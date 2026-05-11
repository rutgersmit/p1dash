import { useEffect, useRef, useState } from 'react';

const HISTORY_MS = 60_000;
const GRID_LINES = 4;

// Resolve CSS variable at render time
function cssVar(el, name) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

function niceMax(absMax) {
  if (absMax < 100) return 200;
  const step = Math.pow(10, Math.floor(Math.log10(absMax)));
  return Math.ceil(absMax / step) * step * 1.15;
}

// Catmull-Rom → cubic bezier: draws a smooth curve through all pts.
// tension 0 = straight lines, 0.5 = full Catmull-Rom
function traceCurve(ctx, pts, xOf, yOf, tension = 0.4) {
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = xOf(p1.t) + (xOf(p2.t) - xOf(p0.t)) * tension;
    const cp1y = yOf(p1.v) + (yOf(p2.v) - yOf(p0.v)) * tension;
    const cp2x = xOf(p2.t) - (xOf(p3.t) - xOf(p1.t)) * tension;
    const cp2y = yOf(p2.v) - (yOf(p3.v) - yOf(p1.v)) * tension;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, xOf(p2.t), yOf(p2.v));
  }
}

function formatPower(w) {
  if (w == null) return { value: '—', unit: '' };
  const abs = Math.abs(w);
  if (abs >= 1000) return { value: (w / 1000).toFixed(2), unit: 'kW' };
  return { value: Math.round(w).toString(), unit: 'W' };
}

export function PowerGraph({ history, powerW }) {
  const canvasRef  = useRef(null);
  const cardRef    = useRef(null);
  const rafRef     = useRef(null);
  const historyRef = useRef(history);
  historyRef.current = history;

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      cardRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Handle hi-DPI displays
    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    function draw() {
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width;
      const H = canvas.height;
      const now = Date.now();

      // ── Colors from CSS custom properties ──────────────────────────────
      const bgColor     = cssVar(canvas, '--bg-card') || '#1c2128';
      const borderColor = cssVar(canvas, '--border') || '#30363d';
      const text3       = cssVar(canvas, '--text-3') || '#6e7681';
      const importColor = cssVar(canvas, '--import') || '#f97316';
      const exportColor = cssVar(canvas, '--export') || '#22c55e';

      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);

      const PAD_TOP    = 24 * dpr;
      const PAD_BOTTOM = 28 * dpr;
      const PAD_LEFT   = 52 * dpr;
      const PAD_RIGHT  = 12 * dpr;

      const plotW = W - PAD_LEFT - PAD_RIGHT;
      const plotH = H - PAD_TOP - PAD_BOTTOM;

      const data = historyRef.current;
      const windowStart = now - HISTORY_MS;

      // Determine y scale
      const visibleVals = data.filter(p => p.t >= windowStart).map(p => p.v);
      const absMax = visibleVals.length ? Math.max(...visibleVals.map(Math.abs), 0) : 500;
      const yMax = niceMax(absMax);

      // Coordinate transforms
      const xOf = (t) => PAD_LEFT + ((t - windowStart) / HISTORY_MS) * plotW;
      const yOf = (v) => PAD_TOP + (1 - (v + yMax) / (2 * yMax)) * plotH;

      const zeroY = yOf(0);

      // ── Y-axis grid lines & labels ──────────────────────────────────────
      ctx.font = `${10 * dpr}px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      const step = yMax / (GRID_LINES / 2);
      for (let i = -GRID_LINES / 2; i <= GRID_LINES / 2; i++) {
        const v = i * step;
        const y = yOf(v);
        if (y < PAD_TOP - 2 || y > PAD_TOP + plotH + 2) continue;

        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 0.5 * dpr;
        ctx.globalAlpha = v === 0 ? 0.7 : 0.35;
        ctx.setLineDash(v === 0 ? [] : [4 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.moveTo(PAD_LEFT, y);
        ctx.lineTo(PAD_LEFT + plotW, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // Label
        const label = Math.abs(v) >= 1000
          ? `${(v / 1000).toFixed(1)}k`
          : `${Math.round(v)}`;
        ctx.fillStyle = v === 0 ? borderColor : text3;
        ctx.fillText(label, PAD_LEFT - 6 * dpr, y);
      }

      // ── X-axis time labels ──────────────────────────────────────────────
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = text3;
      for (let s = 0; s <= 60; s += 15) {
        const t = now - (60 - s) * 1000;
        const x = xOf(t);
        const label = s === 60 ? 'now' : `-${60 - s}s`;
        ctx.fillText(label, x, PAD_TOP + plotH + 6 * dpr);
      }

      // ── No-data state ──────────────────────────────────────────────────
      if (data.length < 2) {
        ctx.fillStyle = text3;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${11 * dpr}px -apple-system, system-ui, sans-serif`;
        ctx.fillText('Waiting for data…', W / 2, H / 2);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // ── Build point list (include synthetic boundary points) ────────────
      const visible = data.filter(p => p.t >= windowStart - 2000); // slight overshoot for edges
      if (visible.length < 1) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Extend line to "now" using the last known value
      const last = visible[visible.length - 1];
      const points = [...visible, { t: now, v: last.v }];

      // ── Clip to plot area ───────────────────────────────────────────────
      ctx.save();
      ctx.beginPath();
      ctx.rect(PAD_LEFT, PAD_TOP, plotW, plotH);
      ctx.clip();

      // ── Area fill: positive (import) — smooth curve, clipped above zero ──
      {
        const grad = ctx.createLinearGradient(0, PAD_TOP, 0, zeroY);
        grad.addColorStop(0, 'rgba(249,115,22,0.45)');
        grad.addColorStop(1, 'rgba(249,115,22,0.04)');

        ctx.save();
        ctx.beginPath();
        ctx.rect(PAD_LEFT, PAD_TOP, plotW, zeroY - PAD_TOP);
        ctx.clip();

        ctx.beginPath();
        ctx.moveTo(xOf(points[0].t), zeroY);
        ctx.lineTo(xOf(points[0].t), yOf(points[0].v));
        traceCurve(ctx, points, xOf, yOf);
        ctx.lineTo(xOf(points[points.length - 1].t), zeroY);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      }

      // ── Area fill: negative (export) — smooth curve, clipped below zero ──
      {
        const grad = ctx.createLinearGradient(0, zeroY, 0, PAD_TOP + plotH);
        grad.addColorStop(0, 'rgba(34,197,94,0.04)');
        grad.addColorStop(1, 'rgba(34,197,94,0.45)');

        ctx.save();
        ctx.beginPath();
        ctx.rect(PAD_LEFT, zeroY, plotW, PAD_TOP + plotH - zeroY);
        ctx.clip();

        ctx.beginPath();
        ctx.moveTo(xOf(points[0].t), zeroY);
        ctx.lineTo(xOf(points[0].t), yOf(points[0].v));
        traceCurve(ctx, points, xOf, yOf);
        ctx.lineTo(xOf(points[points.length - 1].t), zeroY);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      }

      // ── Smooth line — one pass per color, clip above/below zero line ─────
      const drawLine = (color, clipY, clipH) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(PAD_LEFT, clipY, plotW, clipH);
        ctx.clip();
        ctx.beginPath();
        ctx.moveTo(xOf(points[0].t), yOf(points[0].v));
        traceCurve(ctx, points, xOf, yOf);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * dpr;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      };
      drawLine(importColor, PAD_TOP,  zeroY - PAD_TOP);          // above zero → orange
      drawLine(exportColor, zeroY,    PAD_TOP + plotH - zeroY);   // below zero → green

      // ── Current value dot ───────────────────────────────────────────────
      const cur = points[points.length - 1];
      const dotColor = cur.v >= 0 ? importColor : exportColor;
      const cx = xOf(cur.t);
      const cy = yOf(cur.v);
      // Glow
      ctx.beginPath();
      ctx.arc(cx, cy, 6 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = dotColor.replace(')', ',0.25)').replace('rgb(', 'rgba(').replace('#', '');
      // Simple approach: just draw outer ring with low alpha via globalAlpha
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = dotColor;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.arc(cx, cy, 3 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.fill();

      ctx.restore(); // restore plot clip

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []); // run once — data flows in via historyRef

  return (
    <div className="card graph-card" ref={cardRef}>
      <div className="graph-header">
        <span className="graph-title">Power — last 60 s</span>
        <span className="graph-legend">
          <span><span className="legend-dot" style={{ background: 'var(--import)' }} />Import</span>
          <span><span className="legend-dot" style={{ background: 'var(--export)' }} />Export</span>
        </span>
        <button className="theme-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} aria-label="Toggle fullscreen">
          {isFullscreen ? (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M5 1v4H1M11 1v4h4M5 15v-4H1M11 15v-4h4" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 5V1h4M15 5V1h-4M1 11v4h4M15 11v4h-4" />
            </svg>
          )}
        </button>
      </div>
      <div className="graph-canvas-wrap">
        <canvas ref={canvasRef} />
        {isFullscreen && (() => {
          const { value, unit } = formatPower(powerW);
          const flow = powerW == null ? 'idle' : powerW > 10 ? 'import' : powerW < -10 ? 'export' : 'idle';
          return (
            <div className="graph-fs-overlay" data-flow={flow}>
              <span className="graph-fs-value">{value}</span>
              {unit && <span className="graph-fs-unit">{unit}</span>}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
