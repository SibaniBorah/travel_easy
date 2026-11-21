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

        # API Endpoints
        if path == "/api/states":
            self.handle_get_states()
        elif path.startswith("/api/states/"):
            code = path.split("/")[-1].upper()
            self.handle_get_state_detail(code)
        elif path == "/api/destinations":
            self.handle_get_destinations(query_params)
        elif path.startswith("/api/destinations/"):
            slug = path.split("/")[-1]
            self.handle_get_destination_detail(slug)
        elif path == "/api/transit":
            self.handle_get_transit(query_params)
        elif path == "/api/homestays":
            self.handle_get_homestays(query_params)
        elif path == "/api/itineraries":
            self.handle_get_itineraries(query_params)
        elif path.startswith("/api/itineraries/"):
            slug = path.split("/")[-1]
            self.handle_get_itinerary_detail(slug)
        elif path == "/api/permits":
            self.handle_get_permits()
        elif path == "/api/tips":
            self.handle_get_tips(query_params)
        elif path.startswith("/api/custom-trips/"):
            share_code = path.split("/")[-1]
            self.handle_get_custom_trip(share_code)
        elif path == "/api/stats":
            self.handle_get_stats()
        else:
            # Fallback to static handler
            return super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path == "/api/calculate-budget":
            self.handle_calculate_budget()
        elif path == "/api/custom-trips":
            self.handle_create_custom_trip()
        elif path == "/api/tips":
            self.handle_create_tip()
        elif path.endswith("/upvote") and path.startswith("/api/tips/"):
            tip_id = path.split("/")[-2]
            self.handle_upvote_tip(tip_id)
        elif path == "/api/reviews":
            self.handle_create_review()
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

def run_server(port=8000):
    init_db()
    server_address = ("0.0.0.0", port)
    httpd = ThreadingHTTPServer(server_address, ChaloNorthEastHandler)
    print(f"Chalo NorthEast server running at http://127.0.0.1:{port}")
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
