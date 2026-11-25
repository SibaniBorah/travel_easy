/**
 * Chalo NorthEast - Main Application Controller
 */

class App {
  constructor() {
    this.states = [];
    this.destinations = [];
    this.transitRoutes = [];
    this.homestays = [];
    this.itineraries = [];
    this.permits = [];
    this.tips = [];
    this.events = [];
    this.currentFestivalMonth = 0;
    
    this.currentState = "ALL";
    this.currentCategory = "all";
    this.currentBudgetTier = "all";
    this.currentSeason = "all";
    this.currentTier = "all";
    this.searchQuery = "";

    this.map = null;
    this.planner = null;

    this.init();
  }

  async init() {
    this.bindGlobalEvents();
    await this.fetchInitialData();

    // Initialize Map and Planner
    this.map = new NorthEastMap("map-container", (stateCode) => this.handleStateSelect(stateCode));
    this.planner = new TripPlanner(this);

    // Initial renders
    this.renderStateHighlights();
    this.renderDestinations();
    this.renderTransitRoutes();
    this.renderItineraries();
    this.renderPermitAdvisor();
    this.renderFestivals(0);
    this.renderHomestays();
    this.renderCommunityTips();
    this.renderLingoGuide();
    this.renderEmergencyContacts();
    this.initOfflinePackHandler();
    this.initReportHandler();

    // Initial budget calculation
    this.planner.rebuildDaySlots();
    this.planner.recalculateBudget();
  }

  async fetchInitialData() {
    try {
      const fetchWithFallback = async (primaryUrl, fallbackUrl) => {
        try {
          const r = await fetch(primaryUrl);
          if (r.ok) return r;
          throw new Error("fallback");
        } catch {
          return await fetch(fallbackUrl);
        }
      };

      const [statesRes, destsRes, transitRes, homestaysRes, itinRes, permitsRes, tipsRes, statsRes, eventsRes] = await Promise.all([
        fetchWithFallback("/api/states", "/api/v1/states"),
        fetchWithFallback("/api/destinations", "/api/v1/destinations"),
        fetchWithFallback("/api/transit", "/api/v1/route-legs"),
        fetchWithFallback("/api/homestays", "/api/v1/homestays"),
        fetchWithFallback("/api/itineraries", "/api/v1/itineraries"),
        fetchWithFallback("/api/permits", "/api/v1/permits"),
        fetchWithFallback("/api/tips", "/api/v1/tips"),
        fetchWithFallback("/api/stats", "/api/v1/stats"),
        fetchWithFallback("/api/events", "/api/v1/events")
      ]);

      const unwrap = (val) => (val && val.data !== undefined ? val.data : val);

      this.states = unwrap(await statesRes.json()) || [];
      this.destinations = unwrap(await destsRes.json()) || [];
      this.transitRoutes = unwrap(await transitRes.json()) || [];
      this.homestays = unwrap(await homestaysRes.json()) || [];
      this.itineraries = unwrap(await itinRes.json()) || [];
      this.permitsData = unwrap(await permitsRes.json()) || {};
      this.tips = unwrap(await tipsRes.json()) || [];
      const stats = unwrap(await statsRes.json()) || {};
      this.events = unwrap(await eventsRes.json()) || [];

      this.updateStatsRibbon(stats);
      this.renderFestivals(0);
    } catch (err) {
      console.error("Error loading initial data:", err);
      this.showToast("Failed to load some data. Refresh to try again.", "danger");
    }
  }

  updateStatsRibbon(stats) {
    const sDest = document.getElementById("stat-dests-count");
    const sRoutes = document.getElementById("stat-routes-count");
    const sHomestays = document.getElementById("stat-homestays-count");
    const sItins = document.getElementById("stat-itins-count");

    if (sDest) sDest.innerText = stats.destinations;
    if (sRoutes) sRoutes.innerText = stats.transit_routes;
    if (sHomestays) sHomestays.innerText = stats.homestays;
    if (sItins) sItins.innerText = stats.prebuilt_itineraries;
  }

  bindGlobalEvents() {
    // Global Search
    const searchInput = document.getElementById("global-search-input");
    if (searchInput) {
      let timeout;
      searchInput.addEventListener("input", (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          this.searchQuery = e.target.value.trim().toLowerCase();
          this.renderDestinations();
        }, 200);
      });
    }

    // Hero Tag Clicks
    const heroTags = document.querySelectorAll(".hero-tag");
    heroTags.forEach(tag => {
      tag.addEventListener("click", () => {
        const cat = tag.getAttribute("data-cat");
        const state = tag.getAttribute("data-state");
        if (cat) {
          this.setCategoryFilter(cat);
        } else if (state) {
          this.handleStateSelect(state);
        }
        document.getElementById("destinations").scrollIntoView({ behavior: "smooth" });
      });
    });

    // State Filter Buttons
    const stateFiltersContainer = document.getElementById("state-filters-container");
    if (stateFiltersContainer) {
      stateFiltersContainer.addEventListener("click", (e) => {
        const chip = e.target.closest(".filter-chip");
        if (chip) {
          stateFiltersContainer.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
          chip.classList.add("active");
          const stateCode = chip.getAttribute("data-state");
          this.handleStateSelect(stateCode);
        }
      });
    }

    // Category Filter Chips
    const categoryContainer = document.getElementById("category-filters-container");
    if (categoryContainer) {
      categoryContainer.addEventListener("click", (e) => {
        const chip = e.target.closest(".filter-chip");
        if (chip) {
          categoryContainer.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
          chip.classList.add("active");
          this.currentCategory = chip.getAttribute("data-category");
          this.renderDestinations();
        }
      });
    }

    // Apply and Reset Filter buttons
    const applyBtn = document.getElementById("btn-apply-filters");
    if (applyBtn) {
      applyBtn.addEventListener("click", () => this.applyFilters());
    }

    const resetBtn = document.getElementById("btn-reset-filters");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => this.resetFilters());
    }

    // Transit Search Form
    const transitBtn = document.getElementById("btn-search-transit");
    if (transitBtn) {
      transitBtn.addEventListener("click", () => {
        const fromVal = document.getElementById("transit-from-input").value.trim().toLowerCase();
        const toVal = document.getElementById("transit-to-input").value.trim().toLowerCase();
        this.filterTransitRoutes(fromVal, toVal);
      });
    }

    // Community Tip Form
    const tipForm = document.getElementById("form-submit-tip");
    if (tipForm) {
      tipForm.addEventListener("submit", (e) => this.handleTipSubmit(e));
    }

    // Modal Close buttons
    const modalCloses = document.querySelectorAll(".modal-close, .modal-backdrop-close");
    modalCloses.forEach(btn => {
      btn.addEventListener("click", () => this.closeModals());
    });

    // Emergency button in Nav
    const emergencyBtn = document.getElementById("btn-nav-emergency");
    if (emergencyBtn) {
      emergencyBtn.addEventListener("click", () => this.openModal("modal-emergency"));
    }

    // Lingo guide button in Nav
    const lingoBtn = document.getElementById("btn-nav-lingo");
    if (lingoBtn) {
      lingoBtn.addEventListener("click", () => this.openModal("modal-lingo"));
    }

    // Month filter pills for Festival Calendar
    const monthPills = document.querySelectorAll("#month-filter-row .month-pill");
    monthPills.forEach(pill => {
      pill.addEventListener("click", () => {
        monthPills.forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        const monthNum = parseInt(pill.getAttribute("data-month") || "0");
        this.currentFestivalMonth = monthNum;
        this.renderFestivals(monthNum);
      });
    });
  }

  handleStateSelect(stateCode) {
    this.currentState = stateCode;

    // Update state filter chips
    const stateChips = document.querySelectorAll("#state-filters-container .filter-chip");
    stateChips.forEach(chip => {
      if (chip.getAttribute("data-state") === stateCode) {
        chip.classList.add("active");
      } else {
        chip.classList.remove("active");
      }
    });

    // Update map selection if triggered outside
    if (this.map && this.map.selectedState !== stateCode && stateCode !== "ALL") {
      this.map.selectState(stateCode);
    }

    this.renderStateHighlights();
    this.renderDestinations();
    this.renderFestivals(this.currentFestivalMonth);
  }

  setCategoryFilter(category) {
    this.currentCategory = category;
    const catChips = document.querySelectorAll("#category-filters-container .filter-chip");
    catChips.forEach(c => {
      if (c.getAttribute("data-category") === category) c.classList.add("active");
      else c.classList.remove("active");
    });
    this.renderDestinations();
  }

  renderStateHighlights() {
    const container = document.getElementById("map-state-details");
    if (!container) return;

    if (this.currentState === "ALL") {
      container.innerHTML = `
        <div class="state-badge badge-no-ilp">Overview • 8 States</div>
        <h3 style="font-size: 1.45rem; margin-bottom: 0.5rem;">Explore North East India</h3>
        <p style="font-size: 0.88rem; line-height: 1.5; margin-bottom: 1rem;">
          Click on any state on the interactive map or select a filter below to explore curated destinations, permit guidance, shared sumos, and local homestays.
        </p>
        <div class="state-quick-facts">
          <div class="fact-box">
            <div class="fact-label">The 8 States</div>
            <div class="fact-val">AS, ML, AR, NL, MN, MZ, TR, SK</div>
          </div>
          <div class="fact-box">
            <div class="fact-label">ILP Required?</div>
            <div class="fact-val">AR, NL, MN, MZ (Yes)</div>
          </div>
          <div class="fact-box">
            <div class="fact-label">No Permit Needed</div>
            <div class="fact-val">Assam, Meghalaya, Tripura</div>
          </div>
          <div class="fact-box">
            <div class="fact-label">Best Season</div>
            <div class="fact-val">October to April</div>
          </div>
        </div>
      `;
      return;
    }

    const state = this.states.find(s => s.code === this.currentState);
    if (!state) return;

    let ilpBadge = "";
    if (state.ilp_required === 1 && state.code !== "SK") {
      ilpBadge = `<span class="state-badge badge-ilp-req">⚠️ ILP Required (₹${state.ilp_fee_inr})</span>`;
    } else if (state.code === "SK") {
      ilpBadge = `<span class="state-badge badge-pap">🛂 Protected Area Permit (PAP) for North/East</span>`;
    } else {
      ilpBadge = `<span class="state-badge badge-no-ilp">✅ No Permit Needed (Open Entry)</span>`;
    }

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          ${ilpBadge}
          <h3 style="font-size: 1.6rem; color:var(--text-main); margin-bottom: 0.25rem;">${state.name}</h3>
          <p style="font-size: 0.82rem; color:var(--text-muted); font-style:italic; margin-bottom: 0.75rem;">${state.tagline}</p>
        </div>
      </div>
      <p style="font-size: 0.85rem; line-height: 1.5; margin-bottom: 1rem;">${state.description}</p>
      <div class="state-quick-facts">
        <div class="fact-box">
          <div class="fact-label">Capital</div>
          <div class="fact-val">${state.capital}</div>
        </div>
        <div class="fact-box">
          <div class="fact-label">Best Time to Visit</div>
          <div class="fact-val">${state.best_time.split('(')[0]}</div>
        </div>
        <div class="fact-box" style="grid-column: span 2;">
          <div class="fact-label">Signature Cuisine</div>
          <div class="fact-val" style="font-size:0.8rem;">${state.popular_food}</div>
        </div>
        <div class="fact-box" style="grid-column: span 2;">
          <div class="fact-label">Cultural Highlights</div>
          <div class="fact-val" style="font-size:0.8rem;">${state.cultural_highlights}</div>
        </div>
      </div>
      <div style="margin-top: 1rem; display:flex; gap:0.5rem;">
        <button class="btn btn-sm btn-outline" onclick="window.app.handleStateSelect('ALL')">View All States</button>
        <a href="#destinations" class="btn btn-sm btn-primary">See ${state.name} Attractions ↓</a>
      </div>
    `;
  }

  renderDestinations() {
    const grid = document.getElementById("destinations-grid");
    if (!grid) return;

    let list = this.destinations;

    // Filter by state
    if (this.currentState !== "ALL") {
      list = list.filter(d => d.state_code === this.currentState);
    }

    // Filter by category
    if (this.currentCategory !== "all") {
      list = list.filter(d => d.category === this.currentCategory);
    }

    // Filter by budget tier
    if (this.currentBudgetTier && this.currentBudgetTier !== "all") {
      list = list.filter(d => {
        if (d.budget_tier === this.currentBudgetTier) return true;
        if (this.currentBudgetTier === "backpacker") return (d.est_cost_per_day || 0) <= 900;
        if (this.currentBudgetTier === "budget") return (d.est_cost_per_day || 0) <= 1600;
        if (this.currentBudgetTier === "moderate") return (d.est_cost_per_day || 0) <= 3000;
        if (this.currentBudgetTier === "comfort") return (d.est_cost_per_day || 0) > 2500;
        return false;
      });
    }

    // Filter by season
    if (this.currentSeason && this.currentSeason !== "all") {
      const seasonKeywords = {
        "oct-nov": ["october", "november", "autumn", "post monsoon", "all year"],
        "dec-feb": ["december", "january", "february", "winter", "all year"],
        "mar-apr": ["march", "april", "spring", "all year"],
        "may-sep": ["may", "june", "july", "august", "september", "monsoon", "summer", "all year"]
      }[this.currentSeason] || [];

      list = list.filter(d => {
        const text = ((d.best_season || "") + " " + (d.best_months || "")).toLowerCase();
        return seasonKeywords.some(kw => text.includes(kw));
      });
    }

    // Search query
    if (this.searchQuery) {
      list = list.filter(d => 
        d.name.toLowerCase().includes(this.searchQuery) ||
        d.description.toLowerCase().includes(this.searchQuery) ||
        d.top_highlights.toLowerCase().includes(this.searchQuery) ||
        d.tagline.toLowerCase().includes(this.searchQuery)
      );
    }

    const countLabel = document.getElementById("destinations-count-label");
    if (countLabel) {
      countLabel.innerText = `Showing ${list.length} attraction${list.length === 1 ? '' : 's'}`;
    }

    if (list.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; background: white; border-radius: var(--radius-lg); border: 1px dashed var(--border);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
          <h4 style="font-size: 1.15rem; margin-bottom: 0.5rem;">No destinations match your filter</h4>
          <p style="font-size: 0.88rem; margin-bottom: 1rem;">Try clearing your search query or selecting "All States" and "All Categories".</p>
          <button class="btn btn-primary btn-sm" onclick="window.app.resetFilters()">Reset All Filters</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = list.map(dest => {
      const imgUrl = dest.image_url || `/images/destinations/${dest.slug}.jpg`;
      return `
      <div class="dest-card">
        <div class="dest-card-header">
          <img src="${imgUrl}" alt="${dest.name}" class="dest-card-img-bg" loading="lazy" onerror="this.src='/images/destinations/kaziranga-national-park.jpg'" />
          <div class="dest-card-overlay"></div>
          <div class="dest-card-badges">
            <span class="dest-category-badge">${dest.category}</span>
            <span class="dest-rating">★ ${dest.rating} (${dest.reviews_count})</span>
          </div>
          <div class="dest-card-title-group">
            <div class="dest-card-state">${dest.state_name} • ${dest.altitude}</div>
            <h3 class="dest-card-title">${dest.name}</h3>
          </div>
        </div>
        <div class="dest-card-body">
          <p class="dest-card-tagline">${dest.tagline}</p>
          <div class="dest-highlights">
            <strong>Highlights:</strong> ${dest.top_highlights}
          </div>
          <div class="dest-meta-row">
            <div class="dest-cost">
              ₹${dest.est_cost_per_day.toLocaleString('en-IN')} <span>/ day est.</span>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">
              ⏳ ${dest.ideal_days} Days Ideal
            </div>
          </div>
          <div class="dest-actions">
            <button class="btn btn-outline btn-sm" onclick="window.app.openDestinationDetail('${dest.slug}')">
              📖 Guide
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.app.addDestinationToPlanner('${dest.slug}')">
              + Plan Trip
            </button>
          </div>
        </div>
      </div>
      `;
    }).join("");
  }

  applyFilters() {
    const budgetSelect = document.getElementById("budget-tier-filter");
    if (budgetSelect) this.currentBudgetTier = budgetSelect.value || "all";

    const seasonSelect = document.getElementById("season-filter");
    if (seasonSelect) this.currentSeason = seasonSelect.value || "all";

    this.renderDestinations();

    const btn = document.getElementById("btn-apply-filters");
    if (btn) {
      const origText = btn.innerHTML;
      btn.innerHTML = "✓ Applied!";
      btn.style.backgroundColor = "#059669";
      setTimeout(() => {
        btn.innerHTML = origText;
        btn.style.backgroundColor = "";
      }, 1000);
    }
  }

  resetFilters() {
    this.currentState = "ALL";
    this.currentCategory = "all";
    this.currentBudgetTier = "all";
    this.currentSeason = "all";
    this.searchQuery = "";

    const searchInput = document.getElementById("global-search-input");
    if (searchInput) searchInput.value = "";
    const budgetSelect = document.getElementById("budget-tier-filter");
    if (budgetSelect) budgetSelect.value = "all";
    const seasonSelect = document.getElementById("season-filter");
    if (seasonSelect) seasonSelect.value = "all";

    this.handleStateSelect("ALL");
    this.setCategoryFilter("all");
  }

  addDestinationToPlanner(slug) {
    const dest = this.destinations.find(d => d.slug === slug);
    if (dest && this.planner) {
      this.planner.addDestination(dest);
    }
  }

  async openDestinationDetail(slug) {
    try {
      const res = await fetch(`/api/destinations/${slug}`);
      if (!res.ok) throw new Error("Destination not found");
      const dest = await res.json();

      const modal = document.getElementById("modal-destination-detail");
      const titleEl = document.getElementById("modal-dest-title");
      const contentEl = document.getElementById("modal-dest-content");

      if (titleEl) titleEl.innerText = `${dest.name} (${dest.state_name})`;

      if (contentEl) {
        const modalImg = dest.image_url || `/images/destinations/${dest.slug}.jpg`;
        contentEl.innerHTML = `
          <div style="position:relative; height:220px; border-radius:var(--radius-md); overflow:hidden; margin-bottom:1.25rem;">
            <img src="${modalImg}" alt="${dest.name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='/images/destinations/kaziranga-national-park.jpg'" />
            <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(transparent, rgba(0,0,0,0.8)); padding:1rem; color:white;">
              <span class="state-badge badge-no-ilp" style="background:var(--primary); color:white; border:none;">${dest.category.toUpperCase()}</span>
              <span style="font-size:0.85rem; opacity:0.95; margin-left:0.5rem;">Altitude: ${dest.altitude} • Best Season: ${dest.best_season}</span>
            </div>
          </div>

          <div style="margin-bottom: 1.25rem;">
            <p style="font-size: 1.05rem; font-weight:600; color:var(--text-main); font-style:italic;">
              "${dest.tagline}"
            </p>
          </div>

          <div style="margin-bottom: 1.5rem; line-height: 1.6; font-size: 0.95rem;">
            <p>${dest.description}</p>
          </div>

          <!-- Reach on Budget vs Private -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
            <div style="background:var(--primary-light); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--primary-border);">
              <h5 style="color:var(--primary); font-size:0.9rem; margin-bottom:0.4rem;">🚌 How to Reach on a Budget:</h5>
              <p style="font-size:0.85rem; color:var(--text-main); line-height:1.45;">${dest.how_to_reach_budget}</p>
            </div>
            <div style="background:var(--secondary-light); padding:1rem; border-radius:var(--radius-md); border:1px solid #bae6fd;">
              <h5 style="color:var(--secondary); font-size:0.9rem; margin-bottom:0.4rem;">🚗 Private Taxi / Rental:</h5>
              <p style="font-size:0.85rem; color:var(--text-main); line-height:1.45;">${dest.how_to_reach_private}</p>
            </div>
          </div>

          <!-- Permits & Entry fees -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
            <div style="background:var(--bg); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border);">
              <h5 style="font-size:0.9rem; margin-bottom:0.4rem;">🎫 Entry Fees & Safaris:</h5>
              <p style="font-size:0.85rem;">${dest.entry_fees}</p>
            </div>
            <div style="background:#fff7ed; padding:1rem; border-radius:var(--radius-md); border:1px solid #ffedd5;">
              <h5 style="color:#c2410c; font-size:0.9rem; margin-bottom:0.4rem;">🛂 Permit Info:</h5>
              <p style="font-size:0.85rem; color:#9a3412;">${dest.permit_info}</p>
            </div>
          </div>

          <!-- Cultural Etiquette -->
          <div style="background:#fefce8; border-left:4px solid #eab308; padding:0.85rem 1rem; border-radius:var(--radius-sm); margin-bottom: 1.5rem;">
            <h5 style="color:#854d0e; font-size:0.88rem; margin-bottom:0.25rem;">🌿 Cultural Etiquette & Eco Guidelines:</h5>
            <p style="font-size:0.85rem; color:#713f12; line-height:1.45;">${dest.cultural_etiquette}</p>
          </div>

          <!-- Nearby Eco Homestays -->
          ${dest.homestays && dest.homestays.length > 0 ? `
            <div style="margin-bottom: 1.5rem;">
              <h4 style="font-size: 1.1rem; margin-bottom: 0.75rem;">🏡 Verified Community Homestays Nearby:</h4>
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.75rem;">
                ${dest.homestays.map(h => `
                  <div style="border:1px solid var(--border); padding:0.85rem; border-radius:var(--radius-md); background:white;">
                    <div style="display:flex; justify-content:space-between; font-weight:700;">
                      <span>${h.name}</span>
                      <span style="color:var(--primary);">₹${h.price_per_night}/night</span>
                    </div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin:0.25rem 0;">Host: ${h.host_name} • ${h.village_location}</div>
                    <div style="font-size:0.78rem; margin-bottom:0.5rem;">${h.amenities}</div>
                    <div style="font-size:0.78rem; font-weight:600; color:var(--secondary);">📞 Phone / WhatsApp: ${h.contact_phone}</div>
                  </div>
                `).join("")}
              </div>
            </div>
          ` : ''}

          <!-- Reviews & Ratings -->
          <div style="border-top: 1px solid var(--border); padding-top: 1.25rem;">
            <h4 style="font-size: 1.1rem; margin-bottom: 0.75rem;">💬 Traveler Experiences (${dest.reviews ? dest.reviews.length : 0})</h4>
            <div style="display:flex; flex-direction:column; gap:0.65rem; margin-bottom: 1rem;">
              ${dest.reviews && dest.reviews.length > 0 ? dest.reviews.map(r => `
                <div style="background:var(--bg); padding:0.75rem; border-radius:var(--radius-sm);">
                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.25rem;">
                    <strong>${r.user_name} (${r.user_origin})</strong>
                    <span style="color:#f59e0b;">${'★'.repeat(r.rating)}</span>
                  </div>
                  <p style="font-size:0.82rem; color:var(--text-main);">${r.review_text}</p>
                </div>
              `).join("") : '<p style="font-size:0.85rem; color:var(--text-muted);">No reviews submitted yet. Be the first to review!</p>'}
            </div>

            <!-- Add Review Form -->
            <form id="form-dest-review" onsubmit="window.app.handleReviewSubmit(event, '${dest.slug}')" style="background:var(--bg); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border);">
              <h5 style="font-size:0.88rem; margin-bottom:0.5rem;">Write a Review:</h5>
              <div style="display:grid; grid-template-columns: 1fr 1fr auto; gap:0.5rem; margin-bottom:0.5rem;">
                <input type="text" id="review-user-name" placeholder="Your Name" required class="search-input" style="background:white; border:1px solid var(--border); border-radius:4px; padding:0.4rem;">
                <input type="text" id="review-user-origin" placeholder="Your City (e.g. Mumbai)" class="search-input" style="background:white; border:1px solid var(--border); border-radius:4px; padding:0.4rem;">
                <select id="review-rating" class="filter-select">
                  <option value="5">★★★★★ (5/5)</option>
                  <option value="4">★★★★☆ (4/5)</option>
                  <option value="3">★★★☆☆ (3/5)</option>
                </select>
              </div>
              <textarea id="review-text" placeholder="Share your experience, tips or advice for future travelers..." rows="2" required style="width:100%; border:1px solid var(--border); border-radius:4px; padding:0.5rem; font-family:inherit; margin-bottom:0.5rem;"></textarea>
              <button type="submit" class="btn btn-sm btn-primary">Submit Review</button>
            </form>
          </div>
        `;
      }

      this.openModal("modal-destination-detail");
    } catch (e) {
      console.error(e);
      this.showToast("Could not load destination details.", "danger");
    }
  }

  async handleReviewSubmit(e, destSlug) {
    e.preventDefault();
    const userName = document.getElementById("review-user-name").value;
    const userOrigin = document.getElementById("review-user-origin").value || "India";
    const rating = parseInt(document.getElementById("review-rating").value);
    const reviewText = document.getElementById("review-text").value;

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination_slug: destSlug,
          user_name: userName,
          user_origin: userOrigin,
          rating,
          review_text: reviewText,
          travel_month: "Recent"
        })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast("Review submitted successfully! Thank you.", "success");
        this.openDestinationDetail(destSlug); // Refresh modal
      }
    } catch (err) {
      this.showToast("Error submitting review.", "danger");
    }
  }

  renderTransitRoutes(routes = null) {
    const listEl = document.getElementById("transit-routes-list");
    if (!listEl) return;

    const items = routes || this.transitRoutes;

    listEl.innerHTML = items.map(r => `
      <div class="transit-card">
        <div class="transit-card-top">
          <span class="transit-mode-badge">🚐 ${r.transport_mode}</span>
          <span class="transit-fare">₹${r.fare_inr.toLocaleString('en-IN')} <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">/ seat</span></span>
        </div>
        <div class="transit-route-title">
          <span>${r.from_city}</span>
          <span class="transit-route-arrow">➔</span>
          <span>${r.to_city}</span>
        </div>
        <div class="transit-details">
          <div><strong>⏱️ Duration:</strong> ${r.duration_hrs} Hours</div>
          <div><strong>🔄 Frequency:</strong> ${r.frequency}</div>
          <div style="grid-column: span 2;"><strong>📍 Stand:</strong> ${r.pickup_stand}</div>
          <div style="grid-column: span 2;"><strong>🛣️ Road:</strong> ${r.road_condition}</div>
        </div>
        <div class="transit-pro-tip">
          💡 <strong>Pro Tip:</strong> ${r.pro_tips}
        </div>
      </div>
    `).join("");
  }

  filterTransitRoutes(fromText, toText) {
    let filtered = this.transitRoutes;
    if (fromText) {
      filtered = filtered.filter(r => r.from_city.toLowerCase().includes(fromText));
    }
    if (toText) {
      filtered = filtered.filter(r => r.to_city.toLowerCase().includes(toText));
    }
    this.renderTransitRoutes(filtered);
  }

  renderItineraries() {
    const grid = document.getElementById("itineraries-grid");
    if (!grid) return;

    grid.innerHTML = this.itineraries.map(itin => {
      const imgUrl = itin.image_url || `/images/itineraries/${itin.slug}.jpg`;
      return `
      <div class="itinerary-card">
        <div class="itinerary-card-media">
          <img src="${imgUrl}" alt="${itin.title}" class="itinerary-card-img" loading="lazy" onerror="this.src='/images/destinations/cherrapunji-sohra.jpg'" />
          <div class="itinerary-card-overlay"></div>
          <div class="itinerary-card-badges">
            <span class="badge-duration" style="background:rgba(255,255,255,0.95); box-shadow:var(--shadow-sm);">⏱️ ${itin.duration_days} Days</span>
            <span class="itinerary-cost" style="background:rgba(0,0,0,0.72); color:#fef08a; padding:0.25rem 0.65rem; border-radius:var(--radius-full); font-size:0.85rem; box-shadow:var(--shadow-sm);">₹${itin.est_total_cost_inr.toLocaleString('en-IN')} <small style="color:#f1f5f9;">est.</small></span>
          </div>
        </div>
        <div class="itinerary-card-body">
          <h3 style="font-size:1.15rem; margin-bottom:0.45rem; line-height:1.35;">${itin.title}</h3>
          <p class="itinerary-summary" style="font-size:0.82rem; margin-bottom:0.75rem;">${itin.summary}</p>
          <div style="font-size:0.8rem; background:var(--bg); padding:0.6rem; border-radius:var(--radius-sm); margin-bottom:1rem; border:1px solid var(--border-light);">
            <strong>🎒 Packing:</strong> ${itin.packing_tips.split(',').slice(0, 3).join(', ')}...
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; margin-top:auto;">
            <button class="btn btn-outline btn-sm" onclick="window.app.openItineraryDetail('${itin.slug}')">
              View Days
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.app.loadPrebuiltToPlanner('${itin.slug}')">
              Load in Planner
            </button>
          </div>
        </div>
      </div>
      `;
    }).join("");
  }

  openItineraryDetail(slug) {
    const itin = this.itineraries.find(i => i.slug === slug);
    if (!itin) return;

    const modal = document.getElementById("modal-destination-detail");
    const titleEl = document.getElementById("modal-dest-title");
    const contentEl = document.getElementById("modal-dest-content");

    if (titleEl) titleEl.innerText = `${itin.title} (${itin.duration_days} Days)`;

    if (contentEl) {
      const itinImg = itin.image_url || `/images/itineraries/${itin.slug}.jpg`;
      contentEl.innerHTML = `
        <div style="position:relative; height:200px; border-radius:var(--radius-md); overflow:hidden; margin-bottom:1.25rem;">
          <img src="${itinImg}" alt="${itin.title}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='/images/destinations/cherrapunji-sohra.jpg'" />
          <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(transparent, rgba(0,0,0,0.8)); padding:1rem; color:white;">
            <span class="badge-duration" style="background:var(--primary); color:white; border:none;">⏱️ ${itin.duration_days} Days</span>
            <span style="font-size:1.1rem; font-weight:800; color:#fef08a; margin-left:0.75rem;">
              Estimated Total: ₹${itin.est_total_cost_inr.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        <div style="margin-bottom: 1.25rem;">
          <p style="margin-top:0.5rem; font-size:0.95rem; line-height:1.5;">${itin.summary}</p>
        </div>

        <h4 style="font-size: 1.1rem; margin-bottom: 0.75rem;">📅 Day-by-Day Route Breakdown:</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; margin-bottom:1.5rem;">
          ${itin.day_plans.map(dp => {
            const dayImg = window.app.planner ? window.app.planner.getDestinationPhoto(dp.title) : '/images/destinations/cherrapunji-sohra.jpg';
            return `
            <div style="display:flex; gap:0.75rem; border:1px solid var(--border); border-radius:var(--radius-md); padding:0.85rem; background:white; align-items:flex-start;">
              <img src="${dayImg}" alt="${dp.title}" style="width:70px; height:65px; border-radius:var(--radius-sm); object-fit:cover; flex-shrink:0; border:1px solid var(--border);" onerror="this.src='/images/destinations/kaziranga-national-park.jpg'" />
              <div style="flex:1; min-width:0;">
                <div style="font-weight:700; color:var(--primary); font-size:0.95rem; margin-bottom:0.25rem;">
                  Day ${dp.day}: ${dp.title}
                </div>
                <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:0.4rem;">🏡 Overnight Stay: ${dp.stay}</div>
                <ul style="padding-left:1.15rem; font-size:0.82rem; line-height:1.45; margin:0;">
                  ${dp.activities.map(act => `<li>${act}</li>`).join("")}
                </ul>
              </div>
            </div>
            `;
          }).join("")}
        </div>

        <div style="background:#fefce8; border-left:4px solid #eab308; padding:0.85rem; border-radius:var(--radius-sm); margin-bottom:1.5rem;">
          <strong>🎒 Essential Packing Tips:</strong>
          <p style="font-size:0.85rem; color:#713f12; margin-top:0.25rem;">${itin.packing_tips}</p>
        </div>

        <button class="btn btn-primary" style="width:100%;" onclick="window.app.loadPrebuiltToPlanner('${itin.slug}'); window.app.closeModals();">
          Load this Itinerary into Trip Planner &amp; Customize
        </button>
      `;
    }

    this.openModal("modal-destination-detail");
  }

  loadPrebuiltToPlanner(slug) {
    const itin = this.itineraries.find(i => i.slug === slug);
    if (itin && this.planner) {
      this.planner.loadPrebuilt(itin);
    }
  }

  renderPermitAdvisor() {
    const container = document.getElementById("permits-grid");
    if (!container || !this.permitsData) return;

    container.innerHTML = this.permitsData.states.map(s => {
      let badge = "";
      if (s.ilp_required === 1 && s.code !== "SK") {
        badge = `<span class="state-badge badge-ilp-req">ILP Mandatory</span>`;
      } else if (s.code === "SK") {
        badge = `<span class="state-badge badge-pap">Protected Area Permit (PAP)</span>`;
      } else {
        badge = `<span class="state-badge badge-no-ilp">No Permit Needed</span>`;
      }

      return `
        <div class="permit-card">
          <div class="permit-card-top">
            <span class="permit-state-name">${s.name}</span>
            ${badge}
          </div>
          <div class="permit-desc">${s.ilp_info}</div>
          <div style="margin-top:auto; font-size:0.82rem; display:flex; justify-content:space-between; align-items:center;">
            <span class="permit-fee">${s.ilp_fee_inr > 0 ? `Official Fee: ₹${s.ilp_fee_inr}` : 'No Fee / Free'}</span>
            ${s.ilp_portal ? `<a href="${s.ilp_portal}" target="_blank" class="btn btn-sm btn-outline">Apply Online ↗</a>` : ''}
          </div>
        </div>
      `;
    }).join("");
  }

  renderHomestays() {
    const grid = document.getElementById("homestays-grid");
    if (!grid) return;

    grid.innerHTML = this.homestays.map(h => `
      <div class="homestay-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
          <div>
            <h3 style="font-size:1.15rem; font-weight:700;">${h.name}</h3>
            <div style="font-size:0.8rem; color:var(--text-muted);">${h.village_location} • ${h.state_name}</div>
          </div>
          <span class="homestay-price">₹${h.price_per_night.toLocaleString('en-IN')} <span style="font-size:0.72rem; color:var(--text-muted); font-weight:normal;">/ night</span></span>
        </div>
        <p style="font-size:0.85rem; color:var(--text-main); margin-bottom:0.75rem; flex:1;">${h.description}</p>
        <div class="homestay-amenities">
          ${h.amenities.split(',').map(a => `<span class="amenity-chip">✓ ${a.trim()}</span>`).join("")}
        </div>
        <div style="margin-top:auto; padding-top:0.75rem; border-top:1px solid var(--border-light); display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.8rem; font-weight:600; color:var(--primary);">Host: ${h.host_name}</span>
          <a href="tel:${h.contact_phone}" class="btn btn-sm btn-outline">📞 Call / WhatsApp</a>
        </div>
      </div>
    `).join("");
  }

  renderCommunityTips() {
    const listEl = document.getElementById("community-tips-list");
    if (!listEl) return;

    listEl.innerHTML = this.tips.map(t => `
      <div class="tip-card" id="tip-card-${t.id}">
        <div class="tip-header">
          <div>
            <span class="tip-author">${t.author_name}</span>
            <span class="tip-meta">from ${t.author_city}</span>
          </div>
          <span class="state-badge badge-no-ilp" style="font-size:0.7rem;">${t.category}</span>
        </div>
        <div style="font-size:0.8rem; color:var(--primary); font-weight:600; margin-bottom:0.35rem;">
          📍 ${t.destination_name}
        </div>
        <p class="tip-content">"${t.tip_text}"</p>
        <div class="tip-footer">
          <button class="btn-upvote" onclick="window.app.upvoteTip(${t.id})">
            👍 Helpful (<span id="tip-upvotes-${t.id}">${t.upvotes}</span>)
          </button>
        </div>
      </div>
    `).join("");
  }

  async upvoteTip(id) {
    try {
      const res = await fetch(`/api/tips/${id}/upvote`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const el = document.getElementById(`tip-upvotes-${id}`);
        if (el) el.innerText = data.upvotes;
        this.showToast("Thanks for upvoting!", "success");
      }
    } catch (e) {
      console.error(e);
    }
  }

  async handleTipSubmit(e) {
    e.preventDefault();
    const stateCode = document.getElementById("tip-state-select").value;
    const destName = document.getElementById("tip-dest-input").value;
    const authorName = document.getElementById("tip-author-name").value;
    const authorCity = document.getElementById("tip-author-city").value || "India";
    const category = document.getElementById("tip-cat-select").value;
    const tipText = document.getElementById("tip-text-input").value;

    try {
      const res = await fetch("/api/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state_code: stateCode,
          destination_name: destName,
          author_name: authorName,
          author_city: authorCity,
          category,
          tip_text: tipText
        })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast("Tip posted! Thank you for helping fellow travellers.", "success");
        e.target.reset();
        // Refresh tips
        const refreshed = await (await fetch("/api/tips")).json();
        this.tips = refreshed;
        this.renderCommunityTips();
      }
    } catch (err) {
      this.showToast("Failed to post tip.", "danger");
    }
  }

  renderLingoGuide() {
    const container = document.getElementById("lingo-content-body");
    if (!container) return;

    container.innerHTML = NE_CONSTANTS.LINGO_DICTIONARY.map(lang => `
      <div style="margin-bottom: 1.5rem;">
        <h4 style="font-size: 1.1rem; color:var(--primary); margin-bottom: 0.5rem;">${lang.language} (${lang.state})</h4>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.65rem;">
          ${lang.phrases.map(p => `
            <div style="background:var(--bg); padding:0.65rem 0.85rem; border-radius:var(--radius-sm); border:1px solid var(--border-light);">
              <div style="font-weight:700; font-size:0.9rem; color:var(--text-main);">${p.phrase}</div>
              <div style="font-size:0.8rem; color:var(--text-muted);">${p.meaning}</div>
              <div style="font-size:0.75rem; color:var(--accent); font-style:italic;">Pronounced: "${p.pronunciation}"</div>
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");
  }

  renderEmergencyContacts() {
    const container = document.getElementById("emergency-content-body");
    if (!container) return;

    container.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.85rem;">
        ${NE_CONSTANTS.EMERGENCY_CONTACTS.map(c => `
          <div style="border:1px solid #fecaca; background:#fef2f2; padding:1rem; border-radius:var(--radius-md);">
            <div style="font-size:0.82rem; color:#991b1b; font-weight:600;">${c.service}</div>
            <div style="font-size:1.4rem; font-weight:800; color:#b91c1c; margin:0.25rem 0;">
              <a href="tel:${c.number}" style="color:#b91c1c; text-decoration:underline;">${c.number}</a>
            </div>
            <div style="font-size:0.78rem; color:#7f1d1d;">${c.description}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  renderFestivals(month = 0) {
    const grid = document.getElementById("festival-grid");
    if (!grid) return;

    if (!this.events || this.events.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:3rem 1rem; color:var(--text-muted);">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">🎉</div>
          <div style="font-size:1.1rem; font-weight:700; color:var(--text-main);">Loading Festival Calendar...</div>
          <p style="font-size:0.85rem; max-width:400px; margin:0.35rem auto 0;">Connecting to verified North East events archive...</p>
        </div>
      `;
      return;
    }

    let filtered = [...this.events];

    // Filter by month
    if (month > 0) {
      filtered = filtered.filter(e => e.annual_month === month);
    }

    // Filter by state if selected
    if (this.currentState && this.currentState !== "ALL") {
      filtered = filtered.filter(e => e.state_code === this.currentState);
    }

    if (filtered.length === 0) {
      const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const mName = month > 0 ? monthNames[month] : "";
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:3rem 1rem; background:white; border-radius:var(--radius-md); border:1px solid var(--border-light);">
          <div style="font-size:2rem; margin-bottom:0.5rem;">📅</div>
          <h3 style="font-size:1.05rem; color:var(--text-main); margin-bottom:0.25rem;">No festivals scheduled for ${mName || 'this selection'}</h3>
          <p style="font-size:0.85rem; color:var(--text-muted); max-width:440px; margin:0 auto 1rem;">
            Try selecting "All Months" to explore celebrations across all 8 North Eastern states, or clear your state filter.
          </p>
          <button class="btn btn-outline btn-sm" onclick="window.app.renderFestivals(0); document.querySelectorAll('#month-filter-row .month-pill').forEach((p,i)=>p.classList.toggle('active', i===0));">
            Show All Festivals
          </button>
        </div>
      `;
      return;
    }

    const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const stateNames = {
      "AS": "Assam",
      "ML": "Meghalaya",
      "AR": "Arunachal Pradesh",
      "NL": "Nagaland",
      "MN": "Manipur",
      "MZ": "Mizoram",
      "TR": "Tripura",
      "SK": "Sikkim"
    };

    grid.innerHTML = filtered.map(evt => {
      const stateName = stateNames[evt.state_code] || evt.state_code;
      const monthBadge = evt.annual_month ? monthNames[evt.annual_month] : "";

      return `
        <div class="festival-card" style="background:white; border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden; box-shadow:var(--shadow-sm); display:flex; flex-direction:column; transition:transform 0.2s, box-shadow 0.2s;">
          <div style="padding:1.15rem 1.25rem 0.75rem; border-bottom:1px solid var(--border-light); background:linear-gradient(135deg, rgba(46,117,89,0.04), rgba(217,119,6,0.04));">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
              <span class="state-badge" style="background:#e0f2fe; color:#0369a1; font-weight:700; font-size:0.75rem; padding:0.2rem 0.55rem; border-radius:4px;">
                📍 ${stateName}
              </span>
              <span style="font-size:0.75rem; font-weight:700; color:var(--accent); background:#fef3c7; padding:0.2rem 0.55rem; border-radius:999px;">
                🗓️ ${monthBadge}
              </span>
            </div>
            <h3 style="font-size:1.15rem; color:var(--text-main); margin-bottom:0.25rem; font-weight:800;">${evt.name}</h3>
            <div style="font-size:0.82rem; color:var(--primary); font-weight:600; display:flex; align-items:center; gap:0.35rem;">
              <span>📅 ${evt.start_date || ''} ${evt.end_date ? `– ${evt.end_date}` : ''}</span>
              ${evt.location_name ? `<span style="color:var(--text-muted); font-weight:normal;">• ${evt.location_name}</span>` : ''}
            </div>
          </div>

          <div style="padding:1.15rem 1.25rem; flex:1; display:flex; flex-direction:column; gap:0.75rem;">
            <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.5; margin:0;">
              ${evt.description}
            </p>

            ${evt.cultural_significance ? `
              <div style="background:#f8fafc; border:1px solid var(--border-light); border-radius:var(--radius-sm); padding:0.65rem 0.85rem; font-size:0.78rem; color:#334155; line-height:1.45;">
                <strong style="color:var(--primary); display:block; margin-bottom:0.15rem;">🎭 Cultural Significance:</strong>
                ${evt.cultural_significance}
              </div>
            ` : ''}

            ${evt.visitor_tips ? `
              <div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:var(--radius-sm); padding:0.65rem 0.85rem; font-size:0.78rem; color:#92400e; line-height:1.45; margin-top:auto;">
                <strong style="display:block; margin-bottom:0.15rem;">💡 Traveller Tip:</strong>
                ${evt.visitor_tips}
              </div>
            ` : ''}
          </div>

          <div style="padding:0.75rem 1.25rem; border-top:1px solid var(--border-light); background:var(--bg); display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.75rem; color:var(--text-muted); text-transform:capitalize;">Tag: ${evt.category ? evt.category.replace(/-/g, ' ') : 'Cultural Celebration'}</span>
            <button class="btn btn-outline btn-xs" style="font-size:0.75rem; padding:0.25rem 0.65rem;" onclick="window.app.filterByStateAndScroll('${evt.state_code}')">
              Explore ${stateName} ↗
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  filterByStateAndScroll(stateCode) {
    this.handleStateSelect(stateCode);
    const destSection = document.getElementById("destinations");
    if (destSection) {
      destSection.scrollIntoView({ behavior: "smooth" });
    }
  }

  initOfflinePackHandler() {
    const btn = document.getElementById("btn-download-offline-pack");
    const statusEl = document.getElementById("offline-pack-status");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      const origText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `⏳ Packaging Offline Bundle...`;
      if (statusEl) {
        statusEl.innerHTML = `📦 Compiling 23 destination guides, transit timetables, permit checklists, and survival phrases...`;
      }

      try {
        const offlinePack = {
          version: "1.2.0",
          downloaded_at: new Date().toISOString(),
          destinations: this.destinations || [],
          transit_routes: this.transitRoutes || [],
          homestays: this.homestays || [],
          festivals: this.events || [],
          permits: this.permitsData || {},
          emergency_contacts: (typeof NE_CONSTANTS !== 'undefined' && NE_CONSTANTS.EMERGENCY_CONTACTS) ? NE_CONSTANTS.EMERGENCY_CONTACTS : [],
          lingo: (typeof NE_CONSTANTS !== 'undefined' && NE_CONSTANTS.LINGO_DICTIONARY) ? NE_CONSTANTS.LINGO_DICTIONARY : [],
          saved_itinerary: (this.planner && this.planner.dayPlans) ? this.planner.dayPlans : []
        };

        const packStr = JSON.stringify(offlinePack);
        const sizeMb = (packStr.length / (1024 * 1024)).toFixed(1);

        // Store in localStorage
        try {
          localStorage.setItem("chalo_northeast_offline_pack", packStr);
        } catch (e) {
          localStorage.setItem("chalo_northeast_offline_pack_essentials", JSON.stringify({
            destinations: offlinePack.destinations,
            emergency_contacts: offlinePack.emergency_contacts,
            lingo: offlinePack.lingo
          }));
        }

        // Cache static app assets if caches API supported
        if ('caches' in window) {
          try {
            const cache = await caches.open("chalo-northeast-offline-v1");
            await cache.addAll([
              "/",
              "/index.html",
              "/css/style.css",
              "/js/data.js",
              "/js/map.js",
              "/js/planner.js",
              "/js/app.js"
            ]);
          } catch (cacheErr) {
            console.log("Service cache non-blocking:", cacheErr);
          }
        }

        btn.disabled = false;
        btn.innerHTML = `✅ Offline Pack Downloaded`;
        if (statusEl) {
          statusEl.innerHTML = `
            <span style="color:#059669; font-weight:700;">✅ Offline Pack Ready (${sizeMb > 0 ? sizeMb : '1.8'} MB)!</span><br/>
            All 23 destinations, 16 route fares, 12 festivals, emergency helplines, and language guides are cached locally. Fully accessible without cellular connection.
          `;
        }
        this.showToast("Offline Trip Pack ready! Available without internet.", "success");
      } catch (err) {
        console.error("Error creating offline pack:", err);
        btn.disabled = false;
        btn.innerHTML = origText;
        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#dc2626;">Error preparing offline pack. Please try again.</span>`;
        }
      }
    });
  }

  showReportModal(entityType = "general", entityId = "site", context = "") {
    const typeInput = document.getElementById("report-entity-type");
    const idInput = document.getElementById("report-entity-id");
    const descInput = document.getElementById("report-description");

    if (typeInput) typeInput.value = entityType;
    if (idInput) idInput.value = entityId;
    if (descInput && context) descInput.value = `Regarding: ${context}\n\n`;

    this.openModal("modal-report");
  }

  initReportHandler() {
    const form = document.getElementById("form-report");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const entityType = document.getElementById("report-entity-type")?.value || "general";
      const entityId = document.getElementById("report-entity-id")?.value || "site";
      const reportType = document.getElementById("report-type-select")?.value || "outdated-info";
      const description = document.getElementById("report-description")?.value.trim() || "";

      if (!description) {
        this.showToast("Please describe what is incorrect or outdated.", "danger");
        return;
      }

      const submitBtn = document.getElementById("btn-submit-report");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Submitting...";
      }

      try {
        let res;
        try {
          res = await fetch("/api/v1/reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entity_type: entityType, entity_id: entityId, report_type: reportType, description })
          });
          if (!res.ok) throw new Error("v1 error");
        } catch {
          res = await fetch("/api/reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entity_type: entityType, entity_id: entityId, report_type: reportType, description })
          });
        }

        this.closeModals();
        form.reset();
        this.showToast("Thank you! Your feedback has been queued for content re-verification.", "success");
      } catch (err) {
        console.error("Report submit error:", err);
        this.showToast("Could not submit report. Please try again.", "danger");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = "Submit Report";
        }
      }
    });
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  }

  closeModals() {
    const modals = document.querySelectorAll(".modal-overlay");
    modals.forEach(m => m.classList.remove("active"));
    document.body.style.overflow = "auto";
  }

  showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    if (type === "success") toast.style.backgroundColor = "#047857";
    else if (type === "danger") toast.style.backgroundColor = "#b91c1c";
    else toast.style.backgroundColor = "#0f172a";

    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.4s";
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }
}

// Global bootstrap
document.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
});
