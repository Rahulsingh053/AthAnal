"""ORM models. Importing this module registers all tables on the metadata."""
from app.models.comparison import Comparison
from app.models.enums import ProcessingStatus
from app.models.sport import Sport
from app.models.user import User
from app.models.video import Video

__all__ = ["User", "Sport", "Video", "Comparison", "ProcessingStatus"]
