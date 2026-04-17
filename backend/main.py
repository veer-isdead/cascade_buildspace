from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from backend.db import db
from backend.routes import auth, crisis, hubs, merchants, trucks

BASE_DIR = Path(__file__).resolve().parent.parent


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.connect()
    db.seed_initial_data()
    yield


app = FastAPI(
    title="Cascade GridLock API",
    description="AI-powered logistics congestion prevention platform for hackathon prototyping.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(hubs.router)
app.include_router(trucks.router)
app.include_router(merchants.router)
app.include_router(crisis.router)

app.mount("/html", StaticFiles(directory=BASE_DIR / "html"), name="html")
app.mount("/js", StaticFiles(directory=BASE_DIR / "js"), name="js")
app.mount("/css", StaticFiles(directory=BASE_DIR / "css"), name="css")
app.mount("/assets", StaticFiles(directory=BASE_DIR / "assets"), name="assets")


@app.get("/", tags=["Health"], summary="API heartbeat")
def root() -> RedirectResponse:
    return RedirectResponse(url="/html/index.html")
