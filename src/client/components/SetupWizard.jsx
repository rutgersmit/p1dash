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

function StepDots({ current }) {
  return (
    <div className="wizard-steps">
      {[0, 1, 2].map(i => (
        <div key={i} className={`wizard-step-dot ${i === current ? 'active' : i < current ? 'done' : ''}`} />
      ))}
    </div>
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
      // 403 from meter → awaiting_button (expected first response)
      // 200 from meter → already done (button was still active from a previous attempt)
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

// ─── Step 2: press button + auto-poll ────────────────────────────────────────
function StepButton({ ip, onDone }) {
  const [status, setStatus] = useState('polling'); // polling | done | error
  const [error, setError] = useState('');
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      try {
        const result = await apiPost('/api/setup/pair', { ip });
        if (result.status === 'ok') {
          clearInterval(intervalRef.current);
          setStatus('done');
        }
        // 'awaiting_button' → keep polling, resets the meter's 30s timer
      } catch (err) {
        clearInterval(intervalRef.current);
        setError(err.message);
        setStatus('error');
      }
    }, 3000);

    return () => clearInterval(intervalRef.current);
  }, [ip]);

  if (status === 'done') {
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

  if (status === 'error') {
    return (
      <>
        <div>
          <div className="wizard-step-label">Step 2 of 2</div>
          <div className="wizard-title">Something went wrong</div>
        </div>
        <div className="wizard-error">{error}</div>
        <button className="wizard-btn" onClick={() => { setStatus('polling'); setError(''); }}>
          Try again
        </button>
      </>
    );
  }

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
            if (done) {
              // Button was still active — skip straight to success
              setStep(2);
            } else {
              setStep(1);
            }
          }} />
        )}
        {step === 1 && (
          <StepButton ip={ctx.ip} onDone={onComplete} />
        )}
      </div>
    </div>
  );
}
