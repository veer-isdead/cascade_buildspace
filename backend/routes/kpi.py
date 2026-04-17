from fastapi import APIRouter, Depends

from backend.db import DatabaseManager, get_db
from backend.services.analytics import build_kpi_snapshot


router = APIRouter(tags=["Analytics"])


@router.get("/kpi", summary="Get logistics KPIs")
def get_kpi(database: DatabaseManager = Depends(get_db)) -> dict:
    hubs = database.list_documents("hubs")
    shipments = database.list_documents("shipments")
    return build_kpi_snapshot(hubs, shipments)
