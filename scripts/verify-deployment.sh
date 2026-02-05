#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_URL="${API_URL:-http://localhost:8080}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"

echo "=========================================="
echo "Pre-Deployment Verification Script"
echo "=========================================="
echo ""
echo "API URL: $API_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""

PASS=0
FAIL=0

check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $2"
        ((FAIL++))
    fi
}

echo "1. Checking API Health Endpoints..."
echo "   - Health check"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health" || echo "000")
check $([ "$HTTP_STATUS" = "200" ] && echo 0 || echo 1) "Health endpoint (HTTP $HTTP_STATUS)"

echo "   - Readiness probe"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health/ready" || echo "000")
check $([ "$HTTP_STATUS" = "200" ] && echo 0 || echo 1) "Readiness probe (HTTP $HTTP_STATUS)"

echo "   - Liveness probe"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health/live" || echo "000")
check $([ "$HTTP_STATUS" = "200" ] && echo 0 || echo 1) "Liveness probe (HTTP $HTTP_STATUS)"

echo ""
echo "2. Checking API Functionality..."
echo "   - Create secret"
SECRET_RESPONSE=$(curl -s -X POST "$API_URL/api/secrets" \
    -H "Content-Type: application/json" \
    -d '{"ciphertext":"dGVzdA==","iv":"dGVzdA==","expires_in":3600}' || echo "")

if echo "$SECRET_RESPONSE" | grep -q '"id"'; then
    SECRET_ID=$(echo "$SECRET_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    check 0 "Create secret (ID: ${SECRET_ID:0:8}...)"
else
    check 1 "Create secret"
fi

if [ -n "$SECRET_ID" ]; then
    echo "   - Retrieve secret"
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/secrets/$SECRET_ID" || echo "000")
    check $([ "$HTTP_STATUS" = "200" ] && echo 0 || echo 1) "Retrieve secret (HTTP $HTTP_STATUS)"
    
    echo "   - Secret deletion (one-time read)"
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/secrets/$SECRET_ID" || echo "000")
    check $([ "$HTTP_STATUS" = "404" ] && echo 0 || echo 1) "Secret deleted after read (HTTP $HTTP_STATUS)"
fi

echo ""
echo "3. Checking Metrics Endpoint..."
METRICS_RESPONSE=$(curl -s "$API_URL/api/metrics" || echo "")
if echo "$METRICS_RESPONSE" | grep -q '"uptime"'; then
    check 0 "Metrics endpoint returning data"
else
    check 1 "Metrics endpoint"
fi

echo ""
echo "4. Checking Frontend..."
echo "   - Frontend accessibility"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" || echo "000")
check $([ "$HTTP_STATUS" = "200" ] && echo 0 || echo 1) "Frontend accessible (HTTP $HTTP_STATUS)"

echo ""
echo "5. Checking Database Connection..."
if curl -s "$API_URL/api/health" | grep -q '"database":"ok"'; then
    check 0 "Database connection"
else
    check 1 "Database connection"
fi

echo ""
echo "=========================================="
echo "Verification Complete"
echo "=========================================="
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -gt 0 ]; then
    echo -e "${RED}Deployment verification FAILED${NC}"
    echo "Please fix the issues above before deploying."
    exit 1
else
    echo -e "${GREEN}All checks passed! Ready for deployment.${NC}"
    exit 0
fi
