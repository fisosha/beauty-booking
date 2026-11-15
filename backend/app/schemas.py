"""Pydantic-схеми запитів і відповідей API (з валідацією полів)."""
import re
from datetime import date, time

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

PHONE_RE = re.compile(r"^(\+?38)?0\d{9}$")


def normalize_phone(value: str) -> str:
    """Приводить український номер до формату +380XXXXXXXXX."""
    digits = re.sub(r"[\s\-()]", "", value)
    if not PHONE_RE.match(digits):
        raise ValueError("номер телефону має бути у форматі +380XXXXXXXXX або 0XXXXXXXXX")
    return "+38" + digits[-10:]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MasterOut(ORM):
    id: int
    name: str
    specialization: str


class ServiceOut(ORM):
    id: int
    master_id: int
    name: str
    duration_min: int
    price: float


class MasterWithServices(MasterOut):
    services: list[ServiceOut]


class SlotsOut(BaseModel):
    master_id: int
    service_id: int
    date: date
    duration_min: int
    slots: list[str] = Field(description="Час початку вільних слотів, HH:MM")


class AvailableDatesOut(BaseModel):
    master_id: int
    service_id: int
    dates: list[date]


class BookingCreate(BaseModel):
    service_id: int
    date: date
    start_time: time
    client_name: str = Field(min_length=2, max_length=100)
    client_phone: str

    @field_validator("client_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("ім'я занадто коротке")
        return v

    @field_validator("client_phone")
    @classmethod
    def check_phone(cls, v: str) -> str:
        return normalize_phone(v)


class BookingOut(ORM):
    id: int
    master_id: int
    service_id: int
    service_name: str
    master_name: str
    client_name: str
    date: date
    start_time: time
    end_time: time
    status: str
    cancel_code: str


# ---------- адмін ----------
class MasterCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    specialization: str = Field(min_length=2, max_length=100)
    phone: str | None = None

    @field_validator("phone")
    @classmethod
    def check_phone(cls, v):
        return normalize_phone(v) if v else v


class ServiceCreate(BaseModel):
    master_id: int
    name: str = Field(min_length=2, max_length=100)
    duration_min: int = Field(gt=0, le=480)
    price: float = Field(ge=0)


class ScheduleCreate(BaseModel):
    """Графік майстра: робочі години на діапазон дат у вибрані дні тижня."""
    master_id: int
    date_from: date
    date_to: date
    weekdays: list[int] = Field(default=[0, 1, 2, 3, 4], description="0 — понеділок … 6 — неділя")
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def check_ranges(self):
        if self.date_from > self.date_to:
            raise ValueError("date_from пізніше за date_to")
        if self.start_time >= self.end_time:
            raise ValueError("start_time має бути раніше за end_time")
        if any(d < 0 or d > 6 for d in self.weekdays):
            raise ValueError("weekdays: значення від 0 до 6")
        return self


class ScheduleOut(BaseModel):
    created: int
