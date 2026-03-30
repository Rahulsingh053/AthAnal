"""Sport catalog routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Sport
from app.schemas.sport import SportRead

router = APIRouter()


@router.get("", response_model=list[SportRead])
def list_sports(db: Session = Depends(get_db)) -> list[Sport]:
    return list(db.scalars(select(Sport).where(Sport.is_active).order_by(Sport.name)))
