package api

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"ots-backend/internal/config"
	"ots-backend/internal/crypto"
	"ots-backend/internal/db"
	"ots-backend/internal/logger"
	"ots-backend/internal/models"
	"ots-backend/internal/validation"
)

// Handler handles API requests
type Handler struct {
	db  *db.DB
	cfg *config.Config
}

// NewHandler creates a new API handler
func NewHandler(database *db.DB, cfg *config.Config) *Handler {
	return &Handler{
		db:  database,
		cfg: cfg,
	}
}

// Routes returns the router for API endpoints
func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/health", h.HealthCheck)
	r.Get("/health/ready", h.ReadinessProbe)
	r.Get("/health/live", h.LivenessProbe)
	r.Get("/metrics", h.MetricsHandler)
	r.Post("/secrets", h.CreateSecret)
	r.Get("/secrets/{id}", h.GetSecret)
	r.Delete("/secrets/{id}", h.BurnSecret)

	return r
}

// CreateSecret handles secret creation
func (h *Handler) CreateSecret(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req models.CreateSecretRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Warn("invalid request body", "error", err, "ip", r.RemoteAddr)
		h.respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate request using validation package
	validatedReq, err := validation.ValidateCreateRequest(
		req.Ciphertext,
		req.IV,
		req.Salt,
		req.ExpiresIn,
		h.cfg.MaxSecretSize,
	)
	if err != nil {
		logger.Warn("validation failed", "error", err, "ip", r.RemoteAddr)

		status := http.StatusBadRequest
		if errors.Is(err, validation.ErrSecretTooLarge) {
			status = http.StatusRequestEntityTooLarge
		}

		h.respondError(w, status, err.Error())
		return
	}

	// Generate secret ID
	secretID, err := crypto.GenerateSecretID()
	if err != nil {
		logger.Error("failed to generate secret ID", "error", err)
		h.respondError(w, http.StatusInternalServerError, "failed to generate secret ID")
		return
	}

	// Store in database
	ctx := r.Context()
	expiresAt := time.Now().Add(validatedReq.ExpiresIn)

	_, err = h.db.Pool().Exec(ctx, `
		INSERT INTO secrets (id, ciphertext, iv, salt, expires_at, burn_after_read, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, secretID, validatedReq.Ciphertext, validatedReq.IV, validatedReq.Salt, expiresAt, validatedReq.BurnAfterRead, time.Now())

	if err != nil {
		logger.Error("failed to store secret", "error", err, "secret_id", secretID)
		h.respondError(w, http.StatusInternalServerError, "failed to store secret")
		return
	}

	logger.Info("secret created",
		"secret_id", secretID,
		"expires_in", validatedReq.ExpiresIn,
		"size", len(validatedReq.Ciphertext),
		"duration", time.Since(start),
		"ip", r.RemoteAddr,
	)

	// Return response
	resp := models.CreateSecretResponse{
		ID: secretID,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

// GetSecret handles secret retrieval (atomic consume)
func (h *Handler) GetSecret(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	secretID := chi.URLParam(r, "id")

	// Validate ID format
	if err := validation.ValidateSecretID(secretID); err != nil {
		logger.Warn("invalid secret ID format", "error", err, "ip", r.RemoteAddr)
		h.respondError(w, http.StatusNotFound, "not found")
		return
	}

	ctx := r.Context()

	// Start transaction for atomic consume
	tx, err := h.db.Pool().Begin(ctx)
	if err != nil {
		logger.Error("failed to begin transaction", "error", err)
		h.respondError(w, http.StatusInternalServerError, "database error")
		return
	}
	defer tx.Rollback(ctx)

	// Lock the row and retrieve secret
	var secret models.Secret
	var ciphertext, iv, salt []byte

	err = tx.QueryRow(ctx, `
		SELECT id, ciphertext, iv, salt, expires_at, burn_after_read, created_at
		FROM secrets
		WHERE id = $1
		FOR UPDATE
	`, secretID).Scan(&secret.ID, &ciphertext, &iv, &salt, &secret.ExpiresAt, &secret.BurnAfterRead, &secret.CreatedAt)

	if err != nil {
		if errors.Is(err, errors.New("no rows in result set")) {
			h.respondError(w, http.StatusNotFound, "not found")
		} else {
			logger.Error("database query failed", "error", err, "secret_id", secretID)
			h.respondError(w, http.StatusInternalServerError, "database error")
		}
		return
	}

	// Check expiration
	if time.Now().After(secret.ExpiresAt) {
		// Delete expired secret
		_, _ = tx.Exec(ctx, `DELETE FROM secrets WHERE id = $1`, secretID)
		if err := tx.Commit(ctx); err != nil {
			logger.Error("failed to commit expiration cleanup", "error", err)
			h.respondError(w, http.StatusInternalServerError, "database error")
			return
		}
		h.respondError(w, http.StatusNotFound, "not found")
		return
	}

	// Delete the secret (atomic consume)
	_, err = tx.Exec(ctx, `DELETE FROM secrets WHERE id = $1`, secretID)
	if err != nil {
		logger.Error("failed to delete secret", "error", err, "secret_id", secretID)
		h.respondError(w, http.StatusInternalServerError, "database error")
		return
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		logger.Error("failed to commit transaction", "error", err, "secret_id", secretID)
		h.respondError(w, http.StatusInternalServerError, "database error")
		return
	}

	logger.Info("secret retrieved",
		"secret_id", secretID,
		"duration", time.Since(start),
		"ip", r.RemoteAddr,
	)

	// Encode response
	resp := models.GetSecretResponse{
		Ciphertext: base64.StdEncoding.EncodeToString(ciphertext),
		IV:         base64.StdEncoding.EncodeToString(iv),
	}

	if len(salt) > 0 {
		resp.Salt = base64.StdEncoding.EncodeToString(salt)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// BurnSecret handles manual secret destruction
func (h *Handler) BurnSecret(w http.ResponseWriter, r *http.Request) {
	secretID := chi.URLParam(r, "id")

	// Validate ID format
	if err := validation.ValidateSecretID(secretID); err != nil {
		h.respondError(w, http.StatusNotFound, "not found")
		return
	}

	ctx := r.Context()

	result, err := h.db.Pool().Exec(ctx, `DELETE FROM secrets WHERE id = $1`, secretID)
	if err != nil {
		logger.Error("failed to burn secret", "error", err, "secret_id", secretID)
		h.respondError(w, http.StatusInternalServerError, "database error")
		return
	}

	if result.RowsAffected() == 0 {
		h.respondError(w, http.StatusNotFound, "not found")
		return
	}

	logger.Info("secret burned", "secret_id", secretID, "ip", r.RemoteAddr)

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) respondError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(models.ErrorResponse{
		Error:   http.StatusText(status),
		Message: message,
	})
}
