import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Download } from 'lucide-react'

const API_BASE = "http://localhost:8000";
const POLL_MS = 2000;
const MAX_HISTORY = 200;

function ConfidenceBar({ value }) {
  const pct = Math.max(0, Math.min(100, (value || 0) * 100));
  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden" aria-label="confidence-bar">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#60a5fa,#22c55e)" }} />
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-[92vw] max-w-4xl max-h-[80vh] overflow-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="px-2 py-1 text-sm rounded-md hover:bg-gray-100" onClick={onClose}>Close</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function KeyValueGrid({ obj }) {
  const entries = Object.entries(obj || {});
  if (!entries.length) return <div className="text-sm text-gray-500">No features</div>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-start gap-2 p-2 rounded-lg border border-gray-100">
          <div className="text-gray-500 text-xs min-w-28">{k}</div>
          <div className="font-mono text-xs break-all">{String(v)}</div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [polling, setPolling] = useState(true);
  const [onlyAttacks, setOnlyAttacks] = useState(false);
  const [query, setQuery] = useState("");
  const [details, setDetails] = useState(null);

  const timerRef = useRef(null);

  const fetchLatest = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/latest`);
      setLatest(data);

      const item = {
        id: data.id || `local-${Date.now()}`,
        ts: data.ts || new Date().toISOString(),
        attack_type: data.attack_type || "None",
        confidence: typeof data.confidence === "number" ? data.confidence : 0,
        features: data.features || null,
      };

      setHistory(prev => {
        const existing = new Map(prev.map(r => [r.id, r]));
        existing.set(item.id, item);
        const deduped = Array.from(existing.values());
        deduped.sort((a, b) => new Date(b.ts) - new Date(a.ts));
        return deduped.slice(0, MAX_HISTORY);
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLatest();
  }, []);

  useEffect(() => {
    if (polling) {
      timerRef.current = setInterval(fetchLatest, POLL_MS);
    }
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [polling]);

  const filtered = useMemo(() => {
    let rows = history.slice(); 
    if (onlyAttacks) rows = rows.filter(r => r.attack_type && r.attack_type !== "None");
    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter(r =>
        (r.attack_type || "").toLowerCase().includes(q) ||
        (r.id || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [history, onlyAttacks, query]);

  const downloadReport = (id) => {
    window.open(`${API_BASE}/reports/${id}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">5G Cyber Attack Dashboard</h1>
            <p className="text-sm text-gray-500">Live inference</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 flex items-center gap-2">
              <input type="checkbox" checked={polling} onChange={(e)=>setPolling(e.target.checked)} />
              Auto-refresh
            </label>
            <button
              className="px-3 py-2 rounded-xl bg-black text-white text-sm hover:opacity-90"
              onClick={fetchLatest}
            >
              Refresh now
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
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
          <div className="mt-3"><ConfidenceBar value={latest?.confidence || 0} /></div>
          <div className="mt-3 text-sm text-gray-500">
            Showing last {Math.min(history.length, MAX_HISTORY)} events
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Filter by attack type or event id…"
            value={query}
            onChange={(e)=>setQuery(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-sky-200"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyAttacks} onChange={(e)=>setOnlyAttacks(e.target.checked)} />
            Only attacks
          </label>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">Time</th>
                <th className="text-left px-4 py-3">Event ID</th>
                <th className="text-left px-4 py-3">Attack</th>
                <th className="text-left px-4 py-3">Confidence</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No events yet</td></tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{new Date(row.ts).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-[11px] break-all max-w-[220px]">{row.id}</td>
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
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100" onClick={()=>setDetails(row)}>Details</button>
                        <button className="px-3 py-1.5 rounded-lg bg-black text-white hover:opacity-90" onClick={()=>downloadReport(row.id)}><Download /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      <Modal open={!!details} onClose={()=>setDetails(null)} title={`Event details — ${details?.id || ""}`}>
        <div className="space-y-3">
          <div className="text-sm text-gray-600">Time: {details ? new Date(details.ts).toLocaleString() : ""}</div>
          <div className="text-sm text-gray-600">Attack: {details?.attack_type || "None"}</div>
          <div className="text-sm text-gray-600">Confidence: {details ? ((details.confidence || 0) * 100).toFixed(2) + "%" : ""}</div>
          <div className="pt-2">
            <h4 className="font-semibold mb-2">Feature Snapshot</h4>
            <KeyValueGrid obj={details?.features || {}} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
