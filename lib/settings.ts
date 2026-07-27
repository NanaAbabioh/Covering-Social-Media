import "server-only";
import { supabase } from "./supabase";

export type ScoringWeights = {
  authority: number;
  cadence: number;
  longevity: number;
  engagement: number;
  website: number;
  description: number;
  relevance: number;
};

export type ScoringThresholds = {
  farm_uploads_per_week: number;
  good_uploads_per_week: number;
  min_channel_age_days: number;
};

export type AppConfig = {
  queue_cap: number;
  lookback_days: number;
  classifier_model: string;
  weights: ScoringWeights;
  thresholds: ScoringThresholds;
};

export const DEFAULT_CONFIG: AppConfig = {
  queue_cap: 15,
  lookback_days: 30,
  classifier_model: "claude-haiku-4-5",
  weights: {
    authority: 25,
    cadence: 10,
    longevity: 10,
    engagement: 15,
    website: 15,
    description: 10,
    relevance: 15,
  },
  thresholds: {
    farm_uploads_per_week: 5,
    good_uploads_per_week: 1.5,
    min_channel_age_days: 180,
  },
};

/** Read the single app_settings row, merged over defaults so missing keys are safe. */
export async function getConfig(): Promise<AppConfig> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("config")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return DEFAULT_CONFIG;

  const cfg = (data.config ?? {}) as Partial<AppConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...cfg,
    classifier_model: cfg.classifier_model || DEFAULT_CONFIG.classifier_model,
    weights: { ...DEFAULT_CONFIG.weights, ...(cfg.weights ?? {}) },
    thresholds: { ...DEFAULT_CONFIG.thresholds, ...(cfg.thresholds ?? {}) },
  };
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, config: config as unknown as import("./types").Json });
  if (error) throw new Error(`Failed to save settings: ${error.message}`);
}
