from fastapi import APIRouter

from app.api.v1.routes import auth, changes, health, hosted_zones, records

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(hosted_zones.router, prefix="/hostedzones", tags=["hosted-zones"])
api_router.include_router(
    records.router, prefix="/hostedzones/{zone_id}/records", tags=["records"]
)
api_router.include_router(changes.router, prefix="/changes", tags=["changes"])
