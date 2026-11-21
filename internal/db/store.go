// Package db provides the JSON-file-backed data store for Chalo NorthEast.
package db

import (
	"fmt"
	"path/filepath"
	"strings"
	"time"
)

// Store provides CRUD operations backed by JSON files.
type Store struct {
	dataDir string
}

// NewStore creates a Store rooted at dataDir (which must already be initialized).
func NewStore(dataDir string) *Store {
	return &Store{dataDir: dataDir}
}

func (s *Store) path(file string) string {
	return filepath.Join(s.dataDir, file)
}

// ── States ────────────────────────────────────────────────────────────────────

func (s *Store) ListStates() ([]State, error) {
	var out []State
	return out, readJSON(s.path("states.json"), &out)
}

func (s *Store) GetState(code string) (*State, error) {
	states, err := s.ListStates()
	if err != nil {
		return nil, err
	}
	for i := range states {
		if strings.EqualFold(states[i].Code, code) {
			return &states[i], nil
		}
	}
	return nil, fmt.Errorf("state %q not found", code)
}

func (s *Store) UpsertState(st State) error {
	states, err := s.ListStates()
	if err != nil {
		return err
	}
	for i := range states {
		if strings.EqualFold(states[i].Code, st.Code) {
			states[i] = st
			return writeJSON(s.path("states.json"), states)
		}
	}
	states = append(states, st)
	return writeJSON(s.path("states.json"), states)
}

// ── Destinations ──────────────────────────────────────────────────────────────

func (s *Store) ListDestinations(filters map[string]string) ([]Destination, error) {
	var all []Destination
	if err := readJSON(s.path("destinations.json"), &all); err != nil {
		return nil, err
	}
	var out []Destination
	for _, d := range all {
		if v, ok := filters["state"]; ok && v != "" && !strings.EqualFold(d.StateCode, v) {
			continue
		}
		if v, ok := filters["category"]; ok && v != "" && d.Category != v {
			continue
		}
		if v, ok := filters["tier"]; ok && v != "" && d.BudgetTier != v {
			continue
		}
		if v, ok := filters["status"]; ok && v != "" && d.Status != v {
			continue
		}
		if v, ok := filters["q"]; ok && v != "" {
			q := strings.ToLower(v)
			if !strings.Contains(strings.ToLower(d.Name), q) &&
				!strings.Contains(strings.ToLower(d.Tagline), q) &&
				!strings.Contains(strings.ToLower(d.Description), q) {
				continue
			}
		}
		out = append(out, d)
	}
	return out, nil
}

func (s *Store) GetDestination(slug string) (*Destination, error) {
	all, err := s.ListDestinations(nil)
	if err != nil {
		return nil, err
	}
	for i := range all {
		if all[i].Slug == slug {
			return &all[i], nil
		}
	}
	return nil, fmt.Errorf("destination %q not found", slug)
}

func (s *Store) UpsertDestination(d Destination) error {
	var all []Destination
	if err := readJSON(s.path("destinations.json"), &all); err != nil {
		return err
	}
	for i := range all {
		if all[i].Slug == d.Slug {
			all[i] = d
			return writeJSON(s.path("destinations.json"), all)
		}
	}
	all = append(all, d)
	return writeJSON(s.path("destinations.json"), all)
}

// ── Route Legs ────────────────────────────────────────────────────────────────

func (s *Store) ListRouteLegs(from, to, state string) ([]RouteLeg, error) {
	var all []RouteLeg
	if err := readJSON(s.path("route_legs.json"), &all); err != nil {
		return nil, err
	}
	var out []RouteLeg
	for _, l := range all {
		if from != "" && l.FromSlug != from {
			continue
		}
		if to != "" && l.ToSlug != to {
			continue
		}
		if state != "" && !strings.EqualFold(l.StateCode, state) {
			continue
		}
		out = append(out, l)
	}
	return out, nil
}

func (s *Store) UpsertRouteLeg(l RouteLeg) error {
	var all []RouteLeg
	if err := readJSON(s.path("route_legs.json"), &all); err != nil {
		return err
	}
	for i := range all {
		if all[i].ID == l.ID {
			all[i] = l
			return writeJSON(s.path("route_legs.json"), all)
		}
	}
	all = append(all, l)
	return writeJSON(s.path("route_legs.json"), all)
}

// ── Permit Rules ──────────────────────────────────────────────────────────────

func (s *Store) ListPermitRules(stateCode, appliesTo string) ([]PermitRule, error) {
	var all []PermitRule
	if err := readJSON(s.path("permit_rules.json"), &all); err != nil {
		return nil, err
	}
	var out []PermitRule
	for _, r := range all {
		if stateCode != "" && !strings.EqualFold(r.StateCode, stateCode) {
			continue
		}
		if appliesTo != "" && r.AppliesTo != appliesTo && r.AppliesTo != "all" {
			continue
		}
		out = append(out, r)
	}
	return out, nil
}

func (s *Store) UpsertPermitRule(r PermitRule) error {
	var all []PermitRule
	if err := readJSON(s.path("permit_rules.json"), &all); err != nil {
		return err
	}
	for i := range all {
		if all[i].ID == r.ID {
			all[i] = r
			return writeJSON(s.path("permit_rules.json"), all)
		}
	}
	all = append(all, r)
	return writeJSON(s.path("permit_rules.json"), all)
}

// ── Events ────────────────────────────────────────────────────────────────────

func (s *Store) ListEvents(stateCode string, month int) ([]Event, error) {
	var all []Event
	if err := readJSON(s.path("events.json"), &all); err != nil {
		return nil, err
	}
	var out []Event
	for _, e := range all {
		if stateCode != "" && !strings.EqualFold(e.StateCode, stateCode) {
			continue
		}
		if month > 0 && e.AnnualMonth != month {
			continue
		}
		out = append(out, e)
	}
	return out, nil
}

func (s *Store) UpsertEvent(e Event) error {
	var all []Event
	if err := readJSON(s.path("events.json"), &all); err != nil {
		return err
	}
	for i := range all {
		if all[i].ID == e.ID {
			all[i] = e
			return writeJSON(s.path("events.json"), all)
		}
	}
	all = append(all, e)
	return writeJSON(s.path("events.json"), all)
}

// ── Budget Estimates ──────────────────────────────────────────────────────────

func (s *Store) ListBudgetEstimates(slug string) ([]BudgetEstimate, error) {
	var all []BudgetEstimate
	if err := readJSON(s.path("budget_estimates.json"), &all); err != nil {
		return nil, err
	}
	if slug == "" {
		return all, nil
	}
	var out []BudgetEstimate
	for _, b := range all {
		if b.DestinationSlug == slug {
			out = append(out, b)
		}
	}
	return out, nil
}

func (s *Store) UpsertBudgetEstimate(b BudgetEstimate) error {
	var all []BudgetEstimate
	if err := readJSON(s.path("budget_estimates.json"), &all); err != nil {
		return err
	}
	for i := range all {
		if all[i].ID == b.ID {
			all[i] = b
			return writeJSON(s.path("budget_estimates.json"), all)
		}
	}
	all = append(all, b)
	return writeJSON(s.path("budget_estimates.json"), all)
}

// ── Itineraries ───────────────────────────────────────────────────────────────

func (s *Store) ListItineraries() ([]Itinerary, error) {
	var out []Itinerary
	return out, readJSON(s.path("itineraries.json"), &out)
}

func (s *Store) GetItinerary(slug string) (*Itinerary, error) {
	all, err := s.ListItineraries()
	if err != nil {
		return nil, err
	}
	for i := range all {
		if all[i].Slug == slug {
			return &all[i], nil
		}
	}
	return nil, fmt.Errorf("itinerary %q not found", slug)
}

func (s *Store) UpsertItinerary(it Itinerary) error {
	var all []Itinerary
	if err := readJSON(s.path("itineraries.json"), &all); err != nil {
		return err
	}
	for i := range all {
		if all[i].Slug == it.Slug {
			all[i] = it
			return writeJSON(s.path("itineraries.json"), all)
		}
	}
	all = append(all, it)
	return writeJSON(s.path("itineraries.json"), all)
}

func (s *Store) ListItineraryDays(itineraryID string) ([]ItineraryDay, error) {
	var all []ItineraryDay
	if err := readJSON(s.path("itinerary_days.json"), &all); err != nil {
		return nil, err
	}
	var out []ItineraryDay
	for _, d := range all {
		if d.ItineraryID == itineraryID {
			out = append(out, d)
		}
	}
	return out, nil
}

func (s *Store) UpsertItineraryDay(d ItineraryDay) error {
	var all []ItineraryDay
	if err := readJSON(s.path("itinerary_days.json"), &all); err != nil {
		return err
	}
	for i := range all {
		if all[i].ID == d.ID {
			all[i] = d
			return writeJSON(s.path("itinerary_days.json"), all)
		}
	}
	all = append(all, d)
	return writeJSON(s.path("itinerary_days.json"), all)
}

// ── Community Tips ────────────────────────────────────────────────────────────

func (s *Store) ListCommunityTips(stateCode string) ([]CommunityTip, error) {
	var all []CommunityTip
	if err := readJSON(s.path("community_tips.json"), &all); err != nil {
		return nil, err
	}
	if stateCode == "" {
		return all, nil
	}
	var out []CommunityTip
	for _, t := range all {
		if strings.EqualFold(t.StateCode, stateCode) {
			out = append(out, t)
		}
	}
	return out, nil
}

func (s *Store) UpsertCommunityTip(t CommunityTip) error {
	var all []CommunityTip
	if err := readJSON(s.path("community_tips.json"), &all); err != nil {
		return err
	}
	for i := range all {
		if all[i].ID == t.ID {
			all[i] = t
			return writeJSON(s.path("community_tips.json"), all)
		}
	}
	all = append(all, t)
	return writeJSON(s.path("community_tips.json"), all)
}

// ── Reports ───────────────────────────────────────────────────────────────────

func (s *Store) UpsertReport(r Report) error {
	var all []Report
	if err := readJSON(s.path("reports.json"), &all); err != nil {
		return err
	}
	for i := range all {
		if all[i].ID == r.ID {
			all[i] = r
			return writeJSON(s.path("reports.json"), all)
		}
	}
	all = append(all, r)
	return writeJSON(s.path("reports.json"), all)
}

// ── Saved Trips ───────────────────────────────────────────────────────────────

func (s *Store) SaveTrip(t SavedTrip) error {
	var all []SavedTrip
	if err := readJSON(s.path("saved_trips.json"), &all); err != nil {
		return err
	}
	all = append(all, t)
	return writeJSON(s.path("saved_trips.json"), all)
}

func (s *Store) GetSavedTrip(shareCode string) (*SavedTrip, error) {
	var all []SavedTrip
	if err := readJSON(s.path("saved_trips.json"), &all); err != nil {
		return nil, err
	}
	for i := range all {
		if all[i].ShareCode == shareCode {
			return &all[i], nil
		}
	}
	return nil, fmt.Errorf("trip %q not found", shareCode)
}

// ── Stale Queue ───────────────────────────────────────────────────────────────

type StaleEntry struct {
	Kind      string    `json:"kind"`
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	ExpiresAt time.Time `json:"expires_at"`
}

func (s *Store) StaleQueue(now time.Time) ([]StaleEntry, error) {
	var out []StaleEntry

	dests, _ := s.ListDestinations(nil)
	for _, d := range dests {
		if !d.ExpiresAt.IsZero() && now.After(d.ExpiresAt) {
			out = append(out, StaleEntry{Kind: "destination", ID: d.ID, Name: d.Name, ExpiresAt: d.ExpiresAt})
		}
	}

	legs, _ := s.ListRouteLegs("", "", "")
	for _, l := range legs {
		if !l.ExpiresAt.IsZero() && now.After(l.ExpiresAt) {
			out = append(out, StaleEntry{Kind: "route_leg", ID: l.ID, Name: l.FromSlug + " → " + l.ToSlug, ExpiresAt: l.ExpiresAt})
		}
	}

	permits, _ := s.ListPermitRules("", "")
	for _, p := range permits {
		if !p.ExpiresAt.IsZero() && now.After(p.ExpiresAt) {
			out = append(out, StaleEntry{Kind: "permit_rule", ID: p.ID, Name: p.Area, ExpiresAt: p.ExpiresAt})
		}
	}

	return out, nil
}

// ── Stats ─────────────────────────────────────────────────────────────────────

type Stats struct {
	States       int `json:"states"`
	Destinations int `json:"destinations"`
	RouteLegs    int `json:"route_legs"`
	PermitRules  int `json:"permit_rules"`
	Events       int `json:"events"`
	Itineraries  int `json:"itineraries"`
}

func (s *Store) GetStats() (Stats, error) {
	var st Stats
	dests, _ := s.ListDestinations(nil)
	states, _ := s.ListStates()
	legs, _ := s.ListRouteLegs("", "", "")
	permits, _ := s.ListPermitRules("", "")
	events, _ := s.ListEvents("", 0)
	itins, _ := s.ListItineraries()
	st.States = len(states)
	st.Destinations = len(dests)
	st.RouteLegs = len(legs)
	st.PermitRules = len(permits)
	st.Events = len(events)
	st.Itineraries = len(itins)
	return st, nil
}
