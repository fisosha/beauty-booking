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
| [`frontend/`](frontend/) | Клієнтська частина |

## Швидкий старт бекенду

```bash
cd backend
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload
```

API-документація (Swagger): http://127.0.0.1:8000/docs
