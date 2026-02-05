package crypto

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
)

const (
	// SecretIDLength is the byte length of secret IDs (128 bits = 16 bytes)
	SecretIDLength = 16
)

// GenerateSecretID generates a cryptographically secure random secret ID
func GenerateSecretID() (string, error) {
	bytes := make([]byte, SecretIDLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate secret ID: %w", err)
	}
	// Use URL-safe base64 encoding
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}
