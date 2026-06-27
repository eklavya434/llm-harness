'use client';

import React, { useEffect, useState } from 'react';
import { fetchHealth } from '@/lib/api';
import { Loader2, RefreshCw } from 'lucide-react';

interface WakeupCheckProps {
  children: React.ReactNode;
}

export default function WakeupCheck({ children }: WakeupCheckProps) {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    let active = true;
    let timer: NodeJS.Timeout;

    async function check() {
      try {
        setErrorMsg('');
        const status = await fetchHealth();
        if (status && status.status === 'healthy' && active) {
          setIsHealthy(true);
        }
      } catch (err) {
        if (active) {
          setIsHealthy(false);
          setAttempts((prev) => prev + 1);
          // Retry in 3 seconds
          timer = setTimeout(check, 3000);
        }
      }
    }

    check();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (isHealthy === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-lg font-medium">Checking backend status...</p>
      </div>
    );
  }

  if (isHealthy === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl text-center">
          <div className="relative flex justify-center mb-6">
            <RefreshCw className="h-12 w-12 text-amber-500 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-slate-50 mb-3">Waking Up Backend</h2>
          <p className="text-slate-400 mb-6 text-sm leading-relaxed">
            The backend API is hosted on Hugging Face Spaces (Docker free tier). 
            If it has been idle, HF puts the container to sleep. We are waking it up now.
          </p>
          <div className="flex flex-col items-center bg-slate-950 rounded-lg p-4 border border-slate-800/50 mb-2">
            <span className="text-xs text-indigo-400 font-mono uppercase tracking-wider mb-1">Status</span>
            <span className="text-sm font-semibold text-amber-400">Waking Container...</span>
            <span className="text-[10px] text-slate-500 mt-2">Connection attempts: {attempts}</span>
          </div>
          <p className="text-[11px] text-slate-500 italic">This usually takes 15–40 seconds. Please wait.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
