"""Алгоритм генерації вільних слотів (BE-03).

Чиста функція без доступу до БД, тому її зручно покривати модульними тестами.
"""
from datetime import date, datetime, time, timedelta


def _minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _to_time(m: int) -> time:
    return time(m // 60, m % 60)


def overlaps(a_start: time, a_end: time, b_start: time, b_end: time) -> bool:
    """Чи перетинаються напіввідкриті інтервали [a_start, a_end) і [b_start, b_end)."""
    return a_start < b_end and b_start < a_end


def generate_free_slots(
    work_intervals: list[tuple[time, time]],
    busy_intervals: list[tuple[time, time]],
    duration_min: int,
    step_min: int = 15,
    day: date | None = None,
    now: datetime | None = None,
) -> list[time]:
    """Повертає список часів початку, на які можна записатися.

    work_intervals — робочі інтервали майстра в цей день;
    busy_intervals — інтервали вже активних записів;
    duration_min — тривалість послуги;
    step_min — крок сітки (слоти починаються з початку робочого інтервалу кожні step_min хвилин);
    day, now — якщо передано і day == now.date(), час у минулому відкидається.
    """
    if duration_min <= 0 or step_min <= 0:
        raise ValueError("тривалість і крок мають бути додатними")
    result: set[int] = set()
    min_start = None
    if day is not None and now is not None:
        if day < now.date():
            return []
        if day == now.date():
            min_start = now.hour * 60 + now.minute
    busy = [(_minutes(s), _minutes(e)) for s, e in busy_intervals]
    for w_start, w_end in work_intervals:
        start, end = _minutes(w_start), _minutes(w_end)
        m = start
        while m + duration_min <= end:
            if min_start is None or m >= min_start:
                if all(not (m < b_end and b_start < m + duration_min) for b_start, b_end in busy):
                    result.add(m)
            m += step_min
    return [_to_time(m) for m in sorted(result)]


def add_minutes(t: time, minutes: int) -> time:
    dt = datetime.combine(date(2000, 1, 1), t) + timedelta(minutes=minutes)
    if dt.date() != date(2000, 1, 1):
        raise ValueError("запис виходить за межі доби")
    return dt.time()
