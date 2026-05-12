import { useState, useEffect } from 'react';
import { useP1Data } from './hooks/useP1Data.js';
import { PowerDisplay } from './components/PowerDisplay.jsx';
import { PhaseCards } from './components/PhaseCards.jsx';
import { EnergyCards } from './components/EnergyCards.jsx';
import { PowerGraph } from './components/PowerGraph.jsx';
import { HourGraph } from './components/HourGraph.jsx';
import { StatusPill, ThemeToggle } from './components/StatusBar.jsx';
import { SetupWizard } from './components/SetupWizard.jsx';

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function fmtTimestamp(ts) {
  if (!ts) return null;
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function App() {
  const [configured, setConfigured] = useState(null); // null = loading

  useEffect(() => {
    fetch('/api/setup/status')
      .then(r => r.json())
      .then(d => setConfigured(d.configured))
      .catch(() => setConfigured(false));
  }, []);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') ?? getSystemTheme();
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Follow system preference changes unless user overrode
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      if (!localStorage.getItem('theme-manual')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleTheme = () => {
    localStorage.setItem('theme-manual', '1');
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  };

  const { measurement: m, history, historyHour, connectionState } = useP1Data();

  const updatedAt = fmtTimestamp(m?.timestamp);

  if (configured === null) return null; // brief loading flash
  if (!configured) {
    return <SetupWizard onComplete={() => setConfigured(true)} />;
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <svg className="logo" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="currentColor" fillOpacity="0.1"/>
            <path d="M16 6l-8 14h6v6l8-14h-6V6z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
          </svg>
          <h1>P1 Dash</h1>
        </div>
        <div className="header-right">
          <StatusPill state={connectionState} />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button
            className="theme-btn"
            onClick={() => setConfigured(false)}
            title="Reconfigure meter"
            aria-label="Reconfigure meter"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </header>

      {/* Live graph — top of page */}
      <PowerGraph history={history} historyHour={historyHour} powerW={m?.power_w ?? null} />

      {/* Current power — compact, below the graph */}
      <PowerDisplay powerW={m?.power_w ?? null} />

      {/* Per-phase (only if any data present) */}
      <PhaseCards
        l1={m?.power_l1_w ?? null}
        l2={m?.power_l2_w ?? null}
        l3={m?.power_l3_w ?? null}
      />

      {/* Energy totals */}
      <EnergyCards m={m} />

      {/* Hour graph */}
      <HourGraph history={historyHour} />

      {/* Footer */}
      <footer className="footer">
        <a href="https://buymeacoffee.com/rutgrrr" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
          made with ☕ by rutgrrr
        </a>
        <span style={{ color: 'var(--border)', margin: '0 8px' }}>·</span>
        <a href="https://github.com/rutgersmit/p1dash" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ verticalAlign: 'middle', marginRight: '4px', marginTop: '-2px' }}>
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          GitHub
        </a>
      </footer>
    </div>
  );
}
