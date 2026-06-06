"""Registry mapping analyzer keys (from the Sport model) to analyzer classes."""
from __future__ import annotations

from app.analysis.sports.base import BaseAnalyzer
from app.analysis.sports.bowling import BowlingAnalyzer

_ANALYZERS: dict[str, type[BaseAnalyzer]] = {
    BaseAnalyzer.key: BaseAnalyzer,
    BowlingAnalyzer.key: BowlingAnalyzer,
}


def get_analyzer(key: str | None) -> BaseAnalyzer:
    """Return an analyzer instance for the given key, falling back to generic."""
    cls = _ANALYZERS.get((key or "generic").lower(), BaseAnalyzer)
    return cls()


def available_analyzers() -> list[str]:
    return list(_ANALYZERS.keys())
