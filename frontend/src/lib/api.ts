const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7860';

export interface RunSummary {
  id: string;
  created_at: string;
  pipeline_version: string;
  average_faithfulness: number;
  average_relevance: number;
  average_clarity: number;
  average_similarity: number;
  sample_count: number;
}

export interface Sample {
  id: string;
  run_id: string;
  question: string;
  retrieved_context: string;
  model_output: string;
  ground_truth?: string;
  faithfulness_score: number;
  faithfulness_reason: string;
  relevance_score: number;
  relevance_reason: string;
  clarity_score: number;
  clarity_reason: string;
  semantic_similarity: number;
}

export interface RunDetails extends RunSummary {
  samples: Sample[];
}

export interface ComparisonMetric {
  total_compared: number;
  improved: number;
  degraded: number;
  unchanged: number;
}

export interface VersionSummary {
  version: string;
  run_id: string;
  average_faithfulness: number;
  average_relevance: number;
  average_clarity: number;
  average_similarity: number;
}

export interface ComparisonItem {
  question: string;
  v1_run_id: string;
  v2_run_id: string;
  v1_output: string;
  v2_output: string;
  v1_scores: {
    faithfulness: number;
    relevance: number;
    clarity: number;
    similarity: number;
  };
  v2_scores: {
    faithfulness: number;
    relevance: number;
    clarity: number;
    similarity: number;
  };
  diff: {
    faithfulness: number;
    relevance: number;
    clarity: number;
    similarity: number;
  };
  status: 'improved' | 'degraded' | 'unchanged';
}

export interface ComparisonReport {
  v1_summary: VersionSummary;
  v2_summary: VersionSummary;
  metrics: ComparisonMetric;
  comparisons: ComparisonItem[];
}

export interface QuotaUsage {
  live_api_calls: number;
  cached_hits: number;
  total_cached_records: number;
}

export interface HealthStatus {
  status: string;
  version: string;
  judge_provider: string;
  database_path: string;
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
  if (!res.ok) throw new Error('API server is offline');
  return res.json();
}

export async function fetchRuns(): Promise<RunSummary[]> {
  const res = await fetch(`${API_BASE}/runs`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch runs');
  return res.json();
}

export async function fetchRunDetails(runId: string): Promise<RunDetails> {
  const res = await fetch(`${API_BASE}/runs/${runId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch run details for ${runId}`);
  return res.json();
}

export async function compareVersions(v1: string, v2: string): Promise<ComparisonReport> {
  const res = await fetch(`${API_BASE}/compare?v1=${encodeURIComponent(v1)}&v2=${encodeURIComponent(v2)}`, { cache: 'no-store' });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || 'Failed to compare versions');
  }
  return res.json();
}

export async function fetchQuotaUsage(): Promise<QuotaUsage> {
  const res = await fetch(`${API_BASE}/quota-usage`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch quota usage');
  return res.json();
}

export async function runEvaluation(pipelineVersion: string, samples: Omit<Sample, 'id' | 'run_id' | 'faithfulness_score' | 'faithfulness_reason' | 'relevance_score' | 'relevance_reason' | 'clarity_score' | 'clarity_reason' | 'semantic_similarity'>[], provider?: string): Promise<{ run_id: string; pipeline_version: string; sample_count: number; message: string }> {
  const res = await fetch(`${API_BASE}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: jsonStringify({
      pipeline_version: pipelineVersion,
      samples,
      provider
    })
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || 'Failed to trigger evaluation');
  }
  return res.json();
}

// Simple helper to avoid TS issues
function jsonStringify(obj: any): string {
  return JSON.stringify(obj);
}
