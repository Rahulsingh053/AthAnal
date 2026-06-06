"""AI-powered coaching report generation via Claude API.

Generates a natural-language coaching narrative and targeted drill
recommendations from the structured comparison report data.
Falls back gracefully (returns None) if no API key is configured.
"""
from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _build_prompt(report_data: dict[str, Any], sport_name: str) -> str:
    summary = report_data.get("summary", {})
    joint_diffs = report_data.get("joint_differences", [])
    timing = report_data.get("timing", {})
    speed_analysis = report_data.get("speed_analysis")
    injury_risks = report_data.get("injury_risks", [])
    pro_comparison = report_data.get("pro_comparison", [])

    similarity = summary.get("similarity_score", 0)
    baseline_label = summary.get("baseline_label", "baseline")
    target_label = summary.get("target_label", "target")

    top_diffs = sorted(joint_diffs, key=lambda d: d.get("mean_abs_diff_deg", 0), reverse=True)[:4]
    diff_lines = "\n".join(
        f"  - {d['label']}: mean delta {d['mean_delta']:+.1f}°, "
        f"ROM delta {d['rom_delta']:+.1f}°, avg diff {d['mean_abs_diff_deg']:.1f}°"
        for d in top_diffs
    )

    metric = summary.get("metric")
    metric_str = ""
    if metric:
        metric_str = (
            f"Athlete-measured performance: {metric['baseline']} → {metric['target']} "
            f"{metric.get('unit', '')} (Δ {metric['delta']:+.2f}).\n"
        )

    speed_str = ""
    if speed_analysis and speed_analysis.get("estimated"):
        est = speed_analysis["estimated"]
        speed_str = (
            f"Estimated ball speed: {est['baseline_kph']} → {est['target_kph']} kph "
            f"(Δ {est['delta_kph']:+.1f} kph).\n"
        )

    risk_str = ""
    if injury_risks:
        risk_items = "; ".join(
            f"{r['label']} ({r['severity']} risk: {r['risk_label']})" for r in injury_risks[:3]
        )
        risk_str = f"Injury risk flags: {risk_items}.\n"

    pro_str = ""
    if pro_comparison:
        not_good = [p for p in pro_comparison if p["status"] != "good"][:3]
        if not_good:
            pro_str = "Gaps vs professional benchmark:\n" + "\n".join(
                f"  - {p['label']}: athlete {p['athlete_value']}° vs pro range "
                f"{p['pro_range_low']}–{p['pro_range_high']}° (gap {p['gap_deg']}°)"
                for p in not_good
            ) + "\n"

    tempo = timing.get("tempo_change_pct")
    tempo_str = f"Action tempo changed {tempo:+.1f}%.\n" if tempo is not None else ""

    return f"""You are an expert {sport_name} biomechanics coach reviewing a movement comparison between two performances.

Sport: {sport_name}
Movement similarity score: {similarity}%
Comparing '{baseline_label}' (baseline) vs '{target_label}' (target).

{metric_str}{speed_str}{tempo_str}
Top biomechanical changes:
{diff_lines}

{risk_str}{pro_str}
Please provide a JSON response with exactly these two keys:
1. "narrative": A 3-4 sentence coaching paragraph written as if by a real sports coach. Link the specific biomechanical numbers to athletic performance outcomes. Be direct, practical, and encouraging. Mention the most impactful change first.
2. "drills": An array of exactly 3 training drill objects. Each must have: "title" (short drill name), "description" (2 sentences: what to do + why it helps this athlete specifically), "focus_area" (the joint or pattern being trained), "difficulty" (one of: beginner / intermediate / advanced).

Respond with valid JSON only. No markdown, no preamble."""


def generate_coaching_report(
    report_data: dict[str, Any],
    sport_name: str,
    analyzer_key: str,
) -> dict[str, Any] | None:
    """Call Claude to generate a coaching narrative and drill recommendations.

    Returns a dict with 'narrative', 'drills', 'model' keys, or None if
    the API key is not configured or the call fails.
    """
    from app.core.config import settings

    api_key = settings.anthropic_api_key
    if not api_key:
        return None

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)
        prompt = _build_prompt(report_data, sport_name)

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1200,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = message.content[0].text.strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == 0:
            logger.warning("AI coaching: no JSON found in response")
            return None

        data = json.loads(raw[start:end])
        return {
            "narrative": str(data.get("narrative", "")),
            "drills": list(data.get("drills", [])),
            "model": "claude-haiku-4-5",
        }

    except Exception:
        logger.exception("AI coaching generation failed")
        return None
