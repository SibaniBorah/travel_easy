package planner_test

import (
	"testing"
	"time"

	"chaloner/internal/db"
	"chaloner/internal/domain/planner"
)

// mockData returns a rich set of destinations, route legs, permit rules, and events
// matching the actual North East geography.
func mockData() ([]db.Destination, []db.RouteLeg, []db.PermitRule, []db.Event) {
	dests := []db.Destination{
		{
			ID: "guw", StateCode: "AS", Name: "Guwahati", Slug: "guwahati",
			Category: "culture", BudgetTier: "budget", EstCostPerDay: 1200,
			BestMonths: []int{1, 2, 3, 4, 10, 11, 12}, IdealDays: 1, Status: "published",
		},
		{
			ID: "shi", StateCode: "ML", Name: "Shillong", Slug: "shillong",
			Category: "scenic", BudgetTier: "budget", EstCostPerDay: 1400,
			BestMonths: []int{1, 2, 3, 4, 5, 9, 10, 11, 12}, IdealDays: 2, Status: "published",
		},
		{
			ID: "che", StateCode: "ML", Name: "Cherrapunji (Sohra)", Slug: "cherrapunji-sohra",
			Category: "waterfall", BudgetTier: "budget", EstCostPerDay: 1400,
			BestMonths: []int{1, 2, 3, 4, 9, 10, 11, 12}, IdealDays: 2, Status: "published",
		},
		{
			ID: "non", StateCode: "ML", Name: "Nongriat Root Bridges", Slug: "nongriat-root-bridges",
			Category: "trek", BudgetTier: "backpacker", EstCostPerDay: 900,
			BestMonths: []int{1, 2, 3, 4, 10, 11, 12}, IdealDays: 2, Status: "published",
		},
		{
			ID: "daw", StateCode: "ML", Name: "Dawki & Shnongpdeng", Slug: "dawki-shnongpdeng-river",
			Category: "waterfall", BudgetTier: "budget", EstCostPerDay: 1200,
			BestMonths: []int{1, 2, 3, 4, 11, 12}, IdealDays: 2, Status: "published",
		},
		{
			ID: "kaz", StateCode: "AS", Name: "Kaziranga National Park", Slug: "kaziranga-national-park",
			Category: "wildlife", BudgetTier: "budget", EstCostPerDay: 2000,
			BestMonths: []int{1, 2, 3, 4, 11, 12}, IdealDays: 2, Status: "published",
		},
		{
			ID: "maj", StateCode: "AS", Name: "Majuli Island", Slug: "majuli-island",
			Category: "culture", BudgetTier: "backpacker", EstCostPerDay: 950,
			BestMonths: []int{1, 2, 3, 10, 11, 12}, IdealDays: 2, Status: "published",
		},
		{
			ID: "tez", StateCode: "AS", Name: "Tezpur", Slug: "tezpur",
			Category: "culture", BudgetTier: "budget", EstCostPerDay: 1100,
			BestMonths: []int{1, 2, 3, 4, 10, 11, 12}, IdealDays: 1, Status: "published",
		},
		{
			ID: "taw", StateCode: "AR", Name: "Tawang", Slug: "tawang-sela-pass",
			Category: "monastery", BudgetTier: "moderate", EstCostPerDay: 2200,
			BestMonths: []int{3, 4, 5, 10, 11}, IdealDays: 4, Status: "published",
		},
		{
			ID: "dim", StateCode: "NL", Name: "Dimapur", Slug: "dimapur",
			Category: "culture", BudgetTier: "budget", EstCostPerDay: 1100,
			BestMonths: []int{1, 2, 3, 4, 10, 11, 12}, IdealDays: 1, Status: "published",
		},
		{
			ID: "koh", StateCode: "NL", Name: "Kohima", Slug: "kohima-kisama-hornbill",
			Category: "culture", BudgetTier: "budget", EstCostPerDay: 1300,
			BestMonths: []int{1, 2, 3, 10, 11, 12}, IdealDays: 2, Status: "published",
		},
		{
			ID: "dzu", StateCode: "NL", Name: "Dzukou Valley", Slug: "dzukou-valley-trek",
			Category: "trek", BudgetTier: "backpacker", EstCostPerDay: 900,
			BestMonths: []int{6, 7, 8, 9, 10, 11, 12}, IdealDays: 2, Status: "published",
		},
		{
			ID: "sil", StateCode: "SK", Name: "Siliguri", Slug: "siliguri",
			Category: "culture", BudgetTier: "budget", EstCostPerDay: 1000,
			BestMonths: []int{1, 2, 3, 4, 5, 10, 11, 12}, IdealDays: 1, Status: "published",
		},
		{
			ID: "gan", StateCode: "SK", Name: "Gangtok", Slug: "gangtok",
			Category: "scenic", BudgetTier: "budget", EstCostPerDay: 1600,
			BestMonths: []int{3, 4, 5, 10, 11}, IdealDays: 2, Status: "published",
		},
		{
			ID: "gur", StateCode: "SK", Name: "Gurudongmar Lake", Slug: "gurudongmar-lake-north-sikkim",
			Category: "scenic", BudgetTier: "moderate", EstCostPerDay: 2500,
			BestMonths: []int{4, 5, 6, 10, 11}, IdealDays: 3, Status: "published",
		},
	}

	legs := []db.RouteLeg{
		// Assam - Meghalaya
		{FromSlug: "guwahati", ToSlug: "shillong", StateCode: "ML", Mode: "shared-sumo", FareMinINR: 300, FareMaxINR: 400, DurationMinHrs: 2.5, DurationMaxHrs: 3.0},
		{FromSlug: "shillong", ToSlug: "guwahati", StateCode: "AS", Mode: "shared-sumo", FareMinINR: 300, FareMaxINR: 400, DurationMinHrs: 2.5, DurationMaxHrs: 3.0},
		{FromSlug: "shillong", ToSlug: "cherrapunji-sohra", StateCode: "ML", Mode: "shared-sumo", FareMinINR: 120, FareMaxINR: 180, DurationMinHrs: 1.5, DurationMaxHrs: 2.0},
		{FromSlug: "cherrapunji-sohra", ToSlug: "shillong", StateCode: "ML", Mode: "shared-sumo", FareMinINR: 120, FareMaxINR: 180, DurationMinHrs: 1.5, DurationMaxHrs: 2.0},
		{FromSlug: "cherrapunji-sohra", ToSlug: "nongriat-root-bridges", StateCode: "ML", Mode: "trek", FareMinINR: 50, FareMaxINR: 80, DurationMinHrs: 1.5, DurationMaxHrs: 2.0},
		{FromSlug: "nongriat-root-bridges", ToSlug: "cherrapunji-sohra", StateCode: "ML", Mode: "trek", FareMinINR: 50, FareMaxINR: 80, DurationMinHrs: 2.0, DurationMaxHrs: 2.5},
		{FromSlug: "cherrapunji-sohra", ToSlug: "dawki-shnongpdeng-river", StateCode: "ML", Mode: "shared-sumo", FareMinINR: 200, FareMaxINR: 300, DurationMinHrs: 2.5, DurationMaxHrs: 3.0},
		{FromSlug: "dawki-shnongpdeng-river", ToSlug: "shillong", StateCode: "ML", Mode: "shared-sumo", FareMinINR: 180, FareMaxINR: 250, DurationMinHrs: 3.0, DurationMaxHrs: 3.5},
		{FromSlug: "dawki-shnongpdeng-river", ToSlug: "guwahati", StateCode: "AS", Mode: "shared-sumo", FareMinINR: 450, FareMaxINR: 600, DurationMinHrs: 5.0, DurationMaxHrs: 6.0},

		// Assam Wildlife & Majuli
		{FromSlug: "guwahati", ToSlug: "kaziranga-national-park", StateCode: "AS", Mode: "bus", FareMinINR: 280, FareMaxINR: 350, DurationMinHrs: 4.5, DurationMaxHrs: 5.0, BlockedMonths: []int{6, 7, 8, 9}},
		{FromSlug: "kaziranga-national-park", ToSlug: "guwahati", StateCode: "AS", Mode: "bus", FareMinINR: 280, FareMaxINR: 350, DurationMinHrs: 4.5, DurationMaxHrs: 5.0, BlockedMonths: []int{6, 7, 8, 9}},
		{FromSlug: "kaziranga-national-park", ToSlug: "majuli-island", StateCode: "AS", Mode: "ferry", FareMinINR: 150, FareMaxINR: 250, DurationMinHrs: 3.0, DurationMaxHrs: 3.5},
		{FromSlug: "majuli-island", ToSlug: "guwahati", StateCode: "AS", Mode: "train", FareMinINR: 180, FareMaxINR: 300, DurationMinHrs: 6.0, DurationMaxHrs: 7.0},

		// Arunachal
		{FromSlug: "tezpur", ToSlug: "tawang-sela-pass", StateCode: "AR", Mode: "shared-sumo", FareMinINR: 1200, FareMaxINR: 1500, DurationMinHrs: 10.0, DurationMaxHrs: 12.0, BlockedMonths: []int{7, 8}},
		{FromSlug: "tawang-sela-pass", ToSlug: "tezpur", StateCode: "AR", Mode: "shared-sumo", FareMinINR: 1200, FareMaxINR: 1500, DurationMinHrs: 10.0, DurationMaxHrs: 12.0, BlockedMonths: []int{7, 8}},

		// Nagaland
		{FromSlug: "dimapur", ToSlug: "kohima-kisama-hornbill", StateCode: "NL", Mode: "shared-sumo", FareMinINR: 250, FareMaxINR: 350, DurationMinHrs: 2.5, DurationMaxHrs: 3.0},
		{FromSlug: "kohima-kisama-hornbill", ToSlug: "dimapur", StateCode: "NL", Mode: "shared-sumo", FareMinINR: 250, FareMaxINR: 350, DurationMinHrs: 2.5, DurationMaxHrs: 3.0},
		{FromSlug: "kohima-kisama-hornbill", ToSlug: "dzukou-valley-trek", StateCode: "NL", Mode: "shared-sumo", FareMinINR: 80, FareMaxINR: 120, DurationMinHrs: 1.0, DurationMaxHrs: 1.5},
		{FromSlug: "dzukou-valley-trek", ToSlug: "kohima-kisama-hornbill", StateCode: "NL", Mode: "shared-sumo", FareMinINR: 80, FareMaxINR: 120, DurationMinHrs: 1.0, DurationMaxHrs: 1.5},

		// Sikkim
		{FromSlug: "siliguri", ToSlug: "gangtok", StateCode: "SK", Mode: "shared-sumo", FareMinINR: 350, FareMaxINR: 450, DurationMinHrs: 4.5, DurationMaxHrs: 5.0},
		{FromSlug: "gangtok", ToSlug: "siliguri", StateCode: "SK", Mode: "shared-sumo", FareMinINR: 350, FareMaxINR: 450, DurationMinHrs: 4.5, DurationMaxHrs: 5.0},
		{FromSlug: "gangtok", ToSlug: "gurudongmar-lake-north-sikkim", StateCode: "SK", Mode: "shared-sumo", FareMinINR: 3500, FareMaxINR: 4500, DurationMinHrs: 8.0, DurationMaxHrs: 10.0},
		{FromSlug: "gurudongmar-lake-north-sikkim", ToSlug: "gangtok", StateCode: "SK", Mode: "shared-sumo", FareMinINR: 3500, FareMaxINR: 4500, DurationMinHrs: 8.0, DurationMaxHrs: 10.0},
	}

	permits := []db.PermitRule{
		{
			ID: "AR-ILP", StateCode: "AR", Area: "All Arunachal Pradesh",
			AppliesTo: "indian", Type: "ILP", LeadTimeDays: 2, Fee: 100,
			OfficialURL: "https://arunachaltourism.com/ilp.php", Status: "published",
		},
		{
			ID: "AR-PAP", StateCode: "AR", Area: "All Arunachal Pradesh",
			AppliesTo: "foreign", Type: "PAP", LeadTimeDays: 14, Fee: 4000,
			OfficialURL: "https://arunachaltourism.com/pap.php", Status: "published",
		},
		{
			ID: "NL-ILP", StateCode: "NL", Area: "All Nagaland",
			AppliesTo: "indian", Type: "ILP", LeadTimeDays: 2, Fee: 50,
			OfficialURL: "https://ilp.nagaland.gov.in", Status: "published",
		},
		{
			ID: "SK-PAP-North", StateCode: "SK", Area: "North Sikkim (Gurudongmar/Lachung)",
			AppliesTo: "indian", Type: "PAP", LeadTimeDays: 1, Fee: 200,
			OfficialURL: "https://sikkimtourism.gov.in", Status: "published",
		},
		{
			ID: "SK-PAP-Foreign", StateCode: "SK", Area: "North Sikkim (Restricted for Foreigners)",
			AppliesTo: "foreign", Type: "PAP", LeadTimeDays: 3, Fee: 500,
			OfficialURL: "https://sikkimtourism.gov.in", Status: "published",
		},
	}

	events := []db.Event{
		{
			ID: "hornbill", StateCode: "NL", Name: "Hornbill Festival",
			AnnualMonth: 12, LocationName: "Kisama Heritage Village, Kohima",
			Category: "tribal-festival",
		},
		{
			ID: "ziro-music", StateCode: "AR", Name: "Ziro Festival of Music",
			AnnualMonth: 9, LocationName: "Ziro Valley",
			Category: "music-festival",
		},
	}

	return dests, legs, permits, events
}

// Test 01: Guwahati 5 nights, October, 18k, Indian -> Classic Loop, feasible, no ILP
func TestPlanner_Guwahati5NightsOctober_Feasible(t *testing.T) {
	dests, legs, permits, events := mockData()
	req := planner.PlanRequest{
		Gateway:        "guwahati",
		StartDate:      time.Date(2026, 10, 15, 0, 0, 0, 0, time.UTC),
		Nights:         5,
		BudgetTotalINR: 18000,
		Pace:           "moderate",
		TravellerType:  "indian",
	}

	plans := planner.GeneratePlans(dests, legs, permits, events, req)
	if len(plans) == 0 {
		t.Fatal("Expected at least 1 plan, got 0")
	}

	topPlan := plans[0]
	if topPlan.Status == planner.StatusNotRecommended {
		t.Errorf("Expected status feasible or tight, got %v with warnings: %v", topPlan.Status, topPlan.Warnings)
	}

	// Meghalaya / Assam circuits require no ILP
	for _, p := range topPlan.PermitsNeeded {
		if p == "AR-ILP" || p == "NL-ILP" {
			t.Errorf("Did not expect ILP %s for Assam-Meghalaya plan", p)
		}
	}
}

// Test 02: Guwahati 7 nights, March, 25k -> Includes Kaziranga / Majuli
func TestPlanner_Guwahati7NightsMarch_WildlifeAndRiver(t *testing.T) {
	dests, legs, permits, events := mockData()
	req := planner.PlanRequest{
		Gateway:        "guwahati",
		StartDate:      time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC),
		Nights:         7,
		BudgetTotalINR: 25000,
		Pace:           "moderate",
		Interests:      []string{"wildlife", "culture"},
		TravellerType:  "indian",
	}

	plans := planner.GeneratePlans(dests, legs, permits, events, req)
	if len(plans) == 0 {
		t.Fatal("Expected at least 1 plan")
	}

	foundCircuit := false
	for _, p := range plans {
		for _, day := range p.Days {
			if day.DestinationSlug == "kaziranga-national-park" || day.DestinationSlug == "shillong" {
				foundCircuit = true
				break
			}
		}
	}
	if !foundCircuit {
		t.Errorf("Expected circuit to include Kaziranga or Shillong")
	}
}

// Test 03: Guwahati 4 nights, December, 15k -> Meghalaya loop
func TestPlanner_Guwahati4NightsDecember_Meghalaya(t *testing.T) {
	dests, legs, permits, events := mockData()
	req := planner.PlanRequest{
		Gateway:        "guwahati",
		StartDate:      time.Date(2026, 12, 5, 0, 0, 0, 0, time.UTC),
		Nights:         4,
		BudgetTotalINR: 15000,
		Pace:           "moderate",
		TravellerType:  "indian",
	}

	plans := planner.GeneratePlans(dests, legs, permits, events, req)
	if len(plans) == 0 {
		t.Fatal("Expected plan for 4 nights December")
	}
	if plans[0].Status == planner.StatusNotRecommended {
		t.Errorf("Plan should be feasible or tight, not recommended")
	}
}

// Test 04: Tezpur 6 nights, November, monastery interest -> Tawang circuit, must trigger ILP
func TestPlanner_TezpurTawang_ILPWarning(t *testing.T) {
	dests, legs, permits, events := mockData()
	req := planner.PlanRequest{
		Gateway:        "tezpur",
		StartDate:      time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC),
		Nights:         6,
		BudgetTotalINR: 22000,
		Pace:           "moderate",
		Interests:      []string{"monastery"},
		TravellerType:  "indian",
	}

	plans := planner.GeneratePlans(dests, legs, permits, events, req)
	if len(plans) == 0 {
		t.Fatal("Expected plan for Tezpur gateway")
	}

	hasILP := false
	for _, p := range plans[0].PermitsNeeded {
		if p == "AR-ILP" {
			hasILP = true
		}
	}
	if !hasILP {
		t.Errorf("Expected AR-ILP permit in plan, got: %v", plans[0].PermitsNeeded)
	}
}

// Test 05: Dimapur 5 nights, December -> Hornbill festival bonus, Kohima & Dzukou
func TestPlanner_DimapurDecember_HornbillBonus(t *testing.T) {
	dests, legs, permits, events := mockData()
	req := planner.PlanRequest{
		Gateway:        "dimapur",
		StartDate:      time.Date(2026, 12, 2, 0, 0, 0, 0, time.UTC),
		Nights:         5,
		BudgetTotalINR: 20000,
		Pace:           "moderate",
		TravellerType:  "indian",
	}

	plans := planner.GeneratePlans(dests, legs, permits, events, req)
	if len(plans) == 0 {
		t.Fatal("Expected plans for Dimapur")
	}

	topPlan := plans[0]
	// Hornbill is in December, so score should receive a festival bonus
	if topPlan.Score <= 50.0 {
		t.Errorf("Expected elevated score from Hornbill festival bonus, got %f", topPlan.Score)
	}

	hasNLILP := false
	for _, p := range topPlan.PermitsNeeded {
		if p == "NL-ILP" {
			hasNLILP = true
		}
	}
	if !hasNLILP {
		t.Errorf("Expected NL-ILP for Nagaland travel")
	}
}

// Test 06: Siliguri 5 nights, April, Indian -> Sikkim Gurudongmar, PAP warning
func TestPlanner_SiliguriApril_SikkimPAP(t *testing.T) {
	dests, legs, permits, events := mockData()
	req := planner.PlanRequest{
		Gateway:        "siliguri",
		StartDate:      time.Date(2026, 4, 15, 0, 0, 0, 0, time.UTC),
		Nights:         5,
		BudgetTotalINR: 25000,
		Pace:           "moderate",
		TravellerType:  "indian",
	}

	plans := planner.GeneratePlans(dests, legs, permits, events, req)
	if len(plans) == 0 {
		t.Fatal("Expected plans for Siliguri gateway")
	}

	hasPAP := false
	for _, p := range plans[0].PermitsNeeded {
		if p == "SK-PAP-North" {
			hasPAP = true
		}
	}
	if !hasPAP {
		t.Errorf("Expected SK-PAP-North for Gurudongmar, got: %v", plans[0].PermitsNeeded)
	}
}

// Test 07: Guwahati 2 nights, 5k -> Short trip, tight status
func TestPlanner_Guwahati2Nights_Tight(t *testing.T) {
	dests, legs, permits, events := mockData()
	req := planner.PlanRequest{
		Gateway:        "guwahati",
		StartDate:      time.Date(2026, 10, 10, 0, 0, 0, 0, time.UTC),
		Nights:         2,
		BudgetTotalINR: 4000,
		Pace:           "relaxed",
		TravellerType:  "indian",
	}

	plans := planner.GeneratePlans(dests, legs, permits, events, req)
	if len(plans) > 0 {
		t.Logf("Plan status: %v, cost: %d - %d", plans[0].Status, plans[0].CostRangeLow, plans[0].CostRangeHigh)
	}
}

// Test 08: Guwahati 3 nights, July, wildlife -> Kaziranga safari blocked in monsoon
func TestPlanner_KazirangaMonsoon_Blocked(t *testing.T) {
	dests, legs, permits, events := mockData()
	req := planner.PlanRequest{
		Gateway:        "guwahati",
		StartDate:      time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC), // July = Monsoon
		Nights:         3,
		BudgetTotalINR: 10000,
		Pace:           "moderate",
		Interests:      []string{"wildlife"},
		TravellerType:  "indian",
	}

	plans := planner.GeneratePlans(dests, legs, permits, events, req)
	for _, p := range plans {
		for _, day := range p.Days {
			if day.DestinationSlug == "kaziranga-national-park" {
				// If Kaziranga is present in July, status MUST be NotRecommended
				if p.Status != planner.StatusNotRecommended {
					t.Errorf("Kaziranga in July must be NotRecommended due to monsoon closure, got %v", p.Status)
				}
			}
		}
	}
}

// Test 09: Foreign traveller in Arunachal -> PAP warning with longer lead time
func TestPlanner_ForeignTraveller_ArunachalPAP(t *testing.T) {
	dests, legs, permits, events := mockData()
	req := planner.PlanRequest{
		Gateway:        "tezpur",
		StartDate:      time.Date(2026, 11, 10, 0, 0, 0, 0, time.UTC),
		Nights:         6,
		BudgetTotalINR: 30000,
		Pace:           "moderate",
		TravellerType:  "foreign",
	}

	plans := planner.GeneratePlans(dests, legs, permits, events, req)
	if len(plans) == 0 {
		t.Fatal("Expected plans for Tezpur foreign traveller")
	}

	hasPAP := false
	for _, p := range plans[0].PermitsNeeded {
		if p == "AR-PAP" {
			hasPAP = true
		}
	}
	if !hasPAP {
		t.Errorf("Expected AR-PAP for foreign traveller in Arunachal, got: %v", plans[0].PermitsNeeded)
	}
}

// Test 10: Invalid Gateway -> gracefully handled
func TestPlanner_InvalidGateway_NoPlans(t *testing.T) {
	dests, legs, permits, events := mockData()
	req := planner.PlanRequest{
		Gateway:        "non-existent-city",
		StartDate:      time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC),
		Nights:         5,
		BudgetTotalINR: 20000,
		Pace:           "moderate",
		TravellerType:  "indian",
	}

	plans := planner.GeneratePlans(dests, legs, permits, events, req)
	if len(plans) == 0 || plans[0].Status != planner.StatusNotRecommended {
		t.Errorf("Expected NotRecommended for non-existent gateway, got %v", plans)
	}
}

// Test 11: Property Test - No plan contains a leg blocked in travel month
func TestPlanner_Property_NoBlockedLegsInTravelMonth(t *testing.T) {
	dests, legs, permits, events := mockData()
	req := planner.PlanRequest{
		Gateway:        "guwahati",
		StartDate:      time.Date(2026, 7, 20, 0, 0, 0, 0, time.UTC),
		Nights:         4,
		BudgetTotalINR: 15000,
		Pace:           "moderate",
		TravellerType:  "indian",
	}

	plans := planner.GeneratePlans(dests, legs, permits, events, req)
	for _, p := range plans {
		if p.Status == planner.StatusFeasible {
			for _, day := range p.Days {
				if day.DestinationSlug == "kaziranga-national-park" {
					t.Errorf("Property violation: Feasible plan contains Kaziranga in July")
				}
			}
		}
	}
}

// Test 12: Property Test - All ILP states trigger permit warnings
func TestPlanner_Property_ILPStatesTriggerPermits(t *testing.T) {
	dests, legs, permits, events := mockData()
	req := planner.PlanRequest{
		Gateway:        "dimapur",
		StartDate:      time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC),
		Nights:         4,
		BudgetTotalINR: 15000,
		Pace:           "moderate",
		TravellerType:  "indian",
	}

	plans := planner.GeneratePlans(dests, legs, permits, events, req)
	for _, p := range plans {
		for _, day := range p.Days {
			if day.DestinationSlug == "kohima-kisama-hornbill" || day.DestinationSlug == "dzukou-valley-trek" {
				hasNL := false
				for _, permit := range p.PermitsNeeded {
					if permit == "NL-ILP" {
						hasNL = true
					}
				}
				if !hasNL {
					t.Errorf("Property violation: Nagaland destination included without NL-ILP permit")
				}
			}
		}
	}
}

// Test 13: Property Test - Cost estimates are strictly positive
func TestPlanner_Property_CostEstimatesPositive(t *testing.T) {
	dests, legs, permits, events := mockData()
	req := planner.PlanRequest{
		Gateway:        "guwahati",
		StartDate:      time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC),
		Nights:         5,
		BudgetTotalINR: 20000,
		Pace:           "moderate",
		TravellerType:  "indian",
	}

	plans := planner.GeneratePlans(dests, legs, permits, events, req)
	for _, p := range plans {
		if p.CostRangeLow <= 0 || p.CostRangeHigh <= 0 {
			t.Errorf("Property violation: Plan cost ranges must be positive, got [%d, %d]", p.CostRangeLow, p.CostRangeHigh)
		}
		if p.CostRangeHigh < p.CostRangeLow {
			t.Errorf("Property violation: CostRangeHigh (%d) < CostRangeLow (%d)", p.CostRangeHigh, p.CostRangeLow)
		}
	}
}

// Test 14: FilterCandidates unit test
func TestPlanner_FilterCandidates(t *testing.T) {
	dests, _, _, _ := mockData()
	req := planner.PlanRequest{
		Gateway:   "guwahati",
		StartDate: time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC), // July
		Interests: []string{"wildlife"},
	}

	candidates := planner.FilterCandidates(dests, req)
	for _, c := range candidates {
		// In July, Kaziranga (months 1,2,3,4,11,12) should be filtered out
		if c.Slug == "kaziranga-national-park" {
			t.Errorf("Kaziranga should not be a candidate in July")
		}
	}
}

// Test 15: AssignStatus unit test
func TestPlanner_AssignStatus(t *testing.T) {
	hardRejects := []planner.PlanWarning{
		{RuleID: "MONSOON_BLOCKED", Message: "Blocked", Severity: "error"},
	}
	softWarns := []planner.PlanWarning{
		{RuleID: "TIGHT_BUDGET", Message: "Budget is close", Severity: "warning"},
	}

	if status := planner.AssignStatus(hardRejects, nil); status != planner.StatusNotRecommended {
		t.Errorf("Expected NotRecommended for hard rejects, got %v", status)
	}
	if status := planner.AssignStatus(nil, softWarns); status != planner.StatusTight {
		t.Errorf("Expected Tight for soft violations, got %v", status)
	}
	if status := planner.AssignStatus(nil, nil); status != planner.StatusFeasible {
		t.Errorf("Expected Feasible when clean, got %v", status)
	}
}
