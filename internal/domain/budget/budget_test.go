package budget

import (
	"testing"

	"chaloner/internal/db"
)

func makeEstimates(localFrac float64) []db.BudgetEstimate {
	return []db.BudgetEstimate{
		{ID: "1", MinINR: 500, MaxINR: 1000, LocallyOwned: true},
		{ID: "2", MinINR: 1000, MaxINR: 2000, LocallyOwned: false},
	}
}

func TestLocalValueScore_Empty(t *testing.T) {
	score := LocalValueScore(nil)
	if score != 0 {
		t.Errorf("expected 0 for empty estimates, got %f", score)
	}
}

func TestLocalValueScore_AllLocal(t *testing.T) {
	estimates := []db.BudgetEstimate{
		{ID: "1", MinINR: 500, MaxINR: 1000, LocallyOwned: true},
		{ID: "2", MinINR: 300, MaxINR: 600, LocallyOwned: true},
	}
	score := LocalValueScore(estimates)
	if score != 1.0 {
		t.Errorf("expected 1.0 for all-local estimates, got %f", score)
	}
}

func TestLocalValueScore_NoneLocal(t *testing.T) {
	estimates := []db.BudgetEstimate{
		{ID: "1", MinINR: 500, MaxINR: 1000, LocallyOwned: false},
		{ID: "2", MinINR: 300, MaxINR: 600, LocallyOwned: false},
	}
	score := LocalValueScore(estimates)
	if score != 0.0 {
		t.Errorf("expected 0.0 for no-local estimates, got %f", score)
	}
}

func TestLocalValueScore_Mixed(t *testing.T) {
	_ = makeEstimates(0.5)
	estimates := []db.BudgetEstimate{
		{ID: "1", MinINR: 1000, MaxINR: 1000, LocallyOwned: true},
		{ID: "2", MinINR: 1000, MaxINR: 1000, LocallyOwned: false},
	}
	score := LocalValueScore(estimates)
	if score < 0.49 || score > 0.51 {
		t.Errorf("expected ~0.5 for 50/50 split, got %f", score)
	}
}

func makeDest(slug, state string, costPerDay int) db.Destination {
	return db.Destination{
		Slug:          slug,
		StateCode:     state,
		EstCostPerDay: costPerDay,
		Status:        "published",
	}
}

func makeLeg(from, to string, minFare, maxFare int) db.RouteLeg {
	return db.RouteLeg{
		FromSlug:   from,
		ToSlug:     to,
		FareMinINR: minFare,
		FareMaxINR: maxFare,
		Status:     "published",
	}
}

func TestEstimateTripCost_Backpacker(t *testing.T) {
	circuit := []db.Destination{
		makeDest("shillong", "ML", 1000),
		makeDest("cherrapunji", "ML", 800),
	}
	legs := []db.RouteLeg{
		makeLeg("guwahati", "shillong", 150, 250),
	}
	bd := EstimateTripCost(circuit, legs, StyleBackpacker, 4, 2)
	if bd.Total.Low <= 0 {
		t.Error("total cost should be > 0")
	}
	if bd.Total.Low > bd.Total.High {
		t.Error("low should be <= high")
	}
	if bd.Transport.Low != 300 { // 150*2
		t.Errorf("transport low: expected 300, got %d", bd.Transport.Low)
	}
}

func TestEstimateTripCost_Comfort_HigherThanBudget(t *testing.T) {
	circuit := []db.Destination{makeDest("tawang", "AR", 2000)}
	legs := []db.RouteLeg{}
	bdBudget := EstimateTripCost(circuit, legs, StyleBudget, 3, 1)
	bdComfort := EstimateTripCost(circuit, legs, StyleComfort, 3, 1)
	if bdComfort.Stay.Low <= bdBudget.Stay.Low {
		t.Errorf("comfort stay (%d) should be > budget stay (%d)", bdComfort.Stay.Low, bdBudget.Stay.Low)
	}
}

func TestEstimateTripCost_Buffer10Pct(t *testing.T) {
	circuit := []db.Destination{makeDest("kaziranga", "AS", 1500)}
	legs := []db.RouteLeg{}
	bd := EstimateTripCost(circuit, legs, StyleBudget, 2, 1)
	subtotal := bd.Stay.Low + bd.Food.Low + bd.Transport.Low + bd.Permits.Low
	expectedBuf := subtotal / 10
	if bd.Buffer.Low != expectedBuf {
		t.Errorf("buffer low: expected %d, got %d", expectedBuf, bd.Buffer.Low)
	}
}

func TestEstimateTripCost_TotalSum(t *testing.T) {
	circuit := []db.Destination{makeDest("majuli", "AS", 1200)}
	legs := []db.RouteLeg{makeLeg("guwahati", "jorhat", 400, 600)}
	bd := EstimateTripCost(circuit, legs, StyleBudget, 3, 2)
	computedLow := bd.Stay.Low + bd.Food.Low + bd.Transport.Low + bd.Permits.Low + bd.Buffer.Low
	if bd.Total.Low != computedLow {
		t.Errorf("total.low: expected %d, got %d", computedLow, bd.Total.Low)
	}
}
