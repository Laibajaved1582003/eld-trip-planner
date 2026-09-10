// src/components/AnimatedScene.jsx
// Purely decorative fixed background scene:
// Sky gradient, twinkling stars, floating sun/moon orb, crisp drifting clouds,
// parallax mountain silhouettes, highway boards passing above road, and bottom road strip (height: 150px).

import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function AnimatedScene() {
  const { isDark } = useTheme();

  // Generate deterministic stars for dark mode
  const stars = useMemo(() => {
    const starList = [];
    for (let i = 0; i < 65; i++) {
      const top = (Math.sin(i * 997) * 38 + 40).toFixed(2); // 2% to 78% (above mountains)
      const left = (Math.cos(i * 701) * 48 + 50).toFixed(2); // 2% to 98%
      const size = (i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 1.5);
      const duration = (2.2 + (i % 5) * 0.7).toFixed(1);
      const delay = ((i % 7) * 0.5).toFixed(1);
      starList.push({ id: i, top: `${top}%`, left: `${left}%`, size, duration, delay });
    }
    return starList;
  }, []);

  return (
    <div
      className="fixed inset-0 w-screen h-screen pointer-events-none select-none overflow-hidden z-0 transition-colors duration-700"
      aria-hidden="true"
    >
      {/* ── 1. Sky Gradient Base (Full Viewport) ── */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          isDark
            ? 'opacity-100 bg-gradient-to-b from-[#030712] via-[#0b132b] via-45% to-[#1e1b4b]'
            : 'opacity-100 bg-gradient-to-b from-[#38bdf8] via-[#bae6fd] via-50% to-[#fed7aa]'
        }`}
      />

      {/* ── 2. Twinkling Stars (Dark Mode Only) ── */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          isDark ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {stars.map((s) => (
          <span
            key={s.id}
            className="absolute rounded-full bg-white animate-twinkle"
            style={{
              top: s.top,
              left: s.left,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
              boxShadow: s.size > 2 ? '0 0 6px 1px rgba(255,255,255,0.8)' : '0 0 3px 0.5px rgba(255,255,255,0.6)',
            }}
          />
        ))}
      </div>

      {/* ── 3. Floating Sun / Moon Orb ── */}
      <div className="absolute top-[8%] right-[10%] sm:right-[15%] flex items-center justify-center animate-float-orb">
        {isDark ? (
          <div className="relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-slate-200 via-blue-100 to-indigo-100 shadow-[0_0_60px_20px_rgba(147,197,253,0.28)] transition-all duration-700">
            <span className="text-3xl sm:text-4xl filter drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] select-none">🌙</span>
            <div className="absolute inset-0 rounded-full border border-white/30 animate-pulse-glow" />
          </div>
        ) : (
          <div className="relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-200 shadow-[0_0_70px_30px_rgba(251,191,36,0.45)] transition-all duration-700">
            <span className="text-3xl sm:text-4xl filter drop-shadow-[0_0_12px_rgba(251,191,36,0.9)] select-none">☀️</span>
            <div className="absolute inset-0 rounded-full border border-amber-200/50 animate-pulse-glow" />
          </div>
        )}
      </div>

      {/* ── 4. Crisp Drifting Clouds (Upper Sky) ── */}
      <div className="absolute top-[6%] left-0 right-0 h-40 overflow-hidden pointer-events-none">
        {/* Cloud 1 */}
        <div className="absolute top-[10px] animate-drift-cloud-1">
          <svg
            className={`w-48 h-16 ${
              isDark ? 'fill-slate-600/30' : 'fill-white/70'
            } transition-colors duration-700 drop-shadow-sm`}
            viewBox="0 0 100 40"
          >
            <path d="M20,35 Q10,35 10,25 Q10,15 25,15 Q30,5 45,8 Q55,2 70,10 Q85,5 90,20 Q100,22 95,35 Z" />
          </svg>
        </div>
        {/* Cloud 2 */}
        <div className="absolute top-[50px] animate-drift-cloud-2">
          <svg
            className={`w-64 h-20 ${
              isDark ? 'fill-slate-700/25' : 'fill-white/60'
            } transition-colors duration-700 drop-shadow-sm`}
            viewBox="0 0 120 45"
          >
            <path d="M15,40 Q5,40 5,28 Q5,18 20,18 Q28,6 48,10 Q60,4 78,12 Q95,6 105,22 Q118,25 112,40 Z" />
          </svg>
        </div>
        {/* Cloud 3 */}
        <div className="absolute top-[90px] animate-drift-cloud-3">
          <svg
            className={`w-40 h-14 ${
              isDark ? 'fill-slate-800/20' : 'fill-white/50'
            } transition-colors duration-700`}
            viewBox="0 0 90 35"
          >
            <path d="M15,30 Q5,30 8,20 Q12,10 25,12 Q32,4 45,8 Q58,5 68,14 Q78,10 85,22 Q88,30 75,30 Z" />
          </svg>
        </div>
      </div>

      {/* ── 5. Parallax Mountains: Far Layer (Sitting on top of 150px Road) ── */}
      <div className="absolute bottom-[150px] left-0 right-0 h-44 sm:h-56 overflow-hidden pointer-events-none">
        <svg
          className={`w-[200%] h-full animate-drift-mountains-far ${
            isDark ? 'fill-[#0d1738] opacity-60' : 'fill-[#93c5fd] opacity-45'
          } transition-colors duration-700`}
          viewBox="0 0 2000 300"
          preserveAspectRatio="none"
        >
          <path d="M0,300 L0,180 L180,90 L340,190 L520,70 L720,210 L920,80 L1100,200 L1300,60 L1500,180 L1700,90 L1880,200 L2000,120 L2000,300 Z" />
        </svg>
      </div>

      {/* ── 6. Parallax Mountains: Near Layer (Sitting on top of 150px Road) ── */}
      <div className="absolute bottom-[150px] left-0 right-0 h-32 sm:h-44 overflow-hidden pointer-events-none">
        <svg
          className={`w-[200%] h-full animate-drift-mountains-near ${
            isDark ? 'fill-[#070e24] opacity-85' : 'fill-[#60a5fa] opacity-55'
          } transition-colors duration-700`}
          viewBox="0 0 2000 300"
          preserveAspectRatio="none"
        >
          <path d="M0,300 L0,150 L120,220 L280,110 L440,240 L600,130 L780,230 L960,120 L1140,220 L1320,100 L1500,210 L1680,120 L1860,230 L2000,160 L2000,300 Z" />
        </svg>
      </div>

      {/* ── 7. Highway Roadside Signs (Passing by above road at bottom: 150px) ── */}
      <div className="absolute bottom-[150px] left-0 right-0 h-[85px] overflow-hidden pointer-events-none">
        {/* Sign 1: Interstate 80 / 90 */}
        <div className="absolute bottom-0 animate-sign-1 flex flex-col items-center">
          <div className="bg-emerald-800/90 dark:bg-emerald-900/90 border-2 border-white/90 text-white rounded-md shadow-md px-2.5 py-1 text-center backdrop-blur-sm">
            <div className="text-[9px] uppercase tracking-wider font-bold text-emerald-200">INTERSTATE 80 WEST</div>
            <div className="text-xs font-bold leading-tight">Denver • Salt Lake</div>
          </div>
          <div className="w-1 h-6 bg-slate-500 dark:bg-slate-600 shadow-sm" />
        </div>

        {/* Sign 2: Weigh Station / Rest Area */}
        <div className="absolute bottom-0 animate-sign-2 flex flex-col items-center">
          <div className="bg-emerald-800/90 dark:bg-emerald-900/90 border-2 border-white/90 text-white rounded-md shadow-md px-2.5 py-1 text-center backdrop-blur-sm">
            <div className="text-[9px] uppercase tracking-wider font-bold text-amber-300">TRUCK REST AREA</div>
            <div className="text-xs font-bold leading-tight">NEXT EXIT 2 MILES</div>
          </div>
          <div className="w-1 h-6 bg-slate-500 dark:bg-slate-600 shadow-sm" />
        </div>
      </div>

      {/* ── 8. Highway / Road Strip (Fixed at True Bottom, Height: 150px) ── */}
      <div className="absolute bottom-0 left-0 right-0 h-[150px] bg-gradient-to-b from-[#334155] via-[#1e293b] to-[#0f172a] dark:from-[#1e293b] dark:via-[#0f172a] dark:to-[#020617] border-t-2 border-amber-500/50 shadow-2xl overflow-hidden">
        {/* Road Shoulder / Guardrail Glow */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-white/40 dark:bg-slate-500/40" />

        {/* Animated Dashed Center Lane Divider */}
        <div className="absolute inset-x-0 top-[70px] -translate-y-1/2 h-[4px] bg-repeat-x road-dashed-line animate-road-scroll" />

        {/* Animated Moving Truck */}
        <div className="absolute left-[12%] sm:left-[18%] bottom-[42px] flex items-center gap-1.5 animate-truck-bounce">
          {/* Exhaust puff particles */}
          <div className="flex gap-1 -scale-x-100 mr-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400/60 dark:bg-slate-500/60 animate-exhaust-1" />
            <span className="w-2 h-2 rounded-full bg-slate-400/40 dark:bg-slate-500/40 animate-exhaust-2" />
          </div>
          {/* Truck Emoji */}
          <span className="text-3xl sm:text-4xl filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.7)] select-none">
            🚛
          </span>
        </div>
      </div>

      {/* ── 9. Blueprint Grid Overlay (Masked with radial fade) ── */}
      <div className="absolute inset-0 blueprint-grid-overlay opacity-25 dark:opacity-15 pointer-events-none" />
    </div>
  );
}
