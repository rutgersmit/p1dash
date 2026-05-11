import { useEffect, useRef, useState, useCallback } from 'react';

const HISTORY_SECONDS = 60;
const MAX_POINTS = HISTORY_SECONDS * 2; // two samples per second max

function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

export function useP1Data() {
  const [measurement, setMeasurement] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected');
  // history: array of { t: number (ms), v: number (W) }
  const historyRef = useRef([]);
  const [history, setHistory] = useState([]);

  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectDelay = useRef(1000);
  const unmounted = useRef(false);

  const addHistoryPoint = useCallback((value) => {
    // Always use browser receive-time so the graph window (Date.now()) stays in sync
    const t = Date.now();
    historyRef.current = [
      ...historyRef.current.filter(p => p.t >= t - HISTORY_SECONDS * 1000),
      { t, v: value },
    ].slice(-MAX_POINTS);
    setHistory([...historyRef.current]);
  }, []);

  const connect = useCallback(() => {
    if (unmounted.current) return;
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
    }

    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelay.current = 1000;
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      if (msg.type === 'status') {
        setConnectionState(msg.data?.state ?? 'disconnected');
      } else if (msg.type === 'measurement' && msg.data) {
        setMeasurement(msg.data);
        if (msg.data.power_w != null) {
          addHistoryPoint(msg.data.power_w);
        }
      }
      // meter_error — ignore silently (no-telegram-received etc.)
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      setConnectionState('disconnected');
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30_000);
        connect();
      }, reconnectDelay.current);
    };

    ws.onerror = () => {
      // close fires after error — reconnect handled there
    };
  }, [addHistoryPoint]);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { measurement, history, connectionState };
}
