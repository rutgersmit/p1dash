import { useRef, useEffect, useState } from 'react';

function useAnimatedValue(target, duration = 50) {
  const frameRef = useRef(null);
  const fromRef = useRef(target);
  const [current, setCurrent] = useState(target);

  useEffect(() => {
    if (target == null) { setCurrent(null); return; }
    const from = fromRef.current ?? target;
    fromRef.current = target;
    const startTime = performance.now();
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    const step = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setCurrent(from + (target - from) * ease);
      if (t < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);

  return current;
}

function flow(w) {
  if (w == null) return 'idle';
  if (w > 10) return 'import';
  if (w < -10) return 'export';
  return 'idle';
}

function formatW(w) {
  if (w == null) return { value: '—', unit: '' };
  const abs = Math.abs(w);
  if (abs >= 1000) {
    return { value: (w / 1000).toFixed(2), unit: 'kW' };
  }
  return { value: Math.round(w).toString(), unit: 'W' };
}

export function PowerDisplay({ powerW }) {
  const animatedW = useAnimatedValue(powerW);
  const f = flow(powerW);
  const { value, unit } = formatW(animatedW);

  const flowLabel = f === 'import' ? '↑ importing'
    : f === 'export' ? '↓ exporting'
    : '≈ idle';

  return (
    <div className="card power-compact" data-flow={f}>
      <span className="power-compact-label">Current power</span>
      <span className="power-compact-value" data-flow={f}>{value}</span>
      {unit && <span className="power-compact-unit">{unit}</span>}
      <span className="power-compact-badge" data-flow={f}>{flowLabel}</span>
    </div>
  );
}
