import { useState, useEffect } from 'react';
import { useP1Data } from './hooks/useP1Data.js';
import { PowerDisplay } from './components/PowerDisplay.jsx';
import { PhaseCards } from './components/PhaseCards.jsx';
import { EnergyCards } from './components/EnergyCards.jsx';
import { PowerGraph } from './components/PowerGraph.jsx';
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

  const { measurement: m, history, connectionState } = useP1Data();

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
        </div>
      </header>

      {/* Live graph — top of page */}
      <PowerGraph history={history} powerW={m?.power_w ?? null} />

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

      {/* Footer */}
      <footer className="footer">
        <a href="https://buymeacoffee.com/rutgrrr" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
          made with 🧠 by rutgrrr
        </a>
      </footer>
    </div>
  );
}
