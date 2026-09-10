// src/components/Tooltip.jsx
// Lightweight styled hover tooltip with Framer Motion fade-in, matching app card aesthetics.

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function Tooltip({
  text,
  children,
  position = 'top',
  className = 'inline-flex',
}) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  };

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      onClick={() => setIsVisible((prev) => !prev)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: position === 'top' ? 4 : -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: position === 'top' ? 2 : -2, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute ${positionClasses[position] ?? positionClasses.top} z-50 pointer-events-none whitespace-normal max-w-[210px] w-max px-2.5 py-1.5 rounded-lg bg-slate-900/95 dark:bg-slate-900/95 text-slate-100 text-[11px] leading-snug font-medium text-center shadow-xl border border-white/15 dark:border-white/15 backdrop-blur-md`}
            role="tooltip"
          >
            {text}
            {/* Small arrow */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent ${
                position === 'top'
                  ? 'top-full border-t-4 border-t-slate-900/95'
                  : 'bottom-full border-b-4 border-b-slate-900/95'
              }`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
