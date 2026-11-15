# Back-end: Beauty Booking API

Python 3.11+ · FastAPI · SQLAlchemy · SQLite (PostgreSQL — через `DATABASE_URL`)

## Запуск

```bash
pip install -r requirements.txt
python seed.py                      # створити БД і наповнити демо-даними (сервер має бути зупинений!)
uvicorn app.main:app --reload       # http://127.0.0.1:8000
```

API-документація (Swagger): http://127.0.0.1:8000/docs

## Тести

```bash
pytest tests/unit -v                # 31 модульний тест
pytest tests/integration -v         # 12 інтеграційних тестів
pytest --cov=app                    # покриття коду
```

## Ендпоінти для фронтенду

| Метод | Шлях | Що робить |
|---|---|---|
| GET | /api/masters | список майстрів |
| GET | /api/masters/{id} | майстер + послуги |
| GET | /api/masters/{id}/services | каталог послуг із цінами |
| GET | /api/masters/{id}/available-dates?service_id=&start=YYYY-MM-DD&days=14 | дні з вільними слотами (для календаря) |
| GET | /api/masters/{id}/slots?date=YYYY-MM-DD&service_id= | вільні слоти на день |
| POST | /api/bookings | створити запис → 201 + `cancel_code`; 409 якщо час зайнятий; 422 якщо невірні дані |
| GET | /api/bookings/{code} | перевірити запис за кодом |
| POST | /api/bookings/{code}/cancel | скасувати запис |

Адмін-API (`/api/admin/masters`, `/api/admin/services`, `/api/admin/schedule`) потребує заголовок
`X-Admin-Token` (за замовчуванням `admin-secret`, змінюється через змінну `ADMIN_TOKEN`).
