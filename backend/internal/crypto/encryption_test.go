package crypto

import (
	"encoding/base64"
	"testing"
)

func TestEncryptPlaintext(t *testing.T) {
	result, err := EncryptPlaintext([]byte("secret payload"))
	if err != nil {
		t.Fatalf("EncryptPlaintext() error = %v", err)
	}

	if len(result.Ciphertext) == 0 {
		t.Fatal("EncryptPlaintext() returned empty ciphertext")
	}

	if len(result.IV) != gcmNonceSize {
		t.Fatalf("EncryptPlaintext() iv length = %d, want %d", len(result.IV), gcmNonceSize)
	}

	if result.ShareKey == "" {
		t.Fatal("EncryptPlaintext() returned empty share key")
	}

	key, err := base64.StdEncoding.DecodeString(result.ShareKey)
	if err != nil {
		t.Fatalf("DecodeString() error = %v", err)
	}

	if len(key) != aesKeySize {
		t.Fatalf("share key length = %d, want %d", len(key), aesKeySize)
	}
}

func TestEncryptPlaintextWithPassphrase(t *testing.T) {
	result, err := EncryptPlaintextWithPassphrase([]byte("secret payload"), "correct horse battery staple")
	if err != nil {
		t.Fatalf("EncryptPlaintextWithPassphrase() error = %v", err)
	}

	if len(result.Ciphertext) == 0 {
		t.Fatal("EncryptPlaintextWithPassphrase() returned empty ciphertext")
	}

	if len(result.IV) != gcmNonceSize {
		t.Fatalf("EncryptPlaintextWithPassphrase() iv length = %d, want %d", len(result.IV), gcmNonceSize)
	}

	if len(result.Salt) != saltSize {
		t.Fatalf("EncryptPlaintextWithPassphrase() salt length = %d, want %d", len(result.Salt), saltSize)
	}

	if result.ShareKey != "" {
		t.Fatal("EncryptPlaintextWithPassphrase() should not return a share key")
	}
}
