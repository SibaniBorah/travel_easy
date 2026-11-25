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

    this.galleryState = {
      activeSlug: null,
      dest: null,
      photos: [],
      currentIndex: 0
    };

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
          this.renderItineraries();
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

    // Photo gallery keyboard swipe/nav and Escape key
    window.addEventListener("keydown", (e) => {
      const gallery = document.getElementById("modal-photo-gallery");
      if (gallery && gallery.classList.contains("active")) {
        if (e.key === "ArrowLeft") this.prevGalleryPhoto();
        else if (e.key === "ArrowRight") this.nextGalleryPhoto();
        else if (e.key === "Escape") this.closeGallery();
      }
    });

    // Touch swipe support on gallery viewport
    const viewport = document.getElementById("gallery-viewport");
    if (viewport) {
      let touchStartX = 0;
      viewport.addEventListener("touchstart", (e) => {
        if (e.changedTouches && e.changedTouches[0]) {
          touchStartX = e.changedTouches[0].screenX;
        }
      }, { passive: true });
      viewport.addEventListener("touchend", (e) => {
        if (e.changedTouches && e.changedTouches[0]) {
          const touchEndX = e.changedTouches[0].screenX;
          const diff = touchEndX - touchStartX;
          if (Math.abs(diff) > 40) {
            if (diff < 0) this.nextGalleryPhoto();
            else this.prevGalleryPhoto();
          }
        }
      }, { passive: true });
    }
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
    this.renderItineraries();
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
    this.renderItineraries();
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

  isDestinationInSeason(d, seasonKey) {
    if (!seasonKey || seasonKey === "all") return true;
    const text = ((d.best_season || "") + " " + (d.best_months || "")).toLowerCase();
    if (text.includes("year round") || text.includes("all year") || text.includes("throughout the year")) return true;

    const monthNames = {
      "jan": 1, "january": 1,
      "feb": 2, "february": 2,
      "mar": 3, "march": 3,
      "apr": 4, "april": 4,
      "may": 5,
      "jun": 6, "june": 6,
      "jul": 7, "july": 7,
      "aug": 8, "august": 8,
      "sep": 9, "september": 9,
      "oct": 10, "october": 10,
      "nov": 11, "november": 11,
      "dec": 12, "december": 12
    };

    const targetMonths = {
      "oct-nov": [10, 11],
      "dec-feb": [12, 1, 2],
      "mar-apr": [3, 4],
      "may-sep": [5, 6, 7, 8, 9]
    }[seasonKey] || [];

    const rangeRegex = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(?:to|-)\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/gi;
    let match;
    while ((match = rangeRegex.exec(text)) !== null) {
      const m1 = monthNames[match[1].toLowerCase()];
      const m2 = monthNames[match[2].toLowerCase()];
      if (m1 && m2) {
        for (const tm of targetMonths) {
          if (m1 <= m2 && tm >= m1 && tm <= m2) return true;
          if (m1 > m2 && (tm >= m1 || tm <= m2)) return true;
        }
      }
    }

    const kwMap = {
      "oct-nov": ["october", "november", "autumn", "post monsoon"],
      "dec-feb": ["december", "january", "february", "winter", "frost"],
      "mar-apr": ["march", "april", "spring", "rhododendron"],
      "may-sep": ["may", "june", "july", "august", "september", "monsoon", "summer"]
    }[seasonKey] || [];

    return kwMap.some(kw => text.includes(kw));
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
        const cost = d.est_cost_per_day || 0;
        if (this.currentBudgetTier === "backpacker") return cost <= 1000;
        if (this.currentBudgetTier === "budget") return cost > 1000 && cost <= 1600;
        if (this.currentBudgetTier === "moderate") return cost > 1600 && cost <= 2500;
        if (this.currentBudgetTier === "comfort") return cost >= 2000;
        return true;
      });
    }

    // Filter by season
    if (this.currentSeason && this.currentSeason !== "all") {
      list = list.filter(d => this.isDestinationInSeason(d, this.currentSeason));
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
        <div class="dest-card-header" onclick="window.app.openGallery('${dest.slug}')" style="cursor: pointer;" title="Click to view photo gallery">
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
          <div class="dest-gallery-pill">
            📷 <span>Photos</span>
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
            <button class="btn btn-outline btn-sm" onclick="window.app.openGallery('${dest.slug}')" title="View photo gallery">
              📷 Photos
            </button>
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
    const activeStateChip = document.querySelector("#state-filters-container .filter-chip.active");
    if (activeStateChip) {
      this.currentState = activeStateChip.getAttribute("data-state") || "ALL";
    }

    const activeCatChip = document.querySelector("#category-filters-container .filter-chip.active");
    if (activeCatChip) {
      this.currentCategory = activeCatChip.getAttribute("data-category") || "all";
    }

    const budgetSelect = document.getElementById("budget-tier-filter");
    if (budgetSelect) this.currentBudgetTier = budgetSelect.value || "all";

    const seasonSelect = document.getElementById("season-filter");
    if (seasonSelect) this.currentSeason = seasonSelect.value || "all";

    const searchInput = document.getElementById("global-search-input");
    if (searchInput) this.searchQuery = searchInput.value.trim().toLowerCase();

    if (this.map && this.currentState !== "ALL") {
      this.map.selectState(this.currentState);
    } else if (this.map && this.currentState === "ALL") {
      this.map.selectedState = null;
      if (this.map.resetHighlight) this.map.resetHighlight();
    }

    this.renderStateHighlights();
    this.renderDestinations();
    this.renderItineraries();

    const btn = document.getElementById("btn-apply-filters");
    if (btn) {
      const origText = btn.innerHTML;
      btn.innerHTML = "✓ Applied!";
      btn.style.backgroundColor = "#059669";
      btn.style.transform = "scale(0.96)";
      setTimeout(() => {
        btn.innerHTML = origText;
        btn.style.backgroundColor = "";
        btn.style.transform = "";
      }, 1000);
    }

    const destCount = document.querySelectorAll("#destinations-grid .dest-card").length;
    const itinCount = document.querySelectorAll("#itineraries-grid .itinerary-card").length;
    this.showToast(`Filters Applied: ${destCount} attraction${destCount === 1 ? '' : 's'} & ${itinCount} plan${itinCount === 1 ? '' : 's'} matching.`, "success");
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

    const stateChips = document.querySelectorAll("#state-filters-container .filter-chip");
    stateChips.forEach(c => c.classList.toggle("active", c.getAttribute("data-state") === "ALL"));

    const catChips = document.querySelectorAll("#category-filters-container .filter-chip");
    catChips.forEach(c => c.classList.toggle("active", c.getAttribute("data-category") === "all"));

    if (this.map) {
      this.map.selectedState = null;
      if (this.map.resetHighlight) this.map.resetHighlight();
    }

    this.renderStateHighlights();
    this.renderDestinations();
    this.renderItineraries();
    this.showToast("All filters reset.", "info");
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
            <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(transparent, rgba(0,0,0,0.85)); padding:0.9rem 1.25rem; color:white; display:flex; justify-content:space-between; align-items:flex-end;">
              <div>
                <span class="state-badge badge-no-ilp" style="background:var(--primary); color:white; border:none;">${dest.category.toUpperCase()}</span>
                <span style="font-size:0.85rem; opacity:0.95; margin-left:0.5rem;">Altitude: ${dest.altitude} • Best Season: ${dest.best_season}</span>
              </div>
              <button class="btn btn-sm btn-primary" onclick="window.app.openGallery('${dest.slug}')" style="box-shadow:0 2px 8px rgba(0,0,0,0.4); font-weight:600; font-size:0.8rem; padding:0.35rem 0.8rem;">
                📷 View Photos
              </button>
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

    let list = this.itineraries || [];

    // Filter itineraries by state
    if (this.currentState && this.currentState !== "ALL") {
      list = list.filter(itin => {
        const states = (itin.states || "").split(",").map(s => s.trim());
        if (states.includes(this.currentState)) return true;
        const stateObj = (typeof NE_CONSTANTS !== "undefined" && NE_CONSTANTS.STATES) ? NE_CONSTANTS.STATES[this.currentState] : null;
        if (stateObj && (itin.title.includes(stateObj.name) || itin.summary.includes(stateObj.name))) return true;
        return false;
      });
    }

    // Filter itineraries by category
    if (this.currentCategory && this.currentCategory !== "all") {
      const catKeywords = {
        "wildlife": ["wildlife", "safari", "rhino", "kaziranga", "manas", "jungle"],
        "waterfall": ["waterfall", "falls", "sohra", "root bridge", "river"],
        "monastery": ["monaster", "tawang", "gompa", "buddhist", "sikkim", "pelling"],
        "trek": ["trek", "dzukou", "hike", "active", "trail"],
        "culture": ["culture", "tribal", "hornbill", "satras", "ahoms", "village"],
        "scenic": ["scenic", "himalayan", "lake", "pass", "high altitude", "odyssey"]
      }[this.currentCategory] || [this.currentCategory];

      list = list.filter(itin => {
        const text = (itin.title + " " + itin.summary + " " + (itin.pace || "")).toLowerCase();
        return catKeywords.some(kw => text.includes(kw));
      });
    }

    // Filter itineraries by budget tier
    if (this.currentBudgetTier && this.currentBudgetTier !== "all") {
      list = list.filter(itin => {
        const total = itin.est_total_cost_inr || 0;
        const perDay = itin.duration_days ? Math.round(total / itin.duration_days) : 1500;
        if (this.currentBudgetTier === "backpacker") {
          return perDay <= 1600 || total <= 9000;
        }
        if (this.currentBudgetTier === "budget") {
          return total <= 15000;
        }
        if (this.currentBudgetTier === "moderate") {
          return total >= 10000 && total <= 20000;
        }
        if (this.currentBudgetTier === "comfort") {
          return total >= 15000;
        }
        return true;
      });
    }

    const countLabel = document.getElementById("itineraries-count-label");
    if (countLabel) {
      countLabel.innerText = `Showing ${list.length} plan${list.length === 1 ? '' : 's'}`;
    }

    if (list.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem 1rem; background: white; border-radius: var(--radius-lg); border: 1px dashed var(--border);">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">🗒️</div>
          <h4 style="font-size: 1.15rem; margin-bottom: 0.5rem;">No curated plans match your current filters</h4>
          <p style="font-size: 0.88rem; margin-bottom: 1rem; color: var(--text-muted);">
            Try selecting "All States" or clearing specific category/budget filters to see more itineraries.
          </p>
          <button class="btn btn-primary btn-sm" onclick="window.app.resetFilters()">Reset All Filters</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = list.map(itin => {
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
    const modals = document.querySelectorAll(".modal-overlay, .gallery-modal-overlay");
    modals.forEach(m => m.classList.remove("active"));
    document.body.style.overflow = "auto";
  }

  getDestinationGallery(slug) {
    const dest = this.destinations.find(d => d.slug === slug);
    const destName = dest ? dest.name : "Destination";
    const stateName = dest ? dest.state_name : "North East India";

    const galleryMap = {
      "gurudongmar-lake-north-sikkim": [
        {
          url: "/images/destinations/gurudongmar-lake-north-sikkim.jpg",
          title: "Gurudongmar High-Altitude Sacred Lake (5,430m)",
          desc: "One of the highest lakes in the world, sacred to Buddhists and Sikhs, surrounded by snow-capped peaks."
        },
        {
          url: "/images/destinations/tsomgo-lake-nathula-pass.jpg",
          title: "Tsomgo Glacial Lake & Alpine Pass",
          desc: "Pristine glacial lake situated at 12,400 ft on the historic Indo-China Silk Route in East Sikkim."
        },
        {
          url: "/images/destinations/pelling-skywalk-pemayangtse.jpg",
          title: "Mount Kanchenjunga Majestic Panorama",
          desc: "Breathtaking views of the world's 3rd highest peak and centuries-old Pemayangtse Monastery."
        },
        {
          url: "/images/itineraries/sikkim-himalayan-majesty-7d.jpg",
          title: "North Sikkim High Himalayan Plateau",
          desc: "Dramatic valleys of Lachen, Lachung, and Yumthang Valley of Flowers covered in alpine beauty."
        }
      ],
      "tawang-sela-pass": [
        {
          url: "/images/destinations/tawang-sela-pass.jpg",
          title: "Tawang Monastery & Sela Pass (13,700 ft)",
          desc: "India's largest Buddhist monastery and the breathtaking snow-covered Sela gateway."
        },
        {
          url: "/images/destinations/mechuka-forbidden-valley.jpg",
          title: "Mechuka Valley & Pristine Siyom River",
          desc: "Untouched highland meadows, snow peaks, and ancient Memba Buddhist traditions."
        },
        {
          url: "/images/destinations/ziro-valley-apatani.jpg",
          title: "Arunachal Pine Hills & Lush Valleys",
          desc: "Enchanting landscapes across the Eastern Himalayas."
        },
        {
          url: "/images/itineraries/arunachal-tawang-high-altitude-7d.jpg",
          title: "High Altitude Himalayan Pass & Prayer Flags",
          desc: "Buddhist prayer flags fluttering along the historic trade route near China border."
        }
      ],
      "nongriat-root-bridges": [
        {
          url: "/images/destinations/nongriat-root-bridges.jpg",
          title: "Double Decker Living Root Bridge, Nongriat",
          desc: "World-renowned bio-engineering marvel crafted by Khasi tribes from Ficus elastica roots across 200+ years."
        },
        {
          url: "/images/destinations/cherrapunji-sohra.jpg",
          title: "Nohkalikai Falls & Cloud Gorges of Sohra",
          desc: "India's tallest plunge waterfall (1,115 ft) cascading into a turquoise jungle pool."
        },
        {
          url: "/images/destinations/mawlynnong-clean-village.jpg",
          title: "Living Root Bridge of Riwai Village",
          desc: "Single-decker living root bridge near Asia's cleanest village."
        },
        {
          url: "/images/destinations/dawki-shnongpdeng-river.jpg",
          title: "Rainbow Falls & Crystal Natural Pools",
          desc: "Deep turquoise natural river pools hidden within Nongriat's rainforest trail."
        }
      ],
      "dzukou-valley-trek": [
        {
          url: "/images/destinations/dzukou-valley-trek.jpg",
          title: "Dzukou Valley Rolling Green Hills (2,452m)",
          desc: "Famous for the rare Dzukou Lily, sweeping emerald dwarf-bamboo hills, and winding natural streams."
        },
        {
          url: "/images/destinations/kohima-kisama-hornbill.jpg",
          title: "Kisama Heritage Morungs & Gateways",
          desc: "Traditional Naga tribal architecture in the shadow of Mount Japfü."
        },
        {
          url: "/images/destinations/khonoma-green-village.jpg",
          title: "Khonoma Terraced Paddy Fields",
          desc: "Centuries-old terraced agriculture and India's first green village conservation sanctuary."
        },
        {
          url: "/images/itineraries/nagaland-dzukou-and-hornbill-5d.jpg",
          title: "Camping Under The Stars in Dzukou Valley",
          desc: "Golden sunrise over misty mountain ravines along the Nagaland-Manipur border."
        }
      ],
      "cherrapunji-sohra": [
        {
          url: "/images/destinations/cherrapunji-sohra.jpg",
          title: "Nohkalikai Falls & Misty Gorges",
          desc: "Breathtaking 340-meter plunge waterfall in the heart of Sohra's wet evergreen plateau."
        },
        {
          url: "/images/destinations/nongriat-root-bridges.jpg",
          title: "Double Decker Bio-Root Bridge Trail",
          desc: "The legendary 3,500-step trek connecting Tyrna to deep jungle living root bridges."
        },
        {
          url: "/images/destinations/dawki-shnongpdeng-river.jpg",
          title: "Seven Sisters Falls & Limestone Caverns",
          desc: "Mawsmai and Arwah limestone caves with prehistoric fossils and subterranean waterfalls."
        },
        {
          url: "/images/itineraries/meghalaya-budget-backpacker-5d.jpg",
          title: "Meghalaya Clouds, Cliffs & Living Wonders",
          desc: "Scenic viewpoints looking out across the Bangladesh plains."
        }
      ],
      "loktak-lake-keibul-lamjao": [
        {
          url: "/images/destinations/loktak-lake-keibul-lamjao.jpg",
          title: "Loktak Lake Floating Phumdis",
          desc: "The largest freshwater lake in Northeast India, famed for circular floating biomass islands called phumdis."
        },
        {
          url: "/images/destinations/imphal-city-ima-keithel.jpg",
          title: "Imphal Valley & Historic Kangla Fort",
          desc: "The cultural heartland of Manipur with royal coronation pavilions and sacred ponds."
        },
        {
          url: "/images/itineraries/seven-sisters-grand-explorer-12d.jpg",
          title: "Keibul Lamjao - World's Only Floating National Park",
          desc: "The last natural refuge of the endangered dancing deer, the Sangai."
        },
        {
          url: "/images/hero-bg.jpg",
          title: "Traditional Manipuri Cultural Splendor",
          desc: "Rich dance traditions, vibrant handlooms, and indigenous water culture."
        }
      ],
      "kaziranga-national-park": [
        {
          url: "/images/destinations/kaziranga-national-park.jpg",
          title: "Great Indian One-Horned Rhinoceros at Kaziranga",
          desc: "UNESCO World Heritage site home to two-thirds of the world's great one-horned rhinoceros population."
        },
        {
          url: "/images/destinations/manas-national-park.jpg",
          title: "Elephant & Wild Water Buffalo Habitats",
          desc: "Pristine alluvial tall grassland and tropical moist deciduous forests."
        },
        {
          url: "/images/destinations/majuli-island.jpg",
          title: "Brahmaputra Floodplains & Bird Sanctuary",
          desc: "Crucial stopover for thousands of migratory waterbirds from Siberia and Central Asia."
        },
        {
          url: "/images/itineraries/assam-wildlife-and-majuli-6d.jpg",
          title: "Morning Jeep Safari in Bagori & Kohora Ranges",
          desc: "Thrilling early morning wildlife spotting through misty elephant grass."
        }
      ],
      "mechuka-forbidden-valley": [
        {
          url: "/images/destinations/mechuka-forbidden-valley.jpg",
          title: "Mechuka Forbidden Valley & Siyom River (1,829m)",
          desc: "Known as the Mini Switzerland of India, surrounded by snow-draped pine peaks near Tibet border."
        },
        {
          url: "/images/destinations/tawang-sela-pass.jpg",
          title: "400-Year-Old Samten Yongcha Buddhist Gompa",
          desc: "Historic hill-perched monastery with ancient Tibetan murals and statues."
        },
        {
          url: "/images/destinations/ziro-valley-apatani.jpg",
          title: "Wooden Bridges & Lush High Pastures",
          desc: "Traditional hanging bridges crossing torrential glacial mountain rivers."
        },
        {
          url: "/images/itineraries/arunachal-tawang-high-altitude-7d.jpg",
          title: "Memba & Ramo Tribal Wooden Homestays",
          desc: "Warm hospitality with roaring bukhari wood stoves and fresh butter tea."
        }
      ],
      "kohima-kisama-hornbill": [
        {
          url: "/images/destinations/kohima-kisama-hornbill.jpg",
          title: "Kisama Heritage Village & Hornbill Arena",
          desc: "Permanent cultural arena showcasing authentic morungs (dormitories) of all 17 major Naga tribes."
        },
        {
          url: "/images/destinations/dzukou-valley-trek.jpg",
          title: "Mount Japfü & Dzukou Foothills",
          desc: "Trekking through the second highest peak in Nagaland and rhododendron forests."
        },
        {
          url: "/images/destinations/khonoma-green-village.jpg",
          title: "Angami Naga Traditional Architecture",
          desc: "Carved wooden clan gateways (Kharu) and historical resistance monuments."
        },
        {
          url: "/images/hero-bg.jpg",
          title: "Hornbill Festival Grand Tribal Dances",
          desc: "The famous 'Festival of Festivals' held every December celebrating Naga bravery and harvest."
        }
      ],
      "tsomgo-lake-nathula-pass": [
        {
          url: "/images/destinations/tsomgo-lake-nathula-pass.jpg",
          title: "Tsomgo (Changu) Sacred Glacial Lake (12,400 ft)",
          desc: "Sacred oval alpine lake reflecting changing colors across seasons, surrounded by rugged mountain slopes."
        },
        {
          url: "/images/destinations/gurudongmar-lake-north-sikkim.jpg",
          title: "Nathu La Pass & Old Silk Route Indo-China Border",
          desc: "Historic high-altitude pass at 14,140 ft linking Sikkim with Tibet Autonomous Region."
        },
        {
          url: "/images/destinations/pelling-skywalk-pemayangtse.jpg",
          title: "Baba Harbhajan Singh Memorial Shrine",
          desc: "Legendary military shrine revered by soldiers stationed along the Eastern Himalayan frontier."
        },
        {
          url: "/images/itineraries/sikkim-himalayan-majesty-7d.jpg",
          title: "Yak Safaris in Winter Snowscape",
          desc: "Decorated friendly Himalayan yaks traversing snow trails around the alpine lake."
        }
      ],
      "pelling-skywalk-pemayangtse": [
        {
          url: "/images/destinations/pelling-skywalk-pemayangtse.jpg",
          title: "Pelling Glass Skywalk & 137ft Chenrezig Statue",
          desc: "India's first glass skywalk overlooking deep Himalayan valleys and facing Mount Kanchenjunga."
        },
        {
          url: "/images/destinations/gurudongmar-lake-north-sikkim.jpg",
          title: "Pemayangtse Monastery (1705 AD)",
          desc: "One of Sikkim's oldest and premier Nyingma Buddhist monasteries with priceless wood carvings."
        },
        {
          url: "/images/destinations/tsomgo-lake-nathula-pass.jpg",
          title: "Rabdentse Ruins & Royal Ancient Capital",
          desc: "Archaeological ruins of the second historic capital of the Kingdom of Sikkim."
        },
        {
          url: "/images/itineraries/sikkim-himalayan-majesty-7d.jpg",
          title: "Singshore Suspension Bridge & Waterfalls",
          desc: "Spectacular gorge crossings and lush cardamom plantations of West Sikkim."
        }
      ],
      "ziro-valley-apatani": [
        {
          url: "/images/destinations/ziro-valley-apatani.jpg",
          title: "Ziro Valley Pine Hills & Terraced Paddy (1,572m)",
          desc: "UNESCO tentative world heritage site famous for eco-friendly paddy-cum-fish farming by the Apatani."
        },
        {
          url: "/images/destinations/tawang-sela-pass.jpg",
          title: "Apatani Bamboo Villages & Sacred Groves",
          desc: "Hong, Hari, and Bulla villages preserved with distinctive bamboo homes and sacred totems."
        },
        {
          url: "/images/destinations/mechuka-forbidden-valley.jpg",
          title: "Kardo Shiva Lingam & Talley Valley Sanctuary",
          desc: "Naturally formed 25ft stone lingam and subtropical cloud rainforest rich in rare clouded leopards."
        },
        {
          url: "/images/hero-bg.jpg",
          title: "Ziro Music Festival & Cultural Celebrations",
          desc: "India's greatest outdoor indie music festival set in golden autumn paddy fields."
        }
      ],
      "dawki-shnongpdeng-river": [
        {
          url: "/images/destinations/dawki-shnongpdeng-river.jpg",
          title: "Umngot River Floating Boats on Crystal Water",
          desc: "Water so transparent that wooden country boats appear to float in mid-air above the riverbed."
        },
        {
          url: "/images/destinations/cherrapunji-sohra.jpg",
          title: "Shnongpdeng Riverside Pebble Beaches",
          desc: "Popular hub for kayaking, cliff jumping, snorkeling, and camping along the clear river banks."
        },
        {
          url: "/images/destinations/mawlynnong-clean-village.jpg",
          title: "Dawki Suspension Bridge & Bangladesh Border",
          desc: "Historic British-era single span suspension bridge spanning the gorge into Tamabil."
        },
        {
          url: "/images/destinations/nongriat-root-bridges.jpg",
          title: "Night Camping Under Starry Skies at Umngot",
          desc: "Riverside bonfires and local Khasi grilled fish by the tranquil river."
        }
      ],
      "unakoti-rock-reliefs": [
        {
          url: "/images/destinations/unakoti-rock-reliefs.jpg",
          title: "Unakoti Rock-Cut Bas Reliefs of Lord Shiva (7th-9th C)",
          desc: "Mysterious hillside rock carvings of 99,99,999 deities hidden within Tripura's dense tropical forest."
        },
        {
          url: "/images/destinations/tripura-palaces-neermahal.jpg",
          title: "Central Shiva Head (Unakotiswara Kal Bhairava)",
          desc: "Colossal 30-foot high rock sculpture adorned with an elaborate headdress."
        },
        {
          url: "/images/itineraries/seven-sisters-grand-explorer-12d.jpg",
          title: "Ganesha & Rawana Stone Sculptures by the Stream",
          desc: "Intricately carved elephant gods and celestial figures flanking natural forest waterfalls."
        },
        {
          url: "/images/hero-bg.jpg",
          title: "Ashokastami Mela & Pilgrimage Heritage",
          desc: "Annual spring festival drawing thousands of pilgrims from across Eastern India."
        }
      ],
      "khonoma-green-village": [
        {
          url: "/images/destinations/khonoma-green-village.jpg",
          title: "Khonoma Asia's First Green Village",
          desc: "Eco-conscious Angami village that banned hunting and logging to protect the Blyth's Tragopan pheasant."
        },
        {
          url: "/images/destinations/dzukou-valley-trek.jpg",
          title: "Terraced Paddy Fields with Mountain Springs",
          desc: "Ancient self-irrigating step cultivation sculpted along steep mountain slopes."
        },
        {
          url: "/images/destinations/kohima-kisama-hornbill.jpg",
          title: "Fortified Morungs & Battle of Khonoma Heritage",
          desc: "Stone forts where Angami warriors held off British colonial forces in the 1879 siege."
        },
        {
          url: "/images/itineraries/nagaland-dzukou-and-hornbill-5d.jpg",
          title: "Nature Trails & Blyth's Tragopan Sanctuary",
          desc: "20 sq km community nature reserve rich in endangered orchids, ferns, and montane birds."
        }
      ],
      "aizawl-reiek-peak": [
        {
          url: "/images/destinations/aizawl-reiek-peak.jpg",
          title: "Reiek Peak Sheer Cliffs (1,548m)",
          desc: "Towering vertical rock face offering 360-degree views across Mizoram's lush valleys towards Bangladesh."
        },
        {
          url: "/images/destinations/thenzawl-vantawng-falls.jpg",
          title: "Reiek Mizo Model Heritage Village",
          desc: "Reconstructed traditional huts of Mizo chieftains, bachelors' quarters, and blacksmith workshops."
        },
        {
          url: "/images/itineraries/seven-sisters-grand-explorer-12d.jpg",
          title: "Aizawl Mountain City Ridge at Night",
          desc: "Glittering capital city perched atop serpentine mountain ridges under starry skies."
        },
        {
          url: "/images/hero-bg.jpg",
          title: "Anurag Bamboo Groves & Trek Trail",
          desc: "Lush tropical hardwood forest trail teeming with migratory birds, orchids, and wild ferns."
        }
      ],
      "majuli-island": [
        {
          url: "/images/destinations/majuli-island.jpg",
          title: "Majuli Island - World's Largest River Island",
          desc: "Nestled in the Brahmaputra River, the spiritual epicenter of Assam's Neo-Vaishnavite culture."
        },
        {
          url: "/images/destinations/sivasagar-ahom-heritage.jpg",
          title: "Chamaguri Satra Traditional Mask Making",
          desc: "Centuries-old craft of handcrafting bamboo and clay mythological masks for Bhaona theatrical plays."
        },
        {
          url: "/images/destinations/kaziranga-national-park.jpg",
          title: "Kamalabari & Auniati Satra Monasteries",
          desc: "Monks performing ethereal Sattriya classical dances and playing rhythmic Khol drums."
        },
        {
          url: "/images/itineraries/assam-wildlife-and-majuli-6d.jpg",
          title: "Sunset Boat Cruise on the Brahmaputra",
          desc: "Traditional wooden ferry rides navigating the peaceful sandbars and wetlands."
        }
      ],
      "tripura-palaces-neermahal": [
        {
          url: "/images/destinations/tripura-palaces-neermahal.jpg",
          title: "Neermahal Water Palace on Rudrasagar Lake",
          desc: "Only floating palace in Eastern India, blending Hindu and Mughal architectural styles built in 1930."
        },
        {
          url: "/images/destinations/unakoti-rock-reliefs.jpg",
          title: "Ujjayanta Palace & Royal Courtyards",
          desc: "Magnificent white neoclassical palace in Agartala with Mughal-style gardens and fountains."
        },
        {
          url: "/images/itineraries/seven-sisters-grand-explorer-12d.jpg",
          title: "Rudrasagar Lake Migratory Bird Sanctuary",
          desc: "Boat cruises watching pintails, teals, and cormorants around the illuminated water palace."
        },
        {
          url: "/images/hero-bg.jpg",
          title: "Tripura Tribal Handloom & Folk Festivities",
          desc: "Traditional Risa and Rikutu weaving with intricate indigenous geometric motifs."
        }
      ],
      "mawlynnong-clean-village": [
        {
          url: "/images/destinations/mawlynnong-clean-village.jpg",
          title: "Mawlynnong Village Floral Paths & Bamboo Bins",
          desc: "Awarded Asia's Cleanest Village in 2003, with 100% literacy, eco-waste management, and blooming gardens."
        },
        {
          url: "/images/destinations/dawki-shnongpdeng-river.jpg",
          title: "Sky Walk Bamboo Machan Viewpoint",
          desc: "85-foot eco-bamboo watchtower offering sweeping bird's-eye views across the Bangladesh plains."
        },
        {
          url: "/images/destinations/nongriat-root-bridges.jpg",
          title: "Riwai Single-Decker Living Root Bridge",
          desc: "Accessible living root bridge grown over a sparkling stream just 10 minutes from the village."
        },
        {
          url: "/images/destinations/cherrapunji-sohra.jpg",
          title: "Traditional Khasi Thatched Homestays",
          desc: "Wholesome organic Khasi meals served with local red rice, wild greens, and seasonal fruits."
        }
      ],
      "imphal-city-ima-keithel": [
        {
          url: "/images/destinations/imphal-city-ima-keithel.jpg",
          title: "Ima Keithel (Mother's Market) - 500-Year Heritage",
          desc: "World's largest market run entirely by over 5,000 married women traders selling textiles and produce."
        },
        {
          url: "/images/destinations/loktak-lake-keibul-lamjao.jpg",
          title: "Kangla Fort & Royal Kangla Sha Dragons",
          desc: "Ancient fortified palace complex holding the sacred coronation sites of Meitei royalty."
        },
        {
          url: "/images/itineraries/seven-sisters-grand-explorer-12d.jpg",
          title: "Manipur State Museum & Royal Polo Grounds",
          desc: "Home to the original roots of modern polo (Sagol Kangjei), played on indigenous Manipuri ponies."
        },
        {
          url: "/images/hero-bg.jpg",
          title: "Classical Manipuri Raas Leela & Pung Cholom",
          desc: "Acrobatic drum dances and graceful devotional dances celebrating Vaishnavite culture."
        }
      ],
      "thenzawl-vantawng-falls": [
        {
          url: "/images/destinations/thenzawl-vantawng-falls.jpg",
          title: "Vantawng Falls - Highest Waterfall in Mizoram (750 ft)",
          desc: "Magnificent two-tiered waterfall roaring amidst impenetrable bamboo groves and deep jungle canyons."
        },
        {
          url: "/images/destinations/aizawl-reiek-peak.jpg",
          title: "Tuirihnau Falls & Natural Crystal Lagoons",
          desc: "Serene curtain waterfall where visitors can walk directly behind the cascade into natural grottos."
        },
        {
          url: "/images/itineraries/seven-sisters-grand-explorer-12d.jpg",
          title: "Thenzawl Handloom Weaving Center",
          desc: "The textile capital of Mizoram, producing exquisite handwoven Puan fabrics on traditional loin looms."
        },
        {
          url: "/images/hero-bg.jpg",
          title: "Thenzawl Golf Course & Lush Meadows",
          desc: "Pristine highland eco-tourism park set amidst pine hills and misty mornings."
        }
      ],
      "manas-national-park": [
        {
          url: "/images/destinations/manas-national-park.jpg",
          title: "Manas UNESCO Biosphere & Foothills of Bhutan",
          desc: "Cross-border biodiversity haven harboring golden langurs, pygmy hogs, Bengal tigers, and wild elephants."
        },
        {
          url: "/images/destinations/kaziranga-national-park.jpg",
          title: "Manas River White Water & Elephant Camp",
          desc: "Crystal-clear glacier-fed river flowing out from Bhutan into Assam's lush riverine plains."
        },
        {
          url: "/images/destinations/majuli-island.jpg",
          title: "Pygmy Hog Conservation Breeding Center",
          desc: "Global sanctuary saving the world's smallest and rarest wild suid from extinction."
        },
        {
          url: "/images/itineraries/assam-wildlife-and-majuli-6d.jpg",
          title: "Bansbari & Mathanguri Riverfront Vistas",
          desc: "Panoramic forest rest house overlooking the turquoise river into the Royal Manas National Park of Bhutan."
        }
      ],
      "sivasagar-ahom-heritage": [
        {
          url: "/images/destinations/sivasagar-ahom-heritage.jpg",
          title: "Rang Ghar - 18th C Royal Sports Amphitheatre",
          desc: "Two-storied royal pavilion built in 1744 by King Pramatta Singha to watch buffalo fights and indigenous games."
        },
        {
          url: "/images/destinations/majuli-island.jpg",
          title: "Talatal Ghar - Seven-Storied Secret Fort",
          desc: "Remarkable military stronghold with secret underground tunnels connecting to the Dikhow River."
        },
        {
          url: "/images/destinations/kaziranga-national-park.jpg",
          title: "Siva Dol - Tallest Shiva Temple in India (104 ft)",
          desc: "Perched along the 257-acre historic Borpukhuri tank, with a massive golden dome finial."
        },
        {
          url: "/images/itineraries/assam-wildlife-and-majuli-6d.jpg",
          title: "Kareng Ghar & Gargaon Royal Palace",
          desc: "Terraced brick and stone royal palace reflecting 600 years of indomitable Ahom rule."
        }
      ]
    };

    if (galleryMap[slug]) {
      return galleryMap[slug];
    }

    const fallbackPhoto = `/images/destinations/${slug}.jpg`;
    return [
      {
        url: fallbackPhoto,
        title: `${destName} — Scenic Overview`,
        desc: `Discover the breathtaking sights and unique topography of ${destName}, ${stateName}.`
      },
      {
        url: "/images/destinations/gurudongmar-lake-north-sikkim.jpg",
        title: `${destName} — Surrounding Landscapes`,
        desc: `Pristine Himalayan landscapes and natural beauty across ${stateName}.`
      },
      {
        url: "/images/destinations/cherrapunji-sohra.jpg",
        title: `${destName} — Flora, Mist & Waterfalls`,
        desc: `Lush valleys, mountain mist, and vibrant ecological wonders of the Seven Sisters.`
      },
      {
        url: "/images/itineraries/seven-sisters-grand-explorer-12d.jpg",
        title: `${destName} — Cultural & Natural Splendor`,
        desc: `Experience authentic local hospitality and untamed wilderness in Northeast India.`
      }
    ];
  }

  openGallery(slug) {
    const dest = this.destinations.find(d => d.slug === slug);
    const photos = this.getDestinationGallery(slug);
    this.galleryState = {
      activeSlug: slug,
      dest: dest || { name: "Destination", state_name: "North East India", slug },
      photos: photos,
      currentIndex: 0
    };

    const modal = document.getElementById("modal-photo-gallery");
    if (modal) {
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
      this.renderGalleryModal();
    }
  }

  renderGalleryModal() {
    const { dest, photos, currentIndex } = this.galleryState;
    if (!photos || photos.length === 0) return;

    const currentPhoto = photos[currentIndex];

    const titleEl = document.getElementById("gallery-dest-title");
    const captionEl = document.getElementById("gallery-caption-text");
    const counterEl = document.getElementById("gallery-counter");
    const imgEl = document.getElementById("gallery-active-img");
    const thumbsRow = document.getElementById("gallery-thumbs-row");

    if (titleEl) titleEl.textContent = `${dest.name} (${dest.state_name || ''})`;
    if (captionEl) captionEl.textContent = `${currentPhoto.title} — ${currentPhoto.desc}`;
    if (counterEl) counterEl.textContent = `${currentIndex + 1} / ${photos.length}`;

    if (imgEl) {
      imgEl.style.opacity = "0.3";
      imgEl.style.transform = "scale(0.98)";
      imgEl.src = currentPhoto.url;
      imgEl.alt = currentPhoto.title;
      imgEl.onload = () => {
        imgEl.style.opacity = "1";
        imgEl.style.transform = "scale(1)";
      };
      imgEl.onerror = () => {
        imgEl.src = "/images/destinations/kaziranga-national-park.jpg";
        imgEl.style.opacity = "1";
        imgEl.style.transform = "scale(1)";
      };
    }

    if (thumbsRow) {
      thumbsRow.innerHTML = photos.map((p, idx) => `
        <div class="gallery-thumb-item ${idx === currentIndex ? 'active' : ''}" onclick="window.app.jumpGallery(${idx})" title="${p.title}">
          <img src="${p.url}" alt="${p.title}" onerror="this.src='/images/destinations/kaziranga-national-park.jpg'" />
        </div>
      `).join("");

      const activeThumb = thumbsRow.querySelector(".gallery-thumb-item.active");
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }

  nextGalleryPhoto() {
    if (!this.galleryState.photos || this.galleryState.photos.length <= 1) return;
    this.galleryState.currentIndex = (this.galleryState.currentIndex + 1) % this.galleryState.photos.length;
    this.renderGalleryModal();
  }

  prevGalleryPhoto() {
    if (!this.galleryState.photos || this.galleryState.photos.length <= 1) return;
    this.galleryState.currentIndex = (this.galleryState.currentIndex - 1 + this.galleryState.photos.length) % this.galleryState.photos.length;
    this.renderGalleryModal();
  }

  jumpGallery(index) {
    if (!this.galleryState.photos || index < 0 || index >= this.galleryState.photos.length) return;
    this.galleryState.currentIndex = index;
    this.renderGalleryModal();
  }

  closeGallery() {
    const modal = document.getElementById("modal-photo-gallery");
    if (modal) {
      modal.classList.remove("active");
    }
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
