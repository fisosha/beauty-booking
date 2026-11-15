"""Схема реляційної БД (BE-01): Masters, Services, TimeSlots, Bookings."""
from datetime import date, datetime, time

from sqlalchemy import (CheckConstraint, Date, DateTime, ForeignKey, Index, Integer,
                        Numeric, String, Time, text)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Master(Base):
    __tablename__ = "masters"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    specialization: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(20))

    services: Mapped[list["Service"]] = relationship(back_populates="master", cascade="all, delete-orphan")
    time_slots: Mapped[list["TimeSlot"]] = relationship(back_populates="master", cascade="all, delete-orphan")


class Service(Base):
    __tablename__ = "services"
    __table_args__ = (
        CheckConstraint("duration_min > 0", name="ck_service_duration"),
        CheckConstraint("price >= 0", name="ck_service_price"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    master_id: Mapped[int] = mapped_column(ForeignKey("masters.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    duration_min: Mapped[int] = mapped_column(Integer)
    price: Mapped[float] = mapped_column(Numeric(10, 2))

    master: Mapped[Master] = relationship(back_populates="services")


class TimeSlot(Base):
    """Робочий інтервал майстра в конкретний день (графік)."""
    __tablename__ = "time_slots"
    __table_args__ = (CheckConstraint("start_time < end_time", name="ck_slot_range"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    master_id: Mapped[int] = mapped_column(ForeignKey("masters.id", ondelete="CASCADE"))
    date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)

    master: Mapped[Master] = relationship(back_populates="time_slots")


Index("ix_time_slots_master_date", TimeSlot.master_id, TimeSlot.date)


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("start_time < end_time", name="ck_booking_range"),
        CheckConstraint("status IN ('active', 'cancelled')", name="ck_booking_status"),
        # Захист на рівні БД: два активні записи до майстра на той самий час неможливі.
        Index("ux_bookings_active_start", "master_id", "date", "start_time",
              unique=True, sqlite_where=text("status = 'active'"),
              postgresql_where=text("status = 'active'")),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    master_id: Mapped[int] = mapped_column(ForeignKey("masters.id"))
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"))
    client_name: Mapped[str] = mapped_column(String(100))
    client_phone: Mapped[str] = mapped_column(String(20))
    date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    status: Mapped[str] = mapped_column(String(10), default="active")
    cancel_code: Mapped[str] = mapped_column(String(16), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    service: Mapped[Service] = relationship()
    master: Mapped[Master] = relationship()
