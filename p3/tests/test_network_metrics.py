
import pytest

from p3.network_metrics import (
    calculate_modeled_network_utilization,
    calculate_remaining_storage,
)


def test_utilization_uses_maximum_edge_ratio():
    edges = [
        {"post_intervention_flow_m3_s": 0.2, "capacity_m3_s": 0.5},
        {"post_intervention_flow_m3_s": 0.4, "capacity_m3_s": 0.5},
    ]

    assert calculate_modeled_network_utilization(edges) == pytest.approx(0.8)


def test_missing_flow_returns_none():
    edges = [
        {"post_intervention_flow_m3_s": None, "capacity_m3_s": 0.5}
    ]

    assert calculate_modeled_network_utilization(edges) is None


def test_no_eligible_edges_returns_none():
    assert calculate_modeled_network_utilization([]) is None
    assert calculate_modeled_network_utilization(
        [{"post_intervention_flow_m3_s": 0.2, "capacity_m3_s": 0}]
    ) is None


def test_remaining_storage():
    assert calculate_remaining_storage(1000, 200) == 800


def test_missing_storage_returns_none():
    assert calculate_remaining_storage(1000, None) is None


def test_occupied_storage_cannot_exceed_capacity():
    with pytest.raises(ValueError):
        calculate_remaining_storage(100, 150)


def test_edge_without_capacity_is_excluded():
    edges = [
        {
            "post_intervention_flow_m3_s": 0.2,
            "capacity_m3_s": 0.5,
        },
        {
            "post_intervention_flow_m3_s": None,
            "capacity_m3_s": None,
        },
    ]

    assert calculate_modeled_network_utilization(edges) == 0.4


def test_missing_flow_on_eligible_edge_returns_none():
    edges = [
        {
            "post_intervention_flow_m3_s": 0.2,
            "capacity_m3_s": 0.5,
        },
        {
            "post_intervention_flow_m3_s": None,
            "capacity_m3_s": 0.4,
        },
    ]

    assert calculate_modeled_network_utilization(edges) is None
