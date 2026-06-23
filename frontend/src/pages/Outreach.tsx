import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/client';

const statusColors: Record<string, string> = {
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  replied: 'bg-purple-100 text-purple-700',
  no_response: 'bg-gray-100 text-gray-500',
};

const statuses = ['sent', 'accepted', 'replied', 'no_response'];

export default function Outreach() {
  const [outreach, setOutreach] = useState<any[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    api.get('/outreach').then((r) => setOutreach(r.data));
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { data } = await api.patch(`/outreach/${id}/status`, { status });
    setOutreach((prev) => prev.map((o) => (o.id === id ? data : o)));
  };

  const filtered = filter ? outreach.filter((o) => o.status === filter) : outreach;

  const stats = {
    total: outreach.length,
    accepted: outreach.filter((o) => o.status === 'accepted').length,
    replied: outreach.filter((o) => o.status === 'replied').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Outreach Tracker</h1>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total sent', value: stats.total, color: 'text-brand-600' },
            { label: 'Accepted', value: stats.accepted, color: 'text-green-600' },
            { label: 'Replied', value: stats.replied, color: 'text-purple-600' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {['', ...statuses].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition capitalize ${
                filter === s ? 'bg-brand-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s.replace('_', ' ') || 'All'}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center text-gray-400 shadow-sm border border-gray-100">
            No outreach yet. Go to LinkedIn to find recruiters and connect.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((o) => (
              <div key={o.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full capitalize">{o.type}</span>
                    </div>
                    <h3 className="font-semibold text-gray-800">{o.personName}</h3>
                    <p className="text-sm text-gray-500">{o.personTitle}{o.company ? ` · ${o.company}` : ''}</p>
                    {o.message && <p className="text-xs text-gray-400 mt-1 line-clamp-2 italic">"{o.message}"</p>}
                    <p className="text-xs text-gray-400 mt-1">{new Date(o.sentAt).toLocaleDateString()}</p>
                  </div>
                  <select
                    value={o.status}
                    onChange={(e) => updateStatus(o.id, e.target.value)}
                    className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer shrink-0 ${statusColors[o.status]}`}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
