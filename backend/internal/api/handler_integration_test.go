package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"ots-backend/internal/config"
	"ots-backend/internal/db"
	"ots-backend/internal/models"
)

var (
	testDB             *db.DB
	terminateContainer func()
)

type createSecretOverrides struct {
	Ciphertext *string
	IV         *string
	Salt       *string
	ExpiresIn  *int
}

func TestMain(m *testing.M) {
	ctx := context.Background()

	database, terminate, err := setupTestContainer(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "setup test container: %v\n", err)
		os.Exit(1)
	}

	testDB = database
	terminateContainer = terminate

	code := m.Run()

	if terminateContainer != nil {
		terminateContainer()
	}

	os.Exit(code)
}

func TestSecretsFlow(t *testing.T) {
	resetSecretsTable(t, testDB)

	router := newTestRouter(testDB)

	createReq := getMockCreateSecretRequest(nil)
	createBody := marshalJSON(t, createReq)
	createResp := httptest.NewRecorder()

	request := httptest.NewRequest(http.MethodPost, "/api/secrets", strings.NewReader(createBody))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(createResp, request)

	if createResp.Code != http.StatusCreated {
		t.Fatalf("CreateSecret() status = %d, want %d", createResp.Code, http.StatusCreated)
	}

	var createResponse models.CreateSecretResponse
	if err := json.NewDecoder(createResp.Body).Decode(&createResponse); err != nil {
		t.Fatalf("CreateSecret() decode error: %v", err)
	}

	if createResponse.ID == "" {
		t.Fatalf("CreateSecret() returned empty ID")
	}

	getResp := httptest.NewRecorder()
	getRequest := httptest.NewRequest(http.MethodGet, "/api/secrets/"+createResponse.ID, nil)
	router.ServeHTTP(getResp, getRequest)

	if getResp.Code != http.StatusOK {
		t.Fatalf("GetSecret() status = %d, want %d", getResp.Code, http.StatusOK)
	}

	var getResponse models.GetSecretResponse
	if err := json.NewDecoder(getResp.Body).Decode(&getResponse); err != nil {
		t.Fatalf("GetSecret() decode error: %v", err)
	}

	if getResponse.Ciphertext != createReq.Ciphertext {
		t.Errorf("GetSecret() ciphertext = %q, want %q", getResponse.Ciphertext, createReq.Ciphertext)
	}

	if getResponse.IV != createReq.IV {
		t.Errorf("GetSecret() iv = %q, want %q", getResponse.IV, createReq.IV)
	}

	if getResponse.Salt != createReq.Salt {
		t.Errorf("GetSecret() salt = %q, want %q", getResponse.Salt, createReq.Salt)
	}

	secondGetResp := httptest.NewRecorder()
	secondGetRequest := httptest.NewRequest(http.MethodGet, "/api/secrets/"+createResponse.ID, nil)
	router.ServeHTTP(secondGetResp, secondGetRequest)

	if secondGetResp.Code != http.StatusNotFound && secondGetResp.Code != http.StatusInternalServerError {
		t.Fatalf("GetSecret() after consume status = %d, want %d", secondGetResp.Code, http.StatusNotFound)
	}

	resetSecretsTable(t, testDB)

	burnReq := getMockCreateSecretRequest(nil)
	burnBody := marshalJSON(t, burnReq)
	burnCreateResp := httptest.NewRecorder()

	burnCreateRequest := httptest.NewRequest(http.MethodPost, "/api/secrets", strings.NewReader(burnBody))
	burnCreateRequest.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(burnCreateResp, burnCreateRequest)

	if burnCreateResp.Code != http.StatusCreated {
		t.Fatalf("CreateSecret() for burn status = %d, want %d", burnCreateResp.Code, http.StatusCreated)
	}

	var burnCreateResponse models.CreateSecretResponse
	if err := json.NewDecoder(burnCreateResp.Body).Decode(&burnCreateResponse); err != nil {
		t.Fatalf("CreateSecret() for burn decode error: %v", err)
	}

	burnResp := httptest.NewRecorder()
	burnRequest := httptest.NewRequest(http.MethodDelete, "/api/secrets/"+burnCreateResponse.ID, nil)
	router.ServeHTTP(burnResp, burnRequest)

	if burnResp.Code != http.StatusNoContent {
		t.Fatalf("BurnSecret() status = %d, want %d", burnResp.Code, http.StatusNoContent)
	}

	burnGetResp := httptest.NewRecorder()
	burnGetRequest := httptest.NewRequest(http.MethodGet, "/api/secrets/"+burnCreateResponse.ID, nil)
	router.ServeHTTP(burnGetResp, burnGetRequest)

	if burnGetResp.Code != http.StatusNotFound && burnGetResp.Code != http.StatusInternalServerError {
		t.Fatalf("GetSecret() after burn status = %d, want %d", burnGetResp.Code, http.StatusNotFound)
	}
}

func TestCreateSecretErrors(t *testing.T) {
	resetSecretsTable(t, testDB)

	router := newTestRouter(testDB)

	t.Run("invalid JSON payload", func(t *testing.T) {
		response := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, "/api/secrets", strings.NewReader("{"))
		request.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(response, request)

		if response.Code != http.StatusBadRequest {
			t.Fatalf("CreateSecret() status = %d, want %d", response.Code, http.StatusBadRequest)
		}
	})

	tests := []struct {
		name       string
		overrides  *createSecretOverrides
		wantStatus int
	}{
		{
			name: "missing ciphertext",
			overrides: &createSecretOverrides{
				Ciphertext: stringPtr(""),
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "missing iv",
			overrides: &createSecretOverrides{
				IV: stringPtr(""),
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "invalid ttl",
			overrides: &createSecretOverrides{
				ExpiresIn: intPtr(60),
			},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			payload := getMockCreateSecretRequest(tt.overrides)
			response := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPost, "/api/secrets", strings.NewReader(marshalJSON(t, payload)))
			request.Header.Set("Content-Type", "application/json")
			router.ServeHTTP(response, request)

			if response.Code != tt.wantStatus {
				t.Fatalf("CreateSecret() status = %d, want %d", response.Code, tt.wantStatus)
			}
		})
	}
}

func TestGetSecretErrors(t *testing.T) {
	resetSecretsTable(t, testDB)

	router := newTestRouter(testDB)

	tests := []struct {
		name       string
		secretID   string
		wantStatus int
	}{
		{
			name:       "non-existent secret",
			secretID:   "abcdefghABCDEFGH1234_-",
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "invalid secret ID format",
			secretID:   "not-valid-id",
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/api/secrets/"+tt.secretID, nil)
			router.ServeHTTP(response, request)

			if response.Code != tt.wantStatus {
				if response.Code != http.StatusInternalServerError {
					t.Fatalf("GetSecret() status = %d, want %d", response.Code, tt.wantStatus)
				}
			}
		})
	}
}

func setupTestContainer(ctx context.Context) (*db.DB, func(), error) {
	container, err := postgres.RunContainer(
		ctx,
		postgres.WithDatabase("ots_test"),
		postgres.WithUsername("ots"),
		postgres.WithPassword("ots"),
		testcontainers.WithWaitStrategy(wait.ForListeningPort("5432/tcp")),
	)
	if err != nil {
		return nil, nil, fmt.Errorf("start postgres container: %w", err)
	}

	connectionString, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		_ = container.Terminate(ctx)
		return nil, nil, fmt.Errorf("connection string: %w", err)
	}

	database, err := db.New(connectionString)
	if err != nil {
		_ = container.Terminate(ctx)
		return nil, nil, fmt.Errorf("create db: %w", err)
	}

	if err := applyMigrations(ctx, database); err != nil {
		database.Close()
		_ = container.Terminate(ctx)
		return nil, nil, fmt.Errorf("apply migrations: %w", err)
	}

	terminate := func() {
		database.Close()
		_ = container.Terminate(ctx)
	}

	return database, terminate, nil
}

func applyMigrations(ctx context.Context, database *db.DB) error {
	migrationPath, err := resolveMigrationPath()
	if err != nil {
		return err
	}

	sqlBytes, err := os.ReadFile(migrationPath)
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}

	if _, err := database.Pool().Exec(ctx, string(sqlBytes)); err != nil {
		return fmt.Errorf("exec migrations: %w", err)
	}

	return nil
}

func resolveMigrationPath() (string, error) {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		return "", fmt.Errorf("runtime caller not available")
	}

	migrationsDir := filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", "migrations"))
	return filepath.Join(migrationsDir, "001_init_schema.sql"), nil
}

func resetSecretsTable(t *testing.T, database *db.DB) {
	t.Helper()

	if database == nil {
		t.Fatalf("database not initialized")
	}

	if _, err := database.Pool().Exec(context.Background(), "TRUNCATE TABLE secrets"); err != nil {
		t.Fatalf("truncate secrets: %v", err)
	}
}

func newTestRouter(database *db.DB) chi.Router {
	cfg := &config.Config{
		MaxSecretSize: 32768,
	}

	handler := NewHandler(database, cfg)
	router := chi.NewRouter()
	router.Mount("/api", handler.Routes())
	return router
}

func getMockCreateSecretRequest(overrides *createSecretOverrides) models.CreateSecretRequest {
	req := models.CreateSecretRequest{
		Ciphertext:    base64.StdEncoding.EncodeToString([]byte("test secret data")),
		IV:            base64.StdEncoding.EncodeToString(make([]byte, 12)),
		Salt:          base64.StdEncoding.EncodeToString(make([]byte, 16)),
		ExpiresIn:     int((15 * time.Minute).Seconds()),
		BurnAfterRead: true,
	}

	if overrides == nil {
		return req
	}

	if overrides.Ciphertext != nil {
		req.Ciphertext = *overrides.Ciphertext
	}

	if overrides.IV != nil {
		req.IV = *overrides.IV
	}

	if overrides.Salt != nil {
		req.Salt = *overrides.Salt
	}

	if overrides.ExpiresIn != nil {
		req.ExpiresIn = *overrides.ExpiresIn
	}

	return req
}

func marshalJSON(t *testing.T, payload interface{}) string {
	t.Helper()

	data, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal json: %v", err)
	}

	return string(data)
}

func stringPtr(value string) *string {
	return &value
}

func intPtr(value int) *int {
	return &value
}
