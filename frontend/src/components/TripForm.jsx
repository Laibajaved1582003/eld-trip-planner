// src/components/TripForm.jsx
// Controlled, presentational form — calls props.onSubmit(formData), never the API directly.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const INITIAL = {
  current_location: '',
  pickup_location: '',
  dropoff_location: '',
  current_cycle_used: '',
};

function FieldError({ msg }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.p
          initial={{ opacity: 0, y: -4, x: 0 }}
          animate={{ opacity: 1, y: 0, x: [0, -3, 3, -2, 2, 0] }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.28, ease: 'easeInOut' }}
          className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-semibold"
        >
          <span aria-hidden="true">⚠️</span> {msg}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export default function TripForm({ onSubmit, isLoading }) {
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!form.current_location.trim()) errs.current_location = 'Current location is required.';
    if (!form.pickup_location.trim()) errs.pickup_location = 'Pickup location is required.';
    if (!form.dropoff_location.trim()) errs.dropoff_location = 'Dropoff location is required.';
    const cycle = parseFloat(form.current_cycle_used);
    if (form.current_cycle_used === '' || isNaN(cycle)) {
      errs.current_cycle_used = 'Cycle hours used is required.';
    } else if (cycle < 0 || cycle > 70) {
      errs.current_cycle_used = 'Must be between 0 and 70 hours.';
    }
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onSubmit({
      current_location: form.current_location.trim(),
      pickup_location: form.pickup_location.trim(),
      dropoff_location: form.dropoff_location.trim(),
      current_cycle_used: parseFloat(form.current_cycle_used),
    });
  };

  const inputBase =
    'w-full rounded-xl border border-slate-300/80 dark:border-white/10 bg-white/80 dark:bg-slate-800/70 ' +
    'px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 ' +
    'shadow-sm backdrop-blur-md transition-all duration-200 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:focus:ring-blue-400/50 ' +
    'focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800/95 focus:shadow-md ' +
    'hover:border-slate-400/80 dark:hover:border-white/20';

  const inputError =
    'border-red-400 dark:border-red-500 focus:ring-red-400 dark:focus:ring-red-400 focus:border-red-400';

  const labelBase = 'block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5';

  const fields = [
    { name: 'current_location', label: '📍 Current Location', placeholder: 'e.g. Chicago, IL' },
    { name: 'pickup_location',  label: '📦 Pickup Location',  placeholder: 'e.g. Indianapolis, IN' },
    { name: 'dropoff_location', label: '🏁 Dropoff Location', placeholder: 'e.g. Nashville, TN' },
  ];

  return (
    <motion.form
      onSubmit={handleSubmit}
      noValidate
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="space-y-4">
        {fields.map(({ name, label, placeholder }) => (
          <div key={name}>
            <label htmlFor={name} className={labelBase}>{label}</label>
            <input
              id={name}
              name={name}
              type="text"
              value={form[name]}
              onChange={handleChange}
              placeholder={placeholder}
              disabled={isLoading}
              className={`${inputBase} ${errors[name] ? inputError : ''} disabled:opacity-50 disabled:cursor-not-allowed`}
            />
            <FieldError msg={errors[name]} />
          </div>
        ))}

        {/* Cycle hours */}
        <div>
          <label htmlFor="current_cycle_used" className={labelBase}>
            ⏱ Cycle Hours Used <span className="text-slate-500 dark:text-slate-400 normal-case font-normal">(0 – 70 hrs)</span>
          </label>
          <input
            id="current_cycle_used"
            name="current_cycle_used"
            type="number"
            min="0"
            max="70"
            step="0.5"
            value={form.current_cycle_used}
            onChange={handleChange}
            placeholder="e.g. 20"
            disabled={isLoading}
            className={`${inputBase} ${errors.current_cycle_used ? inputError : ''} disabled:opacity-50 disabled:cursor-not-allowed`}
          />
          <FieldError msg={errors.current_cycle_used} />
        </div>

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={isLoading}
          id="plan-trip-btn"
          whileTap={!isLoading ? { scale: 0.97 } : undefined}
          whileHover={!isLoading ? { scale: 1.02 } : undefined}
          className={
            'w-full rounded-xl py-3 px-6 text-sm font-bold text-white tracking-wide ' +
            'transition-all duration-200 shadow-lg ' +
            (isLoading
              ? 'bg-blue-400/80 dark:bg-blue-600/50 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 shadow-blue-500/25 hover:shadow-indigo-500/35 hover:shadow-xl active:scale-[0.98]')
          }
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span
                className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
              />
              Planning Route…
            </span>
          ) : (
            '🚛  Plan My Trip'
          )}
        </motion.button>
      </div>
    </motion.form>
  );
}
