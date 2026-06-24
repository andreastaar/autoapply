import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/client';

export default function Pipeline() {
  const [data, setData] = useState<any>({ pending: [], done: [] });
  const [url, setUrl] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');

  const load = () => api.get('/pipeline').then(r => setData(r.data));
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    await api.post('/pipeline/add', { url, company, role });
    setUrl(''); setCompany(''); setRole('');
    load();
  };

  const remove = async (u: string) => {
    await api.post('/pipeline/remove', { url: u });
    load();
  };

  const markDone = async (u: string) => {
    await api.post('/pipeline/done', { url: u });
    load();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Pipeline Queue</h1>

        <form onSubmit={add} className="bg-white border border-gray-100 rounded-xl p-5 mb-8 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 mb-4">Add job to pipeline</h2>
          <div className="flex gap-3 flex-wrap">
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Job URL *" required
              className="flex-1 min-w-[260px] border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company"
              className="w-36 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="Role"
              className="w-44 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              Add
            </button>
          </div>
        </form>

        <div className="space-y-2 mb-8">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Pending ({data.pending.length})
          </h2>
          {data.pending.length === 0 && <p className="text-gray-400 text-sm">No pending URLs</p>}
          {data.pending.map((item: any) => (
            <div key={item.id} className="bg-white border border-gray-100 rounded-lg px-4 py-3 flex items-center justify-between gap-4 shadow-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {item.company && <span className="text-xs font-medium text-gray-700">{item.company}</span>}
                  {item.role && <span className="text-xs text-gray-400">{item.role}</span>}
                </div>
                <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline truncate block">
                  {item.url}
                </a>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => markDone(item.url)} className="text-green-500 hover:text-green-700 text-xs transition">
                  Done ✓
                </button>
                <button onClick={() => remove(item.url)} className="text-gray-300 hover:text-red-500 text-xs transition">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {data.done.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Done ({data.done.length})</h2>
            <div className="space-y-2 opacity-50">
              {data.done.map((item: any) => (
                <div key={item.id} className="bg-white border border-gray-100 rounded-lg px-4 py-3 flex items-center gap-3">
                  <span className="text-green-500 text-xs">✓</span>
                  <span className="text-xs text-gray-400 truncate">{item.company} — {item.url}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
