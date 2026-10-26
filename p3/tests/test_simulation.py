
import pytest

from p3.simulation import (
    compare_with_baseline,
    simulate_intervention,
)


def test_standard_scenario():
    result = simulate_intervention(
        "storage_and_recharge_demo", 200, 600, "C-L2", 200
    )
    assert result.proposed_flow_m3_s == pytest.approx(200 / 600)
    assert result.residual_excess_volume_m3 == 0


def test_different_baseline():
    result = simulate_intervention("custom", 200, 600, "C-L2", 500)
    assert result.residual_excess_volume_m3 == 300


def test_no_candidate_preserves_baseline():
    result = simulate_intervention("custom", 200, 600, None, 500)
    assert result.residual_excess_volume_m3 == 500


def test_invalid_inputs():
    with pytest.raises(ValueError):
        simulate_intervention("custom", 200, 0, "C-L2", 500)

    with pytest.raises(ValueError):
        simulate_intervention("custom", -1, 600, "C-L2", 500)


def test_baseline_comparison():
    result = compare_with_baseline(500, 300)
    assert result.excess_volume_reduction_m3 == 200


def test_unavailable_intervention_result():
    result = compare_with_baseline(500, None)
    assert result.excess_volume_reduction_m3 is None
