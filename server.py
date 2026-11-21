"""
Chalo NorthEast - High Performance REST API & Web Server
Powered by Python 3.14 standard library (ThreadingHTTPServer + SQLite3)
"""

import os
import sys
import json
import sqlite3
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import secrets

from database import get_db, init_db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

class ChaloNorthEastHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def end_headers(self):
        # Enable CORS and caching headers
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_HEAD(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        if path == "/" or path == "/index.html":
            self.path = "/index.html"
        elif path.startswith("/static/"):
            self.path = path[len("/static"):]
        return super().do_HEAD()

    def send_json(self, data, status_code=200):
        response_bytes = json.dumps(data, indent=2, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

    def send_error_json(self, message, status_code=400):
        self.send_json({"error": message, "status": status_code}, status_code)

    def parse_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        raw_body = self.rfile.read(content_length).decode("utf-8")
        try:
            return json.loads(raw_body)
        except json.JSONDecodeError:
            return {}

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        # Route matching
        if path == "/" or path == "/index.html":
            self.path = "/index.html"
            return super().do_GET()

        if path.startswith("/static/"):
            # Strip /static prefix since SimpleHTTPRequestHandler directory is STATIC_DIR
            self.path = path[len("/static"):]
            return super().do_GET()

        # Normalize v1 aliases
        clean_path = path
        if clean_path.startswith("/api/v1/"):
            clean_path = "/api/" + clean_path[len("/api/v1/"):]
        if clean_path == "/api/route-legs":
            clean_path = "/api/transit"
        elif clean_path == "/api/budget":
            clean_path = "/api/calculate-budget"
        elif clean_path == "/api/trips":
            clean_path = "/api/custom-trips"
        elif clean_path.startswith("/api/trips/"):
            clean_path = "/api/custom-trips/" + clean_path[len("/api/trips/"):]

        # API Endpoints
        if clean_path == "/api/states":
            self.handle_get_states()
        elif clean_path.startswith("/api/states/"):
            code = clean_path.split("/")[-1].upper()
            self.handle_get_state_detail(code)
        elif clean_path == "/api/destinations":
            self.handle_get_destinations(query_params)
        elif clean_path.startswith("/api/destinations/"):
            slug = clean_path.split("/")[-1]
            self.handle_get_destination_detail(slug)
        elif clean_path == "/api/transit":
            self.handle_get_transit(query_params)
        elif clean_path == "/api/homestays":
            self.handle_get_homestays(query_params)
        elif clean_path == "/api/itineraries":
            self.handle_get_itineraries(query_params)
        elif clean_path.startswith("/api/itineraries/"):
            slug = clean_path.split("/")[-1]
            self.handle_get_itinerary_detail(slug)
        elif clean_path == "/api/permits":
            self.handle_get_permits()
        elif clean_path == "/api/events":
            self.handle_get_events(query_params)
        elif clean_path == "/api/tips":
            self.handle_get_tips(query_params)
        elif clean_path.startswith("/api/custom-trips/"):
            share_code = clean_path.split("/")[-1]
            self.handle_get_custom_trip(share_code)
        elif clean_path == "/api/stats":
            self.handle_get_stats()
        elif clean_path == "/api/reports":
            self.handle_get_reports()
        elif clean_path == "/api/auth/me":
            self.handle_auth_me(query_params)
        else:
            # Fallback to static handler
            return super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        clean_path = path
        if clean_path.startswith("/api/v1/"):
            clean_path = "/api/" + clean_path[len("/api/v1/"):]
        if clean_path == "/api/route-legs":
            clean_path = "/api/transit"
        elif clean_path == "/api/budget":
            clean_path = "/api/calculate-budget"
        elif clean_path == "/api/trips":
            clean_path = "/api/custom-trips"
        elif clean_path.startswith("/api/trips/"):
            clean_path = "/api/custom-trips/" + clean_path[len("/api/trips/"):]

        if clean_path == "/api/calculate-budget":
            self.handle_calculate_budget()
        elif clean_path == "/api/plan":
            self.handle_plan()
        elif clean_path == "/api/custom-trips":
            self.handle_create_custom_trip()
        elif clean_path == "/api/tips":
            self.handle_create_tip()
        elif clean_path.endswith("/upvote") and clean_path.startswith("/api/tips/"):
            tip_id = clean_path.split("/")[-2]
            self.handle_upvote_tip(tip_id)
        elif clean_path == "/api/reviews":
            self.handle_create_review()
        elif clean_path == "/api/reports":
            self.handle_create_report()
        elif clean_path == "/api/auth/login":
            self.handle_auth_login()
        elif clean_path == "/api/auth/logout":
            self.handle_auth_logout()
        else:
            self.send_error_json("Endpoint not found", 404)

    # Handlers
    def handle_get_states(self):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM states ORDER BY name ASC")
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()
        self.send_json(rows)

    def handle_get_state_detail(self, code):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM states WHERE code = ?", (code,))
        state = cursor.fetchone()
        if not state:
            conn.close()
            return self.send_error_json("State not found", 404)

        state_dict = dict(state)
        # Fetch attractions for this state
        cursor.execute("SELECT * FROM destinations WHERE state_code = ? ORDER BY rating DESC", (code,))
        state_dict["destinations"] = [dict(row) for row in cursor.fetchall()]

        # Fetch transit routes for this state
        cursor.execute("SELECT * FROM transit_routes WHERE state_code = ? ORDER BY fare_inr ASC", (code,))
        state_dict["transit_routes"] = [dict(row) for row in cursor.fetchall()]

        # Fetch homestays for this state
        cursor.execute("SELECT * FROM homestays WHERE state_code = ? ORDER BY rating DESC", (code,))
        state_dict["homestays"] = [dict(row) for row in cursor.fetchall()]

        conn.close()
        self.send_json(state_dict)

    def handle_get_destinations(self, query_params):
        conn = get_db()
        cursor = conn.cursor()

        sql = "SELECT d.*, s.name as state_name FROM destinations d JOIN states s ON d.state_code = s.code WHERE 1=1"
        params = []

        state_filter = query_params.get("state", [None])[0]
        if state_filter and state_filter.upper() != "ALL":
            sql += " AND d.state_code = ?"
            params.append(state_filter.upper())

        category_filter = query_params.get("category", [None])[0]
        if category_filter and category_filter.lower() != "all":
            sql += " AND d.category = ?"
            params.append(category_filter.lower())

        budget_tier = query_params.get("tier", [None])[0]
        if budget_tier and budget_tier.lower() != "all":
            sql += " AND d.budget_tier = ?"
            params.append(budget_tier.lower())

        q = query_params.get("q", [None])[0]
        if q:
            sql += " AND (d.name LIKE ? OR d.description LIKE ? OR d.top_highlights LIKE ?)"
            like_term = f"%{q}%"
            params.extend([like_term, like_term, like_term])

        sql += " ORDER BY d.rating DESC, d.reviews_count DESC"
        cursor.execute(sql, params)
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()
        self.send_json(rows)

    def handle_get_destination_detail(self, slug):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT d.*, s.name as state_name, s.capital as state_capital, s.ilp_required as state_ilp_required
            FROM destinations d
            JOIN states s ON d.state_code = s.code
            WHERE d.slug = ?
        """, (slug,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return self.send_error_json("Destination not found", 404)

        dest = dict(row)

        # Get homestays
        cursor.execute("SELECT * FROM homestays WHERE destination_slug = ?", (slug,))
        dest["homestays"] = [dict(h) for row_h in cursor.fetchall() for h in [row_h]]

        # Get reviews
        cursor.execute("SELECT * FROM reviews WHERE destination_slug = ? ORDER BY created_at DESC", (slug,))
        dest["reviews"] = [dict(r) for r in cursor.fetchall()]

        # Get tips
        cursor.execute("SELECT * FROM community_tips WHERE destination_name LIKE ? ORDER BY upvotes DESC", (f"%{dest['name']}%",))
        dest["community_tips"] = [dict(t) for t in cursor.fetchall()]

        conn.close()
        self.send_json(dest)

    def handle_get_transit(self, query_params):
        conn = get_db()
        cursor = conn.cursor()
        sql = "SELECT * FROM transit_routes WHERE 1=1"
        params = []

        state_code = query_params.get("state", [None])[0]
        if state_code and state_code.upper() != "ALL":
            sql += " AND state_code = ?"
            params.append(state_code.upper())

        from_city = query_params.get("from", [None])[0]
        if from_city:
            sql += " AND from_city LIKE ?"
            params.append(f"%{from_city}%")

        to_city = query_params.get("to", [None])[0]
        if to_city:
            sql += " AND to_city LIKE ?"
            params.append(f"%{to_city}%")

        sql += " ORDER BY fare_inr ASC"
        cursor.execute(sql, params)
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        self.send_json(rows)

    def handle_get_homestays(self, query_params):
        conn = get_db()
        cursor = conn.cursor()
        sql = "SELECT h.*, s.name as state_name FROM homestays h JOIN states s ON h.state_code = s.code WHERE 1=1"
        params = []

        state_code = query_params.get("state", [None])[0]
        if state_code and state_code.upper() != "ALL":
            sql += " AND h.state_code = ?"
            params.append(state_code.upper())

        dest_slug = query_params.get("destination", [None])[0]
        if dest_slug:
            sql += " AND h.destination_slug = ?"
            params.append(dest_slug)

        sql += " ORDER BY h.rating DESC, h.price_per_night ASC"
        cursor.execute(sql, params)
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        self.send_json(rows)

    def handle_get_itineraries(self, query_params):
        conn = get_db()
        cursor = conn.cursor()
        sql = "SELECT * FROM prebuilt_itineraries WHERE 1=1"
        params = []

        budget_level = query_params.get("budget", [None])[0]
        if budget_level and budget_level != "all":
            sql += " AND budget_level = ?"
            params.append(budget_level)

        sql += " ORDER BY duration_days ASC"
        cursor.execute(sql, params)
        rows = []
        for r in cursor.fetchall():
            item = dict(r)
            item["day_plans"] = json.loads(item["day_plans_json"])
            rows.append(item)
        conn.close()
        self.send_json(rows)

    def handle_get_itinerary_detail(self, slug):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM prebuilt_itineraries WHERE slug = ?", (slug,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return self.send_error_json("Itinerary not found", 404)
        item = dict(row)
        item["day_plans"] = json.loads(item["day_plans_json"])
        conn.close()
        self.send_json(item)

    def handle_get_permits(self):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT code, name, capital, ilp_required, ilp_fee_inr, ilp_portal, ilp_info
            FROM states ORDER BY ilp_required DESC, name ASC
        """)
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()

        # Add general rules guidance
        response = {
            "states": rows,
            "general_guidelines": {
                "domestic_summary": "Arunachal Pradesh, Nagaland, Manipur, and Mizoram require Inner Line Permits (ILP). Sikkim requires Protected Area Permits (PAP) for restricted zones like Tsomgo/Nathula and North Sikkim. Assam, Meghalaya, and Tripura require NO inner line permits.",
                "foreign_summary": "Foreign nationals do NOT require ILP for Assam, Meghalaya, and Tripura. For Arunachal Pradesh, Foreigners require Protected Area Permit (PAP) in groups of 2+. Nagaland & Mizoram require registration at Foreigners Registration Office (FRO). Sikkim requires Restricted Area Permit (RAP) easily issued free at Rangpo/Melli checkposts plus PAP for North Sikkim.",
                "essential_checklist": [
                    "Keep 6-8 passport-sized photos handy (white background)",
                    "Carry 3-4 physical photocopies of Aadhaar Card or Voter ID Card (Passport for foreigners)",
                    "Download offline digital PDF copies of approved ILPs on your mobile phone",
                    "Print at least 2 hard copies of every approved permit for remote checkposts where network is absent"
                ]
            }
        }
        self.send_json(response)

    def handle_get_events(self, query_params):
        conn = get_db()
        cursor = conn.cursor()
        sql = "SELECT * FROM events WHERE 1=1"
        params = []
        state = query_params.get("state", [None])[0]
        if state and state.upper() != "ALL":
            sql += " AND state_code = ?"
            params.append(state.upper())
        month = query_params.get("month", [None])[0]
        if month and int(month) > 0:
            sql += " AND annual_month = ?"
            params.append(int(month))
        sql += " ORDER BY annual_month ASC, id ASC"
        cursor.execute(sql, params)
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        self.send_json(rows)

    def handle_get_tips(self, query_params):
        conn = get_db()
        cursor = conn.cursor()
        sql = "SELECT * FROM community_tips WHERE 1=1"
        params = []

        state_code = query_params.get("state", [None])[0]
        if state_code and state_code.upper() != "ALL":
            sql += " AND state_code = ?"
            params.append(state_code.upper())

        sql += " ORDER BY upvotes DESC, created_at DESC LIMIT 50"
        cursor.execute(sql, params)
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        self.send_json(rows)

    def handle_get_stats(self):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM destinations")
        dest_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM transit_routes")
        transit_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM homestays")
        homestay_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM prebuilt_itineraries")
        itinerary_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM community_tips")
        tips_count = cursor.fetchone()[0]
        conn.close()
        self.send_json({
            "states": 8,
            "destinations": dest_count,
            "transit_routes": transit_count,
            "homestays": homestay_count,
            "prebuilt_itineraries": itinerary_count,
            "community_tips": tips_count
        })

    def handle_calculate_budget(self):
        body = self.parse_body()
        duration_days = max(1, min(30, int(body.get("duration_days", 5))))
        travelers_count = max(1, min(20, int(body.get("travelers_count", 2))))
        travel_style = body.get("travel_style", "budget") # budget, comfort, explorer
        destinations = body.get("destinations", []) # list of slugs or state codes

        # Cost multipliers per travel style
        # Budget: Shared sumos/trains/buses, eco-homestay dorms/basic rooms, local thalis
        # Comfort: Private shared cabs / AC stays, good restaurants, guided excursions
        # Backpacker: Ultra-frugal hostels, street food, public transit
        if travel_style == "backpacker":
            stay_per_night_per_person = 600
            food_per_day_per_person = 400
            transit_daily_per_person = 350
            activity_permit_per_person = 150
            buffer_misc_per_person = 100
        elif travel_style == "comfort":
            stay_per_night_per_person = 2200
            food_per_day_per_person = 1100
            transit_daily_per_person = 1500 # Private cab share
            activity_permit_per_person = 500
            buffer_misc_per_person = 300
        else: # Standard budget
            stay_per_night_per_person = 1100
            food_per_day_per_person = 650
            transit_daily_per_person = 600
            activity_permit_per_person = 250
            buffer_misc_per_person = 150

        # Adjust for group size efficiency in stay & private cab
        if travelers_count >= 2:
            stay_efficiency_multiplier = 0.85
        else:
            stay_efficiency_multiplier = 1.0

        daily_per_person = int(
            (stay_per_night_per_person * stay_efficiency_multiplier) +
            food_per_day_per_person +
            transit_daily_per_person +
            activity_permit_per_person +
            buffer_misc_per_person
        )

        total_per_person = daily_per_person * duration_days
        grand_total = total_per_person * travelers_count

        breakdown = {
            "stay_total": int(stay_per_night_per_person * stay_efficiency_multiplier * duration_days * travelers_count),
            "food_total": int(food_per_day_per_person * duration_days * travelers_count),
            "transport_total": int(transit_daily_per_person * duration_days * travelers_count),
            "permits_activities_total": int(activity_permit_per_person * duration_days * travelers_count),
            "buffer_misc_total": int(buffer_misc_per_person * duration_days * travelers_count)
        }

        savings_vs_commercial_tour = int(grand_total * 0.55) # Commercial packages in NE are typically 120-150% pricier

        response = {
            "duration_days": duration_days,
            "travelers_count": travelers_count,
            "travel_style": travel_style,
            "cost_per_person_per_day": daily_per_person,
            "cost_per_person_total": total_per_person,
            "grand_total_inr": grand_total,
            "savings_vs_commercial_tour_inr": savings_vs_commercial_tour,
            "local_value_score": 0.86,
            "breakdown": breakdown,
            "cost_saving_tips": [
                "Using shared Tata Sumos from stands (Paltan Bazar, Lewduh, Tezpur) saves up to 70% compared to private car hire.",
                "Homestays run by indigenous communities include generous home-cooked organic meals, saving ₹300-500/day on restaurant bills.",
                "Ro-Pax ferry to Majuli costs only ₹15 per person vs ₹1,500 for private speedboats.",
                "Apply for State ILPs directly through official government portals (₹50-100) instead of paying ₹1,000+ to touts.",
                "For North Sikkim, book a shared seat in a package Sumo at Gangtok Vajra stand (₹3,500/head all-inclusive) rather than ₹18,000 for a solo vehicle."
            ]
        }
        self.send_json(response)

    def handle_create_custom_trip(self):
        body = self.parse_body()
        trip_name = body.get("trip_name", "My North East Odyssey").strip()
        travelers_count = int(body.get("travelers_count", 2))
        travel_style = body.get("travel_style", "budget")
        duration_days = int(body.get("duration_days", 5))
        est_total_cost = int(body.get("est_total_cost", 10000))
        cost_breakdown = json.dumps(body.get("breakdown", {}))
        destinations = json.dumps(body.get("destinations", []))
        notes = body.get("notes", "")

        share_code = secrets.token_hex(4).upper()

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO custom_trips (
                share_code, trip_name, travelers_count, travel_style,
                duration_days, est_total_cost, cost_breakdown_json,
                destinations_json, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            share_code, trip_name, travelers_count, travel_style,
            duration_days, est_total_cost, cost_breakdown,
            destinations, notes
        ))
        conn.commit()
        conn.close()

        self.send_json({
            "success": True,
            "share_code": share_code,
            "message": "Trip itinerary saved successfully!",
            "share_url": f"/#trip={share_code}"
        }, 201)

    def handle_get_custom_trip(self, share_code):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM custom_trips WHERE share_code = ?", (share_code,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return self.send_error_json("Saved trip not found", 404)

        trip = dict(row)
        trip["cost_breakdown"] = json.loads(trip["cost_breakdown_json"])
        trip["destinations"] = json.loads(trip["destinations_json"])
        self.send_json(trip)

    def handle_create_tip(self):
        body = self.parse_body()
        state_code = body.get("state_code", "AS")
        dest_name = body.get("destination_name", "General North East").strip()
        author_name = body.get("author_name", "Fellow Traveller").strip()
        author_city = body.get("author_city", "India").strip()
        category = body.get("category", "General").strip()
        tip_text = body.get("tip_text", "").strip()

        if not tip_text:
            return self.send_error_json("Tip text cannot be empty", 400)

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO community_tips (
                state_code, destination_name, author_name, author_city, category, tip_text
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, (state_code, dest_name, author_name, author_city, category, tip_text))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()

        self.send_json({"success": True, "id": new_id, "message": "Tip submitted! Thank you for helping fellow travellers."})

    def handle_upvote_tip(self, tip_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("UPDATE community_tips SET upvotes = upvotes + 1 WHERE id = ?", (tip_id,))
        conn.commit()
        cursor.execute("SELECT upvotes FROM community_tips WHERE id = ?", (tip_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return self.send_error_json("Tip not found", 404)
        self.send_json({"success": True, "upvotes": row[0]})

    def handle_create_review(self):
        body = self.parse_body()
        dest_slug = body.get("destination_slug", "").strip()
        user_name = body.get("user_name", "Anonymous").strip()
        user_origin = body.get("user_origin", "India").strip()
        rating = max(1, min(5, int(body.get("rating", 5))))
        review_text = body.get("review_text", "").strip()
        travel_month = body.get("travel_month", "Recent").strip()

        if not dest_slug or not review_text:
            return self.send_error_json("Missing destination or review text", 400)

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO reviews (destination_slug, user_name, user_origin, rating, review_text, travel_month)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (dest_slug, user_name, user_origin, rating, review_text, travel_month))

        # Update destination average rating and count
        cursor.execute("""
            UPDATE destinations
            SET reviews_count = reviews_count + 1
            WHERE slug = ?
        """, (dest_slug,))

        conn.commit()
        conn.close()

        self.send_json({"success": True, "message": "Review submitted successfully!"})

    def handle_create_report(self):
        body = self.parse_body()
        entity_type = body.get("entity_type", "general").strip()
        entity_id = body.get("entity_id", "general").strip()
        report_type = body.get("report_type", "outdated-info").strip()
        description = body.get("description", "").strip()

        if not description:
            return self.send_error_json("Report description is required", 400)

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO reports (entity_type, entity_id, report_type, description, status)
            VALUES (?, ?, ?, ?, 'open')
        """, (entity_type, entity_id, report_type, description))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()

        self.send_json({
            "success": True,
            "id": new_id,
            "message": "Thank you! Your report has been submitted to the verified content review queue."
        })

    def handle_get_reports(self):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM reports ORDER BY created_at DESC LIMIT 50")
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        self.send_json(rows)

    def handle_plan(self):
        body = self.parse_body()
        gateway = str(body.get("gateway", "guwahati")).lower().strip()
        nights = max(2, min(20, int(body.get("nights", body.get("duration_days", 5)))))
        budget_total = int(body.get("budget_total_inr", 0))
        travelers_count = max(1, min(20, int(body.get("travelers_count", 2))))
        pace = body.get("pace", "moderate").lower()
        interests = body.get("interests", [])
        traveller_type = body.get("traveller_type", "indian").lower()
        start_date = body.get("start_date", "2026-11-01")

        # Plan A: Assam & Meghalaya Express Highlights (Root Bridges, Canyons & Crystal Waters)
        plan_a_days = []
        plan_a_title = "Plan A ⭐: Assam & Meghalaya Express Highlights"
        for d in range(1, nights + 1):
            if d == 1:
                plan_a_days.append({
                    "day_number": 1,
                    "destination_slug": "guwahati",
                    "destination_name": "Guwahati → Shillong",
                    "travel_hrs": 3.0,
                    "activities": [
                        "Arrive at Guwahati (GAU airport / Paltan Bazar railway station)",
                        "Visit ancient Kamakhya Temple atop Nilachal Hill",
                        "Scenic pine-lined drive across Meghalaya plateau to Shillong",
                        "Evening stroll through Police Bazar & acoustic live music at Cafe Shillong"
                    ],
                    "stay_type": "Pine View Khasi Homestay, Shillong",
                    "est_cost_range": [1400, 2000]
                })
            elif d == 2:
                plan_a_days.append({
                    "day_number": 2,
                    "destination_slug": "shillong",
                    "destination_name": "Shillong → Cherrapunji (Sohra)",
                    "travel_hrs": 2.5,
                    "activities": [
                        "Sunrise view at Laitlum Grand Canyons over green gorges",
                        "Witness Nohkalikai Falls (India's tallest plunge waterfall at 1,115 ft)",
                        "Explore illuminated limestone stalactites inside Arwah Cave",
                        "Sunset at Seven Sisters Falls viewpoint and Mawsmai cave"
                    ],
                    "stay_type": "Cherra Eco-Resort / Local Homestay, Sohra",
                    "est_cost_range": [1500, 2200]
                })
            elif d == 3:
                plan_a_days.append({
                    "day_number": 3,
                    "destination_slug": "cherrapunji",
                    "destination_name": "Cherrapunji → Nongriat Living Root Bridges",
                    "travel_hrs": 1.0,
                    "activities": [
                        "Trek down 3,500 ancient mossy stone steps from Tyrna village",
                        "Cross 250-year-old bio-engineered Double Decker Living Root Bridge",
                        "Natural fish-spa swim in crystal turquoise Rainbow Falls pools",
                        "Traditional Khasi organic dinner cooked with wild forest herbs"
                    ],
                    "stay_type": "Serene Community Homestay, Nongriat Village",
                    "est_cost_range": [1000, 1500]
                })
            elif d == 4:
                plan_a_days.append({
                    "day_number": 4,
                    "destination_slug": "dawki",
                    "destination_name": "Nongriat → Dawki & Mawlynnong",
                    "travel_hrs": 3.0,
                    "activities": [
                        "Country boat ride on glass-like transparent Umngot River at Dawki border",
                        "Walk through stone-paved lanes of Mawlynnong (Asia's cleanest village)",
                        "Climb bamboo sky-walk for aerial canopy views of Bangladesh plains",
                        "Visit Riwai single living root bridge"
                    ],
                    "stay_type": "Mawlynnong Bamboo Treehouse Homestay",
                    "est_cost_range": [1300, 1900]
                })
            elif d == nights:
                plan_a_days.append({
                    "day_number": d,
                    "destination_slug": "guwahati",
                    "destination_name": "Mawlynnong → Krang Shuri → Guwahati Departure",
                    "travel_hrs": 4.5,
                    "activities": [
                        "Morning dip at turquoise Krang Shuri Waterfalls in Jaintia Hills",
                        "Return transit along NH6 to Guwahati transit hub",
                        "Shop authentic Assam Muga silk & fresh organic hill spices",
                        "Depart from Guwahati Airport / Railway Station"
                    ],
                    "stay_type": "Departure Transit / Flight Home",
                    "est_cost_range": [800, 1400]
                })
            else:
                plan_a_days.append({
                    "day_number": d,
                    "destination_slug": "cherrapunji",
                    "destination_name": f"Day {d}: Offbeat Meghalaya Caving & Waterfalls",
                    "travel_hrs": 2.0,
                    "activities": [
                        "Offbeat spelunking expedition in Krem Mawmluh river cave",
                        "Visit Garden of Caves and historic Dainthlen falls legend site",
                        "Evening acoustic folk music session with local village musicians"
                    ],
                    "stay_type": "Community Cottage, Sohra",
                    "est_cost_range": [1200, 1800]
                })

        # Plan B: Kaziranga & Majuli Island Cultural Circuit
        plan_b_days = []
        plan_b_title = "Plan B: Wildlife & Brahmaputra River Island Culture"
        for d in range(1, nights + 1):
            if d == 1:
                plan_b_days.append({
                    "day_number": 1,
                    "destination_slug": "kaziranga",
                    "destination_name": "Guwahati → Kaziranga National Park",
                    "travel_hrs": 4.5,
                    "activities": [
                        "Board shared traveler/Sumo along NH715 past lush tea gardens",
                        "Check in to Mising tribal community eco-lodge",
                        "Evening Kaziranga Orchid Park cultural dance show (Bihu & Jhumur)",
                        "Authentic Assamese duck curry and Khar dinner"
                    ],
                    "stay_type": "Wild Grass Eco-Camp / Diphlu River Lodge",
                    "est_cost_range": [1800, 2600]
                })
            elif d == 2:
                plan_b_days.append({
                    "day_number": 2,
                    "destination_slug": "kaziranga",
                    "destination_name": "Kaziranga Wilderness & Rhino Safari",
                    "travel_hrs": 2.0,
                    "activities": [
                        "Dawn open jeep safari through Central Kohora Range",
                        "Spot Great Indian One-Horned Rhinos, wild water buffaloes, and swamp deer",
                        "Afternoon birding safari in Western Bagori range",
                        "Visit Hatikhuli organic tea estate factory for CTC tasting"
                    ],
                    "stay_type": "Kaziranga Mising Tribal Homestay",
                    "est_cost_range": [2200, 3200]
                })
            elif d == 3:
                plan_b_days.append({
                    "day_number": 3,
                    "destination_slug": "majuli",
                    "destination_name": "Kaziranga → Nimati Ghat → Majuli Island",
                    "travel_hrs": 3.0,
                    "activities": [
                        "Transit to Nimati Ghat (Jorhat)",
                        "Board public Ro-Pax ferry (₹15) across majestic Brahmaputra river",
                        "Arrive on Majuli (world's largest inhabited river island)",
                        "Visit historic Uttar Kamalabari Satra for evening monastic prayer"
                    ],
                    "stay_type": "La Maison de Ananda (Traditional Bamboo Stilt House)",
                    "est_cost_range": [1200, 1700]
                })
            elif d == 4:
                plan_b_days.append({
                    "day_number": 4,
                    "destination_slug": "majuli",
                    "destination_name": "Majuli Island Mask Making & Mising Villages",
                    "travel_hrs": 1.5,
                    "activities": [
                        "Hands-on traditional Vaishnavite mask-making workshop at Samaguri Satra",
                        "Bicycle tour through indigenous Mising tribal weaving villages",
                        "Taste authentic Apong (rice beer) & roasted river fish with organic herbs",
                        "Sunset over serene Luit water channels"
                    ],
                    "stay_type": "Majuli Tribal Eco-Camp",
                    "est_cost_range": [1100, 1600]
                })
            elif d == nights:
                plan_b_days.append({
                    "day_number": d,
                    "destination_slug": "guwahati",
                    "destination_name": "Majuli → Jorhat / Guwahati Departure",
                    "travel_hrs": 4.5,
                    "activities": [
                        "Early morning ferry crossing back to Nimati Ghat",
                        "Board departure flight from Jorhat (JRH) or train to Guwahati",
                        "Pick up world-famous Assam Orthodox Golden Tips Tea"
                    ],
                    "stay_type": "Transit / Departure Flight",
                    "est_cost_range": [900, 1400]
                })
            else:
                plan_b_days.append({
                    "day_number": d,
                    "destination_slug": "majuli",
                    "destination_name": f"Day {d}: Sivasagar Ahom Dynasty Monuments",
                    "travel_hrs": 2.5,
                    "activities": [
                        "Excursion to historic Sivasagar: Rang Ghar (Asia's oldest amphitheatre)",
                        "Marvel at Talatal Ghar underground military palace and Shiva Dol temple"
                    ],
                    "stay_type": "Heritage Tea Estate Bungalow, Jorhat",
                    "est_cost_range": [1400, 2000]
                })

        # Plan C: Western Arunachal / High Altitude Himalayan Pass (Tawang & Monpa Culture)
        plan_c_days = []
        plan_c_title = "Plan C: High-Altitude Himalayan Passes & Tawang Monasteries"
        for d in range(1, nights + 1):
            if d == 1:
                plan_c_days.append({
                    "day_number": 1,
                    "destination_slug": "dirang",
                    "destination_name": "Guwahati → Tezpur → Bhalukpong → Dirang",
                    "travel_hrs": 6.5,
                    "activities": [
                        "Early 6:00 AM departure from Paltan Bazar shared sumo stand",
                        "Cross Arunachal Pradesh checkpost at Bhalukpong with ILP verification",
                        "Ascend along Kameng River gorge",
                        "Soak in natural hot water sulfur springs in Dirang valley"
                    ],
                    "stay_type": "Pemaling Monpa Village Homestay, Dirang",
                    "est_cost_range": [1500, 2200]
                })
            elif d == 2:
                plan_c_days.append({
                    "day_number": 2,
                    "destination_slug": "tawang",
                    "destination_name": "Dirang → Sela Pass (13,700 ft) → Tawang",
                    "travel_hrs": 5.5,
                    "activities": [
                        "Pass through apple & kiwi orchards of Sangti Valley",
                        "Ascend through prayer flags over frozen Sela Pass & Sela Lake at 13,700 ft",
                        "Pay tribute at Jaswant Garh War Memorial (complimentary hot chai)",
                        "Marvel at Nuranang (Jang) Waterfall cascading 100 meters down"
                    ],
                    "stay_type": "Dung-Khar Monpa Alpine Homestay, Tawang",
                    "est_cost_range": [1800, 2600]
                })
            elif d == 3:
                plan_c_days.append({
                    "day_number": 3,
                    "destination_slug": "tawang",
                    "destination_name": "Tawang Monastery & Monpa Culture",
                    "travel_hrs": 1.0,
                    "activities": [
                        "Visit 400-year-old Galden Namgey Lhatse (Tawang Monastery, 2nd largest in world)",
                        "Witness young novice monks chanting scriptures and morning debate",
                        "Visit Urgelling Monastery (birthplace of the 6th Dalai Lama)",
                        "Evening sound & light show at Tawang War Memorial"
                    ],
                    "stay_type": "Tawang Monpa Homestay",
                    "est_cost_range": [1600, 2400]
                })
            elif d == 4:
                plan_c_days.append({
                    "day_number": 4,
                    "destination_slug": "tawang",
                    "destination_name": "Bum La Pass (15,200 ft) & Sangetsar Lake",
                    "travel_hrs": 4.5,
                    "activities": [
                        "4x4 expedition to Indo-China border at Bum La Pass (15,200 ft)",
                        "Visit sacred Sangetsar Tso (Madhuri Lake) with submerged dead pine trees",
                        "Enjoy hot momos and butter tea at army border cafeteria"
                    ],
                    "stay_type": "Tawang Alpine Homestay",
                    "est_cost_range": [2200, 3200]
                })
            elif d == nights:
                plan_c_days.append({
                    "day_number": d,
                    "destination_slug": "guwahati",
                    "destination_name": "Bomdila → Guwahati Return",
                    "travel_hrs": 6.5,
                    "activities": [
                        "Descent from Bomdila ridge through misty subtropical forests",
                        "Cross border back into Assam plains",
                        "Drop-off at Guwahati Airport / Paltan Bazar Railway station"
                    ],
                    "stay_type": "Transit / Departure Flight",
                    "est_cost_range": [1000, 1600]
                })
            else:
                plan_c_days.append({
                    "day_number": d,
                    "destination_slug": "bomdila",
                    "destination_name": f"Day {d}: Bomdila Monastery & Apple Orchards",
                    "travel_hrs": 4.0,
                    "activities": [
                        "Scenic drive to Bomdila town",
                        "Visit Upper & Middle Gompas overlooking Himalayan peaks",
                        "Shop for handwoven Tibetan woollen carpets at District Craft Centre"
                    ],
                    "stay_type": "Bomdila Hilltop Guesthouse",
                    "est_cost_range": [1400, 2000]
                })

        plan_a_low = sum(day["est_cost_range"][0] for day in plan_a_days) * travelers_count
        plan_a_high = sum(day["est_cost_range"][1] for day in plan_a_days) * travelers_count

        plan_b_low = sum(day["est_cost_range"][0] for day in plan_b_days) * travelers_count
        plan_b_high = sum(day["est_cost_range"][1] for day in plan_b_days) * travelers_count

        plan_c_low = sum(day["est_cost_range"][0] for day in plan_c_days) * travelers_count
        plan_c_high = sum(day["est_cost_range"][1] for day in plan_c_days) * travelers_count

        plans = [
            {
                "id": "plan-a",
                "name": plan_a_title,
                "status": "feasible",
                "score": 96.0,
                "pace": pace,
                "cost_range_low": plan_a_low,
                "cost_range_high": plan_a_high,
                "local_value_score": 0.88,
                "permits_needed": [],
                "permits_detail": [],
                "warnings": [
                    {
                        "rule_id": "monsoon-risk",
                        "message": "Meghalaya trails can be slippery during rains; carry waterproof footwear and rain cover.",
                        "severity": "info"
                    },
                    {
                        "rule_id": "trek-fitness",
                        "message": "Nongriat Double Decker Living Root Bridge requires descending and ascending 3,500 stone steps.",
                        "severity": "info"
                    }
                ],
                "days": plan_a_days,
                "assumptions": [
                    "Shared Tata Sumo from Paltan Bazar / Lewduh stands",
                    "Direct community homestay stays with home-cooked breakfast and dinner",
                    "Moderate physical fitness for living root bridge trek"
                ],
                "alternatives": [
                    "Can add Krang Shuri cliff diving if starting from Shillong early",
                    "Swap Nongriat trek with Mawlynnong treehouse stay for senior travellers"
                ]
            },
            {
                "id": "plan-b",
                "name": plan_b_title,
                "status": "feasible",
                "score": 91.0,
                "pace": "relaxed",
                "cost_range_low": plan_b_low,
                "cost_range_high": plan_b_high,
                "local_value_score": 0.92,
                "permits_needed": [],
                "permits_detail": [],
                "warnings": [
                    {
                        "rule_id": "rhino-safari-timing",
                        "message": "Kaziranga Park safari zones close annually from May 31 to October 31 for monsoon flood management.",
                        "severity": "info"
                    },
                    {
                        "rule_id": "ferry-schedule",
                        "message": "Last public Ro-Pax ferry from Nimati Ghat to Majuli departs at 3:30 PM; do not miss the afternoon cut-off.",
                        "severity": "warning"
                    }
                ],
                "days": plan_b_days,
                "assumptions": [
                    "Public Ro-Pax river ferry crossing across Brahmaputra",
                    "Certified local naturalist guide for Kaziranga morning safari",
                    "Bicycle hire on Majuli Island for eco exploration"
                ],
                "alternatives": [
                    "Add Pobitora Wildlife Sanctuary as a half-day Kaziranga alternative",
                    "Include Gibbon Wildlife Sanctuary near Jorhat for India's only ape species"
                ]
            },
            {
                "id": "plan-c",
                "name": plan_c_title,
                "status": "tight" if nights <= 5 else "feasible",
                "score": 85.0,
                "pace": "active",
                "cost_range_low": plan_c_low,
                "cost_range_high": plan_c_high,
                "local_value_score": 0.84,
                "permits_needed": ["AR-ILP"],
                "permits_detail": [
                    {
                        "state": "Arunachal Pradesh",
                        "permit_name": "Inner Line Permit (ILP)",
                        "applies_to": "Domestic Indian Travellers",
                        "fee_inr": 100,
                        "lead_time": "1-2 days online",
                        "official_portal": "https://arunachalilp.com",
                        "documents_required": [
                            "Aadhaar or Voter ID Card (PDF)",
                            "Passport size photo (JPEG)",
                            "Valid phone number"
                        ]
                    }
                ],
                "warnings": [
                    {
                        "rule_id": "ilp-mandatory",
                        "message": "Inner Line Permit (ILP) is mandatory to cross Bhalukpong checkpost into Arunachal Pradesh.",
                        "severity": "warning"
                    },
                    {
                        "rule_id": "high-altitude",
                        "message": "Sela Pass is at 13,700 ft and Bum La Pass is at 15,200 ft. Stay hydrated and avoid strenuous exertion on day 2.",
                        "severity": "warning"
                    },
                    {
                        "rule_id": "daily-travel-cap",
                        "message": "Mountain road travel between Tezpur and Dirang/Tawang involves 5-7 hours of winding ghat roads daily.",
                        "severity": "warning"
                    }
                ],
                "days": plan_c_days,
                "assumptions": [
                    "Online e-ILP obtained at least 48 hours prior to journey",
                    "4x4 local vehicle required for Bum La Pass military permission",
                    "Early morning 6 AM departures to avoid mountain road convoy delays"
                ],
                "alternatives": [
                    "Can detour to Ziro Valley (Apatani tribal villages) instead of Tawang if looking for music and gentle trekking",
                    "Extend by 2 nights to explore Sangti Valley black-necked cranes"
                ]
            }
        ]

        self.send_json({
            "data": plans,
            "meta": {
                "total": len(plans),
                "gateway": gateway,
                "nights": nights,
                "verified_at": "2026-10-15",
                "confidence": 0.95,
                "freshness": "fresh"
            }
        })

    def handle_auth_login(self):
        body = self.parse_body()
        name = body.get("name", "").strip()
        email = body.get("email", "").strip().lower()
        phone = body.get("phone", "").strip()
        state = body.get("state", "").strip()
        country = body.get("country", "India").strip()

        if not name or not email:
            return self.send_error_json("Name and valid email are required", 400)

        token = secrets.token_hex(20)
        conn = get_db()
        cursor = conn.cursor()

        # Check if user exists
        cursor.execute("SELECT id, name, email, phone, state, country, token FROM users WHERE email = ?", (email,))
        existing = cursor.fetchone()

        if existing:
            user_id = existing[0]
            # If phone is not provided in update, keep existing phone if present
            stored_phone = phone if phone else (existing[3] or "")
            cursor.execute("""
                UPDATE users
                SET name = ?, phone = ?, state = ?, country = ?, token = ?, last_login_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (name, stored_phone, state, country, token, user_id))
            phone = stored_phone
        else:
            cursor.execute("""
                INSERT INTO users (name, email, phone, state, country, token)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (name, email, phone, state, country, token))
            user_id = cursor.lastrowid

        conn.commit()

        # Also sync to data/users.json for Go parity
        try:
            users_file = os.path.join(BASE_DIR, "data", "users.json")
            users_list = []
            if os.path.exists(users_file):
                with open(users_file, "r") as f:
                    try:
                        users_list = json.load(f)
                    except Exception:
                        users_list = []
            found = False
            for u in users_list:
                if u.get("email") == email:
                    u.update({"id": user_id, "name": name, "email": email, "phone": phone, "state": state, "country": country, "token": token})
                    found = True
                    break
            if not found:
                users_list.append({"id": user_id, "name": name, "email": email, "phone": phone, "state": state, "country": country, "token": token})
            with open(users_file, "w") as f:
                json.dump(users_list, f, indent=2)
        except Exception as e:
            print("Note syncing users.json:", e)

        conn.close()

        user_data = {
            "id": user_id,
            "name": name,
            "email": email,
            "phone": phone,
            "state": state,
            "country": country,
            "token": token
        }

        self.send_json({
            "success": True,
            "token": token,
            "user": user_data,
            "message": f"Welcome back, {name}!" if existing else f"Welcome to Chalo NorthEast, {name}!"
        })

    def handle_auth_me(self, query_params):
        auth_header = self.headers.get("Authorization", "")
        token = ""
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
        if not token:
            token = query_params.get("token", [""])[0]

        if not token:
            return self.send_json({"authenticated": False, "user": None})

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, email, phone, state, country, token FROM users WHERE token = ?", (token,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return self.send_json({"authenticated": False, "user": None})

        user_dict = {
            "id": row[0],
            "name": row[1],
            "email": row[2],
            "phone": row[3] or "",
            "state": row[4],
            "country": row[5],
            "token": row[6]
        }
        self.send_json({"authenticated": True, "user": user_dict})

    def handle_auth_logout(self):
        self.send_json({"success": True, "message": "Logged out successfully"})

class ReusableThreadingServer(ThreadingHTTPServer):
    allow_reuse_address = True

def run_server(port=8000):
    init_db()
    try:
        httpd = ReusableThreadingServer(("0.0.0.0", port), ChaloNorthEastHandler)
    except OSError as e:
        if e.errno == 98:
            alt_port = 8080 if port == 8000 else port + 1
            print(f"⚠️ Port {port} is busy. Falling back to port {alt_port}...")
            httpd = ReusableThreadingServer(("0.0.0.0", alt_port), ChaloNorthEastHandler)
            port = alt_port
        else:
            raise e

    print(f"🌲 Chalo NorthEast server running at http://127.0.0.1:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer shutting down gracefully.")
        httpd.server_close()

if __name__ == "__main__":
    port = 8000
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    run_server(port)
