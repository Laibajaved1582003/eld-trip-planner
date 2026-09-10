// src/components/RouteMap.jsx
// Renders an interactive Leaflet map showing the driving route polyline and waypoint markers.

import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import { motion } from 'framer-motion';
import L from 'leaflet';
import { useTheme } from '../context/ThemeContext';
import AnimatedNumber from './AnimatedNumber';

// ── Fix the broken Leaflet default icon with Vite ─────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Coloured markers for current / pickup / dropoff
const MARKER_COLORS = {
  current: '#3b82f6',   // blue
  pickup:  '#10b981',   // green
  dropoff: '#ef4444',   // red
};

function makeIcon(label, index = 0) {
  const color = MARKER_COLORS[label] ?? '#6366f1';
  const delaySec = (index * 0.18).toFixed(2);
  const svg = `<div class="marker-bounce" style="animation-delay: ${delaySec}s;">
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36" style="filter: drop-shadow(0 3px 5px rgba(0,0,0,0.4));">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="${color}"/>
      <circle cx="14" cy="14" r="7" fill="white" opacity="0.95"/>
    </svg>
  </div>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -38],
  });
}

// Auto-fit bounds to the polyline after mount
function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 1) {
      map.fitBounds(positions, { padding: [40, 40] });
    }
  }, [map, positions]);
  return null;
}

const LABEL_MAP = { current: 'Current Location', pickup: 'Pickup', dropoff: 'Dropoff' };

export default function RouteMap({ route }) {
  const { isDark } = useTheme();
  const { geometry = [], waypoints = [], distance_miles = 0, duration_hours = 0 } = route;

  // Default center (US center) if no geometry
  const center = geometry.length > 0 ? geometry[Math.floor(geometry.length / 2)] : [39.5, -98.35];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="glass-card rounded-2xl overflow-hidden shadow-xl transition-all duration-300"
    >
      {/* ── Stat bar (Gradient Pill Style) ── */}
      <div className="flex items-center gap-6 px-5 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-slate-950/95 dark:via-indigo-950/90 dark:to-purple-950/90 text-white border-b border-white/15 shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-blue-200 dark:text-blue-300 text-sm filter drop-shadow-sm select-none">📏</span>
          <div>
            <p className="text-xs text-blue-100 dark:text-slate-400 font-medium leading-none">Distance</p>
            <p className="font-bold text-lg leading-tight tracking-tight">
              <AnimatedNumber
                value={distance_miles}
                duration={1.0}
                decimals={0}
                formatter={(val) => val.toLocaleString()}
              />{' '}
              <span className="text-xs font-normal text-blue-200 dark:text-slate-400">mi</span>
            </p>
          </div>
        </div>
        <div className="w-px h-8 bg-white/20 dark:bg-slate-700" />
        <div className="flex items-center gap-2">
          <span className="text-blue-200 dark:text-blue-300 text-sm filter drop-shadow-sm select-none">⏱</span>
          <div>
            <p className="text-xs text-blue-100 dark:text-slate-400 font-medium leading-none">Drive Time</p>
            <p className="font-bold text-lg leading-tight tracking-tight">
              <AnimatedNumber
                value={duration_hours}
                duration={1.0}
                decimals={2}
                formatter={(val) => {
                  const h = Math.floor(val);
                  const m = Math.round((val - h) * 60);
                  return h > 0 ? `${h}h ${m}m` : `${m}m`;
                }}
              />
            </p>
          </div>
        </div>
        <div className="w-px h-8 bg-white/20 dark:bg-slate-700" />
        <div className="flex items-center gap-2">
          <span className="text-blue-200 dark:text-blue-300 text-sm filter drop-shadow-sm select-none">📍</span>
          <div>
            <p className="text-xs text-blue-100 dark:text-slate-400 font-medium leading-none">Waypoints</p>
            <p className="font-bold text-lg leading-tight tracking-tight">
              <AnimatedNumber value={waypoints.length} duration={0.8} />
            </p>
          </div>
        </div>
      </div>

      {/* ── Map ── */}
      <MapContainer
        center={center}
        zoom={6}
        className={isDark ? 'dark-theme-map' : ''}
        style={{ height: '420px', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {geometry.length > 1 && (
          <>
            {/* Glow / shadow line */}
            <Polyline
              positions={geometry}
              pathOptions={{
                color: isDark ? '#3b82f6' : '#93c5fd',
                weight: isDark ? 7 : 8,
                opacity: isDark ? 0.4 : 0.45,
              }}
            />
            {/* Main route line */}
            <Polyline
              positions={geometry}
              pathOptions={{
                color: isDark ? '#38bdf8' : '#2563eb',
                weight: 4,
                opacity: 0.95,
              }}
            />
            <FitBounds positions={geometry} />
          </>
        )}

        {waypoints.map((wp, idx) => (
          <Marker
            key={wp.label}
            position={[wp.lat, wp.lng]}
            icon={makeIcon(wp.label, idx)}
          >
            <Popup>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {LABEL_MAP[wp.label] ?? wp.label}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 px-5 py-3 bg-white/75 dark:bg-slate-900/75 backdrop-blur-md border-t border-slate-200/60 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 transition-colors duration-200">
        {waypoints.map((wp, idx) => (
          <motion.div
            key={wp.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 + idx * 0.1 }}
            className="flex items-center gap-1.5"
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shadow-sm"
              style={{ backgroundColor: MARKER_COLORS[wp.label] ?? '#6366f1' }}
            />
            <span className="font-semibold">{LABEL_MAP[wp.label] ?? wp.label}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
