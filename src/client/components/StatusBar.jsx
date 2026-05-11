const STATE_LABELS = {
  connected:    'Connected',
  connecting:   'Connecting…',
  disconnected: 'Disconnected',
  error:        'Error',
};

export function StatusPill({ state }) {
  return (
    <div className="status-pill" data-state={state}>
      <span className="status-dot" />
      {STATE_LABELS[state] ?? state}
    </div>
  );
}

export function ThemeToggle({ theme, onToggle }) {
  return (
    <button className="theme-btn" onClick={onToggle} title="Toggle theme" aria-label="Toggle light/dark theme">
      {theme === 'dark' ? (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8" cy="8" r="3.5"/>
          <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M11.7 3.2l-1.1 1.1M3.2 11.7l1.1 1.1" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M13.5 8.5A5.5 5.5 0 1 1 7.5 2.5a4 4 0 0 0 6 6z" />
        </svg>
      )}
    </button>
  );
}
