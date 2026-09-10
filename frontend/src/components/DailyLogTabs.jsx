// src/components/DailyLogTabs.jsx
// Tab bar for multiple daily logs, or a plain single sheet if only one day.

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import DailyLogSheet from './DailyLogSheet';

export default function DailyLogTabs({ dailyLogs }) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!dailyLogs || dailyLogs.length === 0) return null;

  // Single day — no tabs needed
  if (dailyLogs.length === 1) {
    return <DailyLogSheet log={dailyLogs[0]} />;
  }

  const activeLog = dailyLogs[activeIdx] ?? dailyLogs[0];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1.5 pt-0.5">
        {dailyLogs.map((log, idx) => {
          const dayLabel = format(parseISO(log.date), 'MMM d');
          const isActive = idx === activeIdx;
          return (
            <button
              key={log.date}
              id={`log-tab-${idx}`}
              onClick={() => setActiveIdx(idx)}
              className={
                'relative flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 focus:outline-none ' +
                (isActive
                  ? 'text-white'
                  : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 hover:bg-white dark:hover:bg-slate-750 hover:border-slate-300 dark:hover:border-white/20 shadow-sm')
              }
            >
              {isActive && (
                <motion.div
                  layoutId="activeDailyTab"
                  className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl shadow-md shadow-blue-500/25"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
              <span className="relative z-10">
                Day {idx + 1} — {dayLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active day's log sheet with animated slide/fade transition */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeLog.date}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: 'easeInOut' }}
        >
          <DailyLogSheet log={activeLog} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
