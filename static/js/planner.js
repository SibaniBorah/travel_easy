/**
 * Chalo NorthEast - Trip Planner & Live Budget Calculator Engine
 */

class TripPlanner {
  constructor(app) {
    this.app = app;
    this.durationDays = 5;
    this.travelersCount = 2;
    this.travelStyle = "budget"; // backpacker, budget, comfort
    this.selectedDestinations = [];
    this.dayPlans = [];
    this.budgetData = null;
    this.init();
  }

  init() {
    this.bindControls();
    this.checkUrlForSavedTrip();
  }

  bindControls() {
    const daysSlider = document.getElementById("planner-days-slider");
    const daysVal = document.getElementById("planner-days-val");
    if (daysSlider && daysVal) {
      daysSlider.addEventListener("input", (e) => {
        this.durationDays = parseInt(e.target.value);
        daysVal.innerText = `${this.durationDays} Days`;
        this.rebuildDaySlots();
        this.recalculateBudget();
      });
    }

    const travelersSlider = document.getElementById("planner-travelers-slider");
    const travelersVal = document.getElementById("planner-travelers-val");
    if (travelersSlider && travelersVal) {
      travelersSlider.addEventListener("input", (e) => {
        this.travelersCount = parseInt(e.target.value);
        travelersVal.innerText = `${this.travelersCount} ${this.travelersCount === 1 ? 'Person' : 'People'}`;
        this.recalculateBudget();
      });
    }

    const styleButtons = document.querySelectorAll(".style-btn");
    styleButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        styleButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.travelStyle = btn.getAttribute("data-style");
        this.recalculateBudget();
      });
    });

    const saveBtn = document.getElementById("btn-save-itinerary");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => this.saveTrip());
    }

    const printBtn = document.getElementById("btn-print-itinerary");
    if (printBtn) {
      printBtn.addEventListener("click", () => this.printTripSheet());
    }

    const clearBtn = document.getElementById("btn-clear-itinerary");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => this.clearPlanner());
    }
  }

  addDestination(dest) {
    if (this.selectedDestinations.some(d => d.slug === dest.slug)) {
      this.app.showToast(`"${dest.name}" is already in your itinerary!`, "info");
      return;
    }

    this.selectedDestinations.push(dest);
    this.rebuildDaySlots();
    this.renderSelectedPills();
    this.recalculateBudget();
    this.app.showToast(`Added "${dest.name}" to your Trip Planner!`, "success");

    // Scroll to planner section if not visible
    const plannerEl = document.getElementById("planner");
    if (plannerEl) {
      plannerEl.scrollIntoView({ behavior: "smooth" });
    }
  }

  removeDestination(slug) {
    this.selectedDestinations = this.selectedDestinations.filter(d => d.slug !== slug);
    this.rebuildDaySlots();
    this.renderSelectedPills();
    this.recalculateBudget();
    this.app.showToast("Destination removed from itinerary", "info");
  }

  rebuildDaySlots() {
    this.dayPlans = [];
    const destCount = this.selectedDestinations.length;

    for (let day = 1; day <= this.durationDays; day++) {
      let assignedDest = null;
      let activities = [];

      if (destCount > 0) {
        // Distribute destinations evenly across days
        const destIndex = Math.min(destCount - 1, Math.floor((day - 1) / Math.max(1, Math.ceil(this.durationDays / destCount))));
        assignedDest = this.selectedDestinations[destIndex];

        if (day === 1) {
          activities.push(`Arrive at gateway hub (Guwahati / Shillong / Dimapur)`);
          activities.push(`Board budget transit: ${assignedDest.how_to_reach_budget.split('.')[0]}`);
          activities.push(`Check into local eco-homestay & explore nearby neighborhood`);
        } else if (day === this.durationDays) {
          activities.push(`Morning sunrise walk & local breakfast`);
          activities.push(`Shop for authentic tribal handicrafts / tea`);
          activities.push(`Return transit to transit hub for departure flight / train`);
        } else {
          activities.push(`Explore ${assignedDest.name}: ${assignedDest.top_highlights.split(',')[0] || 'Key attractions'}`);
          activities.push(`Try regional specialty: ${assignedDest.cultural_etiquette.split('.')[0] || 'Local cuisine'}`);
          activities.push(`Sunset view & community homestay dinner`);
        }
      } else {
        activities.push(`Custom Day ${day}: Click "+ Add to Planner" on any destination to auto-populate.`);
      }

      this.dayPlans.push({
        day,
        destination: assignedDest ? assignedDest.name : "Custom North East Exploration",
        state: assignedDest ? assignedDest.state_name : "Seven Sisters",
        activities
      });
    }

    this.renderDayPlans();
  }

  renderSelectedPills() {
    const container = document.getElementById("selected-destinations-pills");
    if (!container) return;

    if (this.selectedDestinations.length === 0) {
      container.innerHTML = `<span style="font-size:0.85rem; color:var(--text-muted); font-style:italic;">No destinations selected yet. Browse attractions above and click "+ Add to Itinerary".</span>`;
      return;
    }

    container.innerHTML = this.selectedDestinations.map(dest => `
      <div class="selected-dest-pill">
        <span>📍 ${dest.name}</span>
        <span class="pill-remove" onclick="window.app.planner.removeDestination('${dest.slug}')">&times;</span>
      </div>
    `).join("");
  }

  renderDayPlans() {
    const container = document.getElementById("planner-day-cards-list");
    if (!container) return;

    container.innerHTML = this.dayPlans.map(dp => `
      <div class="day-plan-card">
        <div class="day-plan-header">
          <div>
            <strong>Day ${dp.day}</strong> • <span style="color:var(--primary);">${dp.destination}</span>
          </div>
          <span style="font-size:0.75rem; background:var(--border-light); padding:0.2rem 0.5rem; border-radius:4px; font-weight:600;">${dp.state}</span>
        </div>
        <div class="day-plan-body">
          <ul class="day-plan-activities">
            ${dp.activities.map(act => `<li class="day-plan-activity-item">${act}</li>`).join("")}
          </ul>
        </div>
      </div>
    `).join("");
  }

  async recalculateBudget() {
    try {
      const payload = {
        duration_days: this.durationDays,
        travelers_count: this.travelersCount,
        travel_style: this.travelStyle,
        destinations: this.selectedDestinations.map(d => d.slug)
      };

      const res = await fetch("/api/calculate-budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      this.budgetData = data;
      this.renderBudgetBox(data);
    } catch (e) {
      console.error("Budget calculation error:", e);
    }
  }

  renderBudgetBox(data) {
    const totalEl = document.getElementById("budget-grand-total");
    const perPersonEl = document.getElementById("budget-per-person");
    const breakdownEl = document.getElementById("budget-breakdown-details");
    const savingsEl = document.getElementById("budget-savings-badge");

    if (totalEl) totalEl.innerText = `₹${data.grand_total_inr.toLocaleString('en-IN')}`;
    if (perPersonEl) perPersonEl.innerText = `₹${data.cost_per_person_total.toLocaleString('en-IN')} total (₹${data.cost_per_person_per_day.toLocaleString('en-IN')} / person / day)`;

    if (breakdownEl) {
      breakdownEl.innerHTML = `
        <div class="budget-breakdown-row">
          <span>🏡 Accommodation (Homestays):</span>
          <strong>₹${data.breakdown.stay_total.toLocaleString('en-IN')}</strong>
        </div>
        <div class="budget-breakdown-row">
          <span>🚐 Transport (Shared Sumos/Trains):</span>
          <strong>₹${data.breakdown.transport_total.toLocaleString('en-IN')}</strong>
        </div>
        <div class="budget-breakdown-row">
          <span>🍲 Food & Local Dining:</span>
          <strong>₹${data.breakdown.food_total.toLocaleString('en-IN')}</strong>
        </div>
        <div class="budget-breakdown-row">
          <span>🎫 Permits, Entry & Safaris:</span>
          <strong>₹${data.breakdown.permits_activities_total.toLocaleString('en-IN')}</strong>
        </div>
        <div class="budget-breakdown-row">
          <span>🛡️ Emergency Buffer & Misc:</span>
          <strong>₹${data.breakdown.buffer_misc_total.toLocaleString('en-IN')}</strong>
        </div>
      `;
    }

    if (savingsEl) {
      savingsEl.innerHTML = `✨ <strong>Save ~₹${data.savings_vs_commercial_tour_inr.toLocaleString('en-IN')}</strong> compared to rigid commercial travel agencies!`;
    }
  }

  loadPrebuilt(itinerary) {
    this.durationDays = itinerary.duration_days;
    const daysSlider = document.getElementById("planner-days-slider");
    const daysVal = document.getElementById("planner-days-val");
    if (daysSlider) daysSlider.value = this.durationDays;
    if (daysVal) daysVal.innerText = `${this.durationDays} Days`;

    // Map day plans
    this.dayPlans = itinerary.day_plans.map(dp => ({
      day: dp.day,
      destination: dp.title,
      state: itinerary.states,
      activities: dp.activities
    }));

    this.renderDayPlans();
    this.recalculateBudget();
    this.app.showToast(`Loaded "${itinerary.title}" into Planner!`, "success");

    const plannerEl = document.getElementById("planner");
    if (plannerEl) plannerEl.scrollIntoView({ behavior: "smooth" });
  }

  async saveTrip() {
    const tripNameInput = prompt("Enter a name for your custom trip itinerary:", "My North East Adventure");
    if (!tripNameInput) return;

    try {
      const payload = {
        trip_name: tripNameInput,
        travelers_count: this.travelersCount,
        travel_style: this.travelStyle,
        duration_days: this.durationDays,
        est_total_cost: this.budgetData ? this.budgetData.grand_total_inr : 10000,
        breakdown: this.budgetData ? this.budgetData.breakdown : {},
        destinations: this.selectedDestinations.map(d => d.slug),
        notes: `Trip with ${this.travelersCount} travelers in ${this.travelStyle} style.`
      };

      const res = await fetch("/api/custom-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        window.location.hash = `trip=${data.share_code}`;
        prompt(`🎉 Trip saved successfully! Share this permanent link with your friends:`, window.location.href);
        this.app.showToast("Trip saved! Share link copied.", "success");
      }
    } catch (e) {
      this.app.showToast("Failed to save trip. Please try again.", "danger");
    }
  }

  async checkUrlForSavedTrip() {
    const hash = window.location.hash;
    if (hash && hash.includes("trip=")) {
      const shareCode = hash.split("trip=")[1];
      try {
        const res = await fetch(`/api/custom-trips/${shareCode}`);
        if (res.ok) {
          const trip = await res.json();
          this.durationDays = trip.duration_days;
          this.travelersCount = trip.travelers_count;
          this.travelStyle = trip.travel_style;

          const daysSlider = document.getElementById("planner-days-slider");
          const daysVal = document.getElementById("planner-days-val");
          if (daysSlider) daysSlider.value = this.durationDays;
          if (daysVal) daysVal.innerText = `${this.durationDays} Days`;

          const travelersSlider = document.getElementById("planner-travelers-slider");
          const travelersVal = document.getElementById("planner-travelers-val");
          if (travelersSlider) travelersSlider.value = this.travelersCount;
          if (travelersVal) travelersVal.innerText = `${this.travelersCount} People`;

          this.rebuildDaySlots();
          this.recalculateBudget();
          this.app.showToast(`Loaded saved trip: "${trip.trip_name}"!`, "success");
        }
      } catch (e) {
        console.error("Error loading shared trip:", e);
      }
    }
  }

  printTripSheet() {
    window.print();
  }

  clearPlanner() {
    if (confirm("Reset your trip planner and clear all selected destinations?")) {
      this.selectedDestinations = [];
      this.durationDays = 5;
      const daysSlider = document.getElementById("planner-days-slider");
      if (daysSlider) daysSlider.value = 5;
      this.rebuildDaySlots();
      this.renderSelectedPills();
      this.recalculateBudget();
      this.app.showToast("Planner reset to defaults", "info");
    }
  }
}
