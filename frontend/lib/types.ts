export type ProcessingStatus = "pending" | "processing" | "completed" | "failed";

export interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface Sport {
  id: number;
  slug: string;
  name: string;
  description: string;
  analyzer_key: string;
  is_active: boolean;
}

export interface Video {
  id: number;
  owner_id: number;
  sport_id: number;
  label: string;
  notes: string;
  metric_value: number | null;
  metric_unit: string | null;
  original_filename: string;
  status: ProcessingStatus;
  error_message: string | null;
  analysis_progress: number;
  fps: number | null;
  frame_count: number | null;
  duration_seconds: number | null;
  analysis_summary: Record<string, unknown> | null;
  created_at: string;
  sport: Sport | null;
}

export interface JointDifference {
  channel: string;
  label: string;
  baseline_mean: number;
  target_mean: number;
  mean_delta: number;
  baseline_rom: number;
  target_rom: number;
  rom_delta: number;
  mean_abs_diff_deg: number;
}

export interface KeyEvent {
  name: string;
  label: string;
  frame: number;
  time: number | null;
  side: string;
  wrist_speed?: number;
}

export interface SpeedFactor {
  key: string;
  label: string;
  unit: string;
  baseline: number | null;
  target: number | null;
  change: number | null;
  effect: "increases" | "decreases" | "neutral";
  explanation: string;
}

export interface SpeedAnalysis {
  estimated: {
    baseline_kph: number;
    target_kph: number;
    delta_kph: number;
    confidence: number;
    note: string;
  } | null;
  factors: SpeedFactor[];
}

export interface Phase {
  name: string;
  label: string;
  start_frame: number;
  end_frame: number;
  start_pct: number;
  end_pct: number;
  color: string;
}

export interface InjuryRisk {
  joint: string;
  label: string;
  risk_label: string;
  severity: "high" | "medium" | "low";
  direction: "low" | "high";
  observed_angle: number;
  safe_threshold: number;
  deviation_deg: number;
  message: string;
}

export interface ProComparison {
  joint: string;
  label: string;
  athlete_value: number;
  optimal: number;
  pro_range_low: number;
  pro_range_high: number;
  status: "good" | "below" | "above";
  gap_deg: number;
  unit: string;
  note: string;
}

export interface AiDrill {
  title: string;
  description: string;
  focus_area: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

export interface AiCoaching {
  narrative: string;
  drills: AiDrill[];
  model: string;
}

export interface VideoAnalytics {
  id: number;
  label: string;
  created_at: string;
  metric_value: number | null;
  metric_unit: string | null;
  mean_angles: Record<string, number>;
  range_of_motion: Record<string, number>;
  sport: string | null;
  sport_id: number;
}

export interface ComparisonReport {
  summary: {
    similarity_score: number;
    headline: string;
    baseline_label: string;
    target_label: string;
    dominant_side: string;
    analyzer: string;
    metric: {
      baseline: number;
      target: number;
      unit: string | null;
      delta: number;
    } | null;
  };
  joint_differences: JointDifference[];
  timing: {
    baseline_duration_s: number;
    target_duration_s: number;
    tempo_change_pct: number | null;
  };
  key_events: {
    baseline: KeyEvent | null;
    target: KeyEvent | null;
  };
  insights: string[];
  angle_series: {
    points: number;
    timeline_pct: number[];
    channels: Record<string, { label: string; baseline: number[]; target: number[] }>;
  };
  speed_analysis?: SpeedAnalysis;
  phases?: { baseline: Phase[]; target: Phase[] };
  injury_risks?: InjuryRisk[];
  pro_comparison?: ProComparison[];
  ai_coaching?: AiCoaching;
}

export interface TryJobStatus {
  job_id: string;
  status: ProcessingStatus;
  progress: number;
  message: string;
  baseline_progress: number;
  target_progress: number;
  report: ComparisonReport | null;
  error: string | null;
}

export interface Comparison {
  id: number;
  owner_id: number;
  baseline_video_id: number;
  target_video_id: number;
  title: string;
  status: ProcessingStatus;
  error_message: string | null;
  report: ComparisonReport | null;
  created_at: string;
  baseline_video: Video | null;
  target_video: Video | null;
}
