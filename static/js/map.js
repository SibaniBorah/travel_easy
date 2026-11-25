/**
 * Chalo NorthEast - Interactive SVG Map Component
 * Renders stylized North East India map with 8 states, interactive pins, tooltips & zoom controls
 */

class NorthEastMap {
  constructor(containerId, onStateSelect) {
    this.container = document.getElementById(containerId);
    this.onStateSelect = onStateSelect;
    this.selectedState = null;
    this.scale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.init();
  }

  init() {
    if (!this.container) return;
    this.render();
  }

  render() {
    // Stylized SVG Map coordinates for North East India
    // ViewBox: 0 0 750 550
    this.container.innerHTML = `
      <svg class="map-svg" viewBox="0 0 750 550" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="map-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#047857" flood-opacity="0.25"/>
          </filter>
          <radialGradient id="pin-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.8"/>
            <stop offset="100%" stop-color="#d97706" stop-opacity="0"/>
          </radialGradient>
        </defs>

        <g id="map-zoom-layer" style="transform-origin: 375px 275px; transition: transform 0.22s cubic-bezier(0.2, 0, 0, 1);">
          <!-- Rivers -->
          <path d="M 320 230 Q 380 250 460 210 T 560 170" fill="none" stroke="#0284c7" stroke-width="4" stroke-opacity="0.4" stroke-dasharray="4,4"/>
          <text x="430" y="245" fill="#0284c7" font-size="10" font-weight="600" opacity="0.7">Brahmaputra River</text>

          <!-- SIKKIM (Top-West) -->
          <g id="state-group-SK" class="state-group" data-state="SK">
            <path class="state-path" id="path-SK" d="M 40 180 L 75 140 L 95 155 L 85 200 L 50 205 Z"/>
            <text x="65" y="175" font-size="11" font-weight="bold" fill="#0f172a" text-anchor="middle" pointer-events="none">Sikkim</text>
          </g>

          <!-- ARUNACHAL PRADESH (North & North-East) -->
          <g id="state-group-AR" class="state-group" data-state="AR">
            <path class="state-path" id="path-AR" d="M 220 190 L 250 140 L 330 110 L 440 90 L 570 95 L 680 140 L 690 190 L 630 200 L 560 170 L 460 190 L 370 210 L 290 205 Z"/>
            <text x="470" y="145" font-size="13" font-weight="bold" fill="#0f172a" text-anchor="middle" pointer-events="none">Arunachal Pradesh</text>
          </g>

          <!-- ASSAM (Central Valley) -->
          <g id="state-group-AS" class="state-group" data-state="AS">
            <path class="state-path" id="path-AS" d="M 180 280 L 220 230 L 290 205 L 370 210 L 460 190 L 560 170 L 620 200 L 580 240 L 500 270 L 440 280 L 390 320 L 360 380 L 330 380 L 310 320 L 260 310 L 190 330 Z"/>
            <text x="360" y="260" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle" pointer-events="none">Assam</text>
          </g>

          <!-- MEGHALAYA (South of Assam) -->
          <g id="state-group-ML" class="state-group" data-state="ML">
            <path class="state-path" id="path-ML" d="M 190 330 L 260 310 L 310 320 L 330 350 L 310 385 L 210 380 Z"/>
            <text x="260" y="355" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="middle" pointer-events="none">Meghalaya</text>
          </g>

          <!-- NAGALAND (East) -->
          <g id="state-group-NL" class="state-group" data-state="NL">
            <path class="state-path" id="path-NL" d="M 500 270 L 580 240 L 610 270 L 570 330 L 520 320 Z"/>
            <text x="560" y="285" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="middle" pointer-events="none">Nagaland</text>
          </g>

          <!-- MANIPUR (South of Nagaland) -->
          <g id="state-group-MN" class="state-group" data-state="MN">
            <path class="state-path" id="path-MN" d="M 520 320 L 570 330 L 560 410 L 510 420 L 490 370 Z"/>
            <text x="535" y="375" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="middle" pointer-events="none">Manipur</text>
          </g>

          <!-- MIZORAM (Southern Horn) -->
          <g id="state-group-MZ" class="state-group" data-state="MZ">
            <path class="state-path" id="path-MZ" d="M 440 400 L 490 380 L 510 420 L 480 500 L 440 480 L 430 420 Z"/>
            <text x="465" y="450" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="middle" pointer-events="none">Mizoram</text>
          </g>

          <!-- TRIPURA (South-West) -->
          <g id="state-group-TR" class="state-group" data-state="TR">
            <path class="state-path" id="path-TR" d="M 360 400 L 410 400 L 415 460 L 370 470 L 350 430 Z"/>
            <text x="385" y="435" font-size="11" font-weight="bold" fill="#0f172a" text-anchor="middle" pointer-events="none">Tripura</text>
          </g>

          <!-- Interactive Pins for Famous Destinations -->
          <g id="map-pins">
            <!-- Gangtok & Gurudongmar -->
            <circle cx="68" cy="180" r="5" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" class="state-pin" data-name="Gangtok (SK)"/>
            <circle cx="78" cy="150" r="4" fill="#3b82f6" stroke="#ffffff" stroke-width="1.5" class="state-pin" data-name="Gurudongmar Lake (17,800 ft)"/>
            
            <!-- Tawang & Ziro -->
            <circle cx="260" cy="175" r="5" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" class="state-pin" data-name="Tawang Monastery (AR)"/>
            <circle cx="430" cy="170" r="4" fill="#3b82f6" stroke="#ffffff" stroke-width="1.5" class="state-pin" data-name="Ziro Valley (AR)"/>

            <!-- Guwahati & Kaziranga & Majuli -->
            <circle cx="270" cy="285" r="6" fill="#10b981" stroke="#ffffff" stroke-width="2" class="state-pin" data-name="Guwahati Transit Hub (AS)"/>
            <circle cx="420" cy="245" r="5" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5" class="state-pin" data-name="Kaziranga Rhino Sanctuary (AS)"/>
            <circle cx="510" cy="225" r="4" fill="#8b5cf6" stroke="#ffffff" stroke-width="1.5" class="state-pin" data-name="Majuli River Island (AS)"/>

            <!-- Shillong & Sohra & Dawki -->
            <circle cx="280" cy="335" r="5" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" class="state-pin" data-name="Shillong (ML)"/>
            <circle cx="275" cy="360" r="4" fill="#06b6d4" stroke="#ffffff" stroke-width="1.5" class="state-pin" data-name="Cherrapunji & Root Bridges (ML)"/>
            <circle cx="295" cy="375" r="4" fill="#0284c7" stroke="#ffffff" stroke-width="1.5" class="state-pin" data-name="Dawki Umngot River (ML)"/>

            <!-- Kohima & Dzukou -->
            <circle cx="540" cy="305" r="5" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" class="state-pin" data-name="Kohima (NL)"/>
            <circle cx="525" cy="325" r="4" fill="#10b981" stroke="#ffffff" stroke-width="1.5" class="state-pin" data-name="Dzukou Valley (NL)"/>

            <!-- Imphal & Loktak -->
            <circle cx="535" cy="370" r="5" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" class="state-pin" data-name="Imphal (MN)"/>
            <circle cx="525" cy="390" r="4" fill="#06b6d4" stroke="#ffffff" stroke-width="1.5" class="state-pin" data-name="Loktak Floating Lake (MN)"/>

            <!-- Aizawl & Reiek -->
            <circle cx="465" cy="435" r="5" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" class="state-pin" data-name="Aizawl (MZ)"/>
            <circle cx="450" cy="445" r="4" fill="#10b981" stroke="#ffffff" stroke-width="1.5" class="state-pin" data-name="Reiek Peak (MZ)"/>

            <!-- Agartala & Unakoti -->
            <circle cx="375" cy="435" r="5" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" class="state-pin" data-name="Agartala (TR)"/>
            <circle cx="400" cy="415" r="4" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5" class="state-pin" data-name="Unakoti Rock Carvings (TR)"/>
          </g>
        </g>
      </svg>
    `;

    this.attachEvents();
    this.attachZoomEvents();
  }

  attachEvents() {
    const stateGroups = this.container.querySelectorAll(".state-group");
    stateGroups.forEach(group => {
      const code = group.getAttribute("data-state");
      group.addEventListener("click", () => {
        this.selectState(code);
      });
    });

    const pins = this.container.querySelectorAll(".state-pin");
    pins.forEach(pin => {
      pin.addEventListener("mouseenter", (e) => {
        const name = e.target.getAttribute("data-name");
        this.showTooltip(e, name);
      });
      pin.addEventListener("mouseleave", () => {
        this.hideTooltip();
      });
    });
  }

  attachZoomEvents() {
    const btnIn = document.getElementById("btn-map-zoom-in") || this.container.querySelector("#btn-map-zoom-in");
    const btnOut = document.getElementById("btn-map-zoom-out") || this.container.querySelector("#btn-map-zoom-out");
    const btnReset = document.getElementById("btn-map-zoom-reset") || this.container.querySelector("#btn-map-zoom-reset");
    const svg = this.container.querySelector(".map-svg");

    if (btnIn) btnIn.addEventListener("click", (e) => { e.stopPropagation(); this.zoomIn(); });
    if (btnOut) btnOut.addEventListener("click", (e) => { e.stopPropagation(); this.zoomOut(); });
    if (btnReset) btnReset.addEventListener("click", (e) => { e.stopPropagation(); this.resetZoom(); });

    if (svg) {
      // Mouse wheel zoom
      svg.addEventListener("wheel", (e) => {
        e.preventDefault();
        if (e.deltaY < 0) {
          this.zoomIn();
        } else {
          this.zoomOut();
        }
      }, { passive: false });

      // Drag to pan when zoomed in
      svg.addEventListener("mousedown", (e) => {
        if (this.scale <= 1.0) return;
        this.isDragging = true;
        this.startX = e.clientX - this.panX;
        this.startY = e.clientY - this.panY;
        svg.style.cursor = "grabbing";
      });

      window.addEventListener("mousemove", (e) => {
        if (!this.isDragging) return;
        this.panX = e.clientX - this.startX;
        this.panY = e.clientY - this.startY;
        // Limit pan boundary
        const maxPan = 220 * (this.scale - 1);
        this.panX = Math.max(-maxPan, Math.min(maxPan, this.panX));
        this.panY = Math.max(-maxPan, Math.min(maxPan, this.panY));
        this.applyTransform(true);
      });

      window.addEventListener("mouseup", () => {
        if (this.isDragging) {
          this.isDragging = false;
          svg.style.cursor = this.scale > 1.0 ? "grab" : "default";
          this.applyTransform(false);
        }
      });
    }
  }

  zoomIn() {
    this.scale = Math.min(+(this.scale + 0.35).toFixed(2), 3.0);
    this.applyTransform();
  }

  zoomOut() {
    this.scale = Math.max(+(this.scale - 0.35).toFixed(2), 0.75);
    if (this.scale <= 1.0) {
      this.panX = 0;
      this.panY = 0;
    }
    this.applyTransform();
  }

  resetZoom() {
    this.scale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
  }

  applyTransform(immediate = false) {
    const layer = this.container.querySelector("#map-zoom-layer");
    const svg = this.container.querySelector(".map-svg");
    if (layer) {
      layer.style.transition = immediate ? "none" : "transform 0.22s cubic-bezier(0.2, 0, 0, 1)";
      layer.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    }
    if (svg && !this.isDragging) {
      svg.style.cursor = this.scale > 1.0 ? "grab" : "default";
    }
  }

  selectState(code) {
    this.selectedState = code;
    // Update path styling
    const allPaths = this.container.querySelectorAll(".state-path");
    allPaths.forEach(p => p.classList.remove("selected"));

    const targetPath = this.container.querySelector(`#path-${code}`);
    if (targetPath) {
      targetPath.classList.add("selected");
    }

    if (this.onStateSelect) {
      this.onStateSelect(code);
    }
  }

  showTooltip(e, text) {
    let tooltip = document.getElementById("map-hover-tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "map-hover-tooltip";
      tooltip.style.position = "absolute";
      tooltip.style.backgroundColor = "rgba(15, 23, 42, 0.9)";
      tooltip.style.color = "#ffffff";
      tooltip.style.padding = "4px 8px";
      tooltip.style.borderRadius = "4px";
      tooltip.style.fontSize = "12px";
      tooltip.style.fontWeight = "600";
      tooltip.style.pointerEvents = "none";
      tooltip.style.zIndex = "1000";
      tooltip.style.boxShadow = "0 4px 6px rgba(0,0,0,0.15)";
      document.body.appendChild(tooltip);
    }

    tooltip.innerText = text;
    tooltip.style.display = "block";
    tooltip.style.left = `${e.pageX + 10}px`;
    tooltip.style.top = `${e.pageY - 25}px`;
  }

  hideTooltip() {
    const tooltip = document.getElementById("map-hover-tooltip");
    if (tooltip) {
      tooltip.style.display = "none";
    }
  }
}
