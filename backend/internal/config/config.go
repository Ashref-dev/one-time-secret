package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all application configuration
type Config struct {
	DatabaseURL       string
	MaxSecretSize     int
	DefaultTTL        time.Duration
	CleanupInterval   time.Duration
	RateLimitRequests int
	RateLimitWindow   time.Duration
	Environment       string
}

// Load creates a new Config from environment variables
func Load() *Config {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://ots_user:ots_password@localhost:5432/ots?sslmode=disable"
	}

	maxSize, _ := strconv.Atoi(os.Getenv("MAX_SECRET_SIZE"))
	if maxSize == 0 {
		maxSize = 32768 // 32KB default
	}

	defaultTTL, _ := strconv.Atoi(os.Getenv("DEFAULT_TTL"))
	if defaultTTL == 0 {
		defaultTTL = 3600 // 1 hour default
	}

	cleanupInterval, _ := strconv.Atoi(os.Getenv("CLEANUP_INTERVAL"))
	if cleanupInterval == 0 {
		cleanupInterval = 300 // 5 minutes
	}

	rateLimitRequests, _ := strconv.Atoi(os.Getenv("RATE_LIMIT_REQUESTS"))
	if rateLimitRequests == 0 {
		rateLimitRequests = 30
	}

	rateLimitWindow, _ := strconv.Atoi(os.Getenv("RATE_LIMIT_WINDOW"))
	if rateLimitWindow == 0 {
		rateLimitWindow = 60
	}

	env := os.Getenv("ENV")
	if env == "" {
		env = "development"
	}

	return &Config{
		DatabaseURL:       dbURL,
		MaxSecretSize:     maxSize,
		DefaultTTL:        time.Duration(defaultTTL) * time.Second,
		CleanupInterval:   time.Duration(cleanupInterval) * time.Second,
		RateLimitRequests: rateLimitRequests,
		RateLimitWindow:   time.Duration(rateLimitWindow) * time.Second,
		Environment:       env,
	}
}
