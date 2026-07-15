import type { MetricKey, MetricMeta } from "@/types";

/** Single source of truth for metric metadata (shared by stats, render, UI). */
export const METRIC_META: Record<MetricKey, MetricMeta> = {
  reaction_time: { key: "reaction_time", label: "Reaction time", direction: "higher_is_better", description: "How quickly you respond in timed tasks." },
  attention: { key: "attention", label: "Attention", direction: "higher_is_better", description: "Sustained focus during short tasks." },
  working_memory: { key: "working_memory", label: "Working memory", direction: "higher_is_better", description: "Holding and using information briefly." },
  processing_speed: { key: "processing_speed", label: "Processing speed", direction: "higher_is_better", description: "How quickly you work through visual information accurately." },
  fatigue: { key: "fatigue", label: "Fatigue", direction: "lower_is_better", description: "How tired you've felt day to day." },
  mood: { key: "mood", label: "Mood", direction: "higher_is_better", description: "Your self-reported mood." },
  sleep_quality: { key: "sleep_quality", label: "Sleep quality", direction: "higher_is_better", description: "How restorative your sleep felt." },
  stress: { key: "stress", label: "Stress", direction: "lower_is_better", description: "Your self-reported stress level." },
  symptoms: { key: "symptoms", label: "Symptom load", direction: "lower_is_better", description: "How much symptoms have interfered with your day." },
};

export function metricLabel(key: MetricKey): string {
  return METRIC_META[key]?.label ?? key;
}
