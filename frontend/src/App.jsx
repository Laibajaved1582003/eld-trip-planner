// src/App.jsx
// Top-level ELD Trip Planner application with animated dusk/dawn background and glassy aesthetic.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import 'leaflet/dist/leaflet.css';
import { planTrip } from './api/tripApi';
import TripForm from './components/TripForm';
import RouteMap from './components/RouteMap';
import DailyLogTabs from './components/DailyLogTabs';
import ThemeToggle from './components/ThemeToggle';
import AnimatedScene from './components/AnimatedScene';

// ── Small utility components ───────────────────────────────────────────────

function ErrorBanner({ message, onDismiss }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-300/80 dark:border-red-900/70 bg-red-50/90 dark:bg-red-950/60 backdrop-blur-md px-4 py-3.5 text-sm text-red-800 dark:text-red-200 shadow-md"
    >
      <svg className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      <div className="flex-1">
        <p className="font-semibold">Something went wrong</p>
        <p className="mt-0.5 text-red-700 dark:text-red-300 text-xs sm:text-sm">{message}</p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="text-red-500 hover:text-red-700 dark:hover:text-red-200 transition-colors text-lg leading-none ml-1 p-0.5"
      >
        ×
      </button>
    </div>
  );
}

function SectionHeading({ title, subtitle }) {
  return (
    <div className="mb-4 pl-3.5 border-l-4 border-blue-600 dark:border-blue-400">
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight tracking-tight">{title}</h2>
      {subtitle && <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-normal">{subtitle}</p>}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);
  const [result, setResult]       = useState(null);

  const handleSubmit = async (formData) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await planTrip(formData);
      console.log('[ELD] API response:', data);   // intentional debug log
      setResult(data);
    } catch (err) {
      console.error('[ELD] API error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col text-slate-800 dark:text-slate-100 overflow-x-hidden font-sans">
      {/* ── Fixed Animated Dusk/Dawn Background Scene ── */}
      <AnimatedScene />

      {/* ── Fixed Footer Text Bar (ABSOLUTE BOTTOM-MOST strip, touching bottom of viewport: bottom: 0, z-index: 30) ── */}
      <footer
        className="fixed bottom-0 left-0 right-0 w-full min-h-[44px] sm:h-12 z-30 flex items-center justify-center border-t border-white/15 dark:border-white/10 bg-slate-900/95 dark:bg-slate-950/98 backdrop-blur-md shadow-2xl px-3 sm:px-4 py-1.5 text-center transition-colors duration-300"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 30,
        }}
      >
        <div className="max-w-7xl mx-auto text-[11px] sm:text-xs leading-normal text-slate-300 dark:text-slate-400">
          ELD Trip Planner: FMCSA Hours of Service simulation. Not a substitute for certified ELD hardware.
        </div>
      </footer>

      {/* ── Main Foreground UI (Header, Cards, Empty-State/Results: z-35 & z-50) ── */}
      {/* pb-[218px] reserves clearance equal to footer (48px) + road (150px) = 198px + 20px visual buffer */}
      <div className="relative z-30 flex flex-col min-h-screen pb-[218px]">
        {/* ── Header ── */}
        <header className="bg-transparent backdrop-blur-[2px] border-b border-white/20 dark:border-white/10 sticky top-0 z-50 transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center gap-2.5 sm:gap-4">
            {/* Brand icon */}
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                background: 'none',
                backgroundColor: 'transparent',
                backgroundImage: 'none',
                boxShadow: 'none',
                border: 'none',
              }}
            >
              <span
                className="text-2xl sm:text-3xl select-none leading-none inline-block"
                style={{
                  filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4)) drop-shadow(0 0 12px rgba(59,130,246,0.35))',
                  background: 'none',
                  backgroundColor: 'transparent',
                }}
              >
                🚛
              </span>
            </div>
            {/* Brand Title */}
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight truncate header-title-text">
                ELD Trip Planner
              </h1>
              <p className="text-[10px] sm:text-xs font-semibold sm:font-medium text-slate-800/90 dark:text-slate-300 leading-tight truncate mt-0.5 header-subtitle-text">
                FMCSA Hours-of-Service Scheduler
              </p>
            </div>
            {/* Theme toggle */}
            <div className="shrink-0 flex items-center">
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* ── Main content (all content stops cleanly above the 210px bottom reserved space) ── */}
        <main className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 w-full">

          {/* ── Top section: form + (map when result exists) ── */}
          <div className={`gap-8 ${result ? 'lg:grid lg:grid-cols-5' : ''}`}>

            {/* Form card */}
            <div className={result ? 'lg:col-span-2' : 'max-w-lg mx-auto w-full'}>
              <div className="glass-card rounded-2xl p-4 sm:p-6 transition-all duration-300">
                <SectionHeading
                  title="Trip Details"
                  subtitle="Enter locations to generate your ELD log"
                />
                <TripForm onSubmit={handleSubmit} isLoading={isLoading} />
              </div>

              {/* Error banner — sits below the form card */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.25 }}
                    className="mt-4"
                  >
                    <ErrorBanner message={error} onDismiss={() => setError(null)} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Map — only shown after a successful result, animated in */}
            <AnimatePresence>
              {result && (
                <motion.div
                  key="route-map-panel"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="lg:col-span-3 mt-8 lg:mt-0"
                >
                  <SectionHeading
                    title="Route Map"
                    subtitle="Driving route with waypoints"
                  />
                  <RouteMap route={result.route} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Loading skeleton ── */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-10 space-y-4"
              >
                <div className="h-6 w-48 rounded-lg bg-white/40 dark:bg-slate-800/60 animate-pulse backdrop-blur-sm" />
                <div className="h-[420px] rounded-2xl bg-white/40 dark:bg-slate-800/60 animate-pulse backdrop-blur-sm" />
                <div className="h-6 w-64 rounded-lg bg-white/40 dark:bg-slate-800/60 animate-pulse backdrop-blur-sm" />
                <div className="h-64 rounded-2xl bg-white/40 dark:bg-slate-800/60 animate-pulse backdrop-blur-sm" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Daily log sheets (staggered entrance after map) ── */}
          <AnimatePresence>
            {result && result.daily_logs && result.daily_logs.length > 0 && (
              <motion.div
                key="daily-logs-panel"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.45, delay: 0.15, ease: 'easeOut' }}
                className="mt-10"
              >
                <SectionHeading
                  title="Daily HOS Logs"
                  subtitle={`${result.daily_logs.length} day${result.daily_logs.length > 1 ? 's' : ''} — FMCSA compliant schedule`}
                />
                <DailyLogTabs dailyLogs={result.daily_logs} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Empty state (before first search) ── */}
          {!result && !isLoading && !error && (
            <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Enter trip details to generate your route and FMCSA daily logs
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
