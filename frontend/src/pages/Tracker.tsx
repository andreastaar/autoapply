import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/client';

const statusColors: Record<string, string> = {
  Evaluated: 'bg-blue-100 text-blue-700',
  Applied: 'bg-green-100 text-green-700',
  Interview: 'bg-yellow-100 text-yellow-700',
  Rejected: 'bg-red-100 text-red-600',
  Offer: 'bg-purple-100 text-purple-700',
  Withdrawn: 'bg-gray-100 text-gray-500',
  Ghost: 'bg-gray-100 text-gray-400',
};

const STATUSES = ['Evaluated', 'Applied', 'Interview', 'Offer', 'Rejected', 'Withdrawn', 'Ghost'];

export default function Tracker() {
  const [apps, setApps] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ company: '', role: '', url: '', score: '', status: 'Evaluated' });
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/tracker').then(r => setApps(r.data));
  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/tracker/${id}/status`, { status });
    setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  const viewReport = async (entry: any) => {
    setSelectedReport({ filename: `${entry.company} — ${entry.role}`, content: entry.report.content });
  };

  const addEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await api.post('/tracker', { ...form, score: form.score ? parseFloat(form.score) : null });
    setForm({ company: '', role: '', url: '', score: '', status: 'Evaluated' });
    setShowAdd(false);
    setSaving(false);
    load();
  };

  const filtered = filter
    ? apps.filter(a =>
        a.status?.toLowerCase().includes(filter.toLowerCase()) ||
        a.company?.toLowerCase().includes(filter.toLowerCase())
      )
    : apps;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Applications Tracker</h1>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Filter by company or status..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-56"
            />
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition"
            >
              + Add
            </button>
          </div>
        </div>

        {showAdd && (
          <form onSubmit={addEntry} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-600 mb-4">New Application</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <input required value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Company *"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="Role"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="Job URL"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <input value={form.score} onChange={e => setForm({ ...form, score: e.target.value })} placeholder="Score (0-5)" type="number" step="0.1" min="0" max="5"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-3 mt-3">
              <button type="submit" disabled={saving}
                className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)}
                className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-3 px-4">#</th>
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Company</th>
                  <th className="text-left py-3 px-4">Role</th>
                  <th className="text-left py-3 px-4">Score</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Report</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="py-3 px-4 text-gray-400 font-mono text-xs">{a.number}</td>
                    <td className="py-3 px-4 text-gray-400">{a.date}</td>
                    <td className="py-3 px-4 font-medium text-gray-800">{a.company}</td>
                    <td className="py-3 px-4 text-gray-500 max-w-[180px] truncate">{a.role}</td>
                    <td className="py-3 px-4">
                      {a.score ? (
                        <span className={`font-bold text-sm ${a.score >= 4 ? 'text-green-600' : a.score >= 3 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {a.score}/5
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={a.status}
                        onChange={e => updateStatus(a.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${statusColors[a.status] || 'bg-gray-100 text-gray-500'}`}
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      {a.report ? (
                        <button onClick={() => viewReport(a)} className="text-brand-600 hover:underline text-xs">
                          View →
                        </button>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-center text-gray-400 py-10 text-sm">
                No applications yet. Click <strong>+ Add</strong> to add your first one.
              </p>
            )}
          </div>
        </div>

        {selectedReport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" onClick={() => setSelectedReport(null)}>
            <div className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-gray-800">{selectedReport.filename}</h2>
                <button onClick={() => setSelectedReport(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
              </div>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">{selectedReport.content}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
