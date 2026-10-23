import unittest
from datetime import datetime, timezone

from p2.sensor_reliability import assess_reading


NOW = "2026-10-23T12:00:00Z"


class SensorReliabilityTests(unittest.TestCase):
    def assess(self, **overrides):
        args = {
            "sensor_id": "WL-J3",
            "sensor_type": "water_level",
            "raw_value": 0.60,
            "timestamp": "2026-10-23T11:59:00Z",
            "now": NOW,
        }
        args.update(overrides)
        return assess_reading(**args)

    def test_fresh_reading_is_usable(self):
        result = self.assess()
        self.assertEqual(result["quality_status"], "fresh")
        self.assertEqual(result["effective_value"], 0.60)
        self.assertGreater(result["confidence"], 0)

    def test_exactly_five_minutes_is_fresh(self):
        result = self.assess(timestamp="2026-10-23T11:55:00Z")
        self.assertEqual(result["quality_status"], "fresh")

    def test_older_than_five_minutes_is_stale(self):
        result = self.assess(timestamp="2026-10-23T11:54:59Z")
        self.assertEqual(result["quality_status"], "stale")
        self.assertIsNone(result["effective_value"])
        self.assertEqual(result["confidence"], 0.0)

    def test_missing_reading(self):
        result = self.assess(raw_value=None)
        self.assertEqual(result["quality_status"], "missing")
        self.assertIsNone(result["raw_value"])
        self.assertIsNone(result["effective_value"])
        self.assertIsNone(result["timestamp"])
        self.assertEqual(result["confidence"], 0.0)

    def test_missing_timestamp(self):
        result = self.assess(timestamp=None)
        self.assertEqual(result["quality_status"], "missing")
        self.assertIn("MISSING_TIMESTAMP", result["issue_codes"])
        self.assertIsNone(result["effective_value"])

    def test_invalid_reading(self):
        result = self.assess(raw_value="not-a-number")
        self.assertEqual(result["quality_status"], "invalid")
        self.assertIsNone(result["effective_value"])
        self.assertEqual(result["confidence"], 0.0)

    def test_conflicting_reading(self):
        result = self.assess(reported_status="conflicting")
        self.assertEqual(result["quality_status"], "conflicting")
        self.assertIsNone(result["effective_value"])
        self.assertEqual(result["confidence"], 0.0)

    def test_degraded_usable_reading(self):
        result = self.assess(reported_status="degraded", degraded_usable=True)
        self.assertEqual(result["quality_status"], "degraded")
        self.assertEqual(result["effective_value"], 0.60)
        self.assertGreater(result["confidence"], 0)
        self.assertIn("DEGRADED_SENSOR", result["issue_codes"])

    def test_degraded_unusable_reading(self):
        result = self.assess(reported_status="degraded", degraded_usable=False)
        self.assertEqual(result["quality_status"], "degraded")
        self.assertIsNone(result["effective_value"])
        self.assertEqual(result["confidence"], 0.0)

    def test_water_quality_has_fifteen_minute_threshold(self):
        result = self.assess(
            sensor_type="water_quality",
            timestamp="2026-10-23T11:46:00Z",
        )
        self.assertEqual(result["quality_status"], "fresh")

    def test_future_timestamp_is_invalid(self):
        result = self.assess(timestamp="2026-10-23T12:01:00Z")
        self.assertEqual(result["quality_status"], "invalid")
        self.assertIsNone(result["effective_value"])

    def test_bad_sensor_type_is_rejected(self):
        with self.assertRaises(ValueError):
            self.assess(sensor_type="temperature")


if __name__ == "__main__":
    unittest.main()
