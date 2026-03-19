package middleware

import (
	"encoding/json"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// SecurityHeaders adds security headers to all responses
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; media-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Permissions-Policy", "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()")
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("X-XSS-Protection", "0")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")

		next.ServeHTTP(w, r)
	})
}

// Logger returns a middleware that logs HTTP requests
func Logger(next http.Handler) http.Handler {
	return middleware.Logger(next)
}

// rateLimitEntry tracks request timestamps for rate limiting
type rateLimitEntry struct {
	requests []time.Time
}

// RateLimiter implements IP-based rate limiting
type RateLimiter struct {
	requests map[string]*rateLimitEntry
	mu       sync.RWMutex
	maxReq   int
	window   time.Duration
}

type rateLimitResult struct {
	Allowed    bool
	Limit      int
	Remaining  int
	RetryAfter time.Duration
}

// RateLimit creates a middleware that limits requests per IP
func RateLimit(maxRequests int, window time.Duration) func(http.Handler) http.Handler {
	limiter := &RateLimiter{
		requests: make(map[string]*rateLimitEntry),
		maxReq:   maxRequests,
		window:   window,
	}

	// Cleanup old entries periodically
	go limiter.cleanup()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := getClientIP(r)
			result := limiter.allow(ip)

			w.Header().Set("X-RateLimit-Limit", strconv.Itoa(result.Limit))
			w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(result.Remaining))

			if !result.Allowed {
				retryAfterSeconds := int(result.RetryAfter.Seconds())
				if retryAfterSeconds < 1 {
					retryAfterSeconds = 1
				}

				w.Header().Set("Retry-After", strconv.Itoa(retryAfterSeconds))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				json.NewEncoder(w).Encode(map[string]string{
					"error":   "rate limit exceeded",
					"message": "too many requests from this IP, please retry later",
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func (rl *RateLimiter) allow(ip string) rateLimitResult {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	entry, exists := rl.requests[ip]
	now := time.Now()

	if !exists {
		rl.requests[ip] = &rateLimitEntry{
			requests: []time.Time{now},
		}
		return rateLimitResult{
			Allowed:   true,
			Limit:     rl.maxReq,
			Remaining: max(rl.maxReq-1, 0),
		}
	}

	// Remove old requests outside the window
	validRequests := make([]time.Time, 0)
	for _, req := range entry.requests {
		if now.Sub(req) < rl.window {
			validRequests = append(validRequests, req)
		}
	}

	if len(validRequests) >= rl.maxReq {
		rl.requests[ip].requests = validRequests
		retryAfter := rl.window
		if len(validRequests) > 0 {
			retryAfter = rl.window - now.Sub(validRequests[0])
		}

		return rateLimitResult{
			Allowed:    false,
			Limit:      rl.maxReq,
			Remaining:  0,
			RetryAfter: retryAfter,
		}
	}

	validRequests = append(validRequests, now)
	rl.requests[ip].requests = validRequests
	return rateLimitResult{
		Allowed:   true,
		Limit:     rl.maxReq,
		Remaining: max(rl.maxReq-len(validRequests), 0),
	}
}

func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, entry := range rl.requests {
			valid := make([]time.Time, 0)
			for _, req := range entry.requests {
				if now.Sub(req) < rl.window {
					valid = append(valid, req)
				}
			}
			if len(valid) == 0 {
				delete(rl.requests, ip)
			} else {
				rl.requests[ip].requests = valid
			}
		}
		rl.mu.Unlock()
	}
}

func getClientIP(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}

	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); realIP != "" {
		return realIP
	}

	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil {
		return host
	}

	return strings.TrimSpace(r.RemoteAddr)
}

func max(a, b int) int {
	if a > b {
		return a
	}

	return b
}
