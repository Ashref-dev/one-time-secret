package api

import (
	"encoding/json"
	"net/http"
	"runtime"
	"sync"
	"time"

	"ots-backend/internal/logger"
)

// MetricsCollector holds application metrics
type MetricsCollector struct {
	mu sync.RWMutex

	// Request metrics
	RequestCount     int64
	RequestErrors    int64
	RequestDurations []time.Duration

	// Secret metrics
	SecretsCreated   int64
	SecretsRetrieved int64
	SecretsBurned    int64
	SecretsActive    int64

	// Start time for uptime calculation
	startTime time.Time
}

// Global metrics instance
var metrics = &MetricsCollector{
	startTime: time.Now(),
}

// MetricsResponse represents the Prometheus-compatible metrics response
type MetricsResponse struct {
	Uptime             string `json:"uptime"`
	RequestCount       int64  `json:"request_count_total"`
	RequestErrors      int64  `json:"request_errors_total"`
	AvgRequestDuration string `json:"avg_request_duration_ms"`
	SecretsCreated     int64  `json:"secrets_created_total"`
	SecretsRetrieved   int64  `json:"secrets_retrieved_total"`
	SecretsBurned      int64  `json:"secrets_burned_total"`
	ActiveSecrets      int64  `json:"active_secrets"`
	GoRoutines         int    `json:"go_routines"`
	MemoryMB           uint64 `json:"memory_mb"`
}

// RecordRequest records a request
func RecordRequest() {
	metrics.mu.Lock()
	defer metrics.mu.Unlock()
	metrics.RequestCount++
}

// RecordRequestDuration records request duration
func RecordRequestDuration(d time.Duration) {
	metrics.mu.Lock()
	defer metrics.mu.Unlock()
	metrics.RequestDurations = append(metrics.RequestDurations, d)

	// Keep only last 1000 measurements to prevent memory growth
	if len(metrics.RequestDurations) > 1000 {
		metrics.RequestDurations = metrics.RequestDurations[len(metrics.RequestDurations)-1000:]
	}
}

// RecordError records an error
func RecordError() {
	metrics.mu.Lock()
	defer metrics.mu.Unlock()
	metrics.RequestErrors++
}

// RecordSecretCreated records a secret creation
func RecordSecretCreated() {
	metrics.mu.Lock()
	defer metrics.mu.Unlock()
	metrics.SecretsCreated++
	metrics.SecretsActive++
}

// RecordSecretRetrieved records a secret retrieval
func RecordSecretRetrieved() {
	metrics.mu.Lock()
	defer metrics.mu.Unlock()
	metrics.SecretsRetrieved++
}

// RecordSecretBurned records a secret burn
func RecordSecretBurned() {
	metrics.mu.Lock()
	defer metrics.mu.Unlock()
	metrics.SecretsBurned++
}

// SetActiveSecrets sets the current number of active secrets
func SetActiveSecrets(count int64) {
	metrics.mu.Lock()
	defer metrics.mu.Unlock()
	metrics.SecretsActive = count
}

// GetMetrics returns current metrics snapshot
func GetMetrics() MetricsResponse {
	metrics.mu.RLock()
	defer metrics.mu.RUnlock()

	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// Calculate average request duration
	var avgDuration time.Duration
	if len(metrics.RequestDurations) > 0 {
		var total time.Duration
		for _, d := range metrics.RequestDurations {
			total += d
		}
		avgDuration = total / time.Duration(len(metrics.RequestDurations))
	}

	return MetricsResponse{
		Uptime:             time.Since(metrics.startTime).String(),
		RequestCount:       metrics.RequestCount,
		RequestErrors:      metrics.RequestErrors,
		AvgRequestDuration: avgDuration.String(),
		SecretsCreated:     metrics.SecretsCreated,
		SecretsRetrieved:   metrics.SecretsRetrieved,
		SecretsBurned:      metrics.SecretsBurned,
		ActiveSecrets:      metrics.SecretsActive,
		GoRoutines:         runtime.NumGoroutine(),
		MemoryMB:           m.Alloc / 1024 / 1024,
	}
}

// MetricsHandler handles metrics requests
func (h *Handler) MetricsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Update active secrets count from database
	var activeCount int64
	err := h.db.QueryRow(ctx, "SELECT COUNT(*) FROM secrets").Scan(&activeCount)
	if err != nil {
		logger.Error("metrics: failed to get active secrets count", "error", err)
	} else {
		SetActiveSecrets(activeCount)
	}

	resp := GetMetrics()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}

// MetricsMiddleware wraps handlers to collect metrics
func MetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		RecordRequest()

		// Wrap response writer to capture status code
		wrapped := &responseRecorder{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(wrapped, r)

		RecordRequestDuration(time.Since(start))

		if wrapped.statusCode >= 400 {
			RecordError()
		}
	})
}

// responseRecorder wraps http.ResponseWriter to capture status code
type responseRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (rr *responseRecorder) WriteHeader(code int) {
	rr.statusCode = code
	rr.ResponseWriter.WriteHeader(code)
}
