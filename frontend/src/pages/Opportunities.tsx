import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/client';

const typeColors: Record<string, string> = {
  job: 'bg-blue-100 text-blue-700',
  scholarship: 'bg-green-100 text-green-700',
  programme: 'bg-purple-100 text-purple-700',
  internship: 'bg-yellow-100 text-yellow-700',
};

const JOBS_TYPES = ['job', 'internship'];
const BECAS_TYPES = ['scholarship', 'programme'];

export default function Opportunities() {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'jobs' | 'becas'>('all');
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get('/opportunities').then((r) => setOpportunities(r.data));
    api.get('/applications').then((r) => {
      const ids = r.data.map((a: any) => a.opportunity?.id).filter(Boolean);
      setApplied(new Set(ids));
    });
  }, []);

  const apply = async (id: string) => {
    setApplying(id);
    try {
      await api.post('/applications', { opportunityId: id });
      setApplied((prev) => new Set([...prev, id]));
    } finally {
      setApplying(null);
    }
  };

  const filtered = opportunities.filter((o) => {
    if (filter === 'jobs') return JOBS_TYPES.includes(o.type);
    if (filter === 'becas') return BECAS_TYPES.includes(o.type);
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Opportunities</h1>

        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setFilter('all')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('jobs')}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition ${
              filter === 'jobs'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white border border-blue-300 text-blue-600 hover:bg-blue-50'
            }`}
          >
            💼 Jobs
          </button>
          <button
            onClick={() => setFilter('becas')}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition ${
              filter === 'becas'
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-white border border-green-300 text-green-600 hover:bg-green-50'
            }`}
          >
            🎓 Becas
          </button>
        </div>

        <div className="space-y-4">
          {filtered.map((o) => (
            <div key={o.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[o.type] || 'bg-gray-100 text-gray-600'}`}>
                      {o.type}
                    </span>
                    {o.deadline && o.deadline !== 'Open' && (
                      <span className="text-xs text-gray-400">Deadline: {o.deadline}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-800">{o.title}</h3>
                  <p className="text-sm text-gray-500">{o.organization} · {o.location}</p>
                  {o.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{o.description}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {applied.has(o.id) ? (
                    <span className="text-sm text-green-600 font-medium px-3 py-1.5 bg-green-50 rounded-lg">
                      Applied ✓
                    </span>
                  ) : (
                    <button
                      onClick={() => apply(o.id)}
                      disabled={applying === o.id}
                      className="bg-brand-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
                    >
                      {applying === o.id ? 'Applying...' : '1-Click Apply'}
                    </button>
                  )}
                  {o.applyUrl && (
                    <a
                      href={o.applyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-center text-brand-600 hover:underline"
                    >
                      Official site →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
