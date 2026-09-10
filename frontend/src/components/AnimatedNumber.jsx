// src/components/AnimatedNumber.jsx
// Smoothly animates a number from 0 (or previous value) to a target value.
// Guarantees landing on the exact final value upon completion.

import { useEffect, useState, useRef } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

export default function AnimatedNumber({
  value,
  duration = 0.8,
  decimals = 0,
  formatter = null,
  prefix = '',
  suffix = '',
}) {
  const target = typeof value === 'number' && !isNaN(value) ? value : 0;
  const shouldReduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);

  useEffect(() => {
    if (shouldReduceMotion) {
      prevValueRef.current = target;
      return;
    }

    const startVal = prevValueRef.current;
    const controls = animate(startVal, target, {
      duration,
      ease: [0.16, 1, 0.3, 1], // easeOutExpo
      onUpdate: (latest) => {
        setDisplayValue(latest);
      },
      onComplete: () => {
        // Guarantee landing strictly on the target value
        setDisplayValue(target);
        prevValueRef.current = target;
      },
    });

    return () => controls.stop();
  }, [target, duration, shouldReduceMotion]);

  const activeValue = shouldReduceMotion ? target : displayValue;

  const formatted = formatter
    ? formatter(activeValue)
    : decimals > 0
    ? activeValue.toFixed(decimals)
    : Math.round(activeValue).toLocaleString();

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
