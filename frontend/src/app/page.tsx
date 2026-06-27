'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchRuns, fetchQuotaUsage, runEvaluation, RunSummary, QuotaUsage } from '@/lib/api';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Loader2, 
  Layers, 
  Cpu, 
  Database, 
  ChevronRight, 
  PlusCircle, 
  CheckCircle,
  AlertTriangle,
  Play
} from 'lucide-react';

export default function Dashboard() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [quota, setQuota] = useState<QuotaUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  // Evaluation Run Trigger Form
  const [evaluating, setEvaluating] = useState(false);
  const [evalVersion, setEvalVersion] = useState('v1.3.0');
  const [selectedDataset, setSelectedDataset] = useState('clearance');
  const [evalMessage, setEvalMessage] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [runsData, quotaData] = await Promise.all([fetchRuns(), fetchQuotaUsage()]);
      setRuns(runsData);
      setQuota(quotaData);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTriggerEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    setEvaluating(true);
    setEvalMessage('');
    
    // Construct sample data to evaluate. We'll use clearance QA sample.
    // This matches the seed cache key, so it will hit the cache instantly.
    const samplesToEvaluate = [
      {
        question: "What is the return policy for items purchased during the annual clearance sale?",
        retrieved_context: "Standard items can be returned within 30 days of purchase for a full refund. Clearance items sold with a red tag are final sale and cannot be returned or exchanged. Clearance items with a yellow tag can be returned for store credit only within 14 days.",
        model_output: "Under our annual clearance sale policy, return options depend on the item's tag color:\n1. **Red Tag Items**: These are final sale and cannot be returned or exchanged.\n2. **Yellow Tag Items**: These can be returned within 14 days of purchase for store credit only.\nFor standard non-clearance items, our regular 30-day full refund policy applies."
      }
    ];

    try {
      const response = await runEvaluation(evalVersion, samplesToEvaluate);
      setEvalMessage(`Success! Run ${response.run_id} created.`);
      // Reload runs & quota usage
      await loadData();
    } catch (err: any) {
      setEvalMessage(`Error: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  // Format runs data for charts
  // Recharts needs chronologically ascending order to plot line trends correctly
  const chartData = [...runs]
    .reverse()
    .map(r => ({
      name: r.pipeline_version,
      Faithfulness: r.average_faithfulness,
      Relevance: r.average_relevance,
      Clarity: r.average_clarity,
      Similarity: r.average_similarity * 5 // Scale similarity to 5 for comparison
    }));

  if (loading && runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-2" />
        <p className="text-slate-400 text-sm">Loading dashboard analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="md:flex md:items-center md:justify-between border-b border-slate-900 pb-5">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-extrabold text-slate-100 sm:truncate">Evaluation Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Monitor Faithfulness, Relevance, and Clarity scores across RAG pipeline runs.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Runs Widget */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-500">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">Evaluation Runs</span>
            <span className="text-3xl font-bold text-slate-50">{runs.length}</span>
          </div>
        </div>

        {/* API Cache Hit Widget */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500">
            <Database className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider block">Database cache</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-50">
                {quota ? quota.total_cached_records : 0}
              </span>
              <span className="text-xs text-slate-400">records</span>
            </div>
          </div>
        </div>

        {/* Quota Usage Widget */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-cyan-500/10 rounded-lg text-cyan-500">
            <Cpu className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider block">API Quota Spent</span>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-slate-200 font-semibold">{quota ? quota.live_api_calls : 0} calls</span>
              <span className="text-emerald-400 font-medium">({quota ? quota.cached_hits : 0} hits cached)</span>
            </div>
            {/* Simple progress bar */}
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                style={{ 
                  width: quota ? `${Math.min(100, (quota.live_api_calls / (quota.live_api_calls + quota.cached_hits || 1)) * 100)}%` : '0%' 
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Chart and Run Trigger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Analytics Trend Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-50 mb-4">Pipeline Performance Trends</h2>
          <div className="h-80 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis domain={[0, 5]} stroke="#94a3b8" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                    labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Line type="monotone" dataKey="Faithfulness" stroke="#6366f1" strokeWidth={2.5} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Relevance" stroke="#06b6d4" strokeWidth={2.5} />
                  <Line type="monotone" dataKey="Clarity" stroke="#10b981" strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                No historical chart data available.
              </div>
            )}
          </div>
        </div>

        {/* Trigger Evaluation Demo Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-50 mb-2 flex items-center gap-1.5">
              <Play className="h-5 w-5 text-indigo-500 fill-indigo-500/20" />
              <span>Trigger Test Run</span>
            </h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Launch an evaluation against a pipeline version. To protect your Gemini API quota, 
              evaluating seeded queries hits the database cache instantly and incurs <strong>zero cost</strong>.
            </p>

            <form onSubmit={handleTriggerEvaluation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Pipeline Version
                </label>
                <input 
                  type="text" 
                  value={evalVersion}
                  onChange={(e) => setEvalVersion(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="e.g. v1.3.0"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Sample Prompt/Context
                </label>
                <select
                  value={selectedDataset}
                  onChange={(e) => setSelectedDataset(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="clearance">Clearance Return Policy FAQ (Seeded Cache)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={evaluating}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-slate-50 font-semibold py-2 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                {evaluating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Evaluating...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="h-4 w-4" />
                    <span>Run Cache Evaluation</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {evalMessage && (
            <div className={`mt-4 p-3 rounded-lg text-xs flex items-center gap-2 border ${
              evalMessage.startsWith('Success') 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span className="font-medium">{evalMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Historical Evaluation Runs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <h2 className="text-lg font-bold text-slate-50">Evaluation Runs</h2>
          <span className="text-xs font-medium text-slate-400 font-mono">
            {runs.length} Runs Recorded
          </span>
        </div>
        <div className="overflow-x-auto">
          {runs.length > 0 ? (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 font-semibold uppercase bg-slate-950/40">
                  <th className="py-3 px-6">Pipeline Version</th>
                  <th className="py-3 px-4">Created At</th>
                  <th className="py-3 px-4 text-center">Faithfulness</th>
                  <th className="py-3 px-4 text-center">Relevance</th>
                  <th className="py-3 px-4 text-center">Clarity</th>
                  <th className="py-3 px-4 text-center">Sim. (QA)</th>
                  <th className="py-3 px-4 text-center">Samples</th>
                  <th className="py-3 px-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-200 font-mono">
                      {run.pipeline_version}
                    </td>
                    <td className="py-4 px-4 text-slate-400 text-xs">
                      {run.created_at}
                    </td>
                    <td className="py-4 px-4 text-center font-mono">
                      <span className={`inline-block px-2 py-0.5 rounded font-bold ${
                        run.average_faithfulness >= 4 ? 'text-emerald-400' : run.average_faithfulness >= 3 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {run.average_faithfulness.toFixed(2)}/5
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center font-mono">
                      <span className={`inline-block px-2 py-0.5 rounded font-bold ${
                        run.average_relevance >= 4 ? 'text-emerald-400' : run.average_relevance >= 3 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {run.average_relevance.toFixed(2)}/5
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center font-mono">
                      <span className={`inline-block px-2 py-0.5 rounded font-bold ${
                        run.average_clarity >= 4 ? 'text-emerald-400' : run.average_clarity >= 3 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {run.average_clarity.toFixed(2)}/5
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center text-slate-300 font-mono">
                      {(run.average_similarity * 100).toFixed(1)}%
                    </td>
                    <td className="py-4 px-4 text-center text-slate-400">
                      {run.sample_count}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Link 
                        href={`/runs/${run.id}`} 
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 hover:underline"
                      >
                        <span>View Details</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12 text-slate-500 text-sm">
              No evaluation runs found. Add a version and run an evaluation to start.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
