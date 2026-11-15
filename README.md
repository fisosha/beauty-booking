# Beauty Booking

Веб-застосунок онлайн-запису до майстрів б'юті-сфери: каталог послуг, календар вільних слотів,
бронювання без подвійного запису, скасування за кодом.

Командний проєкт з дисципліни «Інформаційні технології».

## Команда

| Учасниця | Роль |
|---|---|
| Шаламай Софія | Back-end Developer |
| Суховерська Наталія | Front-end Developer |
| Редько Юлія | QA Engineer |
| Захарова Надія | Product Manager |
| Весна-Ізбаш Дарія | Project Manager |

## Структура репозиторію

| Папка | Вміст |
|---|---|
| [`backend/`](backend/) | REST API (Python, FastAPI, SQLite), тести, діаграми UML, журнали тестування |
| [`frontend/`](frontend/) | Клієнтська частина (HTML, CSS, JavaScript без збірки), модульні тести |

## Швидкий старт бекенду

```bash
cd backend
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload
```

API-документація (Swagger): http://127.0.0.1:8000/docs

## Швидкий старт фронтенду

```bash
cd frontend
python -m http.server 5173
```

Відкрити http://127.0.0.1:5173. Якщо бекенд не запущено, фронт працює в демо-режимі —
деталі у [`frontend/README.md`](frontend/README.md).
