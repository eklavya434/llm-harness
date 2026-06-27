'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchRunDetails, RunDetails, Sample } from '@/lib/api';
import { 
  Loader2, 
  ArrowLeft, 
  X, 
  BookOpen, 
  HelpCircle, 
  MessageSquare, 
  CheckSquare, 
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import Link from 'next/link';

export default function RunDetailPage() {
  const router = useRouter();
  const params = useParams();
  const runId = params.id as string;

  const [run, setRun] = useState<RunDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal selection state
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<keyof Sample>('semantic_similarity');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (!runId) return;

    const loadRunDetails = async () => {
      try {
        setLoading(true);
        const data = await fetchRunDetails(runId);
        setRun(data);
        setError('');
      } catch (err: any) {
        setError(err.message || 'Failed to load run details');
      } finally {
        setLoading(false);
      }
    };

    loadRunDetails();
  }, [runId]);

  const handleSort = (field: keyof Sample) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedSamples = run ? [...run.samples].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    }
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return 0;
  }) : [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-2" />
        <p className="text-slate-400 text-sm">Loading run details...</p>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4 font-medium">{error || 'Run not found'}</p>
        <button 
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 text-slate-350 hover:text-slate-200 px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link 
          href="/" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-indigo-400 transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      {/* Run Summary Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="md:flex md:items-center md:justify-between border-b border-slate-800/60 pb-4 mb-6">
          <div>
            <span className="text-xs text-indigo-400 font-mono font-semibold uppercase tracking-wider block mb-1">
              RUN ID: {run.id}
            </span>
            <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2">
              <span>Pipeline:</span>
              <span className="font-mono text-indigo-400 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/25 rounded-md text-xl">
                {run.pipeline_version}
              </span>
            </h1>
          </div>
          <div className="mt-4 md:mt-0 text-slate-400 text-xs font-medium">
            Evaluated on: <span className="text-slate-250 font-mono">{run.created_at}</span>
          </div>
        </div>

        {/* Aggregate Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-950/40 p-4 border border-slate-800/40 rounded-lg">
            <span className="text-xs text-slate-450 block mb-1 uppercase tracking-wider">Faithfulness</span>
            <span className={`text-2xl font-bold font-mono ${
              run.average_faithfulness >= 4 ? 'text-emerald-400' : run.average_faithfulness >= 3 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {run.average_faithfulness.toFixed(2)}/5
            </span>
          </div>
          <div className="bg-slate-950/40 p-4 border border-slate-800/40 rounded-lg">
            <span className="text-xs text-slate-450 block mb-1 uppercase tracking-wider">Relevance</span>
            <span className={`text-2xl font-bold font-mono ${
              run.average_relevance >= 4 ? 'text-emerald-400' : run.average_relevance >= 3 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {run.average_relevance.toFixed(2)}/5
            </span>
          </div>
          <div className="bg-slate-950/40 p-4 border border-slate-800/40 rounded-lg">
            <span className="text-xs text-slate-450 block mb-1 uppercase tracking-wider">Clarity</span>
            <span className={`text-2xl font-bold font-mono ${
              run.average_clarity >= 4 ? 'text-emerald-400' : run.average_clarity >= 3 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {run.average_clarity.toFixed(2)}/5
            </span>
          </div>
          <div className="bg-slate-950/40 p-4 border border-slate-800/40 rounded-lg">
            <span className="text-xs text-slate-450 block mb-1 uppercase tracking-wider">Similarity (QA)</span>
            <span className="text-2xl font-bold text-slate-100 font-mono">
              {(run.average_similarity * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Samples Table Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-bold text-slate-50">Evaluated Samples ({sortedSamples.length})</h2>
          <p className="text-xs text-slate-450 mt-1">
            Click on any row to view full context, generated response, and judge scoring justifications.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 font-semibold uppercase bg-slate-950/40 select-none">
                <th className="py-3 px-6 w-1/3">Question</th>
                <th className="py-3 px-4 text-center cursor-pointer hover:text-slate-200" onClick={() => handleSort('faithfulness_score')}>
                  Faithfulness {sortField === 'faithfulness_score' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-3 px-4 text-center cursor-pointer hover:text-slate-200" onClick={() => handleSort('relevance_score')}>
                  Relevance {sortField === 'relevance_score' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-3 px-4 text-center cursor-pointer hover:text-slate-200" onClick={() => handleSort('clarity_score')}>
                  Clarity {sortField === 'clarity_score' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-3 px-4 text-center cursor-pointer hover:text-slate-200" onClick={() => handleSort('semantic_similarity')}>
                  Sim. (QA) {sortField === 'semantic_similarity' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-3 px-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sortedSamples.map((sample) => (
                <tr 
                  key={sample.id} 
                  onClick={() => setSelectedSample(sample)}
                  className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                >
                  <td className="py-4 px-6 text-slate-200 font-medium max-w-xs truncate">
                    {sample.question}
                  </td>
                  <td className="py-4 px-4 text-center font-mono font-bold">
                    <span className={
                      sample.faithfulness_score >= 4 ? 'text-emerald-400' : sample.faithfulness_score >= 3 ? 'text-amber-400' : 'text-red-400'
                    }>
                      {sample.faithfulness_score}/5
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center font-mono font-bold">
                    <span className={
                      sample.relevance_score >= 4 ? 'text-emerald-400' : sample.relevance_score >= 3 ? 'text-amber-400' : 'text-red-400'
                    }>
                      {sample.relevance_score}/5
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center font-mono font-bold">
                    <span className={
                      sample.clarity_score >= 4 ? 'text-emerald-400' : sample.clarity_score >= 3 ? 'text-amber-400' : 'text-red-400'
                    }>
                      {sample.clarity_score}/5
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center text-slate-350 font-mono font-medium">
                    {(sample.semantic_similarity * 100).toFixed(0)}%
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1">
                      <span>Examine</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedSample && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/20">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-500" />
                <span>Sample Judge Analysis</span>
              </h3>
              <button 
                onClick={() => setSelectedSample(null)}
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
                  User Question
                </span>
                <div className="bg-slate-950 p-4 border border-slate-800 rounded-lg text-sm text-slate-200">
                  {selectedSample.question}
                </div>
              </div>

              {/* RAG Context */}
              <div>
                <span className="text-xs text-amber-500 font-mono font-semibold uppercase tracking-wider block mb-1">
                  Retrieved Context
                </span>
                <div className="bg-slate-950 p-4 border border-slate-800 rounded-lg text-xs font-sans text-slate-350 max-h-40 overflow-y-auto leading-relaxed">
                  {selectedSample.retrieved_context}
                </div>
              </div>

              {/* Outputs Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-cyan-400 font-mono font-semibold uppercase tracking-wider block mb-1">
                    Model Response
                  </span>
                  <div className="bg-slate-950 p-4 border border-slate-800 rounded-lg text-xs text-slate-300 min-h-32 whitespace-pre-wrap leading-relaxed">
                    {selectedSample.model_output}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-450 font-mono font-semibold uppercase tracking-wider block mb-1">
                    Ground Truth (Reference)
                  </span>
                  <div className="bg-slate-950 p-4 border border-slate-800 rounded-lg text-xs text-slate-400 min-h-32 whitespace-pre-wrap leading-relaxed">
                    {selectedSample.ground_truth || "No reference answer provided."}
                  </div>
                </div>
              </div>

              {/* Rubric Evaluation Breakdown */}
              <div className="border-t border-slate-850 pt-6">
                <span className="text-xs text-indigo-400 font-mono font-semibold uppercase tracking-wider block mb-4">
                  Rubric Score justifications
                </span>

                <div className="space-y-4">
                  {/* Faithfulness */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start bg-slate-950/40 p-4 border border-slate-800/40 rounded-lg">
                    <div className="flex items-center gap-2 md:flex-col md:items-start">
                      <span className="text-sm font-bold text-slate-300">Faithfulness</span>
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-sm ${
                        selectedSample.faithfulness_score >= 4 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : selectedSample.faithfulness_score >= 3 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {selectedSample.faithfulness_score}/5
                      </span>
                    </div>
                    <div className="md:col-span-3 text-xs text-slate-350 leading-relaxed font-sans">
                      {selectedSample.faithfulness_reason}
                    </div>
                  </div>

                  {/* Relevance */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start bg-slate-950/40 p-4 border border-slate-800/40 rounded-lg">
                    <div className="flex items-center gap-2 md:flex-col md:items-start">
                      <span className="text-sm font-bold text-slate-300">Relevance</span>
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-sm ${
                        selectedSample.relevance_score >= 4 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : selectedSample.relevance_score >= 3 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {selectedSample.relevance_score}/5
                      </span>
                    </div>
                    <div className="md:col-span-3 text-xs text-slate-350 leading-relaxed font-sans">
                      {selectedSample.relevance_reason}
                    </div>
                  </div>

                  {/* Clarity */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start bg-slate-950/40 p-4 border border-slate-800/40 rounded-lg">
                    <div className="flex items-center gap-2 md:flex-col md:items-start">
                      <span className="text-sm font-bold text-slate-300">Clarity</span>
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-sm ${
                        selectedSample.clarity_score >= 4 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : selectedSample.clarity_score >= 3 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {selectedSample.clarity_score}/5
                      </span>
                    </div>
                    <div className="md:col-span-3 text-xs text-slate-350 leading-relaxed font-sans">
                      {selectedSample.clarity_reason}
                    </div>
                  </div>

                  {/* Cosine Similarity */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start bg-slate-950/40 p-4 border border-slate-800/40 rounded-lg">
                    <div className="flex items-center gap-2 md:flex-col md:items-start">
                      <span className="text-sm font-bold text-slate-300">Similarity (QA)</span>
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-sm bg-slate-850 text-slate-300 border border-slate-800">
                        {(selectedSample.semantic_similarity * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="md:col-span-3 text-xs text-slate-400 leading-relaxed font-sans">
                      Measures the cosine similarity between the embeddings of the <strong>user question</strong> and 
                      the <strong>model output</strong> using the local `sentence-transformers/all-MiniLM-L6-v2` model. 
                      A higher score indicates the generated output matches the conceptual wording/intent of the question.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/20 flex justify-end">
              <button 
                onClick={() => setSelectedSample(null)}
                className="bg-indigo-600 hover:bg-indigo-500 text-slate-50 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Done Inspecting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
