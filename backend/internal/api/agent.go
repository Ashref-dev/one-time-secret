package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"ots-backend/internal/crypto"
	"ots-backend/internal/logger"
	"ots-backend/internal/models"
	"ots-backend/internal/validation"
)

type parsedAgentCreateRequest struct {
	Content    []byte
	Passphrase string
	ExpiresIn  int
	Source     string
}

func (h *Handler) CreateAgentSecret(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	parsedReq, err := h.parseAgentCreateRequest(r)
	if err != nil {
		logger.Warn("invalid agent request", "error", err, "ip", r.RemoteAddr)
		h.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	expiresIn := parsedReq.ExpiresIn
	if expiresIn == 0 {
		expiresIn = int(h.cfg.AgentDefaultTTL.Seconds())
	}

	if err := validation.ValidatePlaintextContent(parsedReq.Content, h.cfg.MaxSecretSize); err != nil {
		logger.Warn("invalid agent secret content", "error", err, "ip", r.RemoteAddr)
		h.respondValidationError(w, err)
		return
	}

	ttl, err := validation.ValidateTTL(expiresIn)
	if err != nil {
		logger.Warn("invalid agent ttl", "error", err, "ip", r.RemoteAddr)
		h.respondValidationError(w, err)
		return
	}

	var encryptedSecret *crypto.EncryptedSecret
	if parsedReq.Passphrase != "" {
		encryptedSecret, err = crypto.EncryptPlaintextWithPassphrase(parsedReq.Content, parsedReq.Passphrase)
	} else {
		encryptedSecret, err = crypto.EncryptPlaintext(parsedReq.Content)
	}
	if err != nil {
		logger.Error("failed to encrypt agent secret", "error", err)
		h.respondError(w, http.StatusInternalServerError, "failed to encrypt secret")
		return
	}

	validatedReq, err := validation.ValidateEncryptedPayload(
		encryptedSecret.Ciphertext,
		encryptedSecret.IV,
		encryptedSecret.Salt,
		expiresIn,
		h.cfg.MaxSecretSize,
	)
	if err != nil {
		logger.Warn("invalid encrypted agent payload", "error", err, "ip", r.RemoteAddr)
		h.respondValidationError(w, err)
		return
	}

	secretID, expiresAt, err := h.storeSecret(r, validatedReq)
	if err != nil {
		logger.Error("failed to store agent secret", "error", err)
		h.respondError(w, http.StatusInternalServerError, "failed to store secret")
		return
	}

	shareURL := h.buildShareURL(r, secretID, encryptedSecret.ShareKey)
	resp := models.AgentCreateSecretResponse{
		ID:                 secretID,
		URL:                shareURL,
		ExpiresAt:          expiresAt.UTC(),
		ExpiresIn:          int(ttl.Seconds()),
		PassphraseRequired: parsedReq.Passphrase != "",
	}

	logger.Info("agent secret created",
		"secret_id", secretID,
		"source", parsedReq.Source,
		"expires_in", ttl,
		"size", len(validatedReq.Ciphertext),
		"duration", time.Since(start),
		"passphrase_required", parsedReq.Passphrase != "",
		"ip", r.RemoteAddr,
	)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) parseAgentCreateRequest(r *http.Request) (*parsedAgentCreateRequest, error) {
	contentType := r.Header.Get("Content-Type")
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		return nil, fmt.Errorf("invalid content type")
	}

	switch mediaType {
	case "application/json":
		return h.parseAgentJSONRequest(r)
	case "multipart/form-data":
		return h.parseAgentMultipartRequest(r)
	case "application/x-www-form-urlencoded":
		return h.parseAgentFormRequest(r)
	case "", "text/plain":
		return h.parseAgentTextRequest(r)
	default:
		return nil, fmt.Errorf("unsupported content type: %s", mediaType)
	}
}

func (h *Handler) parseAgentJSONRequest(r *http.Request) (*parsedAgentCreateRequest, error) {
	decoder := json.NewDecoder(io.LimitReader(r.Body, int64(h.cfg.MaxSecretSize)+1024))
	decoder.DisallowUnknownFields()

	var req models.AgentCreateSecretRequest
	if err := decoder.Decode(&req); err != nil {
		return nil, fmt.Errorf("invalid JSON body")
	}

	return &parsedAgentCreateRequest{
		Content:    []byte(req.Content),
		Passphrase: req.Passphrase,
		ExpiresIn:  req.ExpiresIn,
		Source:     "json",
	}, nil
}

func (h *Handler) parseAgentMultipartRequest(r *http.Request) (*parsedAgentCreateRequest, error) {
	if err := r.ParseMultipartForm(int64(h.cfg.MaxSecretSize) * 2); err != nil {
		return nil, fmt.Errorf("invalid multipart form")
	}

	var content []byte
	source := "multipart-content"

	if file, _, err := r.FormFile("file"); err == nil {
		defer file.Close()

		content, err = io.ReadAll(io.LimitReader(file, int64(h.cfg.MaxSecretSize)+1))
		if err != nil {
			return nil, fmt.Errorf("failed to read uploaded file")
		}

		if len(content) > h.cfg.MaxSecretSize {
			return nil, fmt.Errorf("%w: %d bytes (max %d)", validation.ErrSecretTooLarge, len(content), h.cfg.MaxSecretSize)
		}

		source = "multipart-file"
	} else if contentValue := r.FormValue("content"); contentValue != "" {
		content = []byte(contentValue)
	} else {
		return nil, fmt.Errorf("provide either a content field or a file upload")
	}

	if !utf8.Valid(content) {
		return nil, fmt.Errorf("uploaded content must be valid UTF-8 text")
	}

	expiresIn, err := parseOptionalInt(r.FormValue("expires_in"))
	if err != nil {
		return nil, err
	}

	return &parsedAgentCreateRequest{
		Content:    content,
		Passphrase: r.FormValue("passphrase"),
		ExpiresIn:  expiresIn,
		Source:     source,
	}, nil
}

func (h *Handler) parseAgentFormRequest(r *http.Request) (*parsedAgentCreateRequest, error) {
	if err := r.ParseForm(); err != nil {
		return nil, fmt.Errorf("invalid form body")
	}

	content := []byte(r.FormValue("content"))
	if len(content) == 0 {
		return nil, fmt.Errorf("content is required")
	}

	expiresIn, err := parseOptionalInt(r.FormValue("expires_in"))
	if err != nil {
		return nil, err
	}

	return &parsedAgentCreateRequest{
		Content:    content,
		Passphrase: r.FormValue("passphrase"),
		ExpiresIn:  expiresIn,
		Source:     "form",
	}, nil
}

func (h *Handler) parseAgentTextRequest(r *http.Request) (*parsedAgentCreateRequest, error) {
	content, err := io.ReadAll(io.LimitReader(r.Body, int64(h.cfg.MaxSecretSize)+1))
	if err != nil {
		return nil, fmt.Errorf("failed to read request body")
	}

	if len(content) > h.cfg.MaxSecretSize {
		return nil, fmt.Errorf("%w: %d bytes (max %d)", validation.ErrSecretTooLarge, len(content), h.cfg.MaxSecretSize)
	}

	expiresIn, err := parseOptionalInt(r.Header.Get("X-Secret-Expires-In"))
	if err != nil {
		return nil, err
	}

	return &parsedAgentCreateRequest{
		Content:    bytes.TrimPrefix(content, []byte("\ufeff")),
		Passphrase: r.Header.Get("X-Secret-Passphrase"),
		ExpiresIn:  expiresIn,
		Source:     "text",
	}, nil
}

func (h *Handler) buildShareURL(r *http.Request, secretID, shareKey string) string {
	baseURL := strings.TrimRight(h.cfg.PublicBaseURL, "/")
	if baseURL == "" {
		scheme := r.Header.Get("X-Forwarded-Proto")
		if scheme == "" {
			if r.TLS != nil {
				scheme = "https"
			} else {
				scheme = "http"
			}
		}

		host := strings.TrimSpace(r.Host)
		if forwardedHost := strings.TrimSpace(r.Header.Get("X-Forwarded-Host")); forwardedHost != "" {
			host = forwardedHost
		}

		baseURL = fmt.Sprintf("%s://%s", scheme, host)
	}

	shareURL := fmt.Sprintf("%s/s/%s", baseURL, secretID)
	if shareKey != "" {
		shareURL += "#" + shareKey
	}

	return shareURL
}

func parseOptionalInt(value string) (int, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return 0, nil
	}

	parsedValue, err := strconv.Atoi(trimmed)
	if err != nil {
		return 0, fmt.Errorf("expires_in must be an integer number of seconds")
	}

	return parsedValue, nil
}
