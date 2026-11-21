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

    const generateBtn = document.getElementById("btn-generate-plans");
    if (generateBtn) {
      generateBtn.addEventListener("click", () => this.generate3Plans());
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
        activities.push(`Free Exploration: Click "+ Plan Trip" on any destination card above, or click "Generate 3 Plans" for AI circuits.`);
      }

      this.dayPlans.push({
        day,
        destination: assignedDest ? assignedDest.name : `Day ${day} Exploration`,
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
      container.innerHTML = `<span style="font-size:0.85rem; color:var(--text-muted); font-style:italic;">No destinations pinned yet. Click "+ Plan Trip" on any attraction card above, or click "Generate 3 Plans" for ready-made circuits.</span>`;
      return;
    }

    container.innerHTML = this.selectedDestinations.map(dest => `
      <div class="selected-dest-pill">
        <span>📍 ${dest.name}</span>
        <span class="pill-remove" onclick="window.app.planner.removeDestination('${dest.slug}')">&times;</span>
      </div>
    `).join("");
  }

  getDestinationPhoto(destName) {
    if (!destName) return '/images/destinations/cherrapunji-sohra.jpg';
    const clean = destName.toLowerCase().trim();

    if (this.app && this.app.destinations && this.app.destinations.length > 0) {
      const found = this.app.destinations.find(d => 
        clean.includes(d.name.toLowerCase()) || 
        d.name.toLowerCase().includes(clean) ||
        (d.slug && clean.includes(d.slug.replace(/-/g, ' ')))
      );
      if (found && found.image_url) return found.image_url;
      if (found && found.slug) return `/images/destinations/${found.slug}.jpg`;
    }

    const keywordMap = {
      'kaziranga': '/images/destinations/kaziranga-national-park.jpg',
      'majuli': '/images/destinations/majuli-island.jpg',
      'manas': '/images/destinations/manas-national-park.jpg',
      'sivasagar': '/images/destinations/sivasagar-ahom-heritage.jpg',
      'charaideo': '/images/destinations/sivasagar-ahom-heritage.jpg',
      'cherrapunji': '/images/destinations/cherrapunji-sohra.jpg',
      'sohra': '/images/destinations/cherrapunji-sohra.jpg',
      'nongriat': '/images/destinations/nongriat-root-bridges.jpg',
      'root bridge': '/images/destinations/nongriat-root-bridges.jpg',
      'dawki': '/images/destinations/dawki-shnongpdeng-river.jpg',
      'shnongpdeng': '/images/destinations/dawki-shnongpdeng-river.jpg',
      'mawlynnong': '/images/destinations/mawlynnong-clean-village.jpg',
      'tawang': '/images/destinations/tawang-sela-pass.jpg',
      'sela': '/images/destinations/tawang-sela-pass.jpg',
      'ziro': '/images/destinations/ziro-valley-apatani.jpg',
      'mechuka': '/images/destinations/mechuka-forbidden-valley.jpg',
      'dzukou': '/images/destinations/dzukou-valley-trek.jpg',
      'khonoma': '/images/destinations/khonoma-green-village.jpg',
      'kohima': '/images/destinations/kohima-kisama-hornbill.jpg',
      'kisama': '/images/destinations/kohima-kisama-hornbill.jpg',
      'hornbill': '/images/destinations/kohima-kisama-hornbill.jpg',
      'loktak': '/images/destinations/loktak-lake-keibul-lamjao.jpg',
      'keibul': '/images/destinations/loktak-lake-keibul-lamjao.jpg',
      'imphal': '/images/destinations/imphal-city-ima-keithel.jpg',
      'ima keithel': '/images/destinations/imphal-city-ima-keithel.jpg',
      'aizawl': '/images/destinations/aizawl-reiek-peak.jpg',
      'reiek': '/images/destinations/aizawl-reiek-peak.jpg',
      'thenzawl': '/images/destinations/thenzawl-vantawng-falls.jpg',
      'vantawng': '/images/destinations/thenzawl-vantawng-falls.jpg',
      'unakoti': '/images/destinations/unakoti-rock-reliefs.jpg',
      'neermahal': '/images/destinations/tripura-palaces-neermahal.jpg',
      'gurudongmar': '/images/destinations/gurudongmar-lake-north-sikkim.jpg',
      'pelling': '/images/destinations/pelling-skywalk-pemayangtse.jpg',
      'tsomgo': '/images/destinations/tsomgo-lake-nathula-pass.jpg',
      'nathula': '/images/destinations/tsomgo-lake-nathula-pass.jpg',
      'guwahati': '/images/destinations/kaziranga-national-park.jpg',
      'shillong': '/images/destinations/cherrapunji-sohra.jpg',
      'dimapur': '/images/destinations/kohima-kisama-hornbill.jpg'
    };

    for (const [key, val] of Object.entries(keywordMap)) {
      if (clean.includes(key)) return val;
    }

    return '/images/destinations/cherrapunji-sohra.jpg';
  }

  renderDayPlans() {
    const container = document.getElementById("planner-day-cards-list");
    if (!container) return;

    container.innerHTML = this.dayPlans.map(dp => {
      const dayPhoto = this.getDestinationPhoto(dp.destination);
      return `
      <div class="day-plan-card">
        <div class="day-plan-header">
          <div style="display:flex; align-items:center; gap:0.65rem;">
            <img src="${dayPhoto}" alt="${dp.destination}" style="width:42px; height:42px; border-radius:var(--radius-sm); object-fit:cover; border:1px solid var(--border);" onerror="this.src='/images/destinations/cherrapunji-sohra.jpg'" />
            <div>
              <strong>Day ${dp.day}</strong> • <span style="color:var(--primary); font-weight:700;">${dp.destination}</span>
            </div>
          </div>
          <span style="font-size:0.75rem; background:var(--bg); border:1px solid var(--border); padding:0.2rem 0.55rem; border-radius:4px; font-weight:600; color:var(--text-muted);">${dp.state}</span>
        </div>
        <div class="day-plan-body">
          <ul class="day-plan-activities">
            ${dp.activities.map(act => `<li class="day-plan-activity-item">${act}</li>`).join("")}
          </ul>
        </div>
      </div>
      `;
    }).join("");
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

    // Update Local Value Score
    const localBar = document.getElementById("local-value-bar");
    const localLabel = document.getElementById("local-value-label");
    const score = (data && data.local_value_score !== undefined) ? data.local_value_score : 0.86;
    const pct = Math.round(score * 100);

    if (localBar) {
      localBar.style.width = `${pct}%`;
      localBar.setAttribute("aria-valuenow", pct);
      if (pct >= 80) {
        localBar.style.background = "linear-gradient(90deg, #10b981, #059669)";
      } else if (pct >= 60) {
        localBar.style.background = "linear-gradient(90deg, #f59e0b, #d97706)";
      } else {
        localBar.style.background = "linear-gradient(90deg, #ef4444, #dc2626)";
      }
    }
    if (localLabel) {
      const retainedInr = Math.round((data.grand_total_inr || 10000) * score);
      localLabel.innerHTML = `<strong>${pct}% Community Retention</strong> — directly supports indigenous homestays, village guides & local sumo drivers (~₹${retainedInr.toLocaleString('en-IN')})`;
    }
  }

  async generate3Plans() {
    const btn = document.getElementById("btn-generate-plans");
    const origText = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `⏳ Analyzing routes & circuits...`;
    }

    try {
      const gatewaySelect = document.getElementById("planner-gateway");
      const gateway = gatewaySelect ? gatewaySelect.value : "guwahati";
      const startDateInput = document.getElementById("planner-start-date");
      const startDate = (startDateInput && startDateInput.value) ? startDateInput.value : new Date().toISOString().split("T")[0];
      const travellerTypeEl = document.querySelector('input[name="traveller-type"]:checked');
      const travellerType = travellerTypeEl ? travellerTypeEl.value : "indian";
      const paceSelect = document.getElementById("planner-pace-select");
      const pace = paceSelect ? paceSelect.value : "moderate";
      const interestCheckboxes = document.querySelectorAll(".planner-interest:checked");
      const interests = Array.from(interestCheckboxes).map(cb => cb.value);

      const payload = {
        gateway: gateway,
        nights: this.durationDays,
        duration_days: this.durationDays,
        travelers_count: this.travelersCount,
        travel_style: this.travelStyle,
        pace: pace,
        interests: interests,
        traveller_type: travellerType,
        start_date: startDate
      };

      // Call API (v1 with fallback to /api/plan)
      let res;
      try {
        res = await fetch("/api/v1/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("v1 plan error");
      } catch (err) {
        res = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      const resJson = await res.json();
      const plans = (resJson && resJson.data) ? resJson.data : (Array.isArray(resJson) ? resJson : []);

      if (!plans || plans.length === 0) {
        this.app.showToast("No circuits found for this gateway. Try Guwahati or Shillong.", "warning");
        return;
      }

      this.generatedPlans = plans;
      this.activePlanIndex = 0;
      this.renderGeneratedPlans();

      // Update permits, warnings, and local value score for Plan A
      this.updatePermitsAndWarnings(plans[0]);
      if (plans[0].local_value_score) {
        this.updateLocalValueScore(plans[0].local_value_score);
      }

      this.app.showToast(`✨ Generated 3 tailored plans! Review Plan A, B & C below.`, "success");

      // Scroll to generated plans
      const genSection = document.getElementById("generated-plans-section");
      if (genSection) {
        genSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (err) {
      console.error("Error generating plans:", err);
      this.app.showToast("Could not generate plans. Please try again.", "danger");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    }
  }

  renderGeneratedPlans() {
    const section = document.getElementById("generated-plans-section");
    const container = document.getElementById("plan-tabs-content");
    if (!section || !container || !this.generatedPlans) return;

    section.style.display = "block";

    // Setup tab buttons
    const tabButtons = section.querySelectorAll(".plan-tab");
    tabButtons.forEach((tabBtn, idx) => {
      if (this.generatedPlans[idx]) {
        tabBtn.style.display = "inline-block";
        const label = idx === 0 ? "Plan A ⭐ Recommended" : (idx === 1 ? "Plan B Scenic/Culture" : "Plan C High Altitude");
        tabBtn.innerText = label;
      } else {
        tabBtn.style.display = "none";
      }

      tabBtn.classList.toggle("active", idx === this.activePlanIndex);
      tabBtn.onclick = () => {
        this.activePlanIndex = idx;
        tabButtons.forEach(b => b.classList.remove("active"));
        tabBtn.classList.add("active");
        this.renderActivePlanContent();
        this.updatePermitsAndWarnings(this.generatedPlans[idx]);
        if (this.generatedPlans[idx].local_value_score) {
          this.updateLocalValueScore(this.generatedPlans[idx].local_value_score);
        }
      };
    });

    this.renderActivePlanContent();
  }

  renderActivePlanContent() {
    const container = document.getElementById("plan-tabs-content");
    if (!container || !this.generatedPlans) return;

    const plan = this.generatedPlans[this.activePlanIndex];
    if (!plan) return;

    let statusBadge = "";
    if (plan.status === "feasible") {
      statusBadge = `<span style="background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; padding:0.25rem 0.65rem; border-radius:999px; font-size:0.78rem; font-weight:700;">✅ Feasible Circuit</span>`;
    } else if (plan.status === "tight") {
      statusBadge = `<span style="background:#fffbeb; color:#92400e; border:1px solid #fde68a; padding:0.25rem 0.65rem; border-radius:999px; font-size:0.78rem; font-weight:700;">⚠️ Tight Travel Schedule</span>`;
    } else {
      statusBadge = `<span style="background:#fef2f2; color:#991b1b; border:1px solid #fecaca; padding:0.25rem 0.65rem; border-radius:999px; font-size:0.78rem; font-weight:700;">❌ Not Recommended</span>`;
    }

    const costStr = (plan.cost_range_low && plan.cost_range_high)
      ? `₹${plan.cost_range_low.toLocaleString('en-IN')} - ₹${plan.cost_range_high.toLocaleString('en-IN')}`
      : `₹${((plan.days ? plan.days.length : 5) * 2200).toLocaleString('en-IN')}`;

    container.innerHTML = `
      <div style="background:white; border:1px solid var(--border); border-radius:var(--radius-md); padding:1.25rem; margin-top:0.75rem; box-shadow:var(--shadow-sm);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.75rem; margin-bottom:1rem; border-bottom:1px solid var(--border-light); padding-bottom:0.85rem;">
          <div>
            <h3 style="font-size:1.15rem; color:var(--text-main); margin-bottom:0.35rem;">${plan.name || "Custom North East Circuit"}</h3>
            <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
              ${statusBadge}
              <span style="font-size:0.78rem; color:var(--text-muted); background:var(--bg); border:1px solid var(--border); padding:0.2rem 0.5rem; border-radius:4px;">
                ⭐ Match Score: ${Math.round(plan.score || 90)}/100
              </span>
              <span style="font-size:0.78rem; color:var(--text-muted); background:var(--bg); border:1px solid var(--border); padding:0.2rem 0.5rem; border-radius:4px;">
                ⏱️ Pace: ${plan.pace || 'moderate'}
              </span>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.78rem; color:var(--text-muted);">Est. Total Cost (${this.travelersCount} pax, ${this.durationDays}d)</div>
            <div style="font-size:1.25rem; font-weight:800; color:var(--primary);">${costStr}</div>
            <button class="btn btn-primary btn-sm" id="btn-load-generated-plan" style="margin-top:0.35rem;">
              📥 Load into Custom Builder
            </button>
          </div>
        </div>

        <!-- Day by day listing with Destination Photos -->
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          ${(plan.days || []).map(day => {
            const dayPhoto = this.getDestinationPhoto(day.destination_name);
            return `
            <div style="display:flex; gap:0.85rem; padding:0.85rem; background:white; border:1px solid var(--border); border-radius:var(--radius-sm); align-items:flex-start; box-shadow:var(--shadow-sm);">
              <div style="position:relative; width:85px; height:80px; border-radius:var(--radius-sm); overflow:hidden; flex-shrink:0;">
                <img src="${dayPhoto}" alt="${day.destination_name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='/images/destinations/kaziranga-national-park.jpg'" />
                <div style="position:absolute; top:4px; left:4px; background:rgba(0,0,0,0.75); color:white; font-size:0.65rem; font-weight:700; padding:2px 5px; border-radius:3px;">
                  Day ${day.day_number}
                </div>
              </div>
              <div style="flex:1; min-width:0;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.35rem;">
                  <strong style="font-size:0.95rem; color:var(--text-main);">${day.destination_name}</strong>
                  <div style="display:flex; gap:0.4rem; align-items:center;">
                    ${day.travel_hrs > 0 ? `<span style="font-size:0.75rem; background:#eff6ff; color:#1d4ed8; padding:0.15rem 0.45rem; border-radius:4px; font-weight:600;">🚐 ${day.travel_hrs} hrs transit</span>` : `<span style="font-size:0.75rem; background:#f0fdf4; color:#15803d; padding:0.15rem 0.45rem; border-radius:4px; font-weight:600;">🚶 Exploration</span>`}
                    <span style="font-size:0.75rem; color:var(--text-muted);">${day.stay_type ? `🏡 ${day.stay_type}` : ''}</span>
                  </div>
                </div>
                <ul style="margin:0; padding-left:1.15rem; font-size:0.82rem; color:var(--text-muted); line-height:1.45;">
                  ${(day.activities || []).map(act => `<li>${act}</li>`).join("")}
                </ul>
              </div>
            </div>
            `;
          }).join("")}
        </div>

        ${plan.assumptions && plan.assumptions.length > 0 ? `
          <div style="margin-top:1rem; padding:0.75rem; background:#f8fafc; border:1px solid var(--border-light); border-radius:var(--radius-sm); font-size:0.78rem; color:var(--text-muted);">
            <strong>💡 Plan Assumptions:</strong> ${plan.assumptions.join(" • ")}
          </div>
        ` : ''}
      </div>
    `;

    const loadBtn = document.getElementById("btn-load-generated-plan");
    if (loadBtn) {
      loadBtn.onclick = () => this.loadGeneratedPlan(plan);
    }
  }

  loadGeneratedPlan(plan) {
    if (!plan || !plan.days) return;

    this.durationDays = plan.days.length;
    const daysSlider = document.getElementById("planner-days-slider");
    const daysVal = document.getElementById("planner-days-val");
    if (daysSlider) daysSlider.value = this.durationDays;
    if (daysVal) daysVal.innerText = `${this.durationDays} Days`;

    this.dayPlans = plan.days.map(d => ({
      day: d.day_number,
      destination: d.destination_name,
      state: "North East India",
      activities: d.activities || []
    }));

    this.renderDayPlans();
    this.recalculateBudget();
    this.updatePermitsAndWarnings(plan);
    if (plan.local_value_score) {
      this.updateLocalValueScore(plan.local_value_score);
    }

    this.app.showToast(`Loaded "${plan.name || 'Generated Plan'}" into Custom Day Builder!`, "success");

    const editorEl = document.getElementById("planner-day-editor");
    if (editorEl) {
      editorEl.scrollIntoView({ behavior: "smooth" });
    }
  }

  updateLocalValueScore(score = 0.86) {
    const bar = document.getElementById("local-value-bar");
    const label = document.getElementById("local-value-label");
    const pct = Math.round(score * 100);

    if (bar) {
      bar.style.width = `${pct}%`;
      bar.setAttribute("aria-valuenow", pct);
      if (pct >= 80) bar.style.background = "linear-gradient(90deg, #10b981, #059669)";
      else bar.style.background = "linear-gradient(90deg, #f59e0b, #d97706)";
    }
    if (label) {
      const retainedInr = Math.round((this.budgetData ? this.budgetData.grand_total_inr : 12000) * score);
      label.innerHTML = `<strong>${pct}% Community Retention</strong> — directly retained by indigenous homestays, village guides & local drivers (~₹${retainedInr.toLocaleString('en-IN')})`;
    }
  }

  updatePermitsAndWarnings(plan) {
    const permitContainer = document.getElementById("plan-permit-checklist");
    const warningsContainer = document.getElementById("plan-warnings");

    // 1. Render Permits Checklist
    if (permitContainer) {
      permitContainer.style.display = "block";
      const hasPermits = plan && plan.permits_detail && plan.permits_detail.length > 0;

      if (hasPermits) {
        permitContainer.innerHTML = `
          <div style="background:#fefce8; border:1px solid #fef08a; border-radius:var(--radius-sm); padding:0.85rem;">
            <div style="font-size:0.82rem; font-weight:700; color:#854d0e; margin-bottom:0.4rem; display:flex; align-items:center; gap:0.35rem;">
              <span>🎫 Mandatory Permit Required</span>
            </div>
            ${plan.permits_detail.map(p => `
              <div style="font-size:0.78rem; color:#713f12; margin-bottom:0.5rem; line-height:1.4;">
                <strong>${p.state} — ${p.permit_name}</strong> (${p.fee_inr ? `₹${p.fee_inr}` : 'Fee applies'})<br/>
                <span style="opacity:0.85;">Lead time: ${p.lead_time || '1-2 days'}. Required docs: ${(p.documents_required || []).join(', ')}.</span>
                ${p.official_portal ? `<div style="margin-top:0.35rem;"><a href="${p.official_portal}" target="_blank" class="btn btn-outline btn-xs" style="font-size:0.72rem; padding:0.15rem 0.5rem; color:#854d0e; border-color:#ca8a04;">Apply Online ↗</a></div>` : ''}
              </div>
            `).join("")}
          </div>
        `;
      } else {
        permitContainer.innerHTML = `
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:var(--radius-sm); padding:0.75rem; font-size:0.78rem; color:#166534;">
            <strong>✅ No Inner Line Permit Required!</strong><br/>
            This circuit travels within Assam / Meghalaya which are permit-free for domestic Indian citizens.
          </div>
        `;
      }
    }

    // 2. Render Warnings
    if (warningsContainer) {
      warningsContainer.style.display = "block";
      const warnings = (plan && plan.warnings && plan.warnings.length > 0)
        ? plan.warnings
        : [
            { rule_id: "info-mountain", message: "Depart early morning (6:00-7:00 AM) to beat mountain fog and road maintenance closures.", severity: "info" },
            { rule_id: "info-cash", message: "Network and digital UPI payments fail in deep valleys; keep adequate cash for sumo fares.", severity: "info" }
          ];

      warningsContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.45rem;">
          ${warnings.map(w => {
            const isWarn = w.severity === "warning" || w.severity === "error";
            const bg = isWarn ? "#fff7ed" : "#f8fafc";
            const border = isWarn ? "#ffedd5" : "#e2e8f0";
            const color = isWarn ? "#9a3412" : "#334155";
            const icon = isWarn ? "⚠️" : "ℹ️";
            return `
              <div style="background:${bg}; border:1px solid ${border}; border-radius:var(--radius-sm); padding:0.5rem 0.65rem; font-size:0.75rem; color:${color}; line-height:1.4;">
                <span style="font-weight:700; text-transform:uppercase; font-size:0.68rem; background:rgba(0,0,0,0.06); padding:0.1rem 0.35rem; border-radius:3px; margin-right:0.35rem;">Rule: ${w.rule_id}</span>
                ${icon} ${w.message}
              </div>
            `;
          }).join("")}
        </div>
      `;
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
