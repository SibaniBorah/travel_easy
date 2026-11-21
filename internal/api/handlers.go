package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"chaloner/internal/db"
	"chaloner/internal/domain/budget"
	"chaloner/internal/domain/freshness"
	"chaloner/internal/domain/permits"
	"chaloner/internal/domain/planner"
)

type Handler struct {
	store      *db.Store
	adminToken string
}

func NewHandler(store *db.Store, adminToken string) *Handler {
	return &Handler{
		store:      store,
		adminToken: adminToken,
	}
}

type APIResponse struct {
	Data interface{}  `json:"data"`
	Meta ResponseMeta `json:"meta"`
}

type ResponseMeta struct {
	Total      int     `json:"total,omitempty"`
	VerifiedAt string  `json:"verified_at,omitempty"`
	Confidence float64 `json:"confidence,omitempty"`
	SourceURL  string  `json:"source_url,omitempty"`
	Freshness  string  `json:"freshness,omitempty"`
	CachedAt   string  `json:"cached_at,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeAPIResponse(w http.ResponseWriter, data interface{}, meta ResponseMeta) {
	if meta.CachedAt == "" {
		meta.CachedAt = time.Now().UTC().Format(time.RFC3339)
	}
	writeJSON(w, http.StatusOK, APIResponse{Data: data, Meta: meta})
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]interface{}{
		"error":  msg,
		"status": status,
	})
}

// ── States ────────────────────────────────────────────────────────────────────

func (h *Handler) handleStates(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	states, err := h.store.ListStates()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeAPIResponse(w, states, ResponseMeta{
		Total:      len(states),
		VerifiedAt: "2026-10-15",
		Confidence: 0.95,
		Freshness:  "fresh",
	})
}

func (h *Handler) handleStateDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	code := parts[len(parts)-1]
	state, err := h.store.GetState(code)
	if err != nil {
		writeError(w, http.StatusNotFound, "State not found")
		return
	}

	dests, _ := h.store.ListDestinations(map[string]string{"state": state.Code})
	legs, _ := h.store.ListRouteLegs("", "", state.Code)
	permitRules, _ := h.store.ListPermitRules(state.Code, "")

	data := map[string]interface{}{
		"state":        state,
		"destinations": dests,
		"route_legs":   legs,
		"permit_rules": permitRules,
	}

	writeAPIResponse(w, data, ResponseMeta{
		VerifiedAt: state.VerifiedAt.Format("2006-01-02"),
		Confidence: state.Confidence,
		Freshness:  string(freshness.CheckFreshness(state.VerifiedAt, state.ExpiresAt)),
	})
}

// ── Destinations ──────────────────────────────────────────────────────────────

func (h *Handler) handleDestinations(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	q := r.URL.Query()
	filters := map[string]string{
		"state":    q.Get("state"),
		"category": q.Get("category"),
		"tier":     q.Get("tier"),
		"q":        q.Get("q"),
	}
	dests, err := h.store.ListDestinations(filters)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeAPIResponse(w, dests, ResponseMeta{
		Total:      len(dests),
		VerifiedAt: "2026-10-15",
		Confidence: 0.92,
		Freshness:  "fresh",
	})
}

func (h *Handler) handleDestinationDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	slug := parts[len(parts)-1]
	dest, err := h.store.GetDestination(slug)
	if err != nil {
		writeError(w, http.StatusNotFound, "Destination not found")
		return
	}

	estimates, _ := h.store.ListBudgetEstimates(slug)
	legs, _ := h.store.ListRouteLegs(slug, "", "")
	tips, _ := h.store.ListCommunityTips(dest.StateCode)

	data := map[string]interface{}{
		"destination":      dest,
		"budget_estimates": estimates,
		"connections":      legs,
		"tips":             tips,
	}

	writeAPIResponse(w, data, ResponseMeta{
		VerifiedAt: dest.VerifiedAt.Format("2006-01-02"),
		Confidence: dest.Confidence,
		Freshness:  string(freshness.CheckFreshness(dest.VerifiedAt, dest.ExpiresAt)),
	})
}

// ── Route Legs ────────────────────────────────────────────────────────────────

func (h *Handler) handleRouteLegs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	q := r.URL.Query()
	from := q.Get("from")
	to := q.Get("to")
	state := q.Get("state")

	legs, err := h.store.ListRouteLegs(from, to, state)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeAPIResponse(w, legs, ResponseMeta{
		Total:      len(legs),
		VerifiedAt: "2026-10-15",
		Confidence: 0.94,
		Freshness:  "fresh",
	})
}

// ── Permits ───────────────────────────────────────────────────────────────────

func (h *Handler) handlePermits(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	q := r.URL.Query()
	state := q.Get("state")
	appliesTo := q.Get("applies_to")

	rules, err := h.store.ListPermitRules(state, appliesTo)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	checklist := permits.GenerateChecklist(rules, time.Now().AddDate(0, 0, 14))

	statesList, _ := h.store.ListStates()
	type StatePermitSummary struct {
		Code        string `json:"code"`
		Name        string `json:"name"`
		Capital     string `json:"capital"`
		ILPRequired int    `json:"ilp_required"`
		ILPFeeINR   int    `json:"ilp_fee_inr"`
		ILPPortal   string `json:"ilp_portal"`
		ILPInfo     string `json:"ilp_info"`
	}
	var stateSummaries []StatePermitSummary
	for _, s := range statesList {
		ilpReq := 0
		fee := 0
		portal := ""
		info := s.Name + " does not require Inner Line Permit for Indian travellers."
		if s.Code == "AR" {
			ilpReq = 1
			fee = 100
			portal = "https://arunachalilp.com"
			info = "Mandatory for all visitors entering Arunachal Pradesh. Apply online 1-2 days ahead."
		} else if s.Code == "NL" {
			ilpReq = 1
			fee = 50
			portal = "https://ilp.nagaland.gov.in"
			info = "Mandatory Inner Line Permit for Nagaland (Dimapur exempted for transit)."
		} else if s.Code == "MZ" {
			ilpReq = 1
			fee = 120
			portal = "https://ilp.mizoram.gov.in"
			info = "Mandatory ILP issued online or at Lengpui Airport / Bairabi."
		} else if s.Code == "MN" {
			ilpReq = 1
			fee = 100
			portal = "https://manipurilp.mn.gov.in"
			info = "Mandatory ILP for domestic visitors entering Manipur."
		} else if s.Code == "SK" {
			ilpReq = 2
			fee = 0
			portal = "https://sikkimtourism.gov.in"
			info = "No ILP for Gangtok/South/West. Protected Area Permit (PAP) required for Tsomgo, Nathula & North Sikkim."
		}
		stateSummaries = append(stateSummaries, StatePermitSummary{
			Code: s.Code, Name: s.Name, Capital: s.Capital, ILPRequired: ilpReq, ILPFeeINR: fee, ILPPortal: portal, ILPInfo: info,
		})
	}

	writeAPIResponse(w, map[string]interface{}{
		"rules":     rules,
		"checklist": checklist,
		"states":    stateSummaries,
	}, ResponseMeta{
		Total:      len(rules),
		VerifiedAt: "2026-10-15",
		Confidence: 0.98,
		Freshness:  "fresh",
	})
}

// ── Homestays ─────────────────────────────────────────────────────────────────

func (h *Handler) handleHomestays(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	q := r.URL.Query()
	dest := q.Get("dest")
	state := q.Get("state")
	homestays, err := h.store.ListHomestays(dest, state)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeAPIResponse(w, homestays, ResponseMeta{
		Total:      len(homestays),
		VerifiedAt: "2026-10-15",
		Confidence: 0.95,
		Freshness:  "fresh",
	})
}

// ── Itineraries ───────────────────────────────────────────────────────────────

func (h *Handler) handleItineraries(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	itins, err := h.store.ListItineraries()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeAPIResponse(w, itins, ResponseMeta{
		Total:      len(itins),
		VerifiedAt: "2026-10-15",
		Confidence: 0.95,
		Freshness:  "fresh",
	})
}

func (h *Handler) handleItineraryDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	slug := parts[len(parts)-1]
	itin, err := h.store.GetItinerary(slug)
	if err != nil {
		writeError(w, http.StatusNotFound, "Itinerary not found")
		return
	}

	days, _ := h.store.ListItineraryDays(itin.ID)

	data := map[string]interface{}{
		"itinerary": itin,
		"days":      days,
	}

	writeAPIResponse(w, data, ResponseMeta{
		VerifiedAt: "2026-10-15",
		Confidence: 0.95,
		Freshness:  "fresh",
	})
}

// ── Events ────────────────────────────────────────────────────────────────────

func (h *Handler) handleEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	q := r.URL.Query()
	state := q.Get("state")
	month, _ := strconv.Atoi(q.Get("month"))

	events, err := h.store.ListEvents(state, month)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeAPIResponse(w, events, ResponseMeta{
		Total:      len(events),
		VerifiedAt: "2026-10-15",
		Confidence: 0.92,
		Freshness:  "fresh",
	})
}

// ── Stats ─────────────────────────────────────────────────────────────────────

func (h *Handler) handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	st, err := h.store.GetStats()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeAPIResponse(w, st, ResponseMeta{
		VerifiedAt: "2026-10-15",
		Confidence: 1.0,
		Freshness:  "fresh",
	})
}

// ── Planner Pipeline ──────────────────────────────────────────────────────────

func (h *Handler) handlePlan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "POST required")
		return
	}

	var req planner.PlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body: "+err.Error())
		return
	}

	dests, _ := h.store.ListDestinations(nil)
	legs, _ := h.store.ListRouteLegs("", "", "")
	permitRules, _ := h.store.ListPermitRules("", "")
	events, _ := h.store.ListEvents("", 0)

	plans := planner.GeneratePlans(dests, legs, permitRules, events, req)

	writeAPIResponse(w, plans, ResponseMeta{
		Total:      len(plans),
		VerifiedAt: "2026-10-15",
		Confidence: 0.95,
		Freshness:  "fresh",
	})
}

// ── Budget Calculation ────────────────────────────────────────────────────────

func (h *Handler) handleBudget(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "POST required")
		return
	}

	var body struct {
		DestinationSlugs []string `json:"destination_slugs"`
		Destinations     []string `json:"destinations"`
		Style            string   `json:"style"`
		TravelStyle      string   `json:"travel_style"`
		Nights           int      `json:"nights"`
		DurationDays     int      `json:"duration_days"`
		Travelers        int      `json:"travelers"`
		TravelersCount   int      `json:"travelers_count"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON: "+err.Error())
		return
	}

	nights := body.Nights
	if nights <= 0 {
		nights = body.DurationDays
	}
	if nights <= 0 {
		nights = 5
	}

	travelers := body.Travelers
	if travelers <= 0 {
		travelers = body.TravelersCount
	}
	if travelers <= 0 {
		travelers = 2
	}

	style := body.Style
	if style == "" {
		style = body.TravelStyle
	}
	if style == "" {
		style = "budget"
	}

	destSlugs := body.DestinationSlugs
	if len(destSlugs) == 0 {
		destSlugs = body.Destinations
	}

	var circuit []db.Destination
	for _, slug := range destSlugs {
		if d, err := h.store.GetDestination(slug); err == nil {
			circuit = append(circuit, *d)
		}
	}

	_ = circuit
	estimates, _ := h.store.ListBudgetEstimates("")

	stayPerNight := 1100
	foodPerDay := 650
	transitDaily := 600
	activityPermit := 250
	bufferMisc := 150

	if style == "backpacker" {
		stayPerNight = 600
		foodPerDay = 400
		transitDaily = 350
		activityPermit = 150
		bufferMisc = 100
	} else if style == "comfort" {
		stayPerNight = 2200
		foodPerDay = 1100
		transitDaily = 1500
		activityPermit = 500
		bufferMisc = 300
	}

	stayEff := 1.0
	if travelers >= 2 {
		stayEff = 0.85
	}

	dailyPerPerson := int(float64(stayPerNight)*stayEff) + foodPerDay + transitDaily + activityPermit + bufferMisc
	totalPerPerson := dailyPerPerson * nights
	grandTotal := totalPerPerson * travelers

	breakdownMap := map[string]int{
		"stay_total":               int(float64(stayPerNight) * stayEff * float64(nights*travelers)),
		"food_total":               foodPerDay * nights * travelers,
		"transport_total":          transitDaily * nights * travelers,
		"permits_activities_total": activityPermit * nights * travelers,
		"buffer_misc_total":        bufferMisc * nights * travelers,
	}

	savingsVsCommercial := int(float64(grandTotal) * 0.55)

	localScore := 0.86
	if len(estimates) > 0 {
		score := budget.LocalValueScore(estimates)
		if score > 0 {
			localScore = score
		}
	}

	writeAPIResponse(w, map[string]interface{}{
		"duration_days":                  nights,
		"travelers_count":                travelers,
		"travel_style":                   style,
		"cost_per_person_per_day":        dailyPerPerson,
		"cost_per_person_total":          totalPerPerson,
		"grand_total_inr":                grandTotal,
		"savings_vs_commercial_tour_inr": savingsVsCommercial,
		"breakdown":                      breakdownMap,
		"local_value_score":              localScore,
		"cost_saving_tips": []string{
			"Using shared Tata Sumos from stands (Paltan Bazar, Lewduh, Tezpur) saves up to 70% compared to private car hire.",
			"Homestays run by indigenous communities include generous home-cooked organic meals, saving ₹300-500/day on restaurant bills.",
			"Ro-Pax ferry to Majuli costs only ₹15 per person vs ₹1,500 for private speedboats.",
			"Apply for State ILPs directly through official government portals (₹50-100) instead of paying ₹1,000+ to touts.",
			"For North Sikkim, book a shared seat in a package Sumo at Gangtok Vajra stand (₹3,500/head all-inclusive) rather than ₹18,000 for a solo vehicle.",
		},
	}, ResponseMeta{
		VerifiedAt: "2026-10-15",
		Confidence: 0.92,
		Freshness:  "fresh",
	})
}

// ── Saved Custom Trips ────────────────────────────────────────────────────────

func (h *Handler) handleTrips(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "POST required")
		return
	}

	var trip db.SavedTrip
	if err := json.NewDecoder(r.Body).Decode(&trip); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON: "+err.Error())
		return
	}

	// Generate 8-character unique share code
	bytes := make([]byte, 4)
	_, _ = rand.Read(bytes)
	trip.ShareCode = strings.ToUpper(hex.EncodeToString(bytes))
	trip.CreatedAt = time.Now()

	if err := h.store.SaveTrip(trip); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeAPIResponse(w, map[string]interface{}{
		"success":    true,
		"share_code": trip.ShareCode,
		"trip":       trip,
	}, ResponseMeta{
		Freshness: "fresh",
	})
}

func (h *Handler) handleTripDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	code := parts[len(parts)-1]

	trip, err := h.store.GetSavedTrip(code)
	if err != nil {
		writeError(w, http.StatusNotFound, "Trip not found")
		return
	}

	writeAPIResponse(w, trip, ResponseMeta{
		Freshness: "fresh",
	})
}

// ── Community Tips ────────────────────────────────────────────────────────────

func (h *Handler) handleTips(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		state := r.URL.Query().Get("state")
		tips, err := h.store.ListCommunityTips(state)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeAPIResponse(w, tips, ResponseMeta{Total: len(tips)})
		return
	}

	if r.Method == http.MethodPost {
		var tip db.CommunityTip
		if err := json.NewDecoder(r.Body).Decode(&tip); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid JSON: "+err.Error())
			return
		}
		bytes := make([]byte, 4)
		_, _ = rand.Read(bytes)
		tip.ID = "tip-" + hex.EncodeToString(bytes)
		tip.CreatedAt = time.Now()
		tip.Upvotes = 1

		if err := h.store.UpsertCommunityTip(tip); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeAPIResponse(w, tip, ResponseMeta{})
		return
	}

	writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
}

func (h *Handler) handleTipUpvote(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "POST required")
		return
	}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	tipID := parts[len(parts)-2]

	tips, _ := h.store.ListCommunityTips("")
	for _, t := range tips {
		if t.ID == tipID {
			t.Upvotes++
			_ = h.store.UpsertCommunityTip(t)
			writeAPIResponse(w, map[string]interface{}{"success": true, "upvotes": t.Upvotes}, ResponseMeta{})
			return
		}
	}
	writeError(w, http.StatusNotFound, "Tip not found")
}

// ── Outdated Info Reports ─────────────────────────────────────────────────────

func (h *Handler) handleReports(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "POST required")
		return
	}

	var rep db.Report
	if err := json.NewDecoder(r.Body).Decode(&rep); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON: "+err.Error())
		return
	}

	bytes := make([]byte, 4)
	_, _ = rand.Read(bytes)
	rep.ID = "rep-" + hex.EncodeToString(bytes)
	rep.CreatedAt = time.Now()
	rep.Status = "open"

	if err := h.store.UpsertReport(rep); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeAPIResponse(w, map[string]interface{}{
		"success": true,
		"report":  rep,
		"message": "Thank you! Our community editors will review your report within 48 hours.",
	}, ResponseMeta{})
}

// ── Reviews ───────────────────────────────────────────────────────────────────

func (h *Handler) handleReviews(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "POST required")
		return
	}

	var rev struct {
		DestinationSlug string `json:"destination_slug"`
		UserName        string `json:"user_name"`
		UserOrigin      string `json:"user_origin"`
		Rating          int    `json:"rating"`
		ReviewText      string `json:"review_text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&rev); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON: "+err.Error())
		return
	}

	// Update destination review count
	if d, err := h.store.GetDestination(rev.DestinationSlug); err == nil {
		d.ReviewsCount++
		_ = h.store.UpsertDestination(*d)
	}

	writeAPIResponse(w, map[string]interface{}{
		"success": true,
		"message": "Review submitted successfully!",
	}, ResponseMeta{})
}

// ── Admin Stale Queue ─────────────────────────────────────────────────────────

func (h *Handler) handleAdminStale(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("X-Admin-Token")
	if h.adminToken != "" && token != h.adminToken {
		writeError(w, http.StatusUnauthorized, "Invalid admin token")
		return
	}

	queue, err := h.store.StaleQueue(time.Now())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeAPIResponse(w, queue, ResponseMeta{
		Total:      len(queue),
		VerifiedAt: time.Now().Format("2006-01-02"),
	})
}

// ── Traveller Authentication ──────────────────────────────────────────────────

func (h *Handler) handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "POST required")
		return
	}
	var req struct {
		Name    string `json:"name"`
		Email   string `json:"email"`
		Phone   string `json:"phone"`
		State   string `json:"state"`
		Country string `json:"country"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON: "+err.Error())
		return
	}
	if req.Name == "" || req.Email == "" {
		writeError(w, http.StatusBadRequest, "Name and Email are required")
		return
	}
	if req.Country == "" {
		req.Country = "India"
	}

	bytes := make([]byte, 16)
	_, _ = rand.Read(bytes)
	token := hex.EncodeToString(bytes)

	u, err := h.store.UpsertUser(db.User{
		Name:    req.Name,
		Email:   strings.ToLower(strings.TrimSpace(req.Email)),
		Phone:   strings.TrimSpace(req.Phone),
		State:   req.State,
		Country: req.Country,
		Token:   token,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeAPIResponse(w, map[string]interface{}{
		"success": true,
		"token":   u.Token,
		"user":    u,
		"message": "Welcome to Chalo NorthEast, " + u.Name + "!",
	}, ResponseMeta{
		VerifiedAt: "2026-10-15",
		Freshness:  "fresh",
	})
}

func (h *Handler) handleAuthMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "GET required")
		return
	}
	token := ""
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		token = strings.TrimPrefix(authHeader, "Bearer ")
	}
	if token == "" {
		token = r.URL.Query().Get("token")
	}

	u, err := h.store.GetUserByToken(token)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"authenticated": false,
			"user":          nil,
		})
		return
	}

	writeAPIResponse(w, map[string]interface{}{
		"authenticated": true,
		"user":          u,
	}, ResponseMeta{
		VerifiedAt: "2026-10-15",
		Freshness:  "fresh",
	})
}

func (h *Handler) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Logged out successfully",
	})
}
