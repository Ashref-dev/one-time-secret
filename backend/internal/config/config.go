package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all application configuration
type Config struct {
	DatabaseURL            string
	MaxSecretSize          int
	DefaultTTL             time.Duration
	AgentDefaultTTL        time.Duration
	CleanupInterval        time.Duration
	WriteRateLimitRequests int
	WriteRateLimitWindow   time.Duration
	ReadRateLimitRequests  int
	ReadRateLimitWindow    time.Duration
	AgentRateLimitRequests int
	AgentRateLimitWindow   time.Duration
	PublicBaseURL          string
	Environment            string
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

	agentDefaultTTL, _ := strconv.Atoi(os.Getenv("AGENT_DEFAULT_TTL"))
	if agentDefaultTTL == 0 {
		agentDefaultTTL = 86400 // 1 day default for agent uploads
	}

	cleanupInterval, _ := strconv.Atoi(os.Getenv("CLEANUP_INTERVAL"))
	if cleanupInterval == 0 {
		cleanupInterval = 300 // 5 minutes
	}

	legacyRateLimitRequests, _ := strconv.Atoi(os.Getenv("RATE_LIMIT_REQUESTS"))
	if legacyRateLimitRequests == 0 {
		legacyRateLimitRequests = 30
	}

	legacyRateLimitWindow, _ := strconv.Atoi(os.Getenv("RATE_LIMIT_WINDOW"))
	if legacyRateLimitWindow == 0 {
		legacyRateLimitWindow = 60
	}

	writeRateLimitRequests, _ := strconv.Atoi(os.Getenv("RATE_LIMIT_WRITE_REQUESTS"))
	if writeRateLimitRequests == 0 {
		writeRateLimitRequests = legacyRateLimitRequests
	}

	writeRateLimitWindow, _ := strconv.Atoi(os.Getenv("RATE_LIMIT_WRITE_WINDOW"))
	if writeRateLimitWindow == 0 {
		writeRateLimitWindow = legacyRateLimitWindow
	}

	readRateLimitRequests, _ := strconv.Atoi(os.Getenv("RATE_LIMIT_READ_REQUESTS"))
	if readRateLimitRequests == 0 {
		readRateLimitRequests = 180
	}

	readRateLimitWindow, _ := strconv.Atoi(os.Getenv("RATE_LIMIT_READ_WINDOW"))
	if readRateLimitWindow == 0 {
		readRateLimitWindow = 60
	}

	agentRateLimitRequests, _ := strconv.Atoi(os.Getenv("RATE_LIMIT_AGENT_REQUESTS"))
	if agentRateLimitRequests == 0 {
		agentRateLimitRequests = 10
	}

	agentRateLimitWindow, _ := strconv.Atoi(os.Getenv("RATE_LIMIT_AGENT_WINDOW"))
	if agentRateLimitWindow == 0 {
		agentRateLimitWindow = 60
	}

	env := os.Getenv("ENV")
	if env == "" {
		env = "development"
	}

	publicBaseURL := os.Getenv("PUBLIC_BASE_URL")

	return &Config{
		DatabaseURL:            dbURL,
		MaxSecretSize:          maxSize,
		DefaultTTL:             time.Duration(defaultTTL) * time.Second,
		AgentDefaultTTL:        time.Duration(agentDefaultTTL) * time.Second,
		CleanupInterval:        time.Duration(cleanupInterval) * time.Second,
		WriteRateLimitRequests: writeRateLimitRequests,
		WriteRateLimitWindow:   time.Duration(writeRateLimitWindow) * time.Second,
		ReadRateLimitRequests:  readRateLimitRequests,
		ReadRateLimitWindow:    time.Duration(readRateLimitWindow) * time.Second,
		AgentRateLimitRequests: agentRateLimitRequests,
		AgentRateLimitWindow:   time.Duration(agentRateLimitWindow) * time.Second,
		PublicBaseURL:          publicBaseURL,
		Environment:            env,
	}
}
