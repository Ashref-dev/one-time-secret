package validation

import (
	"encoding/base64"
	"errors"
	"fmt"
	"regexp"
	"time"
)

var (
	// ErrInvalidCiphertext indicates invalid ciphertext format
	ErrInvalidCiphertext = errors.New("invalid ciphertext format")
	// ErrInvalidIV indicates invalid IV format
	ErrInvalidIV = errors.New("invalid IV format")
	// ErrInvalidSalt indicates invalid salt format
	ErrInvalidSalt = errors.New("invalid salt format")
	// ErrInvalidSecretID indicates invalid secret ID
	ErrInvalidSecretID = errors.New("invalid secret ID")
	// ErrInvalidTTL indicates invalid TTL value
	ErrInvalidTTL = errors.New("invalid TTL value")
	// ErrSecretTooLarge indicates secret exceeds maximum size
	ErrSecretTooLarge = errors.New("secret exceeds maximum size")
)

const (
	MaxSecretSize   = 32768 // 32KB
	MinSecretSize   = 1
	MaxTTL          = 24 * time.Hour
	MinTTL          = 5 * time.Minute
	SecretIDPattern = `^[A-Za-z0-9_-]{22}$` // Base64URL encoding of 16 bytes
)

var secretIDRegex = regexp.MustCompile(SecretIDPattern)

// CreateSecretRequest represents the validated create request
type CreateSecretRequest struct {
	Ciphertext    []byte
	IV            []byte
	Salt          []byte
	ExpiresIn     time.Duration
	BurnAfterRead bool
}

// ValidateCreateRequest validates a secret creation request
func ValidateCreateRequest(ciphertextB64, ivB64, saltB64 string, expiresIn int, maxSize int) (*CreateSecretRequest, error) {
	// Validate and decode ciphertext
	if ciphertextB64 == "" {
		return nil, fmt.Errorf("%w: ciphertext is required", ErrInvalidCiphertext)
	}

	ciphertext, err := base64.StdEncoding.DecodeString(ciphertextB64)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidCiphertext, err)
	}

	if len(ciphertext) < MinSecretSize {
		return nil, fmt.Errorf("%w: ciphertext too small", ErrInvalidCiphertext)
	}

	if len(ciphertext) > maxSize {
		return nil, fmt.Errorf("%w: %d bytes (max %d)", ErrSecretTooLarge, len(ciphertext), maxSize)
	}

	// Validate and decode IV
	if ivB64 == "" {
		return nil, fmt.Errorf("%w: IV is required", ErrInvalidIV)
	}

	iv, err := base64.StdEncoding.DecodeString(ivB64)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidIV, err)
	}

	// GCM IV should be 12 bytes
	if len(iv) != 12 {
		return nil, fmt.Errorf("%w: IV must be 12 bytes, got %d", ErrInvalidIV, len(iv))
	}

	// Validate and decode salt (optional)
	var salt []byte
	if saltB64 != "" {
		salt, err = base64.StdEncoding.DecodeString(saltB64)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrInvalidSalt, err)
		}
		// Salt should be at least 16 bytes
		if len(salt) < 16 {
			return nil, fmt.Errorf("%w: salt must be at least 16 bytes", ErrInvalidSalt)
		}
	}

	// Validate TTL
	ttl := time.Duration(expiresIn) * time.Second
	if ttl < MinTTL || ttl > MaxTTL {
		return nil, fmt.Errorf("%w: must be between %v and %v", ErrInvalidTTL, MinTTL, MaxTTL)
	}

	return &CreateSecretRequest{
		Ciphertext:    ciphertext,
		IV:            iv,
		Salt:          salt,
		ExpiresIn:     ttl,
		BurnAfterRead: true, // Always burn after read for security
	}, nil
}

// ValidateSecretID validates a secret ID format
func ValidateSecretID(id string) error {
	if id == "" {
		return fmt.Errorf("%w: empty", ErrInvalidSecretID)
	}

	if !secretIDRegex.MatchString(id) {
		return fmt.Errorf("%w: invalid format", ErrInvalidSecretID)
	}

	return nil
}
