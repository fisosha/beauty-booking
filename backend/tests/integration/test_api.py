"""Інтеграційні тести: HTTP-запити до API + реальна БД SQLite."""
from concurrent.futures import ThreadPoolExecutor

import pytest

from tests.conftest import MONDAY

pytestmark = pytest.mark.integration
D = MONDAY.isoformat()
ADMIN = {"X-Admin-Token": "admin-secret"}


def book(client, start="10:00", service_id=1, phone="0671234567"):
    return client.post("/api/bookings", json={"service_id": service_id, "date": D, "start_time": start,
                                              "client_name": "Анна", "client_phone": phone})


def test_list_masters(client):
    r = client.get("/api/masters")
    assert r.status_code == 200
    assert [m["name"] for m in r.json()] == ["Олена Коваль", "Ірина Мельник", "Марта Шевчук"]


def test_master_services_catalog_with_prices(client):
    r = client.get("/api/masters/1/services")
    assert r.status_code == 200
    assert {"name": "Манікюр класичний", "price": 450.0, "duration_min": 60}.items() <= r.json()[0].items()


def test_unknown_master_returns_404(client):
    assert client.get("/api/masters/999").status_code == 404


def test_slots_for_date(client):
    r = client.get(f"/api/masters/1/slots?date={D}&service_id=1")
    assert r.status_code == 200
    slots = r.json()["slots"]
    assert slots[0] == "10:00" and slots[-1] == "18:00" and "13:15" not in slots


def test_full_booking_scenario(client):
    r = book(client)
    assert r.status_code == 201
    code = r.json()["cancel_code"]
    assert "10:00" not in client.get(f"/api/masters/1/slots?date={D}&service_id=1").json()["slots"]
    assert client.get(f"/api/bookings/{code}").json()["status"] == "active"
    assert client.post(f"/api/bookings/{code}/cancel").json()["status"] == "cancelled"
    assert "10:00" in client.get(f"/api/masters/1/slots?date={D}&service_id=1").json()["slots"]


def test_double_booking_returns_409(client):
    assert book(client).status_code == 201
    r = book(client, phone="0501234567")
    assert r.status_code == 409


def test_invalid_phone_returns_422(client):
    assert book(client, phone="123").status_code == 422


def test_concurrent_booking_of_one_slot(client):
    """10 клієнтів одночасно бронюють той самий слот: успішний рівно один, сервер не падає."""
    with ThreadPoolExecutor(max_workers=10) as pool:
        codes = list(pool.map(lambda i: book(client, phone=f"06700000{i:02d}").status_code, range(10)))
    assert codes.count(201) == 1
    assert codes.count(409) == 9


def test_available_dates(client):
    r = client.get(f"/api/masters/1/available-dates?service_id=1&start={D}&days=7")
    assert r.status_code == 200
    assert len(r.json()["dates"]) == 6  # пн–сб робочі, неділя — ні


def test_admin_requires_token(client):
    r = client.post("/api/admin/masters", json={"name": "Тест", "specialization": "Тест"},
                    headers={"X-Admin-Token": "wrong"})
    assert r.status_code == 401


def test_admin_creates_master_service_and_schedule(client):
    m = client.post("/api/admin/masters", json={"name": "Нова Майстриня", "specialization": "Педикюр"},
                    headers=ADMIN).json()
    s = client.post("/api/admin/services", json={"master_id": m["id"], "name": "Педикюр",
                                                 "duration_min": 90, "price": 700}, headers=ADMIN).json()
    r = client.post("/api/admin/schedule", json={"master_id": m["id"], "date_from": D, "date_to": D,
                                                 "weekdays": [0], "start_time": "09:00", "end_time": "12:00"},
                    headers=ADMIN)
    assert r.json() == {"created": 1}
    slots = client.get(f"/api/masters/{m['id']}/slots?date={D}&service_id={s['id']}").json()["slots"]
    assert slots[0] == "09:00" and slots[-1] == "10:30"


def test_cancel_unknown_code_returns_404(client):
    assert client.post("/api/bookings/XXXXXXXX/cancel").status_code == 404
