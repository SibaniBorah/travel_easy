// Package budget provides cost estimation and local value scoring for trips.
package budget

import (
	"chaloner/internal/db"
)

// TravelStyle represents the tier of travel.
type TravelStyle string

const (
	StyleBackpacker TravelStyle = "backpacker"
	StyleBudget     TravelStyle = "budget"
	StyleComfort    TravelStyle = "comfort"
)

// CostRange holds low/expected/high cost estimates in INR.
type CostRange struct {
	Low      int `json:"low"`
	Expected int `json:"expected"`
	High     int `json:"high"`
}

// BudgetBreakdown provides a full cost breakdown for a trip.
type BudgetBreakdown struct {
	Stay      CostRange `json:"stay"`
	Food      CostRange `json:"food"`
	Transport CostRange `json:"transport"`
	Permits   CostRange `json:"permits"`
	Buffer    CostRange `json:"buffer"`
	Total     CostRange `json:"total"`
}

// styleMultiplier maps travel style to a cost multiplier.
func styleMultiplier(style TravelStyle) float64 {
	switch style {
	case StyleBackpacker:
		return 0.7
	case StyleComfort:
		return 1.6
	default: // budget
		return 1.0
	}
}

// LocalValueScore returns fraction 0-1 of spend going to locally-owned businesses.
func LocalValueScore(estimates []db.BudgetEstimate) float64 {
	if len(estimates) == 0 {
		return 0
	}
	var totalSpend, localSpend float64
	for _, e := range estimates {
		avg := float64(e.MinINR+e.MaxINR) / 2
		totalSpend += avg
		if e.LocallyOwned {
			localSpend += avg
		}
	}
	if totalSpend == 0 {
		return 0
	}
	return localSpend / totalSpend
}

// EstimateTripCost builds a full breakdown for a circuit.
func EstimateTripCost(circuit []db.Destination, legs []db.RouteLeg, style TravelStyle, nights int, travelers int) BudgetBreakdown {
	mult := styleMultiplier(style)
	days := nights
	if days < 1 {
		days = 1
	}

	// Stay: based on avg EstCostPerDay across destinations.
	var stayBase int
	for _, d := range circuit {
		stayBase += d.EstCostPerDay
	}
	if len(circuit) > 0 {
		stayBase = stayBase / len(circuit)
	}
	stayPerNight := int(float64(stayBase) * mult)
	stayLow := stayPerNight * nights * travelers
	stayExp := int(float64(stayLow) * 1.15)
	stayHigh := int(float64(stayLow) * 1.4)

	// Food: rough 30% of stay cost.
	foodLow := stayLow * 30 / 100
	foodExp := stayExp * 30 / 100
	foodHigh := stayHigh * 30 / 100

	// Transport: sum of leg fares.
	var transMin, transMax int
	for _, l := range legs {
		transMin += l.FareMinINR * travelers
		transMax += l.FareMaxINR * travelers
	}
	transExp := (transMin + transMax) / 2

	// Permits: 100 INR per destination per person (placeholder).
	permitsLow := len(circuit) * 100 * travelers
	permitsHigh := len(circuit) * 500 * travelers
	permitsExp := (permitsLow + permitsHigh) / 2

	// Buffer: 10% of subtotal.
	subtotalLow := stayLow + foodLow + transMin + permitsLow
	subtotalHigh := stayHigh + foodHigh + transMax + permitsHigh
	bufferLow := subtotalLow / 10
	bufferHigh := subtotalHigh / 10
	bufferExp := (bufferLow + bufferHigh) / 2

	total := BudgetBreakdown{
		Stay:      CostRange{Low: stayLow, Expected: stayExp, High: stayHigh},
		Food:      CostRange{Low: foodLow, Expected: foodExp, High: foodHigh},
		Transport: CostRange{Low: transMin, Expected: transExp, High: transMax},
		Permits:   CostRange{Low: permitsLow, Expected: permitsExp, High: permitsHigh},
		Buffer:    CostRange{Low: bufferLow, Expected: bufferExp, High: bufferHigh},
	}
	total.Total = CostRange{
		Low:      subtotalLow + bufferLow,
		Expected: (stayExp + foodExp + transExp + permitsExp) + bufferExp,
		High:     subtotalHigh + bufferHigh,
	}
	_ = days
	return total
}
