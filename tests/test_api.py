"""
Automated Test Suite for Chalo NorthEast API Endpoints
"""

import unittest
import json
import threading
import time
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import init_db
from server import ChaloNorthEastHandler

TEST_PORT = 8999
BASE_URL = f"http://127.0.0.1:{TEST_PORT}"

class TestChaloNorthEastAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.server = ThreadingHTTPServer(("127.0.0.1", TEST_PORT), ChaloNorthEastHandler)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        time.sleep(0.5)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def get(self, endpoint):
        req = urllib.request.Request(f"{BASE_URL}{endpoint}")
        with urllib.request.urlopen(req) as resp:
            data = resp.read().decode("utf-8")
            return resp.status, json.loads(data)

    def post(self, endpoint, payload):
        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{BASE_URL}{endpoint}",
            data=data_bytes,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as resp:
            data = resp.read().decode("utf-8")
            return resp.status, json.loads(data)

    def test_01_stats_endpoint(self):
        status, data = self.get("/api/stats")
        self.assertEqual(status, 200)
        self.assertEqual(data["states"], 8)
        self.assertGreaterEqual(data["destinations"], 15)
        self.assertGreaterEqual(data["transit_routes"], 10)
        self.assertGreaterEqual(data["homestays"], 10)
        self.assertGreaterEqual(data["prebuilt_itineraries"], 5)

    def test_02_states_endpoint(self):
        status, data = self.get("/api/states")
        self.assertEqual(status, 200)
        self.assertEqual(len(data), 8)
        codes = [s["code"] for s in data]
        for expected in ["AS", "ML", "AR", "NL", "MN", "MZ", "TR", "SK"]:
            self.assertIn(expected, codes)

    def test_03_state_detail_endpoint(self):
        status, data = self.get("/api/states/ML")
        self.assertEqual(status, 200)
        self.assertEqual(data["name"], "Meghalaya")
        self.assertIn("destinations", data)
        self.assertIn("homestays", data)
        self.assertIn("transit_routes", data)
        self.assertGreater(len(data["destinations"]), 0)

    def test_04_destinations_with_filters(self):
        # Filter by state
        status, data = self.get("/api/destinations?state=AS")
        self.assertEqual(status, 200)
        for dest in data:
            self.assertEqual(dest["state_code"], "AS")

        # Filter by category
        status, data = self.get("/api/destinations?category=wildlife")
        self.assertEqual(status, 200)
        for dest in data:
            self.assertEqual(dest["category"], "wildlife")

        # Search query
        status, data = self.get("/api/destinations?q=rhino")
        self.assertEqual(status, 200)
        self.assertTrue(any("rhino" in d["description"].lower() or "rhino" in d["top_highlights"].lower() for d in data))

    def test_05_destination_detail(self):
        status, data = self.get("/api/destinations/kaziranga-national-park")
        self.assertEqual(status, 200)
        self.assertEqual(data["name"], "Kaziranga National Park")
        self.assertIn("how_to_reach_budget", data)
        self.assertIn("permit_info", data)
        self.assertIn("homestays", data)
        self.assertIn("reviews", data)

    def test_06_transit_routes(self):
        status, data = self.get("/api/transit?from=Guwahati&to=Shillong")
        self.assertEqual(status, 200)
        self.assertGreaterEqual(len(data), 1)
        route = data[0]
        self.assertEqual(route["from_city"], "Guwahati")
        self.assertEqual(route["to_city"], "Shillong")
        self.assertIn("Shared Sumo", route["transport_mode"])
        self.assertGreater(route["fare_inr"], 0)

    def test_07_permits_endpoint(self):
        status, data = self.get("/api/permits")
        self.assertEqual(status, 200)
        self.assertIn("states", data)
        self.assertIn("general_guidelines", data)
        ilp_states = [s["code"] for s in data["states"] if s["ilp_required"] == 1]
        self.assertIn("AR", ilp_states)
        self.assertIn("NL", ilp_states)
        self.assertIn("MN", ilp_states)
        self.assertIn("MZ", ilp_states)

    def test_08_budget_calculation(self):
        payload = {
            "duration_days": 5,
            "travelers_count": 2,
            "travel_style": "budget"
        }
        status, data = self.post("/api/calculate-budget", payload)
        self.assertEqual(status, 200)
        self.assertEqual(data["duration_days"], 5)
        self.assertEqual(data["travelers_count"], 2)
        self.assertGreater(data["cost_per_person_per_day"], 1000)
        self.assertGreater(data["grand_total_inr"], 5000)
        self.assertIn("breakdown", data)
        self.assertIn("cost_saving_tips", data)

    def test_09_custom_trip_save_and_retrieve(self):
        payload = {
            "trip_name": "Backpacker Northeast Trail",
            "travelers_count": 1,
            "travel_style": "backpacker",
            "duration_days": 7,
            "est_total_cost": 12000,
            "breakdown": {"stay": 4000, "transport": 3500, "food": 3000, "permits": 1500},
            "destinations": ["cherrapunji-sohra", "nongriat-root-bridges", "dawki-shnongpdeng-river"],
            "notes": "Plan to stay at Byron homestay and camp in Shnongpdeng."
        }
        status, data = self.post("/api/custom-trips", payload)
        self.assertEqual(status, 201)
        self.assertTrue(data["success"])
        share_code = data["share_code"]

        # Retrieve saved trip
        status_get, trip_data = self.get(f"/api/custom-trips/{share_code}")
        self.assertEqual(status_get, 200)
        self.assertEqual(trip_data["trip_name"], "Backpacker Northeast Trail")
        self.assertEqual(len(trip_data["destinations"]), 3)

    def test_10_community_tip_submission_and_upvote(self):
        tip_payload = {
            "state_code": "AS",
            "destination_name": "Majuli Island",
            "author_name": "Test Traveller",
            "author_city": "Tezpur",
            "category": "Budget",
            "tip_text": "Always catch the early morning ferry from Nimati Ghat to see river dolphins!"
        }
        status, data = self.post("/api/tips", tip_payload)
        self.assertEqual(status, 200)
        self.assertTrue(data["success"])
        tip_id = data["id"]

        # Upvote tip
        status_up, data_up = self.post(f"/api/tips/{tip_id}/upvote", {})
        self.assertEqual(status_up, 200)
        self.assertTrue(data_up["success"])
        self.assertGreaterEqual(data_up["upvotes"], 6)

if __name__ == "__main__":
    unittest.main()
