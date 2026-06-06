"""Dynamic Time Warping for aligning two movement sequences of different
length/tempo, plus resampling helpers.
"""
from __future__ import annotations

import numpy as np


def resample(series: np.ndarray, n: int) -> np.ndarray:
    """Resample a 1-D series to exactly ``n`` samples via linear interpolation."""
    if series.size == n:
        return series.astype(np.float64)
    if series.size <= 1:
        return np.full(n, float(series[0]) if series.size else 0.0)
    x_old = np.linspace(0.0, 1.0, series.size)
    x_new = np.linspace(0.0, 1.0, n)
    return np.interp(x_new, x_old, series)


def zscore(matrix: np.ndarray, mean: np.ndarray, std: np.ndarray) -> np.ndarray:
    std_safe = np.where(std < 1e-6, 1.0, std)
    return (matrix - mean) / std_safe


def dtw(x: np.ndarray, y: np.ndarray) -> tuple[float, list[tuple[int, int]]]:
    """Multivariate DTW between sequences x (Tx, C) and y (Ty, C).

    Returns the normalized alignment distance and the warping path as a list of
    (i, j) index pairs. Uses squared-Euclidean local cost.
    """
    tx, ty = x.shape[0], y.shape[0]
    cost = np.full((tx + 1, ty + 1), np.inf)
    cost[0, 0] = 0.0

    # Precompute pairwise local distances.
    for i in range(1, tx + 1):
        xi = x[i - 1]
        diff = y - xi  # (Ty, C)
        d = np.sqrt(np.sum(diff * diff, axis=1))  # (Ty,)
        row_prev = cost[i - 1]
        row_cur = cost[i]
        for j in range(1, ty + 1):
            best = min(row_prev[j], row_cur[j - 1], row_prev[j - 1])
            row_cur[j] = d[j - 1] + best

    # Backtrack the optimal path.
    path: list[tuple[int, int]] = []
    i, j = tx, ty
    while i > 0 and j > 0:
        path.append((i - 1, j - 1))
        candidates = ((cost[i - 1, j], i - 1, j),
                      (cost[i, j - 1], i, j - 1),
                      (cost[i - 1, j - 1], i - 1, j - 1))
        _, i, j = min(candidates, key=lambda c: c[0])
    path.reverse()

    normalized = float(cost[tx, ty] / max(len(path), 1))
    return normalized, path
