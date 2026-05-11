function fmtW(v) {
  if (v == null) return <span className="null-dash">—</span>;
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(2)} kW`;
  return `${Math.round(v)} W`;
}

function phaseColor(v) {
  if (v == null) return 'var(--text-2)';
  if (v > 10)  return 'var(--import)';
  if (v < -10) return 'var(--export)';
  return 'var(--text-2)';
}

export function PhaseCards({ l1, l2, l3 }) {
  // Only render if any phase data is present
  if (l1 == null && l2 == null && l3 == null) return null;

  const phases = [
    { label: 'Phase L1', value: l1 },
    { label: 'Phase L2', value: l2 },
    { label: 'Phase L3', value: l3 },
  ];

  return (
    <div className="phase-grid">
      {phases.map(({ label, value }) => (
        <div key={label} className="card phase-card">
          <div className="phase-number">{label}</div>
          <div className="info-value-sm" style={{ color: phaseColor(value) }}>
            {fmtW(value)}
          </div>
        </div>
      ))}
    </div>
  );
}
