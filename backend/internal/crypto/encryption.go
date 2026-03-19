package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"

	"golang.org/x/crypto/pbkdf2"
)

const (
	aesKeySize       = 32
	gcmNonceSize     = 12
	pbkdf2Iterations = 100000
	saltSize         = 16
)

type EncryptedSecret struct {
	Ciphertext []byte
	IV         []byte
	Salt       []byte
	ShareKey   string
}

func EncryptPlaintext(plaintext []byte) (*EncryptedSecret, error) {
	key := make([]byte, aesKeySize)
	if _, err := rand.Read(key); err != nil {
		return nil, fmt.Errorf("generate key: %w", err)
	}

	ciphertext, iv, err := encrypt(plaintext, key)
	if err != nil {
		return nil, err
	}

	return &EncryptedSecret{
		Ciphertext: ciphertext,
		IV:         iv,
		ShareKey:   base64.StdEncoding.EncodeToString(key),
	}, nil
}

func EncryptPlaintextWithPassphrase(plaintext []byte, passphrase string) (*EncryptedSecret, error) {
	if passphrase == "" {
		return nil, fmt.Errorf("passphrase is required")
	}

	salt := make([]byte, saltSize)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("generate salt: %w", err)
	}

	key := pbkdf2.Key([]byte(passphrase), salt, pbkdf2Iterations, aesKeySize, sha256.New)
	ciphertext, iv, err := encrypt(plaintext, key)
	if err != nil {
		return nil, err
	}

	return &EncryptedSecret{
		Ciphertext: ciphertext,
		IV:         iv,
		Salt:       salt,
	}, nil
}

func encrypt(plaintext, key []byte) ([]byte, []byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, fmt.Errorf("create cipher: %w", err)
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, fmt.Errorf("create gcm: %w", err)
	}

	iv := make([]byte, gcmNonceSize)
	if _, err := rand.Read(iv); err != nil {
		return nil, nil, fmt.Errorf("generate iv: %w", err)
	}

	ciphertext := aead.Seal(nil, iv, plaintext, nil)
	return ciphertext, iv, nil
}
