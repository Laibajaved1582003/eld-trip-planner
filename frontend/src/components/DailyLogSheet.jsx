// src/components/DailyLogSheet.jsx
// Renders a single day's FMCSA-style "Driver's Daily Log" as an SVG 24-hour grid with glassy styling.

import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import AnimatedNumber from './AnimatedNumber';
import Tooltip from './Tooltip';

// ── Grid constants ──────────────────────────────────────────────────────────
const GRID_LEFT   = 120;  // px — room for row labels
const GRID_RIGHT  = 24;   // px — right margin
const ROW_HEIGHT  = 36;   // px per status row
const HEADER_H    = 28;   // px for hour labels
const ROWS = [
  { key: 'off_duty',             label: 'Off Duty',          short: 'OFF' },
  { key: 'sleeper_berth',        label: 'Sleeper Berth',     short: 'SB'  },
  { key: 'driving',              label: 'Driving',           short: 'D'   },
  { key: 'on_duty_not_driving',  label: 'On Duty (Not Drv)', short: 'ON'  },
];
const NUM_ROWS = ROWS.length;
const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0..24

const ROW_TOOLTIPS = {
  off_duty: 'Hours off duty, not working',
  sleeper_berth: 'Hours resting in the sleeper berth',
  driving: 'Hours spent actively driving',
  on_duty_not_driving: 'Hours on duty but not driving (loading, fueling, paperwork)',
};

const STATUS_COLORS = {
  off_duty:            '#3b82f6', // blue-500
  sleeper_berth:       '#8b5cf6', // violet-500
  driving:             '#10b981', // emerald-500
  on_duty_not_driving: '#f59e0b', // amber-500
};

function toDecimalHours(isoStr) {
  const d = new Date(isoStr);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

function rowIndex(status) {
  return ROWS.findIndex((r) => r.key === status);
}

// Convert decimal hours → SVG x coordinate within the grid
function hourToX(hour, gridWidth) {
  return GRID_LEFT + (hour / 24) * gridWidth;
}

// Convert row index → SVG y coordinate (centre of the row)
function rowToY(idx) {
  return HEADER_H + idx * ROW_HEIGHT + ROW_HEIGHT / 2;
}

export default function DailyLogSheet({ log }) {
  const { isDark } = useTheme();
  const { date, segments = [], totals = {} } = log;

  const SVG_WIDTH  = 900;
  const gridWidth  = SVG_WIDTH - GRID_LEFT - GRID_RIGHT;
  const SVG_HEIGHT = HEADER_H + NUM_ROWS * ROW_HEIGHT + HEADER_H;

  // ── Build the continuous polyline path ─────────────────────────────────
  const pathParts = [];
  let prevRowY = null;
  let prevEndX = null;

  segments.forEach((seg) => {
    const startH = toDecimalHours(seg.start);
    const endH   = toDecimalHours(seg.end);

    // Handle midnight wrap: if end < start (segment split at midnight boundary)
    const effectiveEnd = endH < startH ? 24 : endH;

    const x1 = hourToX(Math.max(0, startH), gridWidth);
    const x2 = hourToX(Math.min(24, effectiveEnd), gridWidth);
    const ri  = rowIndex(seg.status);
    if (ri < 0) return; // unknown status
    const y   = rowToY(ri);

    // Vertical connector from previous segment's end row
    if (prevRowY !== null && prevEndX !== null && prevRowY !== y) {
      pathParts.push(`M ${prevEndX} ${prevRowY} L ${prevEndX} ${y}`);
    }

    // Horizontal segment line
    pathParts.push(`M ${x1} ${y} L ${x2} ${y}`);

    prevRowY  = y;
    prevEndX  = x2;
  });

  const d = pathParts.join(' ');

  // ── Totals ────────────────────────────────────────────────────────────
  const totalSum = Object.values(totals).reduce((a, b) => a + b, 0);
  const dateLabel = date
    ? format(parseISO(date), 'EEEE, MMMM d, yyyy')
    : date;

  return (
    <div className="glass-card rounded-2xl shadow-xl overflow-hidden transition-all duration-300">
      {/* Header Banner */}
      <div className="flex items-center justify-between px-3.5 sm:px-5 py-2.5 sm:py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 text-white border-b border-white/10">
        <div>
          <p className="text-[10px] sm:text-xs text-blue-300 dark:text-blue-400 uppercase tracking-widest font-bold">Driver's Daily Log</p>
          <p className="font-bold text-sm sm:text-base text-slate-100">{dateLabel}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] sm:text-xs text-slate-400 font-medium">Total on-duty</p>
          <p className="font-bold text-base sm:text-lg text-amber-400 dark:text-amber-300">
            <AnimatedNumber
              value={(totals.driving ?? 0) + (totals.on_duty_not_driving ?? 0)}
              decimals={2}
              duration={0.8}
              suffix=" hrs"
            />
          </p>
        </div>
      </div>

      {/* Mobile scroll hint */}
      <div className="sm:hidden px-3 pt-2 pb-0.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between font-medium">
        <span>↔ Scroll horizontally for full 24-hr timeline</span>
        <span className="text-[10px] text-blue-500 dark:text-blue-400 font-bold">24h Grid</span>
      </div>

      {/* SVG Grid */}
      <div className="overflow-x-auto px-2 sm:px-4 pt-2 sm:pt-4 pb-2 touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
        <svg
          width={SVG_WIDTH}
          height={SVG_HEIGHT}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full"
          style={{ minWidth: '700px' }}
          aria-label={`HOS log grid for ${date}`}
        >
          {/* ── Hour grid lines (vertical) ── */}
          {HOURS.map((h) => {
            const x = hourToX(h, gridWidth);
            const isMajor = h % 6 === 0;
            return (
              <line
                key={`v-${h}`}
                x1={x}
                y1={HEADER_H}
                x2={x}
                y2={HEADER_H + NUM_ROWS * ROW_HEIGHT}
                stroke={isDark ? (isMajor ? '#475569' : '#1e293b') : (isMajor ? '#94a3b8' : '#e2e8f0')}
                strokeWidth={isMajor ? 1.5 : 1}
              />
            );
          })}

          {/* ── Horizontal row dividers ── */}
          {Array.from({ length: NUM_ROWS + 1 }, (_, i) => (
            <line
              key={`h-${i}`}
              x1={GRID_LEFT}
              y1={HEADER_H + i * ROW_HEIGHT}
              x2={SVG_WIDTH - GRID_RIGHT}
              y2={HEADER_H + i * ROW_HEIGHT}
              stroke={isDark ? '#334155' : '#cbd5e1'}
              strokeWidth={i === 0 || i === NUM_ROWS ? 1.5 : 1}
            />
          ))}

          {/* ── Row background alternation ── */}
          {ROWS.map((row, i) => (
            <rect
              key={`bg-${i}`}
              x={GRID_LEFT}
              y={HEADER_H + i * ROW_HEIGHT}
              width={gridWidth}
              height={ROW_HEIGHT}
              fill={isDark ? (i % 2 === 0 ? '#0b1329' : '#101a36') : (i % 2 === 0 ? '#f8fafc' : '#ffffff')}
            />
          ))}

          {/* ── Top hour labels ── */}
          {HOURS.map((h) => {
            if (h === 24) return null;
            const x = hourToX(h + 0.5, gridWidth);
            const label = h === 0 ? 'Mid' : h === 12 ? 'Noon' : h < 12 ? `${h}a` : `${h - 12}p`;
            return (
              <text
                key={`tl-${h}`}
                x={x}
                y={HEADER_H - 6}
                textAnchor="middle"
                fontSize="9"
                fill={isDark ? '#64748b' : '#94a3b8'}
                fontFamily="monospace"
              >
                {label}
              </text>
            );
          })}

          {/* ── Bottom hour labels (mirror) ── */}
          {HOURS.map((h) => {
            if (h === 24) return null;
            const x = hourToX(h + 0.5, gridWidth);
            const label = h === 0 ? 'Mid' : h === 12 ? 'Noon' : h < 12 ? `${h}a` : `${h - 12}p`;
            return (
              <text
                key={`bl-${h}`}
                x={x}
                y={HEADER_H + NUM_ROWS * ROW_HEIGHT + 14}
                textAnchor="middle"
                fontSize="9"
                fill={isDark ? '#64748b' : '#94a3b8'}
                fontFamily="monospace"
              >
                {label}
              </text>
            );
          })}

          {/* ── Row labels (left side) ── */}
          {ROWS.map((row, i) => (
            <g key={`row-${i}`}>
              {/* Coloured dot */}
              <circle
                cx={14}
                cy={rowToY(i)}
                r={5}
                fill={STATUS_COLORS[row.key] ?? '#64748b'}
              />
              <text
                x={24}
                y={rowToY(i) + 4}
                fontSize="10"
                fill={isDark ? '#cbd5e1' : '#334155'}
                fontFamily="system-ui, sans-serif"
                fontWeight="600"
              >
                {row.label}
              </text>
            </g>
          ))}

          {/* ── Shaded active-duty row backgrounds (fading in after line draws) ── */}
          {segments.map((seg, i) => {
            const ri = rowIndex(seg.status);
            if (ri < 0) return null;
            const startH = toDecimalHours(seg.start);
            const endH   = toDecimalHours(seg.end);
            const effectiveEnd = endH < startH ? 24 : endH;
            const x1 = hourToX(Math.max(0, startH), gridWidth);
            const x2 = hourToX(Math.min(24, effectiveEnd), gridWidth);
            const y  = HEADER_H + ri * ROW_HEIGHT;
            const color = STATUS_COLORS[seg.status] ?? '#64748b';
            return (
              <motion.rect
                key={`shade-${i}`}
                x={x1}
                y={y + 4}
                width={Math.max(0, x2 - x1)}
                height={ROW_HEIGHT - 8}
                fill={color}
                initial={{ opacity: 0 }}
                animate={{ opacity: isDark ? 0.25 : 0.16 }}
                transition={{ duration: 0.45, delay: 1.05 + i * 0.04, ease: 'easeOut' }}
                rx={2}
              />
            );
          })}

          {/* ── Main duty-status animated stepped polyline ── */}
          {d && (
            <motion.path
              d={d}
              stroke={isDark ? '#38bdf8' : '#2563eb'}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: 'easeInOut' }}
            />
          )}
        </svg>
      </div>

      {/* ── Totals table / Summary Chips ── */}
      <div className="px-3 sm:px-5 pb-4 sm:pb-5 pt-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-center">
          {ROWS.map((row) => (
            <Tooltip
              key={row.key}
              text={ROW_TOOLTIPS[row.key]}
              position="top"
              className="w-full cursor-help justify-center"
            >
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.15 }}
                className="w-full rounded-xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200/80 dark:border-white/10 px-2 py-2 sm:py-2.5 shadow-sm transition-colors duration-200"
              >
                <div
                  className="text-xs font-bold mb-0.5 sm:mb-1 truncate"
                  style={{ color: STATUS_COLORS[row.key] }}
                >
                  {row.short}
                </div>
                <div className="text-slate-800 dark:text-slate-100 font-bold text-sm tracking-tight">
                  <AnimatedNumber
                    value={totals[row.key] ?? 0}
                    decimals={2}
                    duration={0.8}
                    suffix="h"
                  />
                </div>
              </motion.div>
            </Tooltip>
          ))}
          <Tooltip
            text="Total hours across all duty statuses for this day (should equal 24.00h)"
            position="top"
            className="w-full cursor-help justify-center col-span-2 sm:col-span-1 md:col-span-1"
          >
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.15 }}
              className="w-full rounded-xl bg-blue-50/80 dark:bg-indigo-950/50 backdrop-blur-md border border-blue-200/90 dark:border-indigo-800/50 px-2 py-2 sm:py-2.5 shadow-sm transition-colors duration-200"
            >
              <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-0.5 sm:mb-1">TOTAL</div>
              <div className={`font-bold text-sm tracking-tight ${Math.abs(totalSum - 24) < 0.01 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                <AnimatedNumber
                  value={totalSum}
                  decimals={2}
                  duration={0.8}
                  suffix="h"
                />
              </div>
            </motion.div>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
