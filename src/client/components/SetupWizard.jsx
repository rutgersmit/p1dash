import { useState, useEffect, useRef } from 'react';

const TIMEOUT_MS = 15_000;

async function apiPost(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('No response from meter after 15 seconds. Check the IP address and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function StepDots({ current, total = 3 }) {
  return (
    <div className="wizard-steps">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`wizard-step-dot ${i === current ? 'active' : i < current ? 'done' : ''}`} />
      ))}
    </div>
  );
}

// ─── Shared success screen ────────────────────────────────────────────────────
function StepDone({ onDone }) {
  return (
    <>
      <div className="wizard-success-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div>
        <div className="wizard-step-label">All done</div>
        <div className="wizard-title">Connected!</div>
      </div>
      <div className="wizard-body">
        P1 Dash is now connected to your meter. Your energy data will appear on the dashboard.
      </div>
      <button className="wizard-btn" onClick={onDone}>Go to dashboard</button>
    </>
  );
}

// ─── Step 1: enter IP ────────────────────────────────────────────────────────
function StepConnect({ onNext }) {
  const [ip, setIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConnect() {
    setError('');
    setLoading(true);
    try {
      const result = await apiPost('/api/setup/pair', { ip });
      onNext({ ip, done: result.status === 'ok' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div>
        <div className="wizard-step-label">Step 1 of 2</div>
        <div className="wizard-title">Connect to your P1 meter</div>
      </div>
      <div className="wizard-body">
        Enter the local IP address of your HomeWizard P1 meter. You can find it in your router's device list or in the HomeWizard Energy app.
      </div>
      <div className="wizard-input-group">
        <label htmlFor="ip">IP address</label>
        <input
          id="ip"
          className="wizard-input"
          type="text"
          placeholder="192.168.1.100"
          value={ip}
          onChange={e => setIp(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ip && handleConnect()}
          autoFocus
        />
      </div>
      {loading && <div className="wizard-spinner" />}
      {error && <div className="wizard-error">{error}</div>}
      <button className="wizard-btn" onClick={handleConnect} disabled={!ip || loading}>
        {loading ? 'Connecting…' : 'Connect'}
      </button>
    </>
  );
}

// ─── Step 2: press button OR enter token manually ─────────────────────────────
function StepPair({ ip, onDone }) {
  const [mode, setMode]     = useState('button'); // 'button' | 'manual'
  const [status, setStatus] = useState('polling'); // polling | done | error
  const [error, setError]   = useState('');
  const [token, setToken]   = useState('');
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef(null);

  // Auto-poll when in button mode
  useEffect(() => {
    if (mode !== 'button' || status !== 'polling') return;

    intervalRef.current = setInterval(async () => {
      try {
        const result = await apiPost('/api/setup/pair', { ip });
        if (result.status === 'ok') {
          clearInterval(intervalRef.current);
          setStatus('done');
        }
      } catch (err) {
        clearInterval(intervalRef.current);
        setError(err.message);
        setStatus('error');
      }
    }, 3000);

    return () => clearInterval(intervalRef.current);
  }, [ip, mode, status]);

  // Stop polling when switching to manual mode
  function switchToManual() {
    clearInterval(intervalRef.current);
    setMode('manual');
    setStatus('idle');
    setError('');
  }

  function switchToButton() {
    setMode('button');
    setStatus('polling');
    setError('');
  }

  async function handleSaveToken() {
    if (!token.trim()) return;
    setError('');
    setSaving(true);
    try {
      await apiPost('/api/setup/save', { ip, token: token.trim() });
      setStatus('done');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (status === 'done') return <StepDone onDone={onDone} />;

  if (status === 'error') {
    return (
      <>
        <div>
          <div className="wizard-step-label">Step 2 of 2</div>
          <div className="wizard-title">Something went wrong</div>
        </div>
        <div className="wizard-error">{error}</div>
        <button className="wizard-btn" onClick={switchToButton}>Try again</button>
      </>
    );
  }

  if (mode === 'manual') {
    return (
      <>
        <div>
          <div className="wizard-step-label">Step 2 of 2</div>
          <div className="wizard-title">Enter your token</div>
        </div>
        <div className="wizard-body">
          Paste the token that was previously issued to P1 Dash by your meter.
          You can find it in the HomeWizard Energy app under <strong>Meter settings → Manage access</strong>.
        </div>
        <div className="wizard-input-group">
          <label htmlFor="token">Token</label>
          <input
            id="token"
            className="wizard-input"
            type="text"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && token.trim() && handleSaveToken()}
            autoFocus
          />
        </div>
        {error && <div className="wizard-error">{error}</div>}
        <button className="wizard-btn" onClick={handleSaveToken} disabled={!token.trim() || saving}>
          {saving ? 'Saving…' : 'Save token'}
        </button>
        <button className="wizard-btn wizard-btn-secondary" onClick={switchToButton} disabled={saving}>
          Pair by pressing the button instead
        </button>
      </>
    );
  }

  // Default: button-press mode
  return (
    <>
      <div>
        <div className="wizard-step-label">Step 2 of 2</div>
        <div className="wizard-title">Press the button on your meter</div>
      </div>
      <div className="wizard-meter-icon">
        <div className="wizard-meter-box">
          <div className="wizard-btn-indicator" />
        </div>
      </div>
      <div className="wizard-body">
        Walk to your P1 meter and <strong>press the small button</strong> on the device.
        P1 Dash is waiting and will continue automatically once you've pressed it.
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', textAlign: 'center' }}>
        Waiting for button press…
      </div>
      <button className="wizard-btn wizard-btn-secondary" onClick={switchToManual}>
        Enter token manually
      </button>
    </>
  );
}

// ─── Wizard shell ─────────────────────────────────────────────────────────────
export function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [ctx, setCtx]   = useState({});

  return (
    <div className="wizard-wrap">
      <div className="wizard-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <svg className="wizard-logo" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="currentColor" fillOpacity="0.1"/>
            <path d="M16 6l-8 14h6v6l8-14h-6V6z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
          </svg>
          <StepDots current={step} />
        </div>

        {step === 0 && (
          <StepConnect onNext={({ ip, done }) => {
            setCtx({ ip });
            setStep(done ? 2 : 1);
          }} />
        )}
        {step === 1 && <StepPair ip={ctx.ip} onDone={onComplete} />}
        {step === 2 && <StepDone onDone={onComplete} />}
      </div>
    </div>
  );
}
