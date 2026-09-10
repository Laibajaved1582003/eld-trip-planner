// src/components/RouteMap.jsx
// Renders an interactive Leaflet map showing the driving route polyline and waypoint markers.

import { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup as LeafletPopup,
  Tooltip as LeafletTooltip,
  useMap,
} from 'react-leaflet';
import { motion } from 'framer-motion';
import L from 'leaflet';
import { useTheme } from '../context/ThemeContext';
import AnimatedNumber from './AnimatedNumber';
import Tooltip from './Tooltip';

// Coloured markers for current / pickup / dropoff
const MARKER_COLORS = {
  current: '#3b82f6',   // Blue for Current Location
  pickup:  '#10b981',   // Green for Pickup
  dropoff: '#ef4444',   // Red for Dropoff
};

const LABEL_MAP = {
  current: 'Current Location',
  pickup:  'Pickup',
  dropoff: 'Dropoff',
};

function makeCircularIcon(label) {
  const color = MARKER_COLORS[label] ?? '#3b82f6';
  const html = `
    <div class="custom-marker-wrapper" style="
      width: 22px;
      height: 22px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        position: absolute;
        inset: -2px;
        border-radius: 50%;
        background-color: ${color};
        opacity: 0.35;
        filter: blur(4px);
        pointer-events: none;
      "></div>
      <div class="custom-marker-dot" style="
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background-color: ${color};
        border: 2.5px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
      ">
        <div style="width: 4px; height: 4px; border-radius: 50%; background-color: #ffffff; opacity: 0.9;"></div>
      </div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-leaflet-marker',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
    tooltipAnchor: [0, -14],
  });
}

function formatDriveTime(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Auto-fit bounds to the polyline with generous padding
function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 1) {
      map.fitBounds(positions, {
        padding: [50, 50],
        maxZoom: 14,
        animate: true,
      });
    }
  }, [map, positions]);
  return null;
}

export default function RouteMap({ route, tripInput }) {
  const { isDark } = useTheme();
  const { geometry = [], waypoints = [], distance_miles = 0, duration_hours = 0 } = route;

  // Default center (US center) if no geometry
  const center = geometry.length > 0 ? geometry[Math.floor(geometry.length / 2)] : [39.5, -98.35];

  const getAddress = (label) => {
    if (tripInput) {
      if (label === 'current') return tripInput.current_location;
      if (label === 'pickup')  return tripInput.pickup_location;
      if (label === 'dropoff') return tripInput.dropoff_location;
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="glass-card rounded-2xl overflow-hidden shadow-xl transition-all duration-300"
    >
      {/* ── Stat bar (Gradient Pill Style) ── */}
      <div className="relative z-20 grid grid-cols-3 divide-x divide-white/20 dark:divide-slate-700 px-2 sm:px-5 py-2.5 sm:py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-slate-950/95 dark:via-indigo-950/90 dark:to-purple-950/90 text-white border-b border-white/15 shadow-md">
        <Tooltip text="Total driving distance for this route" position="bottom" className="w-full justify-center">
          <div className="cursor-help px-1 sm:px-2 text-center sm:text-left w-full">
            <p className="text-[10px] sm:text-xs text-blue-100 dark:text-slate-400 font-medium leading-none truncate">Distance</p>
            <p className="font-bold text-sm sm:text-lg leading-tight tracking-tight mt-0.5 sm:mt-1 truncate">
              <AnimatedNumber
                value={distance_miles}
                duration={1.0}
                decimals={0}
                formatter={(val) => val.toLocaleString()}
              />{' '}
              <span className="text-[10px] sm:text-xs font-normal text-blue-200 dark:text-slate-400">mi</span>
            </p>
          </div>
        </Tooltip>
        <Tooltip text="Estimated total driving time, excluding rest stops" position="bottom" className="w-full justify-center">
          <div className="cursor-help px-1 sm:px-2 text-center sm:text-left w-full">
            <p className="text-[10px] sm:text-xs text-blue-100 dark:text-slate-400 font-medium leading-none truncate">Drive Time</p>
            <p className="font-bold text-sm sm:text-lg leading-tight tracking-tight mt-0.5 sm:mt-1 truncate">
              <AnimatedNumber
                value={duration_hours}
                duration={1.0}
                decimals={2}
                formatter={(val) => formatDriveTime(val)}
              />
            </p>
          </div>
        </Tooltip>
        <Tooltip text="Number of stops: current location, pickup, and dropoff" position="bottom" className="w-full justify-center">
          <div className="cursor-help px-1 sm:px-2 text-center sm:text-left w-full">
            <p className="text-[10px] sm:text-xs text-blue-100 dark:text-slate-400 font-medium leading-none truncate">Waypoints</p>
            <p className="font-bold text-sm sm:text-lg leading-tight tracking-tight mt-0.5 sm:mt-1 truncate">
              <AnimatedNumber value={waypoints.length} duration={0.8} />
            </p>
          </div>
        </Tooltip>
      </div>

      {/* ── Map ── */}
      <MapContainer
        center={center}
        zoom={6}
        className={`route-map-container ${isDark ? 'dark-theme-map' : ''}`}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {geometry.length > 1 && (
          <>
            {/* Soft luminous glow polyline */}
            <Polyline
              positions={geometry}
              pathOptions={{
                color: isDark ? '#38bdf8' : '#3b82f6',
                weight: isDark ? 11 : 12,
                opacity: isDark ? 0.35 : 0.28,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Crisp foreground route polyline with sticky hover tooltip */}
            <Polyline
              positions={geometry}
              pathOptions={{
                color: isDark ? '#38bdf8' : '#2563eb',
                weight: 5.5,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            >
              <LeafletTooltip
                sticky
                direction="top"
                className="glassy-map-tooltip"
                opacity={1}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs whitespace-nowrap">
                  <span>{distance_miles.toFixed(2)} mi</span>
                  <span className="opacity-60">·</span>
                  <span>{formatDriveTime(duration_hours)}</span>
                </div>
              </LeafletTooltip>
            </Polyline>
            <FitBounds positions={geometry} />
          </>
        )}

        {waypoints.map((wp, idx) => {
          const role = LABEL_MAP[wp.label] ?? wp.label;
          const address = getAddress(wp.label) || wp.address || wp.name;
          const color = MARKER_COLORS[wp.label] ?? '#3b82f6';

          return (
            <Marker
              key={wp.label || idx}
              position={[wp.lat, wp.lng]}
              icon={makeCircularIcon(wp.label)}
            >
              {/* Hover Tooltip */}
              <LeafletTooltip
                direction="top"
                offset={[0, -14]}
                opacity={1}
                className="glassy-map-tooltip"
              >
                <div className="font-bold text-xs leading-tight flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  {role}
                </div>
                {address && (
                  <div className="text-[11px] text-slate-300 mt-0.5 font-normal truncate max-w-[200px]">
                    {address}
                  </div>
                )}
              </LeafletTooltip>

              {/* Click Popup */}
              <LeafletPopup
                offset={[0, -10]}
                className="glassy-map-popup"
              >
                <div className="p-1 min-w-[140px]">
                  <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5 leading-tight">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: color }} />
                    {role}
                  </div>
                  {address && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-medium leading-snug">
                      {address}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-mono">
                    {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                  </p>
                </div>
              </LeafletPopup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 sm:px-5 py-2.5 sm:py-3 bg-white/75 dark:bg-slate-900/75 backdrop-blur-md border-t border-slate-200/60 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 transition-colors duration-200">
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
