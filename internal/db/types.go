package db

import "time"

// State represents a North East Indian state.
type State struct {
	Code               string    `json:"code"`
	Name               string    `json:"name"`
	Capital            string    `json:"capital"`
	Tagline            string    `json:"tagline"`
	Description        string    `json:"description"`
	BestTime           string    `json:"best_time"`
	ILPRequired        bool      `json:"ilp_required"`
	ILPFeeINR          int       `json:"ilp_fee_inr"`
	ILPPortal          string    `json:"ilp_portal"`
	ILPInfo            string    `json:"ilp_info"`
	PopularFood        []string  `json:"popular_food"`
	CulturalHighlights []string  `json:"cultural_highlights"`
	SourceID           string    `json:"source_id"`
	VerifiedAt         time.Time `json:"verified_at"`
	ExpiresAt          time.Time `json:"expires_at"`
	Confidence         float64   `json:"confidence"`
	Status             string    `json:"status"` // draft/published/stale
}

// Destination represents a travel destination.
type Destination struct {
	ID                 string    `json:"id"`
	StateCode          string    `json:"state_code"`
	Name               string    `json:"name"`
	Slug               string    `json:"slug"`
	Tagline            string    `json:"tagline"`
	Category           string    `json:"category"` // wildlife/culture/trek/waterfall/monastery/scenic
	BudgetTier         string    `json:"budget_tier"` // backpacker/budget/moderate/comfort
	EstCostPerDay      int       `json:"est_cost_per_day"`
	BestSeason         string    `json:"best_season"`
	BestMonths         []int     `json:"best_months"` // 1-12
	IdealDays          int       `json:"ideal_days"`
	Altitude           string    `json:"altitude"`
	AltitudeM          int       `json:"altitude_m"`
	NetworkCoverage    string    `json:"network_coverage"` // none/low/4G
	Description        string    `json:"description"`
	TopHighlights      []string  `json:"top_highlights"`
	HowToReachBudget   string    `json:"how_to_reach_budget"`
	HowToReachPrivate  string    `json:"how_to_reach_private"`
	EntryFees          string    `json:"entry_fees"`
	PermitInfo         string    `json:"permit_info"`
	CulturalEtiquette  string    `json:"cultural_etiquette"`
	EmergencyContact   string    `json:"emergency_contact"`
	Rating             float64   `json:"rating"`
	ReviewsCount       int       `json:"reviews_count"`
	ImageURL           string    `json:"image_url,omitempty"`
	SourceID           string    `json:"source_id"`
	VerifiedAt         time.Time `json:"verified_at"`
	ExpiresAt          time.Time `json:"expires_at"`
	Confidence         float64   `json:"confidence"`
	Status             string    `json:"status"` // draft/published/stale
}

// RouteLeg represents a transport connection between two destinations.
type RouteLeg struct {
	ID             string    `json:"id"`
	FromSlug       string    `json:"from_slug"`
	ToSlug         string    `json:"to_slug"`
	StateCode      string    `json:"state_code"`
	Mode           string    `json:"mode"` // shared-sumo/train/ferry/bus/flight/private-cab
	PickupStand    string    `json:"pickup_stand"`
	FareMinINR     int       `json:"fare_min_inr"`
	FareMaxINR     int       `json:"fare_max_inr"`
	DurationMinHrs float64   `json:"duration_min_hrs"`
	DurationMaxHrs float64   `json:"duration_max_hrs"`
	Frequency      string    `json:"frequency"`
	BoardingPoint  string    `json:"boarding_point"`
	Contact        string    `json:"contact"`
	BlockedMonths  []int     `json:"blocked_months"`
	MonsoonRisk    string    `json:"monsoon_risk"` // low/medium/high
	SeasonNotes    string    `json:"season_notes"`
	RoadCondition  string    `json:"road_condition"`
	ProTips        string    `json:"pro_tips"`
	SourceID       string    `json:"source_id"`
	VerifiedAt     time.Time `json:"verified_at"`
	ExpiresAt      time.Time `json:"expires_at"`
	Status         string    `json:"status"`
}

// PermitRule represents a permit requirement for an area.
type PermitRule struct {
	ID                string    `json:"id"`
	StateCode         string    `json:"state_code"`
	Area              string    `json:"area"`
	AppliesTo         string    `json:"applies_to"` // indian/foreign/all
	Type              string    `json:"type"` // ILP/RAP/PAP/none
	DocumentsRequired []string  `json:"documents_required"`
	LeadTimeDays      int       `json:"lead_time_days"`
	Fee               int       `json:"fee"`
	OfficialURL       string    `json:"official_url"`
	Notes             string    `json:"notes"`
	VerifiedAt        time.Time `json:"verified_at"`
	ExpiresAt         time.Time `json:"expires_at"`
	Status            string    `json:"status"`
}

// Event represents a cultural or seasonal event.
type Event struct {
	ID                   string `json:"id"`
	StateCode            string `json:"state_code"`
	Name                 string `json:"name"`
	StartDate            string `json:"start_date"`
	EndDate              string `json:"end_date"`
	LocationName         string `json:"location_name"`
	Description          string `json:"description"`
	Category             string `json:"category"`
	AnnualMonth          int    `json:"annual_month"`
	CulturalSignificance string `json:"cultural_significance,omitempty"`
	VisitorTips          string `json:"visitor_tips,omitempty"`
}

// BudgetEstimate represents a cost estimate for a destination.
type BudgetEstimate struct {
	ID              string    `json:"id"`
	DestinationSlug string    `json:"destination_slug"`
	Category        string    `json:"category"` // stay/food/transport/entry/guide
	Description     string    `json:"description"`
	MinINR          int       `json:"min_inr"`
	MaxINR          int       `json:"max_inr"`
	TravelStyle     string    `json:"travel_style"` // backpacker/budget/comfort
	LocallyOwned    bool      `json:"locally_owned"`
	VerifiedAt      time.Time `json:"verified_at"`
}

// CostMinMax holds min and max costs.
type CostMinMax struct {
	Min int `json:"min"`
	Max int `json:"max"`
}

// Itinerary represents a curated or planner-generated trip.
type Itinerary struct {
	ID               string     `json:"id"`
	Slug             string     `json:"slug"`
	Title            string     `json:"title"`
	States           []string   `json:"states"`
	DurationDays     int        `json:"duration_days"`
	BudgetLevel      string     `json:"budget_level"`
	EstTotalCostINR  CostMinMax `json:"est_total_cost_inr"`
	Pace             string     `json:"pace"` // relaxed/moderate/active
	Summary          string     `json:"summary"`
	ImageURL         string     `json:"image_url,omitempty"`
	Status           string     `json:"status"`
	PlannerGenerated bool       `json:"planner_generated"`
}

// ItineraryDay represents a single day in an itinerary.
type ItineraryDay struct {
	ID              string   `json:"id"`
	ItineraryID     string   `json:"itinerary_id"`
	DayNumber       int      `json:"day_number"`
	Title           string   `json:"title"`
	DestinationSlug string   `json:"destination_slug"`
	Stay            string   `json:"stay"`
	ImageURL        string   `json:"image_url,omitempty"`
	Activities      []string `json:"activities"`
	Notes           string   `json:"notes"`
}

// TripDebrief represents a traveller's experience report.
type TripDebrief struct {
	ID              string    `json:"id"`
	DestinationSlug string    `json:"destination_slug"`
	AuthorName      string    `json:"author_name"`
	AuthorCity      string    `json:"author_city"`
	AuthorType      string    `json:"author_type"` // traveller/operator
	Rating          float64   `json:"rating"`
	DebriefText     string    `json:"debrief_text"`
	TravelMonth     int       `json:"travel_month"`
	TravelYear      int       `json:"travel_year"`
	Verified        bool      `json:"verified"`
	CreatedAt       time.Time `json:"created_at"`
}

// Report represents a user-submitted report about content.
type Report struct {
	ID          string    `json:"id"`
	EntityType  string    `json:"entity_type"`
	EntityID    string    `json:"entity_id"`
	ReportType  string    `json:"report_type"` // outdated-info/incorrect/missing
	Description string    `json:"description"`
	Status      string    `json:"status"` // open/resolved
	CreatedAt   time.Time `json:"created_at"`
}

// Source represents a data source.
type Source struct {
	ID            string    `json:"id"`
	URL           string    `json:"url"`
	Publisher     string    `json:"publisher"`
	PublisherType string    `json:"publisher_type"` // official/operator/traveller/press
	FetchedAt     time.Time `json:"fetched_at"`
	Notes         string    `json:"notes"`
}

// CommunityTip represents a community-contributed tip.
type CommunityTip struct {
	ID          string    `json:"id"`
	StateCode   string    `json:"state_code"`
	Destination string    `json:"destination"`
	Tip         string    `json:"tip"`
	AuthorName  string    `json:"author_name"`
	Upvotes     int       `json:"upvotes"`
	CreatedAt   time.Time `json:"created_at"`
}

// SavedTrip represents a user-saved trip with a share code.
type SavedTrip struct {
	ID        string        `json:"id"`
	ShareCode string        `json:"share_code"`
	Plan      interface{}   `json:"plan"`
	CreatedAt time.Time     `json:"created_at"`
}

// Homestay represents a verified eco-homestay.
type Homestay struct {
	ID              int     `json:"id"`
	StateCode       string  `json:"state_code"`
	DestinationSlug string  `json:"destination_slug"`
	Name            string  `json:"name"`
	HostName        string  `json:"host_name"`
	VillageLocation string  `json:"village_location"`
	PricePerNight   int     `json:"price_per_night"`
	ContactPhone    string  `json:"contact_phone"`
	Rating          float64 `json:"rating"`
	Amenities       string  `json:"amenities"`
	EcoCertified    int     `json:"eco_certified"`
	Description     string  `json:"description"`
}

// User represents a registered or logged-in traveller.
type User struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Phone     string    `json:"phone,omitempty"`
	State     string    `json:"state"`
	Country   string    `json:"country"`
	Token     string    `json:"token"`
	CreatedAt time.Time `json:"created_at,omitempty"`
}
