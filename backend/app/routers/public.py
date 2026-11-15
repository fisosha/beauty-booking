"""Публічне API для клієнтів (BE-02, BE-03, BE-04, BE-05)."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import models, schemas, services
from app.database import get_db

router = APIRouter(prefix="/api", tags=["Клієнт"])


def booking_out(b: models.Booking) -> schemas.BookingOut:
    return schemas.BookingOut(
        id=b.id, master_id=b.master_id, service_id=b.service_id, service_name=b.service.name,
        master_name=b.master.name, client_name=b.client_name, date=b.date,
        start_time=b.start_time, end_time=b.end_time, status=b.status, cancel_code=b.cancel_code)


@router.get("/masters", response_model=list[schemas.MasterOut], summary="Список майстрів")
def list_masters(db: Session = Depends(get_db)):
    return db.scalars(select(models.Master).order_by(models.Master.id)).all()


@router.get("/masters/{master_id}", response_model=schemas.MasterWithServices,
            summary="Майстер разом із каталогом послуг")
def get_master(master_id: int, db: Session = Depends(get_db)):
    master = db.scalar(select(models.Master).options(selectinload(models.Master.services))
                       .where(models.Master.id == master_id))
    if master is None:
        raise HTTPException(404, "майстра не знайдено")
    return master


@router.get("/masters/{master_id}/services", response_model=list[schemas.ServiceOut],
            summary="Каталог послуг майстра з цінами")
def master_services(master_id: int, db: Session = Depends(get_db)):
    if db.get(models.Master, master_id) is None:
        raise HTTPException(404, "майстра не знайдено")
    return db.scalars(select(models.Service).where(models.Service.master_id == master_id)
                      .order_by(models.Service.id)).all()


@router.get("/masters/{master_id}/slots", response_model=schemas.SlotsOut,
            summary="Вільні слоти на дату для послуги")
def get_slots(master_id: int, date: date, service_id: int, db: Session = Depends(get_db)):
    try:
        slots = services.free_slots(db, master_id, service_id, date)
    except services.NotFound as e:
        raise HTTPException(404, str(e))
    service = db.get(models.Service, service_id)
    return schemas.SlotsOut(master_id=master_id, service_id=service_id, date=date,
                            duration_min=service.duration_min,
                            slots=[t.strftime("%H:%M") for t in slots])


@router.get("/masters/{master_id}/available-dates", response_model=schemas.AvailableDatesOut,
            summary="Дати, на які є хоча б один вільний слот")
def get_available_dates(master_id: int, service_id: int, start: date,
                        days: int = Query(14, ge=1, le=62), db: Session = Depends(get_db)):
    try:
        dates = services.available_dates(db, master_id, service_id, start, days)
    except services.NotFound as e:
        raise HTTPException(404, str(e))
    return schemas.AvailableDatesOut(master_id=master_id, service_id=service_id, dates=dates)


@router.post("/bookings", response_model=schemas.BookingOut, status_code=201,
             summary="Створити запис (бронювання слота)",
             responses={409: {"description": "Слот уже зайнятий"}, 404: {"description": "Послугу не знайдено"}})
def create_booking(data: schemas.BookingCreate, db: Session = Depends(get_db)):
    try:
        booking = services.create_booking(db, data.service_id, data.date, data.start_time,
                                          data.client_name, data.client_phone)
    except services.NotFound as e:
        raise HTTPException(404, str(e))
    except services.SlotUnavailable as e:
        raise HTTPException(409, str(e))
    return booking_out(booking)


@router.get("/bookings/{code}", response_model=schemas.BookingOut, summary="Перевірити запис за кодом")
def get_booking(code: str, db: Session = Depends(get_db)):
    try:
        return booking_out(services.get_booking(db, code))
    except services.NotFound as e:
        raise HTTPException(404, str(e))


@router.post("/bookings/{code}/cancel", response_model=schemas.BookingOut,
             summary="Скасувати запис за кодом")
def cancel_booking(code: str, db: Session = Depends(get_db)):
    try:
        return booking_out(services.cancel_booking(db, code))
    except services.NotFound as e:
        raise HTTPException(404, str(e))
