import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import WakeupCheck from '@/components/WakeupCheck';
import Link from 'next/link';
import { ShieldCheck, BarChart3, GitCompare } from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LLM Evaluation & Observability Harness',
  description: 'Automated evaluation, regressions, and quality insights for LLM/RAG outputs.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-slate-950 text-slate-100">
      <body className={`${inter.className} min-h-full flex flex-col`}>
        <WakeupCheck>
          {/* Main Top Navigation */}
          <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-2 font-bold text-lg text-slate-50 hover:text-indigo-400 transition-colors">
                  <ShieldCheck className="h-6 w-6 text-indigo-500" />
                  <span>LLM Observability</span>
                </Link>
                <nav className="hidden sm:flex items-center gap-6">
                  <Link href="/" className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-indigo-400 transition-colors">
                    <BarChart3 className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                  <Link href="/compare" className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-indigo-400 transition-colors">
                    <GitCompare className="h-4 w-4" />
                    <span>Regression Analysis</span>
                  </Link>
                </nav>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  API Connected
                </span>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
            <p>© {new Date().getFullYear()} LLM Evaluation Harness — Portfolio Demo. Built with FastAPI, SQLite, Next.js & Tailwind CSS.</p>
          </footer>
        </WakeupCheck>
      </body>
    </html>
  );
}
