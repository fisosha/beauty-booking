"""Seed-скрипт (BE-06): створює таблиці й наповнює БД демо-даними.

Запуск: python seed.py  (графік — на 14 днів від сьогодні, пн–сб)
"""
from datetime import date, time, timedelta

from app import models, services
from app.database import Base, SessionLocal, engine

MASTERS = [
    ("Олена Коваль", "Манікюр", "+380671112233", [("Манікюр класичний", 60, 450), ("Покриття гель-лаком", 90, 650), ("Зняття покриття", 30, 150)]),
    ("Ірина Мельник", "Брови та вії", "+380502223344", [("Корекція брів", 30, 300), ("Фарбування брів", 45, 350), ("Ламінування вій", 60, 600)]),
    ("Марта Шевчук", "Перукар", "+380933334455", [("Жіноча стрижка", 60, 500), ("Укладка", 45, 400), ("Фарбування волосся", 120, 1400)]),
]


def seed(db=None, start: date | None = None, days: int = 14):
    db = db or SessionLocal()
    start = start or date.today()
    Base.metadata.drop_all(db.get_bind())
    Base.metadata.create_all(db.get_bind())
    with db.begin():
        for name, spec, phone, items in MASTERS:
            m = models.Master(name=name, specialization=spec, phone=phone)
            m.services = [models.Service(name=n, duration_min=d, price=p) for n, d, p in items]
            db.add(m)
    for master_id in (1, 2, 3):
        services.add_schedule(db, master_id, start, start + timedelta(days=days - 1),
                              [0, 1, 2, 3, 4, 5], time(10, 0), time(14, 0))
        services.add_schedule(db, master_id, start, start + timedelta(days=days - 1),
                              [0, 1, 2, 3, 4], time(15, 0), time(19, 0))
    return db


if __name__ == "__main__":
    seed()
    print("БД наповнено: 3 майстри, 9 послуг, графік на 14 днів")
