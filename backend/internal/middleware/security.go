package middleware

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// SecurityHeaders adds security headers to all responses
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; media-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Permissions-Policy", "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()")
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("X-XSS-Protection", "0")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")

		next.ServeHTTP(w, r)
	})
}

// Logger returns a middleware that logs HTTP requests
func Logger(next http.Handler) http.Handler {
	return middleware.Logger(next)
}

// rateLimitEntry tracks request timestamps for rate limiting
type rateLimitEntry struct {
	requests []time.Time
}

// RateLimiter implements IP-based rate limiting
type RateLimiter struct {
	requests map[string]*rateLimitEntry
	mu       sync.RWMutex
	maxReq   int
	window   time.Duration
}

// RateLimit creates a middleware that limits requests per IP
func RateLimit(maxRequests int, window time.Duration) func(http.Handler) http.Handler {
	limiter := &RateLimiter{
		requests: make(map[string]*rateLimitEntry),
		maxReq:   maxRequests,
		window:   window,
	}

	// Cleanup old entries periodically
	go limiter.cleanup()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
				ip = forwarded
			}

			if !limiter.allow(ip) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "rate limit exceeded",
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func (rl *RateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	entry, exists := rl.requests[ip]
	now := time.Now()

	if !exists {
		rl.requests[ip] = &rateLimitEntry{
			requests: []time.Time{now},
		}
		return true
	}

	// Remove old requests outside the window
	validRequests := make([]time.Time, 0)
	for _, req := range entry.requests {
		if now.Sub(req) < rl.window {
			validRequests = append(validRequests, req)
		}
	}

	if len(validRequests) >= rl.maxReq {
		rl.requests[ip].requests = validRequests
		return false
	}

	validRequests = append(validRequests, now)
	rl.requests[ip].requests = validRequests
	return true
}

func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, entry := range rl.requests {
			valid := make([]time.Time, 0)
			for _, req := range entry.requests {
				if now.Sub(req) < rl.window {
					valid = append(valid, req)
				}
			}
			if len(valid) == 0 {
				delete(rl.requests, ip)
			} else {
				rl.requests[ip].requests = valid
			}
		}
		rl.mu.Unlock()
	}
}
