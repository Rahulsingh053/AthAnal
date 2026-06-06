"""Small shared utilities."""
from __future__ import annotations

import math
from typing import Any

import numpy as np


def to_jsonable(obj: Any) -> Any:
    """Recursively convert numpy types / NaNs into JSON-serializable values."""
    if isinstance(obj, dict):
        return {k: to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_jsonable(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return [to_jsonable(v) for v in obj.tolist()]
    if isinstance(obj, np.generic):
        return to_jsonable(obj.item())
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
    return obj
