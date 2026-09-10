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
      <span className="text-lg leading-none select-none">⚠️</span>
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

function SectionHeading({ icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-2xl select-none filter drop-shadow-sm">{icon}</span>
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
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

      {/* ── Main Foreground UI ── */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* ── Header ── */}
        <header className="bg-slate-900/80 dark:bg-slate-950/85 backdrop-blur-md border-b border-white/10 shadow-lg sticky top-0 z-20 transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center gap-4">
            {/* Brand icon */}
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 shadow-md shadow-blue-500/25 text-white">
              <span className="text-xl select-none">🚛</span>
            </div>
            {/* Brand Title */}
            <div>
              <h1 className="text-xl font-bold text-white leading-none tracking-tight">ELD Trip Planner</h1>
              <p className="text-xs text-slate-400 mt-0.5">FMCSA Hours-of-Service Scheduler</p>
            </div>
            {/* Status pill & Theme toggle */}
            <div className="ml-auto flex items-center gap-3.5">
              <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 rounded-full backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                API connected
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full pb-44">

          {/* ── Top section: form + (map when result exists) ── */}
          <div className={`gap-8 ${result ? 'lg:grid lg:grid-cols-5' : ''}`}>

            {/* Form card */}
            <div className={result ? 'lg:col-span-2' : 'max-w-lg mx-auto w-full'}>
              <div className="glass-card rounded-2xl p-6 transition-all duration-300">
                <SectionHeading
                  icon="📋"
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
                    icon="🗺️"
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
                  icon="📊"
                  title="Daily HOS Logs"
                  subtitle={`${result.daily_logs.length} day${result.daily_logs.length > 1 ? 's' : ''} — FMCSA compliant schedule`}
                />
                <DailyLogTabs dailyLogs={result.daily_logs} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Empty state (before first search) ── */}
          {!result && !isLoading && !error && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="glass-card max-w-xl mx-auto rounded-2xl p-8 mt-12 text-center text-slate-600 dark:text-slate-400 shadow-xl"
            >
              <div className="text-5xl sm:text-6xl mb-4 select-none filter drop-shadow-md">🛣️</div>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Enter trip details above to generate your ELD log
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 max-w-md mx-auto">
                The planner calculates driving time, required 30-min breaks, 10-hour rest resets, and standard FMCSA daily log sheets.
              </p>
            </motion.div>
          )}
        </main>

        {/* ── Footer ── */}
        <footer className="mt-auto border-t border-white/10 dark:border-white/10 bg-slate-900/80 dark:bg-slate-950/90 backdrop-blur-md mb-[150px]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-xs text-slate-400 dark:text-slate-400">
            ELD Trip Planner — FMCSA Hours of Service simulation. Not a substitute for certified ELD hardware.
          </div>
        </footer>
      </div>
    </div>
  );
}
