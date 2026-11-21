package permits

import (
	"testing"
	"time"

	"chaloner/internal/db"
)

func makePermitRule(id, stateCode, appliesTo, pType string) db.PermitRule {
	return db.PermitRule{
		ID:                id,
		StateCode:         stateCode,
		Area:              stateCode + " restricted",
		AppliesTo:         appliesTo,
		Type:              pType,
		DocumentsRequired: []string{"Aadhaar", "Passport Photo"},
		LeadTimeDays:      7,
		Fee:               100,
		OfficialURL:       "https://example.gov.in/" + id,
		Status:            "published",
	}
}

var allRules = []db.PermitRule{
	makePermitRule("AR-ILP", "AR", "all", "ILP"),
	makePermitRule("NL-ILP", "NL", "all", "ILP"),
	makePermitRule("MN-ILP", "MN", "all", "ILP"),
	makePermitRule("MZ-ILP", "MZ", "all", "ILP"),
	makePermitRule("SK-PAP-North", "SK", "all", "PAP"),
	makePermitRule("SK-PAP-Restricted", "SK", "indian", "PAP"),
	makePermitRule("AR-PAP-Foreign", "AR", "foreign", "PAP"),
	makePermitRule("SK-RAP-Foreign", "SK", "foreign", "RAP"),
}

func dest(state string) db.Destination {
	return db.Destination{StateCode: state, Slug: "test-" + state, Status: "published"}
}

func TestMatchPermits_Indian_Arunachal(t *testing.T) {
	circuit := []db.Destination{dest("AR")}
	matched := MatchPermits(circuit, allRules, "indian")
	if len(matched) == 0 {
		t.Fatal("expected ILP rule for AR, got none")
	}
	for _, m := range matched {
		if m.StateCode != "AR" {
			t.Errorf("unexpected state %s", m.StateCode)
		}
	}
	// AR-PAP-Foreign should NOT appear for Indian
	for _, m := range matched {
		if m.ID == "AR-PAP-Foreign" {
			t.Error("foreign-only PAP rule matched indian traveller")
		}
	}
}

func TestMatchPermits_Foreign_Arunachal(t *testing.T) {
	circuit := []db.Destination{dest("AR")}
	matched := MatchPermits(circuit, allRules, "foreign")
	types := map[string]bool{}
	for _, m := range matched {
		types[m.Type] = true
	}
	if !types["ILP"] {
		t.Error("ILP should apply to foreign travellers in AR")
	}
	if !types["PAP"] {
		t.Error("PAP should apply to foreign travellers in AR")
	}
}

func TestMatchPermits_NoPermit_Assam(t *testing.T) {
	circuit := []db.Destination{dest("AS")}
	matched := MatchPermits(circuit, allRules, "indian")
	if len(matched) != 0 {
		t.Errorf("expected 0 permits for Assam, got %d", len(matched))
	}
}

func TestMatchPermits_MultiState(t *testing.T) {
	circuit := []db.Destination{dest("AS"), dest("NL"), dest("MN")}
	matched := MatchPermits(circuit, allRules, "indian")
	states := map[string]bool{}
	for _, m := range matched {
		states[m.StateCode] = true
	}
	if !states["NL"] {
		t.Error("expected NL ILP")
	}
	if !states["MN"] {
		t.Error("expected MN ILP")
	}
	if states["AS"] {
		t.Error("AS should not require a permit")
	}
}

func TestMatchPermits_Sikkim_Indian(t *testing.T) {
	circuit := []db.Destination{dest("SK")}
	matched := MatchPermits(circuit, allRules, "indian")
	types := map[string]bool{}
	for _, m := range matched {
		types[m.Type] = true
	}
	if !types["PAP"] {
		t.Error("Indian traveller should need PAP for Sikkim")
	}
	// RAP is foreign-only
	if types["RAP"] {
		t.Error("RAP is for foreign travellers only")
	}
}

func TestGenerateChecklist_Deadline(t *testing.T) {
	startDate := time.Date(2024, 12, 1, 0, 0, 0, 0, time.UTC)
	rules := []db.PermitRule{
		makePermitRule("AR-ILP", "AR", "all", "ILP"),
	}
	items := GenerateChecklist(rules, startDate)
	if len(items) != 1 {
		t.Fatalf("expected 1 checklist item, got %d", len(items))
	}
	expected := startDate.AddDate(0, 0, -7)
	if !items[0].Deadline.Equal(expected) {
		t.Errorf("deadline: got %v want %v", items[0].Deadline, expected)
	}
}

func TestGenerateChecklist_AllFields(t *testing.T) {
	startDate := time.Date(2025, 3, 15, 0, 0, 0, 0, time.UTC)
	items := GenerateChecklist(allRules, startDate)
	if len(items) != len(allRules) {
		t.Errorf("expected %d items, got %d", len(allRules), len(items))
	}
	for _, item := range items {
		if item.PermitType == "" {
			t.Error("permit type should not be empty")
		}
		if len(item.Documents) == 0 {
			t.Error("documents should not be empty")
		}
	}
}
