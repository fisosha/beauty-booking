"""Модульні тести бізнес-логіки бронювання (BE-04, BE-05, BE-06) на тестовій БД."""
from datetime import time

import pytest

from app import services
from tests.conftest import MONDAY

NOW = None  # дата 2030 р. завжди в майбутньому


def test_booking_gets_cancel_code_and_end_time(db):
    b = services.create_booking(db, 1, MONDAY, time(10, 0), "Анна", "+380671234567")
    assert len(b.cancel_code) == 8 and b.status == "active"
    assert b.end_time == time(11, 0)  # послуга 1 триває 60 хв


def test_same_slot_cannot_be_booked_twice(db):
    services.create_booking(db, 1, MONDAY, time(10, 0), "Анна", "+380671234567")
    with pytest.raises(services.SlotUnavailable):
        services.create_booking(db, 1, MONDAY, time(10, 0), "Олег", "+380501234567")


def test_overlapping_slot_cannot_be_booked(db):
    services.create_booking(db, 1, MONDAY, time(10, 0), "Анна", "+380671234567")  # 10:00–11:00
    with pytest.raises(services.SlotUnavailable):
        services.create_booking(db, 3, MONDAY, time(10, 30), "Олег", "+380501234567")


def test_booking_outside_working_hours_is_rejected(db):
    with pytest.raises(services.SlotUnavailable):
        services.create_booking(db, 1, MONDAY, time(8, 0), "Анна", "+380671234567")


def test_cancel_frees_the_slot(db):
    b = services.create_booking(db, 1, MONDAY, time(10, 0), "Анна", "+380671234567")
    assert time(10, 0) not in services.free_slots(db, 1, 1, MONDAY)
    services.cancel_booking(db, b.cancel_code)
    assert time(10, 0) in services.free_slots(db, 1, 1, MONDAY)


def test_unknown_cancel_code_raises_not_found(db):
    with pytest.raises(services.NotFound):
        services.get_booking(db, "NOPE0000")


def test_schedule_skips_overlapping_intervals_and_other_weekdays(db):
    # 10:00–14:00 уже є на пн–сб; 12:00–13:00 перетинається, тому нічого не додано
    assert services.add_schedule(db, 1, MONDAY, MONDAY, [0], time(12), time(13)) == 0
    # неділя (6) вільна — додається один інтервал
    sunday = MONDAY.replace(day=13)
    assert services.add_schedule(db, 1, MONDAY, sunday, [6], time(11), time(13)) == 1
