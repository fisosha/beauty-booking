"""Модульні тести алгоритму генерації вільних слотів (BE-03)."""
from datetime import date, datetime, time

import pytest

from app.slots import add_minutes, generate_free_slots, overlaps

DAY = date(2030, 1, 7)
WORK = [(time(10, 0), time(12, 0))]


def t(s):
    return time.fromisoformat(s)


def test_no_work_intervals_gives_no_slots():
    assert generate_free_slots([], [], 60) == []


def test_slots_on_15_min_grid():
    assert generate_free_slots(WORK, [], 60) == [t("10:00"), t("10:15"), t("10:30"), t("10:45"), t("11:00")]


def test_duration_equal_to_interval_gives_one_slot():
    assert generate_free_slots(WORK, [], 120) == [t("10:00")]


def test_duration_longer_than_interval_gives_no_slots():
    assert generate_free_slots(WORK, [], 150) == []


def test_busy_booking_removes_overlapping_slots():
    slots = generate_free_slots(WORK, [(t("10:30"), t("11:00"))], 30)
    assert t("10:30") not in slots and t("10:15") not in slots
    assert slots == [t("10:00"), t("11:00"), t("11:15"), t("11:30")]


def test_adjacent_booking_does_not_block():
    slots = generate_free_slots(WORK, [(t("10:00"), t("11:00"))], 60)
    assert slots == [t("11:00")]


def test_several_work_intervals_are_merged_and_sorted():
    work = [(t("15:00"), t("16:00")), (t("10:00"), t("11:00"))]
    assert generate_free_slots(work, [], 60) == [t("10:00"), t("15:00")]


def test_past_day_has_no_slots():
    now = datetime(2030, 1, 8, 9, 0)
    assert generate_free_slots(WORK, [], 30, day=DAY, now=now) == []


def test_today_skips_time_in_the_past():
    now = datetime(2030, 1, 7, 10, 40)
    assert generate_free_slots(WORK, [], 60, day=DAY, now=now) == [t("10:45"), t("11:00")]


def test_non_positive_duration_raises():
    with pytest.raises(ValueError):
        generate_free_slots(WORK, [], 0)


@pytest.mark.parametrize("a,b,expected", [
    (("10:00", "11:00"), ("10:30", "11:30"), True),
    (("10:00", "11:00"), ("11:00", "12:00"), False),
    (("10:00", "12:00"), ("10:30", "11:00"), True),
])
def test_overlaps(a, b, expected):
    assert overlaps(t(a[0]), t(a[1]), t(b[0]), t(b[1])) is expected


def test_add_minutes_and_day_overflow():
    assert add_minutes(t("10:45"), 90) == t("12:15")
    with pytest.raises(ValueError):
        add_minutes(t("23:30"), 60)
