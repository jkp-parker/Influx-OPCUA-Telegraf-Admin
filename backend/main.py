from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from database import engine, Base
import models  # noqa: F401 — ensures all models are registered
from routers import system, devices, scan_classes, influxdb_config, metrics, telegraf

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="OPC UA Telegraf Admin",
    version="1.0.0",
    description="Web administration portal for managing OPC UA → Telegraf → InfluxDB pipelines",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(system.router, prefix="/api")
app.include_router(devices.router, prefix="/api")
app.include_router(scan_classes.router, prefix="/api")
app.include_router(influxdb_config.router, prefix="/api")
app.include_router(metrics.router, prefix="/api")
app.include_router(telegraf.router, prefix="/api")

# Serve built React frontend from /app/static
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        index = os.path.join(STATIC_DIR, "index.html")
        return FileResponse(index)
