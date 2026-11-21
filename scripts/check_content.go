package main

import (
	"fmt"
	"os"
	"time"

	"chaloner/internal/content"
	"chaloner/internal/db"
)

func main() {
	fmt.Println("─────────────────────────────────────────────────────────────")
	fmt.Println(" 🛡️  Chalo NorthEast — CI Content Verification Gate")
	fmt.Println("─────────────────────────────────────────────────────────────")

	dataDir := "./data"
	if err := db.InitSchema(dataDir); err != nil {
		fmt.Fprintf(os.Stderr, "FATAL: init schema failed: %v\n", err)
		os.Exit(1)
	}

	store := db.NewStore(dataDir)
	if err := content.SeedIfEmpty(store); err != nil {
		fmt.Fprintf(os.Stderr, "FATAL: seed failed: %v\n", err)
		os.Exit(1)
	}

	now := time.Now()
	violations := 0

	// 1. Check Destinations
	dests, err := store.ListDestinations(nil)
	if err != nil {
		fmt.Fprintf(os.Stderr, "FATAL: list destinations: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("🔍 Checking %d destinations...\n", len(dests))
	for _, d := range dests {
		if d.Status == "published" {
			if d.SourceID == "" {
				fmt.Printf("  ❌ Destination %s (%s): missing source_id\n", d.Slug, d.Name)
				violations++
			}
			if d.VerifiedAt.IsZero() {
				fmt.Printf("  ❌ Destination %s (%s): missing verified_at date\n", d.Slug, d.Name)
				violations++
			}
			if !d.ExpiresAt.IsZero() && now.After(d.ExpiresAt) {
				fmt.Printf("  ⚠️  Destination %s (%s): expired at %s\n", d.Slug, d.Name, d.ExpiresAt.Format("2006-01-02"))
				violations++
			}
		}
	}

	// 2. Check Permit Rules
	permits, err := store.ListPermitRules("", "")
	if err != nil {
		fmt.Fprintf(os.Stderr, "FATAL: list permits: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("🔍 Checking %d permit rules...\n", len(permits))
	for _, p := range permits {
		if p.Status == "published" {
			if p.OfficialURL == "" {
				fmt.Printf("  ❌ Permit %s (%s): missing official_url\n", p.ID, p.Area)
				violations++
			}
			if p.VerifiedAt.IsZero() {
				fmt.Printf("  ❌ Permit %s (%s): missing verified_at date\n", p.ID, p.Area)
				violations++
			}
			if !p.ExpiresAt.IsZero() && now.After(p.ExpiresAt) {
				fmt.Printf("  ⚠️  Permit %s (%s): expired at %s\n", p.ID, p.Area, p.ExpiresAt.Format("2006-01-02"))
				violations++
			}
		}
	}

	// 3. Check Route Legs
	legs, err := store.ListRouteLegs("", "", "")
	if err != nil {
		fmt.Fprintf(os.Stderr, "FATAL: list route legs: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("🔍 Checking %d transit route legs...\n", len(legs))
	for _, l := range legs {
		if l.Status == "published" {
			if l.FareMinINR <= 0 {
				fmt.Printf("  ❌ Leg %s → %s: invalid FareMinINR <= 0\n", l.FromSlug, l.ToSlug)
				violations++
			}
			if l.PickupStand == "" {
				fmt.Printf("  ❌ Leg %s → %s: missing pickup_stand\n", l.FromSlug, l.ToSlug)
				violations++
			}
		}
	}

	fmt.Println("─────────────────────────────────────────────────────────────")
	if violations > 0 {
		fmt.Fprintf(os.Stderr, "❌ Content Gate FAILED: %d quality violations found.\n", violations)
		os.Exit(1)
	}

	fmt.Println("✅ Content Gate PASSED: All published records verified and fresh!")
}
