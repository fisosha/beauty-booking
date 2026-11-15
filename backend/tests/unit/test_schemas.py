"""Модульні тести валідації вхідних даних."""
from datetime import date, time

import pytest
from pydantic import ValidationError

from app.schemas import BookingCreate, ScheduleCreate, ServiceCreate, normalize_phone


def booking(**kw):
    data = dict(service_id=1, date=date(2030, 1, 7), start_time=time(10, 0),
                client_name="Анна", client_phone="0671234567")
    data.update(kw)
    return BookingCreate(**data)


def test_phone_local_format_is_normalized():
    assert normalize_phone("0671234567") == "+380671234567"


def test_phone_with_spaces_and_dashes_is_normalized():
    assert normalize_phone("+38 (067) 123-45-67") == "+380671234567"


@pytest.mark.parametrize("bad", ["12345", "+1 202 555 0100", "06712345678", "abc"])
def test_invalid_phone_is_rejected(bad):
    with pytest.raises(ValidationError):
        booking(client_phone=bad)


def test_too_short_client_name_is_rejected():
    with pytest.raises(ValidationError):
        booking(client_name=" А ")


def test_schedule_date_range_must_be_valid():
    with pytest.raises(ValidationError):
        ScheduleCreate(master_id=1, date_from=date(2030, 1, 10), date_to=date(2030, 1, 7),
                       start_time=time(10), end_time=time(18))


def test_schedule_weekday_out_of_range_is_rejected():
    with pytest.raises(ValidationError):
        ScheduleCreate(master_id=1, date_from=date(2030, 1, 7), date_to=date(2030, 1, 8),
                       weekdays=[7], start_time=time(10), end_time=time(18))


def test_service_negative_price_is_rejected():
    with pytest.raises(ValidationError):
        ServiceCreate(master_id=1, name="Манікюр", duration_min=60, price=-1)
