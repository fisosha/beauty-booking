"""Бізнес-логіка: пошук слотів, бронювання (BE-04), скасування (BE-05), графіки (BE-06)."""
import secrets
from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models
from app.config import SLOT_STEP_MIN
from app.slots import add_minutes, generate_free_slots, overlaps


def tx(db: Session):
    """Нова транзакція запису; попередня (лише читання) завершується."""
    if db.in_transaction():
        db.commit()
    return db.begin()


class NotFound(Exception):
    pass


class SlotUnavailable(Exception):
    pass


def get_service(db: Session, service_id: int) -> models.Service:
    service = db.get(models.Service, service_id)
    if service is None:
        raise NotFound("послугу не знайдено")
    return service


def work_intervals(db: Session, master_id: int, day: date) -> list[tuple[time, time]]:
    rows = db.scalars(select(models.TimeSlot).where(
        models.TimeSlot.master_id == master_id, models.TimeSlot.date == day)).all()
    return [(r.start_time, r.end_time) for r in rows]


def busy_intervals(db: Session, master_id: int, day: date) -> list[tuple[time, time]]:
    rows = db.scalars(select(models.Booking).where(
        models.Booking.master_id == master_id, models.Booking.date == day,
        models.Booking.status == "active")).all()
    return [(r.start_time, r.end_time) for r in rows]


def free_slots(db: Session, master_id: int, service_id: int, day: date,
               now: datetime | None = None) -> list[time]:
    service = get_service(db, service_id)
    if service.master_id != master_id:
        raise NotFound("у цього майстра немає такої послуги")
    return generate_free_slots(work_intervals(db, master_id, day), busy_intervals(db, master_id, day),
                               service.duration_min, SLOT_STEP_MIN, day, now or datetime.now())


def available_dates(db: Session, master_id: int, service_id: int, start: date, days: int,
                    now: datetime | None = None) -> list[date]:
    return [start + timedelta(days=i) for i in range(days)
            if free_slots(db, master_id, service_id, start + timedelta(days=i), now)]


def create_booking(db: Session, service_id: int, day: date, start: time,
                   client_name: str, client_phone: str, now: datetime | None = None) -> models.Booking:
    """Транзакційне бронювання: перевірка й вставка виконуються в одній транзакції
    з блокуванням на запис, тому той самий слот не можна зайняти двічі."""
    try:
        with tx(db):
            service = get_service(db, service_id)
            allowed = free_slots(db, service.master_id, service_id, day, now)
            if start not in allowed:
                raise SlotUnavailable("цей час уже зайнятий або недоступний")
            booking = models.Booking(
                master_id=service.master_id, service_id=service.id,
                client_name=client_name, client_phone=client_phone,
                date=day, start_time=start, end_time=add_minutes(start, service.duration_min),
                status="active", cancel_code=secrets.token_hex(4).upper())
            db.add(booking)
    except IntegrityError as e:  # спрацював унікальний індекс у БД
        raise SlotUnavailable("цей час уже зайнятий") from e
    return booking


def get_booking(db: Session, code: str) -> models.Booking:
    booking = db.scalar(select(models.Booking).where(models.Booking.cancel_code == code.upper()))
    if booking is None:
        raise NotFound("запис не знайдено")
    return booking


def cancel_booking(db: Session, code: str) -> models.Booking:
    with tx(db):
        booking = get_booking(db, code)
        booking.status = "cancelled"
    return booking


def add_schedule(db: Session, master_id: int, date_from: date, date_to: date,
                 weekdays: list[int], start: time, end: time) -> int:
    """Додає робочі інтервали майстру; пропускає дні, де інтервал перетинається з наявним."""
    created = 0
    with tx(db):
        if db.get(models.Master, master_id) is None:
            raise NotFound("майстра не знайдено")
        day = date_from
        while day <= date_to:
            if day.weekday() in weekdays and not any(
                    overlaps(start, end, s, e) for s, e in work_intervals(db, master_id, day)):
                db.add(models.TimeSlot(master_id=master_id, date=day, start_time=start, end_time=end))
                created += 1
            day += timedelta(days=1)
    return created
