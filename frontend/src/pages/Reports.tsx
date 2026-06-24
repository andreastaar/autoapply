import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/client';

export default function Reports() {
  const [reports, setReports] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ filename: '', slug: '', content: '', date: '' });
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/reports').then(r => setReports(r.data));
  useEffect(() => { load(); }, []);

  const open = async (dbId: string, filename: string) => {
    const { data } = await api.get(`/reports/${dbId}`);
    setSelected(data);
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await api.post('/reports', form);
    setForm({ filename: '', slug: '', content: '', date: '' });
    setShowUpload(false);
    setSaving(false);
    load();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-10 flex gap-6">
        <div className="w-72 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-gray-800">Evaluation Reports</h1>
            <button onClick={() => setShowUpload(!showUpload)} className="text-xs text-brand-600 hover:underline">
              + New
            </button>
          </div>

          {showUpload && (
            <form onSubmit={upload} className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm space-y-2">
              <input required value={form.filename} onChange={e => setForm({ ...form, filename: e.target.value })} placeholder="Filename (e.g. 002-google.md)"
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <input required value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="Slug (e.g. google-swe)"
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <input value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} placeholder="Date (YYYY-MM-DD)"
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <textarea required value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Report content (markdown)"
                rows={6}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono" />
              <button type="submit" disabled={saving}
                className="w-full bg-brand-600 text-white py-1.5 rounded text-xs font-medium hover:bg-brand-700 transition disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Report'}
              </button>
            </form>
          )}

          <div className="space-y-1">
            {reports.length === 0 && <p className="text-gray-400 text-sm">No reports yet</p>}
            {reports.map(r => (
              <button
                key={r.dbId}
                onClick={() => open(r.dbId, r.filename)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition ${
                  selected?.filename === r.filename
                    ? 'bg-brand-50 text-brand-700 border border-brand-200'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                <span className="font-mono text-xs text-gray-400 mr-2">{r.id}</span>
                <span className="capitalize">{r.slug.replace(/-/g, ' ')}</span>
                <span className="block text-xs text-gray-400 mt-0.5">{r.date}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-white border border-gray-100 rounded-xl p-6 min-h-[400px] shadow-sm">
          {!selected ? (
            <p className="text-gray-400 text-sm">Select a report to read it</p>
          ) : (
            <>
              <h2 className="text-sm font-mono text-gray-400 mb-4">{selected.filename}</h2>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{selected.content}</pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
