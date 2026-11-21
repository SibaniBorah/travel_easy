package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"time"

	"chaloner/internal/api"
	"chaloner/internal/content"
	"chaloner/internal/db"
)

func main() {
	port := flag.String("port", "8000", "HTTP server port")
	dataDir := flag.String("data", "./data", "Directory for JSON data files")
	staticDir := flag.String("static", "./static", "Directory for static assets")
	adminToken := flag.String("admin-token", os.Getenv("ADMIN_TOKEN"), "Admin API token")
	flag.Parse()

	log.Println("─────────────────────────────────────────────────────────────")
	log.Println(" 🌲 Chalo NorthEast — SevenSisters Discovery & Trip Planner")
	log.Println("─────────────────────────────────────────────────────────────")

	// 1. Initialize schema & data directory
	if err := db.InitSchema(*dataDir); err != nil {
		log.Fatalf("Failed to initialize schema: %v", err)
	}

	store := db.NewStore(*dataDir)

	// 2. Seed database if empty
	if err := content.SeedIfEmpty(store); err != nil {
		log.Fatalf("Failed to seed initial data: %v", err)
	}
	log.Println("✓ Verified content & domain data seeded successfully")

	// 3. Build router
	router := api.NewRouter(store, *adminToken, *staticDir)

	server := &http.Server{
		Addr:         ":" + *port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("✓ Server listening on http://127.0.0.1:%s", *port)
	log.Printf("✓ Serving static PWA from: %s", *staticDir)
	log.Printf("✓ Data store rooted at: %s", *dataDir)

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server stopped unexpectedly: %v", err)
	}
}
