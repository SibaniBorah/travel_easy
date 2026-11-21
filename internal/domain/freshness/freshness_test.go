package freshness_test

import (
	"testing"
	"time"

	"chaloner/internal/domain/freshness"
)

func TestCheckFreshness(t *testing.T) {
	now := time.Now()

	// Zero expiresAt -> Fresh
	if status := freshness.CheckFreshness(now, time.Time{}); status != freshness.Fresh {
		t.Errorf("Expected Fresh for zero time, got %v", status)
	}

	// 30 days in future -> Fresh
	if status := freshness.CheckFreshness(now, now.Add(30*24*time.Hour)); status != freshness.Fresh {
		t.Errorf("Expected Fresh for +30d, got %v", status)
	}

	// 3 days in future -> Stale (< 7 days)
	if status := freshness.CheckFreshness(now, now.Add(3*24*time.Hour)); status != freshness.Stale {
		t.Errorf("Expected Stale for +3d, got %v", status)
	}

	// 2 days in past -> Expired
	if status := freshness.CheckFreshness(now, now.Add(-2*24*time.Hour)); status != freshness.Expired {
		t.Errorf("Expected Expired for -2d, got %v", status)
	}
}

func TestStaleQueue(t *testing.T) {
	now := time.Now()
	items := []freshness.Freshable{
		freshness.DestFreshable{ID: "d1", Name: "Fresh Dest", ExpiresAt: now.Add(40 * 24 * time.Hour)},
		freshness.DestFreshable{ID: "d2", Name: "Stale Dest", ExpiresAt: now.Add(2 * 24 * time.Hour)},
		freshness.DestFreshable{ID: "d3", Name: "Expired Dest", ExpiresAt: now.Add(-5 * 24 * time.Hour)},
	}

	queue := freshness.StaleQueue(items, "destination")
	if len(queue) != 2 {
		t.Fatalf("Expected 2 stale/expired items, got %d", len(queue))
	}

	if queue[0].ID != "d2" || queue[0].Status != freshness.Stale {
		t.Errorf("Expected first item d2 to be Stale, got %v", queue[0])
	}
	if queue[1].ID != "d3" || queue[1].Status != freshness.Expired {
		t.Errorf("Expected second item d3 to be Expired, got %v", queue[1])
	}
}
