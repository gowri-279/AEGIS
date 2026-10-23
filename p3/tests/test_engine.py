
from p3.engine import generate_demo_candidates


def test_standard_fixture_selects_feasible_candidate():
    results = generate_demo_candidates(200, 600, 0.60, "ineligible")
    feasible = [result.candidate_id for result in results if result.feasible]

    assert feasible == ["C-L2"]


def test_stress_fixture_has_no_feasible_candidate():
    results = generate_demo_candidates(900, 600, 0.60, "ineligible")

    assert all(not result.feasible for result in results)


def test_water_level_at_limit_fails():
    results = generate_demo_candidates(200, 600, 0.80, "ineligible")
    l2 = next(result for result in results if result.candidate_id == "C-L2")

    assert not l2.feasible
    water_check = next(
        check for check in l2.checks if check.constraint == "j3_water_level"
    )
    assert water_check.status == "failed"
