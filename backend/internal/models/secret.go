package models

import (
	"time"
)

// Secret represents a stored encrypted secret
type Secret struct {
	ID            string    `json:"id"`
	Ciphertext    []byte    `json:"-"`
	IV            []byte    `json:"-"`
	Salt          []byte    `json:"-"`
	ExpiresAt     time.Time `json:"expires_at"`
	BurnAfterRead bool      `json:"burn_after_read"`
	CreatedAt     time.Time `json:"created_at"`
}

// CreateSecretRequest represents a request to create a new secret
type CreateSecretRequest struct {
	Ciphertext    string `json:"ciphertext"`
	IV            string `json:"iv"`
	Salt          string `json:"salt,omitempty"`
	ExpiresIn     int    `json:"expires_in"`
	BurnAfterRead bool   `json:"burn_after_read"`
}

// AgentCreateSecretRequest represents a convenience request for plaintext uploads.
type AgentCreateSecretRequest struct {
	Content    string `json:"content"`
	Passphrase string `json:"passphrase,omitempty"`
	ExpiresIn  int    `json:"expires_in,omitempty"`
}

// CreateSecretResponse represents the response after creating a secret
type CreateSecretResponse struct {
	ID string `json:"id"`
}

// AgentCreateSecretResponse represents the response for agent plaintext uploads.
type AgentCreateSecretResponse struct {
	ID                 string    `json:"id"`
	URL                string    `json:"url"`
	ExpiresAt          time.Time `json:"expires_at"`
	ExpiresIn          int       `json:"expires_in"`
	PassphraseRequired bool      `json:"passphrase_required"`
}

// GetSecretResponse represents the response when retrieving a secret
type GetSecretResponse struct {
	Ciphertext string `json:"ciphertext"`
	IV         string `json:"iv"`
	Salt       string `json:"salt,omitempty"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}
