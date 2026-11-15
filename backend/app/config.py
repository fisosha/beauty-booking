"""Налаштування застосунку (читаються зі змінних середовища)."""
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./booking.db")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "admin-secret")
SLOT_STEP_MIN = int(os.getenv("SLOT_STEP_MIN", "15"))  # крок сітки слотів, хв
