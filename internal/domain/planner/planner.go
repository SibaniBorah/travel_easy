// Package planner provides itinerary generation pipeline for Chalo NorthEast.
package planner

import (
	"sort"
	"strings"
	"time"

	"chaloner/internal/db"
)

// PlanRequest is the input to the planner pipeline.
type PlanRequest struct {
	Gateway            string    // entry destination slug (e.g. "guwahati")
	StartDate          time.Time
	Nights             int
	BudgetTotalINR     int    // 0 = unlimited
	BudgetPerPersonINR int
	TravelersCount     int
	Pace               string   // "relaxed" | "moderate" | "active"
	Interests          []string // categories
	TravellerType      string   // "indian" | "foreign"
	LocalFirst         bool
}

// PlanStatus is the feasibility verdict.
type PlanStatus string

const (
	StatusFeasible       PlanStatus = "feasible"
	StatusTight          PlanStatus = "tight"
	StatusNotRecommended PlanStatus = "not_recommended"
)

// PlanWarning is a warning or hard-reject message.
type PlanWarning struct {
	RuleID   string `json:"rule_id"`
	Message  string `json:"message"`
	Severity string `json:"severity"` // "info" | "warning" | "error"
}

// PlannedDay is one day of a plan.
type PlannedDay struct {
	DayNumber       int      `json:"day_number"`
	DestinationSlug string   `json:"destination_slug"`
	DestinationName string   `json:"destination_name"`
	TravelHrs       float64  `json:"travel_hrs"`
	Activities      []string `json:"activities"`
	StayType        string   `json:"stay_type"`
	EstCostRange    [2]int   `json:"est_cost_range"`
}

// ItineraryPlan is a complete itinerary with score and warnings.
type ItineraryPlan struct {
	Status        PlanStatus    `json:"status"`
	Days          []PlannedDay  `json:"days"`
	CostRangeLow  int           `json:"cost_range_low"`
	CostRangeHigh int           `json:"cost_range_high"`
	Warnings      []PlanWarning `json:"warnings"`
	PermitsNeeded []string      `json:"permits_needed"`
	Assumptions   []string      `json:"assumptions"`
	Alternatives  []string      `json:"alternatives"`
	Score         float64       `json:"score"`
}

// travelMonth extracts the month of the start date, defaulting to current month.
func travelMonth(req PlanRequest) int {
	if req.StartDate.IsZero() {
		return int(time.Now().Month())
	}
	return int(req.StartDate.Month())
}

// maxDailyTravelHrs returns the max travel hours per day for a given pace.
func maxDailyTravelHrs(pace string) float64 {
	switch pace {
	case "active":
		return 8.0
	case "relaxed":
		return 4.0
	default: // moderate
		return 6.0
	}
}

// interestMatch returns true if destination category overlaps with interests.
func interestMatch(d db.Destination, interests []string) bool {
	if len(interests) == 0 {
		return true
	}
	for _, i := range interests {
		if strings.EqualFold(d.Category, i) {
			return true
		}
	}
	return false
}

// monthBlocked checks if a given month is in the blocked list.
func monthBlocked(month int, blocked []int) bool {
	for _, b := range blocked {
		if b == month {
			return true
		}
	}
	return false
}

// FilterCandidates filters destinations matching the request.
func FilterCandidates(dests []db.Destination, req PlanRequest) []db.Destination {
	var out []db.Destination
	for _, d := range dests {
		if d.Status != "published" {
			continue
		}
		if !interestMatch(d, req.Interests) {
			continue
		}
		out = append(out, d)
	}
	return out
}

// findLeg looks up a leg from→to regardless of direction.
func findLeg(legs []db.RouteLeg, fromSlug, toSlug string) *db.RouteLeg {
	for i := range legs {
		l := &legs[i]
		if (l.FromSlug == fromSlug && l.ToSlug == toSlug) ||
			(l.FromSlug == toSlug && l.ToSlug == fromSlug) {
			return l
		}
	}
	return nil
}

// reachable checks if destination b is reachable from a via a non-blocked route.
func reachable(a, b db.Destination, legs []db.RouteLeg, month int) bool {
	l := findLeg(legs, a.Slug, b.Slug)
	if l == nil {
		return false
	}
	return !monthBlocked(month, l.BlockedMonths)
}

// BuildCircuits constructs up to 5 candidate destination sequences.
func BuildCircuits(candidates []db.Destination, legs []db.RouteLeg, req PlanRequest) [][]db.Destination {
	month := travelMonth(req)
	maxDests := req.Nights
	if maxDests < 1 {
		maxDests = 1
	}
	if maxDests > 5 {
		maxDests = 5
	}

	// Find gateway destination.
	var gateway *db.Destination
	for i := range candidates {
		if candidates[i].Slug == req.Gateway {
			gateway = &candidates[i]
			break
		}
	}

	var circuits [][]db.Destination

	if gateway == nil {
		return circuits
	}

	// Greedy: start from gateway and greedily add reachable destinations.
	circuit := []db.Destination{*gateway}
	remaining := make([]db.Destination, 0, len(candidates))
	for _, d := range candidates {
		if d.Slug != req.Gateway {
			remaining = append(remaining, d)
		}
	}

	for len(circuit) < maxDests && len(remaining) > 0 {
		last := circuit[len(circuit)-1]
		bestIdx := -1
		for i, r := range remaining {
			if reachable(last, r, legs, month) {
				bestIdx = i
				break
			}
		}
		if bestIdx < 0 {
			break
		}
		circuit = append(circuit, remaining[bestIdx])
		remaining = append(remaining[:bestIdx], remaining[bestIdx+1:]...)
	}

	if len(circuit) > 0 {
		circuits = append(circuits, circuit)
	}

	// Generate interest-filtered variant.
	if len(req.Interests) > 0 {
		var filtered []db.Destination
		for _, d := range candidates {
			if interestMatch(d, req.Interests) {
				filtered = append(filtered, d)
			}
		}
		if len(filtered) > 0 && len(filtered) != len(candidates) {
			alt := BuildCircuits(filtered, legs, PlanRequest{
				Gateway:       req.Gateway,
				Nights:        req.Nights,
				Pace:          req.Pace,
				TravellerType: req.TravellerType,
			})
			circuits = append(circuits, alt...)
		}
	}

	// Deduplicate.
	seen := map[string]bool{}
	var unique [][]db.Destination
	for _, c := range circuits {
		key := circuitKey(c)
		if !seen[key] {
			seen[key] = true
			unique = append(unique, c)
		}
	}
	return unique
}

func circuitKey(c []db.Destination) string {
	keys := make([]string, len(c))
	for i, d := range c {
		keys[i] = d.Slug
	}
	return strings.Join(keys, ",")
}

// ILPStates that require Inner Line Permits.
var ILPStates = map[string]bool{
	"AR": true,
	"NL": true,
	"MN": true,
	"MZ": true,
}

// PAPStates that require Protected Area Permits for certain zones.
var PAPStates = map[string]bool{
	"SK": true,
}

// ScorePlan produces a score 0-100 for a circuit.
func ScorePlan(circuit []db.Destination, legs []db.RouteLeg, req PlanRequest, events []db.Event) float64 {
	if len(circuit) == 0 {
		return 0
	}
	month := travelMonth(req)
	score := 50.0

	// Diversity bonus.
	states := map[string]bool{}
	for _, d := range circuit {
		states[d.StateCode] = true
	}
	score += float64(len(states)) * 3

	// Best-month bonus.
	for _, d := range circuit {
		for _, m := range d.BestMonths {
			if m == month {
				score += 5
				break
			}
		}
	}

	// Event bonus.
	for _, e := range events {
		if e.AnnualMonth == month {
			for _, d := range circuit {
				if strings.EqualFold(e.StateCode, d.StateCode) {
					score += 8
				}
			}
		}
	}

	// Interest match bonus.
	for _, d := range circuit {
		if interestMatch(d, req.Interests) {
			score += 4
		}
	}

	// Rating bonus.
	for _, d := range circuit {
		score += d.Rating * 2
	}

	// Budget fit.
	if req.BudgetTotalINR > 0 {
		var totalCost int
		for _, d := range circuit {
			totalCost += d.EstCostPerDay * d.IdealDays
		}
		if totalCost <= req.BudgetTotalINR {
			score += 10
		} else {
			score -= 10
		}
	}

	if score > 100 {
		score = 100
	}
	return score
}

// CheckHardRejects returns error-severity warnings that make a plan infeasible.
func CheckHardRejects(circuit []db.Destination, legs []db.RouteLeg, req PlanRequest, permits []db.PermitRule) []PlanWarning {
	var warns []PlanWarning
	month := travelMonth(req)

	// Check blocked legs.
	for i := 1; i < len(circuit); i++ {
		l := findLeg(legs, circuit[i-1].Slug, circuit[i].Slug)
		if l != nil && monthBlocked(month, l.BlockedMonths) {
			warns = append(warns, PlanWarning{
				RuleID:   "blocked-leg",
				Message:  "Route " + circuit[i-1].Slug + " → " + circuit[i].Slug + " is closed in this month",
				Severity: "error",
			})
		}
	}

	// Check missing gateway.
	if req.Gateway == "" {
		warns = append(warns, PlanWarning{
			RuleID:   "no-gateway",
			Message:  "No gateway/entry point specified",
			Severity: "error",
		})
	} else {
		found := false
		for _, d := range circuit {
			if d.Slug == req.Gateway {
				found = true
				break
			}
		}
		if !found {
			warns = append(warns, PlanWarning{
				RuleID:   "gateway-not-found",
				Message:  "Gateway '" + req.Gateway + "' not found in candidate destinations",
				Severity: "error",
			})
		}
	}

	return warns
}

// CheckSoftViolations returns warning/info severity issues.
func CheckSoftViolations(circuit []db.Destination, legs []db.RouteLeg, req PlanRequest) []PlanWarning {
	var warns []PlanWarning
	month := travelMonth(req)
	maxTravel := maxDailyTravelHrs(req.Pace)

	// Travel time per day cap.
	for i := 1; i < len(circuit); i++ {
		l := findLeg(legs, circuit[i-1].Slug, circuit[i].Slug)
		if l != nil && l.DurationMaxHrs > maxTravel {
			warns = append(warns, PlanWarning{
				RuleID:   "daily-travel-cap",
				Message:  "Journey " + circuit[i-1].Slug + " → " + circuit[i].Slug + " may exceed daily travel limit for " + req.Pace + " pace",
				Severity: "warning",
			})
		}
	}

	// ILP warnings — deduplicated per state.
	ilpSeen := map[string]bool{}
	for _, d := range circuit {
		sc := strings.ToUpper(d.StateCode)
		if ILPStates[sc] && !ilpSeen[sc] {
			ilpSeen[sc] = true
			warns = append(warns, PlanWarning{
				RuleID:   "ilp-required",
				Message:  d.StateCode + " requires an Inner Line Permit (ILP). Apply online before travel.",
				Severity: "warning",
			})
		}
	}

	// PAP warnings for foreign travellers.
	if req.TravellerType == "foreign" {
		papSeen := map[string]bool{}
		for _, d := range circuit {
			sc := strings.ToUpper(d.StateCode)
			if (PAPStates[sc] || ILPStates[sc]) && !papSeen[sc] {
				papSeen[sc] = true
				warns = append(warns, PlanWarning{
					RuleID:   "pap-required",
					Message:  d.StateCode + " requires a Protected Area Permit (PAP) for foreign nationals.",
					Severity: "warning",
				})
			}
		}
	}

	// High monsoon risk in July-Sept.
	if month >= 7 && month <= 9 {
		for i := 1; i < len(circuit); i++ {
			l := findLeg(legs, circuit[i-1].Slug, circuit[i].Slug)
			if l != nil && l.MonsoonRisk == "high" {
				warns = append(warns, PlanWarning{
					RuleID:   "monsoon-risk",
					Message:  "High monsoon risk on " + circuit[i-1].Slug + " → " + circuit[i].Slug,
					Severity: "warning",
				})
			}
		}
	}

	// Tight budget.
	if req.BudgetTotalINR > 0 && req.BudgetTotalINR < 5000 && req.Nights > 2 {
		warns = append(warns, PlanWarning{
			RuleID:   "budget-tight",
			Message:  "Budget is very tight for the duration. Consider shorter trip or higher budget.",
			Severity: "warning",
		})
	}

	return warns
}

// AssignStatus determines the overall plan status from warnings.
func AssignStatus(hardRejects, softViolations []PlanWarning) PlanStatus {
	if len(hardRejects) > 0 {
		return StatusNotRecommended
	}
	errorCount := 0
	warnCount := 0
	for _, w := range softViolations {
		switch w.Severity {
		case "error":
			errorCount++
		case "warning":
			warnCount++
		}
	}
	if errorCount > 0 {
		return StatusNotRecommended
	}
	if warnCount > 2 {
		return StatusTight
	}
	return StatusFeasible
}

// buildPlannedDays converts a circuit into a day-by-day plan.
func buildPlannedDays(circuit []db.Destination, legs []db.RouteLeg, nights int) []PlannedDay {
	if len(circuit) == 0 || nights < 1 {
		return nil
	}
	days := make([]PlannedDay, 0, nights+1)
	daysPerDest := nights / len(circuit)
	if daysPerDest < 1 {
		daysPerDest = 1
	}
	dayNum := 1
	for i, d := range circuit {
		if dayNum > nights+1 {
			break
		}
		travelHrs := 0.0
		if i > 0 {
			l := findLeg(legs, circuit[i-1].Slug, d.Slug)
			if l != nil {
				travelHrs = (l.DurationMinHrs + l.DurationMaxHrs) / 2
			}
		}
		stayDays := daysPerDest
		if i == len(circuit)-1 {
			rem := nights - dayNum + 1
			if rem > stayDays {
				stayDays = rem
			}
		}
		for j := 0; j < stayDays && dayNum <= nights+1; j++ {
			act := d.TopHighlights
			if len(act) > 3 {
				act = act[:3]
			}
			pd := PlannedDay{
				DayNumber:       dayNum,
				DestinationSlug: d.Slug,
				DestinationName: d.Name,
				Activities:      act,
				StayType:        "guesthouse",
				EstCostRange:    [2]int{d.EstCostPerDay, int(float64(d.EstCostPerDay) * 1.5)},
			}
			if j == 0 {
				pd.TravelHrs = travelHrs
			}
			days = append(days, pd)
			dayNum++
		}
	}
	return days
}

// collectPermitWarnings returns names of permits needed.
func collectPermitWarnings(warns []PlanWarning) []string {
	var out []string
	seen := map[string]bool{}
	for _, w := range warns {
		if (w.RuleID == "ilp-required" || w.RuleID == "pap-required") && !seen[w.Message] {
			out = append(out, w.Message)
			seen[w.Message] = true
		}
	}
	return out
}

// GeneratePlans runs the full planner pipeline and returns ranked plans.
func GeneratePlans(dests []db.Destination, legs []db.RouteLeg, permits []db.PermitRule, events []db.Event, req PlanRequest) []ItineraryPlan {
	if req.Nights < 1 {
		req.Nights = 1
	}
	if req.TravelersCount < 1 {
		req.TravelersCount = 1
	}

	candidates := FilterCandidates(dests, req)
	circuits := BuildCircuits(candidates, legs, req)

	if len(circuits) == 0 {
		return []ItineraryPlan{{
			Status: StatusNotRecommended,
			Warnings: []PlanWarning{{
				RuleID:   "no-circuit",
				Message:  "Could not build any circuit from gateway '" + req.Gateway + "'",
				Severity: "error",
			}},
		}}
	}

	var plans []ItineraryPlan
	for _, circuit := range circuits {
		hard := CheckHardRejects(circuit, legs, req, permits)
		soft := CheckSoftViolations(circuit, legs, req)
		status := AssignStatus(hard, soft)

		allWarns := append(hard, soft...) //nolint:gocritic

		score := ScorePlan(circuit, legs, req, events)
		if status == StatusNotRecommended {
			score = score * 0.3
		} else if status == StatusTight {
			score = score * 0.7
		}

		var costLow, costHigh int
		for _, d := range circuit {
			costLow += d.EstCostPerDay * req.Nights / len(circuit)
			costHigh += int(float64(d.EstCostPerDay) * 1.5 * float64(req.Nights) / float64(len(circuit)))
		}
		costLow *= req.TravelersCount
		costHigh *= req.TravelersCount

		plans = append(plans, ItineraryPlan{
			Status:        status,
			Days:          buildPlannedDays(circuit, legs, req.Nights),
			CostRangeLow:  costLow,
			CostRangeHigh: costHigh,
			Warnings:      allWarns,
			PermitsNeeded: collectPermitWarnings(soft),
			Assumptions:   []string{"Prices are estimates for " + req.Pace + " pace", "Shared transport assumed"},
			Alternatives:  []string{},
			Score:         score,
		})
	}

	sort.Slice(plans, func(i, j int) bool {
		return plans[i].Score > plans[j].Score
	})

	return plans
}
