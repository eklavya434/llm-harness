'use client';

import React, { useEffect, useState } from 'react';
import { fetchRuns, compareVersions, ComparisonReport, RunSummary, ComparisonItem } from '@/lib/api';
import { 
  Loader2, 
  GitCompare, 
  AlertTriangle, 
  ArrowRight, 
  CheckCircle2, 
  TrendingDown, 
  X, 
  ChevronRight,
  TrendingUp,
  Minus
} from 'lucide-react';

export default function ComparePage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState('');
  
  // Versions state
  const [v1, setV1] = useState('');
  const [v2, setV2] = useState('');
  const [report, setReport] = useState<ComparisonReport | null>(null);

  // Selected comparison item modal
  const [selectedComp, setSelectedComp] = useState<ComparisonItem | null>(null);

  useEffect(() => {
    async function loadVersions() {
      try {
        setLoadingRuns(true);
        const data = await fetchRuns();
        setRuns(data);
        
        // Pre-populate dropdowns if runs are available
        if (data.length >= 2) {
          // Put older first (v1.0.0 is usually last in DESC order, i.e., at the end)
          const versions = Array.from(new Set(data.map(r => r.pipeline_version)));
          if (versions.length >= 2) {
            setV1(versions[versions.length - 1]); // e.g. v1.0.0
            setV2(versions[0]); // e.g. v1.2.0
          }
        }
      } catch (err: any) {
        setError('Failed to fetch pipeline versions');
      } finally {
        setLoadingRuns(false);
      }
    }
    loadVersions();
  }, []);

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v1 || !v2) return;
    
    setComparing(true);
    setError('');
    setReport(null);

    try {
      const data = await compareVersions(v1, v2);
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Failed to compare versions');
    } finally {
      setComparing(false);
    }
  };

  const getScoreDiffClass = (diff: number) => {
    if (diff > 0) return 'text-emerald-450 font-bold';
    if (diff < 0) return 'text-red-450 font-bold';
    return 'text-slate-400';
  };

  const formatDiff = (diff: number) => {
    if (diff > 0) return `+${diff}`;
    return diff.toString();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-900 pb-5">
        <h1 className="text-3xl font-extrabold text-slate-100 flex items-center gap-2">
          <GitCompare className="h-8 w-8 text-indigo-500" />
          <span>Regression Analysis</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Compare two RAG pipeline versions side-by-side to track quality improvements and identify regression bugs.
        </p>
      </div>

      {/* Version Selector Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <form onSubmit={handleCompare} className="flex flex-col sm:flex-row items-end gap-6">
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-slate-350 uppercase tracking-wider mb-2">
              Base Version (v1 / Older)
            </label>
            <select
              value={v1}
              onChange={(e) => setV1(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            >
              <option value="">Select version...</option>
              {Array.from(new Set(runs.map(r => r.pipeline_version))).map((version) => (
                <option key={`v1-${version}`} value={version}>{version}</option>
              ))}
            </select>
          </div>

          <div className="hidden sm:block pb-2">
            <ArrowRight className="h-5 w-5 text-slate-500" />
          </div>

          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-slate-350 uppercase tracking-wider mb-2">
              Target Version (v2 / Newer)
            </label>
            <select
              value={v2}
              onChange={(e) => setV2(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            >
              <option value="">Select version...</option>
              {Array.from(new Set(runs.map(r => r.pipeline_version)))
                .filter(version => version !== v1)
                .map((version) => (
                  <option key={`v2-${version}`} value={version}>{version}</option>
                ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={comparing || !v1 || !v2}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-slate-50 font-semibold py-2.5 px-6 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {comparing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Comparing...</span>
              </>
            ) : (
              <>
                <GitCompare className="h-4 w-4" />
                <span>Compare Versions</span>
              </>
            )}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Comparison Results */}
      {report && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Comparison Metrics Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm text-center">
              <span className="text-xs text-slate-450 block mb-1 uppercase tracking-wider">Total Compared</span>
              <span className="text-3xl font-extrabold text-slate-100 font-mono">{report.metrics.total_compared}</span>
            </div>
            
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 shadow-sm text-center">
              <span className="text-xs text-emerald-450 block mb-1 uppercase tracking-wider flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Improved</span>
              </span>
              <span className="text-3xl font-extrabold text-emerald-400 font-mono">{report.metrics.improved}</span>
            </div>

            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 shadow-sm text-center">
              <span className="text-xs text-red-450 block mb-1 uppercase tracking-wider flex items-center justify-center gap-1">
                <TrendingDown className="h-3.5 w-3.5" />
                <span>Regressed</span>
              </span>
              <span className="text-3xl font-extrabold text-red-400 font-mono">{report.metrics.degraded}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm text-center">
              <span className="text-xs text-slate-450 block mb-1 uppercase tracking-wider flex items-center justify-center gap-1">
                <Minus className="h-3.5 w-3.5 text-slate-500" />
                <span>Unchanged</span>
              </span>
              <span className="text-3xl font-extrabold text-slate-350 font-mono">{report.metrics.unchanged}</span>
            </div>
          </div>

          {/* Aggregates Comparison Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
              <h2 className="text-lg font-bold text-slate-50">Score Delta Averages</h2>
            </div>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 font-semibold uppercase bg-slate-950/40">
                  <th className="py-3 px-6">Evaluation Category</th>
                  <th className="py-3 px-4 text-center font-mono">{report.v1_summary.version}</th>
                  <th className="py-3 px-4 text-center font-mono">{report.v2_summary.version}</th>
                  <th className="py-3 px-6 text-center">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {/* Faithfulness Row */}
                <tr className="hover:bg-slate-800/20">
                  <td className="py-4 px-6 text-slate-200 font-sans font-medium">Faithfulness (1-5)</td>
                  <td className="py-4 px-4 text-center text-slate-350">{report.v1_summary.average_faithfulness}</td>
                  <td className="py-4 px-4 text-center text-slate-100">{report.v2_summary.average_faithfulness}</td>
                  <td className={`py-4 px-6 text-center ${getScoreDiffClass(report.v2_summary.average_faithfulness - report.v1_summary.average_faithfulness)}`}>
                    {formatDiff(parseFloat((report.v2_summary.average_faithfulness - report.v1_summary.average_faithfulness).toFixed(2)))}
                  </td>
                </tr>
                {/* Relevance Row */}
                <tr className="hover:bg-slate-800/20">
                  <td className="py-4 px-6 text-slate-200 font-sans font-medium">Relevance (1-5)</td>
                  <td className="py-4 px-4 text-center text-slate-350">{report.v1_summary.average_relevance}</td>
                  <td className="py-4 px-4 text-center text-slate-100">{report.v2_summary.average_relevance}</td>
                  <td className={`py-4 px-6 text-center ${getScoreDiffClass(report.v2_summary.average_relevance - report.v1_summary.average_relevance)}`}>
                    {formatDiff(parseFloat((report.v2_summary.average_relevance - report.v1_summary.average_relevance).toFixed(2)))}
                  </td>
                </tr>
                {/* Clarity Row */}
                <tr className="hover:bg-slate-800/20">
                  <td className="py-4 px-6 text-slate-200 font-sans font-medium">Clarity (1-5)</td>
                  <td className="py-4 px-4 text-center text-slate-350">{report.v1_summary.average_clarity}</td>
                  <td className="py-4 px-4 text-center text-slate-100">{report.v2_summary.average_clarity}</td>
                  <td className={`py-4 px-6 text-center ${getScoreDiffClass(report.v2_summary.average_clarity - report.v1_summary.average_clarity)}`}>
                    {formatDiff(parseFloat((report.v2_summary.average_clarity - report.v1_summary.average_clarity).toFixed(2)))}
                  </td>
                </tr>
                {/* Semantic Similarity Row */}
                <tr className="hover:bg-slate-800/20">
                  <td className="py-4 px-6 text-slate-200 font-sans font-medium">QA Similarity (%)</td>
                  <td className="py-4 px-4 text-center text-slate-350">{(report.v1_summary.average_similarity * 100).toFixed(1)}%</td>
                  <td className="py-4 px-4 text-center text-slate-100">{(report.v2_summary.average_similarity * 100).toFixed(1)}%</td>
                  <td className={`py-4 px-6 text-center ${getScoreDiffClass(report.v2_summary.average_similarity - report.v1_summary.average_similarity)}`}>
                    {formatDiff(parseFloat(((report.v2_summary.average_similarity - report.v1_summary.average_similarity) * 100).toFixed(1)))}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Sample Comparisons */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
              <h2 className="text-lg font-bold text-slate-50">Detailed Query Diffs</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400 font-semibold uppercase bg-slate-950/40">
                    <th className="py-3 px-6 w-1/2">Question</th>
                    <th className="py-3 px-4 text-center">Faithfulness</th>
                    <th className="py-3 px-4 text-center">Relevance</th>
                    <th className="py-3 px-4 text-center">Clarity</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {report.comparisons.map((comp, idx) => (
                    <tr 
                      key={`comp-${idx}`}
                      onClick={() => setSelectedComp(comp)}
                      className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-6 text-slate-200 font-medium max-w-xs truncate">
                        {comp.question}
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-xs">
                        <span className="text-slate-400">{comp.v1_scores.faithfulness}</span>
                        <span className="mx-1 text-slate-650">→</span>
                        <span className="text-slate-100 font-semibold">{comp.v2_scores.faithfulness}</span>
                        <span className={`ml-1.5 font-bold ${getScoreDiffClass(comp.diff.faithfulness)}`}>
                          ({formatDiff(comp.diff.faithfulness)})
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-xs">
                        <span className="text-slate-400">{comp.v1_scores.relevance}</span>
                        <span className="mx-1 text-slate-650">→</span>
                        <span className="text-slate-100 font-semibold">{comp.v2_scores.relevance}</span>
                        <span className={`ml-1.5 font-bold ${getScoreDiffClass(comp.diff.relevance)}`}>
                          ({formatDiff(comp.diff.relevance)})
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-xs">
                        <span className="text-slate-400">{comp.v1_scores.clarity}</span>
                        <span className="mx-1 text-slate-650">→</span>
                        <span className="text-slate-100 font-semibold">{comp.v2_scores.clarity}</span>
                        <span className={`ml-1.5 font-bold ${getScoreDiffClass(comp.diff.clarity)}`}>
                          ({formatDiff(comp.diff.clarity)})
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide border ${
                          comp.status === 'improved' 
                            ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/25' 
                            : comp.status === 'degraded'
                            ? 'bg-red-500/10 text-red-450 border-red-500/25'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {comp.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1">
                          <span>Compare</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-side Response Comparison Modal */}
      {selectedComp && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/20">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-indigo-500" />
                <span>Side-by-Side Output Comparison</span>
              </h3>
              <button 
                onClick={() => setSelectedComp(null)}
                className="p-1.5 bg-slate-950 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Question */}
              <div>
                <span className="text-xs text-indigo-400 font-mono font-semibold uppercase tracking-wider block mb-1">
                  Evaluated Question
                </span>
                <div className="bg-slate-950 p-4 border border-slate-800 rounded-lg text-sm text-slate-250">
                  {selectedComp.question}
                </div>
              </div>

              {/* Side by side outputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Version 1 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-mono font-semibold uppercase tracking-wider">
                      Version: {v1} Output
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Run: {selectedComp.v1_run_id}</span>
                  </div>
                  <div className="bg-slate-950 p-4 border border-slate-850 rounded-lg text-xs text-slate-350 min-h-40 whitespace-pre-wrap leading-relaxed">
                    {selectedComp.v1_output}
                  </div>
                  {/* Scores */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-950/50 p-3 rounded-lg border border-slate-850 text-center text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Faithfulness</span>
                      <span className="font-bold text-slate-300">{selectedComp.v1_scores.faithfulness}/5</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Relevance</span>
                      <span className="font-bold text-slate-300">{selectedComp.v1_scores.relevance}/5</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Clarity</span>
                      <span className="font-bold text-slate-300">{selectedComp.v1_scores.clarity}/5</span>
                    </div>
                  </div>
                </div>

                {/* Version 2 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-indigo-400 font-mono font-semibold uppercase tracking-wider">
                      Version: {v2} Output
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Run: {selectedComp.v2_run_id}</span>
                  </div>
                  <div className="bg-slate-950 p-4 border border-indigo-950 rounded-lg text-xs text-slate-200 min-h-40 whitespace-pre-wrap leading-relaxed">
                    {selectedComp.v2_output}
                  </div>
                  {/* Scores */}
                  <div className="grid grid-cols-3 gap-2 bg-indigo-950/20 p-3 rounded-lg border border-indigo-900/40 text-center text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Faithfulness</span>
                      <span className="font-bold text-slate-200">
                        {selectedComp.v2_scores.faithfulness}/5
                        <span className={`ml-1 text-[10px] ${getScoreDiffClass(selectedComp.diff.faithfulness)}`}>
                          ({formatDiff(selectedComp.diff.faithfulness)})
                        </span>
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Relevance</span>
                      <span className="font-bold text-slate-200">
                        {selectedComp.v2_scores.relevance}/5
                        <span className={`ml-1 text-[10px] ${getScoreDiffClass(selectedComp.diff.relevance)}`}>
                          ({formatDiff(selectedComp.diff.relevance)})
                        </span>
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Clarity</span>
                      <span className="font-bold text-slate-200">
                        {selectedComp.v2_scores.clarity}/5
                        <span className={`ml-1 text-[10px] ${getScoreDiffClass(selectedComp.diff.clarity)}`}>
                          ({formatDiff(selectedComp.diff.clarity)})
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/20 flex justify-end">
              <button 
                onClick={() => setSelectedComp(null)}
                className="bg-indigo-600 hover:bg-indigo-500 text-slate-50 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Done Comparing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
