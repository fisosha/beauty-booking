"""Точка входу: FastAPI-застосунок онлайн-запису до майстрів."""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app.routers import admin, public



@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(engine)  # створити таблиці під час старту
    yield


app = FastAPI(
    lifespan=lifespan,
    docs_url=None,  # Swagger UI віддаємо з локальних файлів (див. /docs нижче)
    title="Beauty Booking API",
    version="1.0.0",
    description="Бекенд онлайн-запису до майстрів б'юті-сфери: каталог послуг, "
                "вільні слоти, бронювання без подвійного запису, скасування за кодом.",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")
app.include_router(public.router)
app.include_router(admin.router)


@app.get("/health", tags=["Службове"], summary="Перевірка роботи сервера")
def health():
    return {"status": "ok"}


@app.get("/docs", include_in_schema=False)
def swagger_ui():
    """API-документація (Swagger UI) без звернень до зовнішніх CDN."""
    return get_swagger_ui_html(openapi_url=app.openapi_url, title="Beauty Booking API — документація",
                               swagger_js_url="/static/swagger-ui-bundle.js",
                               swagger_css_url="/static/swagger-ui.css",
                               swagger_favicon_url="/static/favicon-32x32.png")
