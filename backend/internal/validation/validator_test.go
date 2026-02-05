package validation

import (
	"encoding/base64"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestValidateCreateRequest(t *testing.T) {
	// Valid ciphertext (base64 of "test")
	validCiphertext := base64.StdEncoding.EncodeToString([]byte("test secret data"))
	// Valid IV (12 bytes for GCM)
	validIV := base64.StdEncoding.EncodeToString(make([]byte, 12))
	// Valid salt (16 bytes minimum)
	validSalt := base64.StdEncoding.EncodeToString(make([]byte, 16))

	tests := []struct {
		name       string
		ciphertext string
		iv         string
		salt       string
		expiresIn  int
		maxSize    int
		wantErr    bool
		errType    error
	}{
		{
			name:       "valid request",
			ciphertext: validCiphertext,
			iv:         validIV,
			salt:       validSalt,
			expiresIn:  3600,
			maxSize:    32768,
			wantErr:    false,
		},
		{
			name:       "valid request without salt",
			ciphertext: validCiphertext,
			iv:         validIV,
			salt:       "",
			expiresIn:  3600,
			maxSize:    32768,
			wantErr:    false,
		},
		{
			name:       "empty ciphertext",
			ciphertext: "",
			iv:         validIV,
			expiresIn:  3600,
			maxSize:    32768,
			wantErr:    true,
			errType:    ErrInvalidCiphertext,
		},
		{
			name:       "invalid ciphertext base64",
			ciphertext: "!!!not-valid-base64!!!",
			iv:         validIV,
			expiresIn:  3600,
			maxSize:    32768,
			wantErr:    true,
			errType:    ErrInvalidCiphertext,
		},
		{
			name:       "empty IV",
			ciphertext: validCiphertext,
			iv:         "",
			expiresIn:  3600,
			maxSize:    32768,
			wantErr:    true,
			errType:    ErrInvalidIV,
		},
		{
			name:       "invalid IV size",
			ciphertext: validCiphertext,
			iv:         base64.StdEncoding.EncodeToString(make([]byte, 8)), // Wrong size
			expiresIn:  3600,
			maxSize:    32768,
			wantErr:    true,
			errType:    ErrInvalidIV,
		},
		{
			name:       "secret too large",
			ciphertext: base64.StdEncoding.EncodeToString(make([]byte, 100)),
			iv:         validIV,
			expiresIn:  3600,
			maxSize:    50, // Small limit
			wantErr:    true,
			errType:    ErrSecretTooLarge,
		},
		{
			name:       "TTL too short",
			ciphertext: validCiphertext,
			iv:         validIV,
			expiresIn:  60, // 1 minute
			maxSize:    32768,
			wantErr:    true,
			errType:    ErrInvalidTTL,
		},
		{
			name:       "TTL too long",
			ciphertext: validCiphertext,
			iv:         validIV,
			expiresIn:  int(25 * time.Hour.Seconds()),
			maxSize:    32768,
			wantErr:    true,
			errType:    ErrInvalidTTL,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := ValidateCreateRequest(tt.ciphertext, tt.iv, tt.salt, tt.expiresIn, tt.maxSize)

			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateCreateRequest() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if tt.wantErr && tt.errType != nil {
				if !errors.Is(err, tt.errType) && !strings.Contains(err.Error(), tt.errType.Error()) {
					t.Errorf("ValidateCreateRequest() error type = %v, want %v", err, tt.errType)
				}
			}

			if !tt.wantErr && req == nil {
				t.Error("ValidateCreateRequest() returned nil request without error")
			}
		})
	}
}

func TestValidateSecretID(t *testing.T) {
	tests := []struct {
		name    string
		id      string
		wantErr bool
	}{
		{
			name:    "valid ID",
			id:      "abcdefghABCDEFGH1234_-",
			wantErr: false,
		},
		{
			name:    "empty ID",
			id:      "",
			wantErr: true,
		},
		{
			name:    "too short",
			id:      "abc123",
			wantErr: true,
		},
		{
			name:    "invalid characters (+)",
			id:      "abcdefghABCDEFGH1234++",
			wantErr: true,
		},
		{
			name:    "invalid characters (/)",
			id:      "abcdefghABCDEFGH1234//",
			wantErr: true,
		},
		{
			name:    "invalid characters (=)",
			id:      "abcdefghABCDEFGH1234==",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSecretID(tt.id)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateSecretID() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
