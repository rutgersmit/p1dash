import { useEffect, useRef, useState, useCallback } from 'react';

const HISTORY_SECONDS  = 60;
const HISTORY_HOUR_MS  = 60 * 60 * 1000;
const MAX_POINTS       = HISTORY_SECONDS * 2;
const MAX_HOUR_POINTS  = 120; // one point/min × 60 min, with headroom

function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

export function useP1Data() {
  const [measurement, setMeasurement] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected');

  const historyRef     = useRef([]);
  const historyHourRef = useRef([]);
  const [history,     setHistory]     = useState([]);
  const [historyHour, setHistoryHour] = useState([]);

  const minuteBufferRef      = useRef([]);
  const minuteBucketStartRef = useRef(null);

  const wsRef          = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectDelay = useRef(1000);
  const unmounted      = useRef(false);

  const addHistoryPoint = useCallback((value) => {
    const t = Date.now();

    // 60-second history: every incoming point
    historyRef.current = [
      ...historyRef.current.filter(p => p.t >= t - HISTORY_SECONDS * 1000),
      { t, v: value },
    ].slice(-MAX_POINTS);
    setHistory([...historyRef.current]);

    // Hour history: one averaged point per minute
    if (minuteBucketStartRef.current === null) minuteBucketStartRef.current = t;
    minuteBufferRef.current.push(value);

    if (t - minuteBucketStartRef.current >= 60_000) {
      const buf = minuteBufferRef.current;
      const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
      minuteBufferRef.current      = [];
      minuteBucketStartRef.current = t;

      historyHourRef.current = [
        ...historyHourRef.current.filter(p => p.t >= t - HISTORY_HOUR_MS),
        { t, v: avg },
      ].slice(-MAX_HOUR_POINTS);
      setHistoryHour([...historyHourRef.current]);
    }
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

    ws.onopen = () => { reconnectDelay.current = 1000; };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      if (msg.type === 'status') {
        setConnectionState(msg.data?.state ?? 'disconnected');
      } else if (msg.type === 'measurement' && msg.data) {
        setMeasurement(msg.data);
        if (msg.data.power_w != null) addHistoryPoint(msg.data.power_w);
      }
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      setConnectionState('disconnected');
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30_000);
        connect();
      }, reconnectDelay.current);
    };

    ws.onerror = () => {};
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

  return { measurement, history, historyHour, connectionState };
}
