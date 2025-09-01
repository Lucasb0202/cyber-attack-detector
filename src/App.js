import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

/**
 * Drop-in replacement for your current App.js UI.
 * - Polls /latest every 2s (configurable)
 * - Maintains a rolling history of the last 100 detections
 * - Shows live status, confidence bar, sparkline, and a table with filters
 * - Exposes buttons to download the latest PDF report and refresh now
 *
 * Minimal deps: axios only. No CSS framework required.
 * Paste this file as App.jsx (or App.js) and ensure axios is installed.
 */

// ==== CONFIG ====
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000"; // set REACT_APP_API_BASE in .env for prod
const POLL_MS = 2000;
const MAX_HISTORY = 100;

function ConfidenceBar({ value }) {
  const pct = Math.max(0, Math.min(100, (value || 0) * 100));
  return (
    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden" aria-label="confidence-bar">
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: "linear-gradient(90deg, #60a5fa, #22c55e)" }}
      />
    </div>
  );
}

function Sparkline({ points = [] }) {
  // Simple inline SVG sparkline
  const width = 180;
  const height = 40;
  const pad = 4;
  if (!points.length) return <div className="text-sm text-gray-500">No data</div>;
  const xs = points.map((_, i) => i);
  const minY = Math.min(...points);
  const maxY = Math.max(...points);
  const rangeY = maxY - minY || 1;
  const scaleX = (width - pad * 2) / Math.max(1, points.length - 1);
  const scaleY = (height - pad * 2) / rangeY;
  const d = points
    .map((y, i) => {
      const x = pad + i * scaleX;
      const ny = pad + (height - pad * 2) - (y - minY) * scaleY;
      return `${i === 0 ? "M" : "L"}${x},${ny}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} role="img" aria-label="confidence-sparkline">
      <path d={d} fill="none" stroke="#0ea5e9" strokeWidth="2" />
    </svg>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="flex flex-col p-4 rounded-2xl shadow-sm border border-gray-100 bg-white">
      <div className="text-gray-500 text-sm">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub ? <div className="text-gray-500 text-xs mt-1">{sub}</div> : null}
    </div>
  );
}

function HeaderActions({ onRefresh, latestReportUrl }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onRefresh}
        className="px-3 py-2 rounded-xl bg-black text-white text-sm hover:opacity-90"
        aria-label="Refresh now"
      >
        Refresh now
      </button>
      <a
        href={latestReportUrl}
        className="px-3 py-2 rounded-xl bg-gray-900/80 text-white text-sm hover:opacity-90"
        aria-label="Download latest report"
        target="_blank"
        rel="noreferrer"
      >
        Download latest report
      </a>
    </div>
  );
}

export default function App() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]); // {ts, attack_type, confidence}
  const [filter, setFilter] = useState("");
  const [onlyAttacks, setOnlyAttacks] = useState(true);
  const [polling, setPolling] = useState(true);
  const timerRef = useRef(null);

  const fetchLatest = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/latest`);
      setLatest(data);
      const record = {
        ts: new Date().toISOString(),
        attack_type: data.attack_type || "None",
        confidence: typeof data.confidence === "number" ? data.confidence : 0,
      };
      setHistory((prev) => {
        const next = [...prev, record];
        return next.slice(-MAX_HISTORY);
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (polling) {
      timerRef.current = setInterval(fetchLatest, POLL_MS);
    }
    return () => timerRef.current && clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling]);

  const filtered = useMemo(() => {
    return history.filter((h) => {
      const matchesText = filter
        ? h.attack_type?.toLowerCase().includes(filter.toLowerCase())
        : true;
      const matchesType = onlyAttacks ? h.attack_type && h.attack_type !== "None" : true;
      return matchesText && matchesType;
    });
  }, [history, filter, onlyAttacks]);

  const counts = useMemo(() => {
    const total = history.length;
    const attacks = history.filter((h) => h.attack_type && h.attack_type !== "None").length;
    const benign = total - attacks;
    const lastAttack = [...history].reverse().find((h) => h.attack_type && h.attack_type !== "None");
    return { total, attacks, benign, lastAttackAt: lastAttack?.ts };
  }, [history]);

  const spark = useMemo(() => filtered.map((h) => h.confidence || 0), [filtered]);

  const latestReportUrl = `${API_BASE}/reports/latest`; // backend route we'll add below

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">5G Cyber Attack Dashboard</h1>
            <p className="text-sm text-gray-500">Live inference & reporting</p>
          </div>
          <HeaderActions onRefresh={fetchLatest} latestReportUrl={latestReportUrl} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Top status row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="col-span-1 md:col-span-2 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-gray-500">Current status</div>
                <div className="mt-1 text-xl font-semibold">
                  {latest?.attack_type && latest.attack_type !== "None" ? (
                    <span className="text-red-600">Attack detected: {latest.attack_type}</span>
                  ) : (
                    <span className="text-emerald-600">No active attack</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Confidence</div>
                <div className="mt-1 text-lg font-medium">{((latest?.confidence || 0) * 100).toFixed(1)}%</div>
              </div>
            </div>
            <div className="mt-3">
              <ConfidenceBar value={latest?.confidence || 0} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={polling} onChange={(e) => setPolling(e.target.checked)} />
                Auto-refresh (every {POLL_MS / 1000}s)
              </label>
            </div>
          </div>

          <Stat label="Total samples" value={counts.total} sub="since page load" />
          <Stat label="Attacks" value={counts.attacks} sub={`Benign: ${counts.benign}`} />
          <div className="flex flex-col p-4 rounded-2xl shadow-sm border border-gray-100 bg-white">
            <div className="text-gray-500 text-sm">Confidence trend</div>
            <div className="mt-2"><Sparkline points={spark} /></div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Filter by attack type…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-sky-200"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyAttacks} onChange={(e) => setOnlyAttacks(e.target.checked)} />
            Only attacks
          </label>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">Timestamp</th>
                <th className="text-left px-4 py-3">Attack Type</th>
                <th className="text-left px-4 py-3">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-500">No records yet</td>
                </tr>
              ) : (
                filtered
                  .slice()
                  .reverse()
                  .map((row, i) => (
                    <tr key={`${row.ts}-${i}`} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{new Date(row.ts).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        {row.attack_type && row.attack_type !== "None" ? (
                          <span className="px-2 py-1 rounded-lg bg-red-50 text-red-700">{row.attack_type}</span>
                        ) : (
                          <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3 w-64">
                        <div className="flex items-center gap-3">
                          <div className="w-40"><ConfidenceBar value={row.confidence || 0} /></div>
                          <div className="w-14 text-right tabular-nums">{((row.confidence || 0) * 100).toFixed(1)}%</div>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-8 text-xs text-gray-500">
          API base: {API_BASE} · History kept in-memory (last {MAX_HISTORY})
        </div>
      </main>
    </div>
  );
}

