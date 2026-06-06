"""Aggregate API router."""
from fastapi import APIRouter

from app.api.routes import auth, comparisons, public, sports, videos

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(sports.router, prefix="/sports", tags=["sports"])
api_router.include_router(videos.router, prefix="/videos", tags=["videos"])
api_router.include_router(comparisons.router, prefix="/comparisons", tags=["comparisons"])
api_router.include_router(public.router, prefix="/public", tags=["public"])
