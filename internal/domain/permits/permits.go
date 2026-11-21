// Package permits provides rule matching and checklist generation for travel permits.
package permits

import (
	"strings"
	"time"

	"chaloner/internal/db"
)

// MatchPermits returns all permit rules applicable to a circuit + traveller type.
// travellerType is "indian" or "foreign".
func MatchPermits(circuit []db.Destination, rules []db.PermitRule, travellerType string) []db.PermitRule {
	// Collect state codes in the circuit.
	stateCodes := map[string]bool{}
	for _, d := range circuit {
		stateCodes[strings.ToUpper(d.StateCode)] = true
	}

	var matched []db.PermitRule
	seen := map[string]bool{}
	for _, r := range rules {
		if r.Status == "expired" || r.Status == "draft" {
			continue
		}
		if !stateCodes[strings.ToUpper(r.StateCode)] {
			continue
		}
		// AppliesTo matching.
		switch r.AppliesTo {
		case "all":
			// always applies
		case "indian":
			if travellerType != "indian" {
				continue
			}
		case "foreign":
			if travellerType != "foreign" {
				continue
			}
		default:
			continue
		}
		if seen[r.ID] {
			continue
		}
		seen[r.ID] = true
		matched = append(matched, r)
	}
	return matched
}

// PermitChecklistItem is a printable permit requirement.
type PermitChecklistItem struct {
	State        string    `json:"state"`
	PermitType   string    `json:"permit_type"`
	Documents    []string  `json:"documents"`
	LeadTimeDays int       `json:"lead_time_days"`
	Fee          int       `json:"fee"`
	OfficialURL  string    `json:"official_url"`
	Notes        string    `json:"notes"`
	Deadline     time.Time `json:"deadline"`
}

// GenerateChecklist produces a printable permit checklist from matched rules.
func GenerateChecklist(matched []db.PermitRule, startDate time.Time) []PermitChecklistItem {
	items := make([]PermitChecklistItem, 0, len(matched))
	for _, r := range matched {
		deadline := startDate.AddDate(0, 0, -r.LeadTimeDays)
		items = append(items, PermitChecklistItem{
			State:        r.StateCode,
			PermitType:   r.Type,
			Documents:    r.DocumentsRequired,
			LeadTimeDays: r.LeadTimeDays,
			Fee:          r.Fee,
			OfficialURL:  r.OfficialURL,
			Notes:        r.Notes,
			Deadline:     deadline,
		})
	}
	return items
}
