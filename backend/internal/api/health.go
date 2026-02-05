package api

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"ots-backend/internal/logger"
)

// HealthCheckResponse represents the structure of health check responses
type HealthCheckResponse struct {
	Status    string            `json:"status"`
	Timestamp string            `json:"timestamp"`
	Version   string            `json:"version"`
	Checks    map[string]string `json:"checks"`
}

// checkDatabaseHealth verifies database connectivity with a 5-second timeout
func (h *Handler) checkDatabaseHealth(ctx context.Context) string {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := h.db.Health(ctx); err != nil {
		logger.Warn("database health check failed", "error", err.Error())
		return "down"
	}
	return "ok"
}

// HealthCheck returns full health status (503 if any dependency is down)
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	dbHealth := h.checkDatabaseHealth(r.Context())

	statusCode := http.StatusOK
	status := "healthy"
	if dbHealth != "ok" {
		statusCode = http.StatusServiceUnavailable
		status = "unhealthy"
	}

	resp := HealthCheckResponse{
		Status:    status,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Version:   "1.0.0",
		Checks: map[string]string{
			"database": dbHealth,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(resp)

	logger.Info("health check", "status", status, "database", dbHealth)
}

// ReadinessProbe checks if the service is ready to accept traffic (503 if not ready)
func (h *Handler) ReadinessProbe(w http.ResponseWriter, r *http.Request) {
	dbHealth := h.checkDatabaseHealth(r.Context())

	statusCode := http.StatusOK
	status := "ready"
	if dbHealth != "ok" {
		statusCode = http.StatusServiceUnavailable
		status = "not_ready"
	}

	resp := HealthCheckResponse{
		Status:    status,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Version:   "1.0.0",
		Checks: map[string]string{
			"database": dbHealth,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(resp)

	logger.Info("readiness probe", "status", status, "database", dbHealth)
}

// LivenessProbe checks if the service process is running (always returns 200)
func (h *Handler) LivenessProbe(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "alive"})

	logger.Info("liveness probe")
}
