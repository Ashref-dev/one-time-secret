package crypto

import (
	"testing"
)

func TestGenerateSecretID(t *testing.T) {
	id, err := GenerateSecretID()
	if err != nil {
		t.Fatalf("GenerateSecretID() error = %v", err)
	}

	// Check length (16 bytes base64url encoded = 22 chars)
	if len(id) != 22 {
		t.Errorf("GenerateSecretID() length = %v, want 22", len(id))
	}

	// Check it's URL safe (no +, /, or =)
	for _, c := range id {
		if c == '+' || c == '/' || c == '=' {
			t.Errorf("GenerateSecretID() contains non-URL-safe char: %c", c)
		}
	}
}

func TestGenerateSecretIDUniqueness(t *testing.T) {
	// Generate 1000 IDs and ensure they're all unique
	ids := make(map[string]bool)
	for i := 0; i < 1000; i++ {
		id, err := GenerateSecretID()
		if err != nil {
			t.Fatalf("GenerateSecretID() error = %v", err)
		}
		if ids[id] {
			t.Errorf("GenerateSecretID() produced duplicate ID: %s", id)
		}
		ids[id] = true
	}
}
