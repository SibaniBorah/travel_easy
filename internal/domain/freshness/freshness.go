// Package freshness provides expiry and stale logic for content entities.
package freshness

import "time"

// FreshnessStatus describes how fresh a content item is.
type FreshnessStatus string

const (
	Fresh   FreshnessStatus = "fresh"
	Stale   FreshnessStatus = "stale"
	Expired FreshnessStatus = "expired"
)

// CheckFreshness computes the freshness of a content item.
// If expiresAt is zero, the item is considered permanently fresh.
// If now is past expiresAt it is Expired.
// If now is within 7 days of expiresAt it is Stale.
// Otherwise it is Fresh.
func CheckFreshness(verifiedAt, expiresAt time.Time) FreshnessStatus {
	if expiresAt.IsZero() {
		return Fresh
	}
	now := time.Now()
	if now.After(expiresAt) {
		return Expired
	}
	if now.Add(7 * 24 * time.Hour).After(expiresAt) {
		return Stale
	}
	return Fresh
}

// StaleItem represents an entity needing refresh.
type StaleItem struct {
	Kind      string          `json:"kind"`
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Status    FreshnessStatus `json:"status"`
	ExpiresAt time.Time       `json:"expires_at"`
}

// Freshable is any entity with ExpiresAt, ID, and a name.
type Freshable interface {
	FreshnessInfo() (id, name string, expiresAt time.Time)
}

// DestinationFreshable wraps a destination for freshness checks.
type DestFreshable struct {
	ID        string
	Name      string
	VerifiedAt time.Time
	ExpiresAt time.Time
}

func (d DestFreshable) FreshnessInfo() (string, string, time.Time) {
	return d.ID, d.Name, d.ExpiresAt
}

// LegFreshable wraps a route leg for freshness checks.
type LegFreshable struct {
	ID        string
	Name      string
	VerifiedAt time.Time
	ExpiresAt time.Time
}

func (l LegFreshable) FreshnessInfo() (string, string, time.Time) {
	return l.ID, l.Name, l.ExpiresAt
}

// PermitFreshable wraps a permit rule for freshness checks.
type PermitFreshable struct {
	ID        string
	Area      string
	VerifiedAt time.Time
	ExpiresAt time.Time
}

func (p PermitFreshable) FreshnessInfo() (string, string, time.Time) {
	return p.ID, p.Area, p.ExpiresAt
}

// StaleQueue returns all items that are Stale or Expired.
func StaleQueue(items []Freshable, kind string) []StaleItem {
	var out []StaleItem
	for _, item := range items {
		id, name, expiresAt := item.FreshnessInfo()
		fs := CheckFreshness(time.Time{}, expiresAt)
		if fs == Stale || fs == Expired {
			out = append(out, StaleItem{
				Kind:      kind,
				ID:        id,
				Name:      name,
				Status:    fs,
				ExpiresAt: expiresAt,
			})
		}
	}
	return out
}
