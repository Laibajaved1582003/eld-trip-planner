// src/components/ThemeToggle.jsx
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { toggleTheme, isDark } = useTheme();

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.06 }}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="relative flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border border-slate-700/60 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white shadow-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="sun"
            initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="flex items-center justify-center text-amber-400 text-lg select-none"
          >
            ☀️
          </motion.span>
        ) : (
          <motion.span
            key="moon"
            initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="flex items-center justify-center text-blue-200 text-lg select-none"
          >
            🌙
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
