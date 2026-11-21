package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"chaloner/internal/db"
)

func NewRouter(store *db.Store, adminToken string, staticDir string) http.Handler {
	mux := http.NewServeMux()
	h := NewHandler(store, adminToken)

	// ── API v1 routes ─────────────────────────────────────────────────────────
	mux.HandleFunc("/api/v1/states", h.handleStates)
	mux.HandleFunc("/api/v1/states/", h.handleStateDetail)
	mux.HandleFunc("/api/v1/destinations", h.handleDestinations)
	mux.HandleFunc("/api/v1/destinations/", h.handleDestinationDetail)
	mux.HandleFunc("/api/v1/route-legs", h.handleRouteLegs)
	mux.HandleFunc("/api/v1/permits", h.handlePermits)
	mux.HandleFunc("/api/v1/itineraries", h.handleItineraries)
	mux.HandleFunc("/api/v1/itineraries/", h.handleItineraryDetail)
	mux.HandleFunc("/api/v1/events", h.handleEvents)
	mux.HandleFunc("/api/v1/homestays", h.handleHomestays)
	mux.HandleFunc("/api/v1/stats", h.handleStats)
	mux.HandleFunc("/api/v1/plan", h.handlePlan)
	mux.HandleFunc("/api/v1/budget", h.handleBudget)
	mux.HandleFunc("/api/v1/trips", h.handleTrips)
	mux.HandleFunc("/api/v1/trips/", h.handleTripDetail)
	mux.HandleFunc("/api/v1/tips", h.handleTips)
	mux.HandleFunc("/api/v1/tips/", h.handleTipUpvote)
	mux.HandleFunc("/api/v1/reports", h.handleReports)
	mux.HandleFunc("/api/v1/reviews", h.handleReviews)
	mux.HandleFunc("/api/v1/auth/login", h.handleAuthLogin)
	mux.HandleFunc("/api/v1/auth/me", h.handleAuthMe)
	mux.HandleFunc("/api/v1/auth/logout", h.handleAuthLogout)
	mux.HandleFunc("/api/v1/admin/stale", h.handleAdminStale)

	// ── Backward-compatible legacy aliases ────────────────────────────────────
	mux.HandleFunc("/api/states", h.handleStates)
	mux.HandleFunc("/api/states/", h.handleStateDetail)
	mux.HandleFunc("/api/destinations", h.handleDestinations)
	mux.HandleFunc("/api/destinations/", h.handleDestinationDetail)
	mux.HandleFunc("/api/transit", h.handleRouteLegs)
	mux.HandleFunc("/api/permits", h.handlePermits)
	mux.HandleFunc("/api/itineraries", h.handleItineraries)
	mux.HandleFunc("/api/itineraries/", h.handleItineraryDetail)
	mux.HandleFunc("/api/events", h.handleEvents)
	mux.HandleFunc("/api/homestays", h.handleHomestays)
	mux.HandleFunc("/api/plan", h.handlePlan)
	mux.HandleFunc("/api/stats", h.handleStats)
	mux.HandleFunc("/api/calculate-budget", h.handleBudget)
	mux.HandleFunc("/api/custom-trips", h.handleTrips)
	mux.HandleFunc("/api/custom-trips/", h.handleTripDetail)
	mux.HandleFunc("/api/tips", h.handleTips)
	mux.HandleFunc("/api/tips/", h.handleTipUpvote)
	mux.HandleFunc("/api/reviews", h.handleReviews)
	mux.HandleFunc("/api/reports", h.handleReports)
	mux.HandleFunc("/api/auth/login", h.handleAuthLogin)
	mux.HandleFunc("/api/auth/me", h.handleAuthMe)
	mux.HandleFunc("/api/auth/logout", h.handleAuthLogout)

	// ── Static Files & SPA fallback ───────────────────────────────────────────
	fileServer := http.FileServer(http.Dir(staticDir))

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}

		cleanPath := filepath.Clean(r.URL.Path)
		filePath := filepath.Join(staticDir, cleanPath)

		// Check if file exists
		info, err := os.Stat(filePath)
		if err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}

		// Fallback to index.html for SPA routing
		http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
	})

	return corsMiddleware(mux)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
