# 🌲 Chalo NorthEast (চল উত্তৰ-পূব)
### The Tourism Discovery & Trip Planning Platform for North East India

> **Pilot Phase · Web PWA · Pure Go Backend (Zero External Dependencies) · Responsive Vanilla JS Frontend**  
> Covering the **Eight Sisters** — Assam, Meghalaya, Arunachal Pradesh, Nagaland, Manipur, Mizoram, Tripura, and Sikkim.

---

## 🧭 Mission & Core Problem

North East India is one of the most culturally vibrant, ecologically diverse, and scenic regions on Earth. However, independent travellers face four acute friction points:
1. **Discovery gap**: Fragmented, outdated, or blog-sponsored info that skips indigenous villages, sacred groves, and authentic community homestays.
2. **Transit opacity**: Commercial travel agencies charge ₹5,000–8,000/day for private SUVs because public transit routes (shared Tata Sumos, ASTC buses, Ro-Pax ferries) lack published pickup stands and schedules.
3. **Regulatory maze**: Inner Line Permits (ILP) for Arunachal, Nagaland, Manipur, and Mizoram; Protected Area Permits (PAP) for North Sikkim; and changing lead times create anxiety.
4. **Data decay**: Landslides, monsoons, and administrative updates make static travel guides go stale fast.

**Chalo NorthEast** solves this with an auditable, trust-first platform featuring a deterministic planner pipeline, real-time permit checklist, budget calculator with a **Local Value Score**, and an offline PWA trip pack.

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Chalo NorthEast Platform                       │
├─────────────────────────────────────┬───────────────────────────────────┤
│          Web PWA (Static)           │      Go Backend (stdlib only)     │
│                                     │                                   │
│  • static/index.html (15 sections)  │  • cmd/server/main.go             │
│  • static/admin.html (Stale Queue)  │  • internal/api/ (router/handlers)│
│  • static/manifest.json (PWA)       │  • internal/db/ (JSON store)      │
│  • static/sw.js (Service Worker)    │  • internal/domain/               │
│  • static/js/app.js (Controller)    │    ├── planner/  (pipeline/graph) │
│  • static/js/planner.js (Engine)    │    ├── budget/   (Local Value %)  │
│  • static/js/map.js (SVG Map)       │    ├── permits/  (Rule matcher)   │
│  • static/js/data.js (Constants)    │    └── freshness/(TTL monitor)    │
│  • static/css/style.css (Design Sys)│  • internal/content/ (Seed data)  │
└─────────────────────────────────────┴───────────────────────────────────┘
                                       │
                              ┌────────▼────────┐
                              │  JSON Data Store│
                              │  ./data/*.json  │
                              │  (Atomic I/O)   │
                              └─────────────────┘
```

> **Architecture Principle**: The `/internal/domain/*` layer is pure Go. It has **zero dependencies** on HTTP, DB, or external frameworks. All business logic takes plain structs in and returns plain structs out, ensuring 100% testability.

---

## ⚡ Quick Start

You can launch the platform using either the high-performance compiled **Go server** or the zero-install **Python 3.14 server**; both provide 100% feature and API parity.

### Option A: Run with Go (Single Binary)
```bash
# Compiles into a standalone binary with zero external dependencies
go build -o chaloner-server ./cmd/server
./chaloner-server -port 8000
```

### Option B: Run with Python 3 (Standard Library)
```bash
python3 server.py 8000
```
Open [http://localhost:8000](http://localhost:8000) in your web browser.

### Test Suites & CI Verification Gates
```bash
# Run all domain unit and property tests (planner, budget, permits, freshness)
go test -v ./internal/domain/...

# Run the CI Content Verification Gate
go run scripts/check_content.go
```

---

## 🗺️ Anchor Circuits (Priority Content)

The pilot focuses on depth across two initial anchor circuits, backed by 6 regional loops:

| Circuit | Gateway | Duration | Best Months | Permits | Estimated Cost |
|---------|---------|----------|-------------|---------|----------------|
| **Assam-Meghalaya Classic** | Guwahati | 5 Days | Oct–May | None | ₹6,500 – ₹11,500 |
| **Wild Assam (Kaziranga & Majuli)** | Guwahati | 6 Days | Nov–Apr | None | ₹7,500 – ₹13,000 |
| **Arunachal High Altitude Trail** | Tezpur | 7 Days | Oct–May | AR-ILP / PAP | ₹12,000 – ₹18,000 |
| **Nagaland Tribal & Dzukou Valley** | Dimapur | 5 Days | Oct–May | NL-ILP | ₹7,000 – ₹12,000 |
| **Sikkim Himalayan Magic** | Siliguri / NJP | 7 Days | Oct–May | SK-PAP (North) | ₹13,000 – ₹21,000 |
| **Manipur Floating Paradise** | Imphal | 4 Days | Oct–Apr | MN-ILP | ₹5,500 – ₹9,500 |
| **Mizoram Highlander Ridge** | Aizawl | 5 Days | Oct–Mar | MZ-ILP | ₹6,000 – ₹10,500 |
| **Tripura Royal & Rock Carvings** | Agartala | 4 Days | Oct–Mar | None | ₹4,500 – ₹8,000 |

Detailed circuit YAML specifications are in [`content/circuits.yaml`](file:///home/sibaniborah/gu/content/circuits.yaml).

---

## 🛡️ Trust-First Schema & Freshness TTL

Every published record carries trust metadata:

```go
type Destination struct {
    // ... core fields ...
    SourceID    string    `json:"source_id"`
    VerifiedAt  time.Time `json:"verified_at"`
    ExpiresAt   time.Time `json:"expires_at"`
    Confidence  float64   `json:"confidence"` // 0.0 - 1.0
    Status      string    `json:"status"`     // draft / published / stale
}
```

### Freshness TTL Schedule
- **Permit rules & fees**: 30 days
- **Shared transit fares & stand locations**: 30 days
- **Monsoon road closure status**: 14 days
- **Destination overviews**: 90 days
- **Events & seasonal festivals**: 7 days

When a record passes `ExpiresAt`, the UI automatically displays an **aging warning badge** and queues the record in the Admin Stale Queue (`/admin.html`).

---

## ⚙️ Planner Pipeline

The deterministic planning engine runs in 5 stages:

```
PlanRequest
  │
  ├─ 1. Candidate Filtering: Exclude off-season months (BestMonths[]) and non-matching categories
  ├─ 2. Circuit Building: Graph search over route_legs starting from gateway
  ├─ 3. Hard Rejection Checks:
  │      • Leg blocked in travel month (BlockedMonths[])
  │      • Permit lead time > days before departure
  │      • Disconnected return to gateway
  ├─ 4. Soft Violation Checks:
  │      • Travel hours > 85% of daily pace limit
  │      • Budget close to lower bound
  │      • Permit requirements (ILP/PAP)
  └─ 5. Scoring & Explainable Status:
         • Feasible: Clean plan with optimal buffer
         • Tight: Minor buffer or schedule strain
         • Not Recommended: Hard rejection with clear RuleID & swap suggestion
```

---

## 📡 REST API Reference

All responses return data wrapped in an auditable metadata envelope:

```json
{
  "data": { ... },
  "meta": {
    "total": 14,
    "verified_at": "2026-10-15",
    "confidence": 0.95,
    "freshness": "fresh",
    "cached_at": "2026-11-21T04:54:10Z"
  }
}
```

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/states` | List 8 states with ILP summary |
| `GET` | `/api/v1/states/:code` | State details, attractions, routes |
| `GET` | `/api/v1/destinations` | Filter by `state`, `category`, `tier`, `q` |
| `GET` | `/api/v1/destinations/:slug` | Full destination card, homestays, tips |
| `GET` | `/api/v1/route-legs` | Transit matrix, shared Sumo stands, fares |
| `GET` | `/api/v1/permits` | Permit rules, document checklists |
| `GET` | `/api/v1/events` | Festival calendar by month and state |
| `GET` | `/api/v1/stats` | Platform statistics |
| `POST` | `/api/v1/plan` | Run planner engine with `PlanRequest` |
| `POST` | `/api/v1/budget` | Calculate budget & Local Value Score |
| `POST` | `/api/v1/trips` | Save custom planned itinerary |
| `GET` | `/api/v1/trips/:code` | Retrieve saved itinerary via share code |
| `POST` | `/api/v1/reports` | Community report of outdated info |
| `GET` | `/api/v1/admin/stale` | Admin Stale Queue (requires `X-Admin-Token`) |

---

## 📱 PWA & Offline Support

- **Service Worker (`sw.js`)**: Implements Cache-First for static assets and Network-First for API calls.
- **Offline Trip Pack**: Travellers can click **"Download Offline Pack"** before heading into zero-reception valleys (e.g. Dzukou, Nongriat, Mechuka) to save complete route cards, emergency numbers, and survival phrases locally in IndexedDB / Cache storage.
- **Low Bandwidth Mode**: Optimized for 2G/3G connections with SVG vector maps and lightweight typography.

---

## 📅 8-Week Pilot Delivery Milestones

- [x] **Week 1: Foundation & Data Architecture** — Go domain types, JSON store, seed scripts, 15 planner fixture tests.
- [x] **Weeks 2–3: Discovery & Core Catalog** — Interactive SVG Map, destination cards, filter engine, Admin Stale Queue.
- [x] **Weeks 4–5: Planning Core & Budget Engine** — 5-stage planner, Permit Passport, Local Value Score, trip saving & sharing.
- [x] **Week 6: Go Mode & PWA** — Service worker, offline trip packs, festival calendar, emergency contacts.
- [ ] **Week 7: Hardening & Community QA** — Pilot testing with local operators in Guwahati and Shillong.
- [ ] **Week 8: Soft Launch** — Onboarding first 50 independent backpackers and 10 homestay hosts.

---

## 🤝 Responsible Travel Pledge

> *Every fact displayed on Chalo NorthEast carries a source, a verification date, and a community report button. We promote community-owned homestays and zero-single-use-plastic travel in sensitive ecological zones like Dzukou Valley and Sacred Groves.*
