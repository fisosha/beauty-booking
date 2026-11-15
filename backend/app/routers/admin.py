"""Адміністративне API (BE-06): майстри, послуги, графіки. Потрібен заголовок X-Admin-Token."""
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas, services
from app.config import ADMIN_TOKEN
from app.database import get_db


def require_admin(x_admin_token: str = Header(...)):
    if x_admin_token != ADMIN_TOKEN:
        raise HTTPException(401, "невірний адмін-токен")


router = APIRouter(prefix="/api/admin", tags=["Адміністратор"], dependencies=[Depends(require_admin)])


@router.post("/masters", response_model=schemas.MasterOut, status_code=201, summary="Додати майстра")
def create_master(data: schemas.MasterCreate, db: Session = Depends(get_db)):
    with services.tx(db):
        master = models.Master(**data.model_dump())
        db.add(master)
    return master


@router.post("/services", response_model=schemas.ServiceOut, status_code=201, summary="Додати послугу")
def create_service(data: schemas.ServiceCreate, db: Session = Depends(get_db)):
    with services.tx(db):
        if db.get(models.Master, data.master_id) is None:
            raise HTTPException(404, "майстра не знайдено")
        service = models.Service(**data.model_dump())
        db.add(service)
    return service


@router.post("/schedule", response_model=schemas.ScheduleOut, status_code=201,
             summary="Задати графік майстра на діапазон дат")
def create_schedule(data: schemas.ScheduleCreate, db: Session = Depends(get_db)):
    try:
        n = services.add_schedule(db, data.master_id, data.date_from, data.date_to,
                                  data.weekdays, data.start_time, data.end_time)
    except services.NotFound as e:
        raise HTTPException(404, str(e))
    return schemas.ScheduleOut(created=n)
