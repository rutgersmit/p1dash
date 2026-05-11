function fmtKwh(v) {
  if (v == null) return '—';
  return v.toFixed(3);
}

export function EnergyCards({ m }) {
  const tariff = m?.tariff ?? m?.active_tariff;

  return (
    <div className="energy-grid">
      {/* Import */}
      <div className="card energy-card">
        <div className="energy-title" data-type="import">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M2 7l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Import
          {tariff != null && (
            <span className="tariff-badge" style={{ marginLeft: 'auto' }}>T{tariff} active</span>
          )}
        </div>
        <div className="energy-row">
          <span className="energy-row-label">Tariff 1 (off-peak)</span>
          <span className="energy-row-value">{fmtKwh(m?.energy_import_t1_kwh)} <small style={{color:'var(--text-3)'}}>kWh</small></span>
        </div>
        <div className="energy-row">
          <span className="energy-row-label">Tariff 2 (peak)</span>
          <span className="energy-row-value">{fmtKwh(m?.energy_import_t2_kwh)} <small style={{color:'var(--text-3)'}}>kWh</small></span>
        </div>
        <div className="energy-row">
          <span className="energy-row-label">Total</span>
          <span className="energy-row-value" style={{color:'var(--import)'}}>{fmtKwh(m?.energy_import_kwh)} <small style={{color:'var(--text-3)'}}>kWh</small></span>
        </div>
      </div>

      {/* Export */}
      <div className="card energy-card">
        <div className="energy-title" data-type="export">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 11V1M2 5l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Export
        </div>
        <div className="energy-row">
          <span className="energy-row-label">Tariff 1 (off-peak)</span>
          <span className="energy-row-value">{fmtKwh(m?.energy_export_t1_kwh)} <small style={{color:'var(--text-3)'}}>kWh</small></span>
        </div>
        <div className="energy-row">
          <span className="energy-row-label">Tariff 2 (peak)</span>
          <span className="energy-row-value">{fmtKwh(m?.energy_export_t2_kwh)} <small style={{color:'var(--text-3)'}}>kWh</small></span>
        </div>
        <div className="energy-row">
          <span className="energy-row-label">Total</span>
          <span className="energy-row-value" style={{color:'var(--export)'}}>{fmtKwh(m?.energy_export_kwh)} <small style={{color:'var(--text-3)'}}>kWh</small></span>
        </div>
      </div>
    </div>
  );
}
