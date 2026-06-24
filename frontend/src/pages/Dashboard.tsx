import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/client';
import { getUser } from '../store/auth';

const statusColors: Record<string, string> = {
  Evaluated: 'bg-blue-100 text-blue-700',
  Applied: 'bg-green-100 text-green-700',
  Interview: 'bg-yellow-100 text-yellow-700',
  Rejected: 'bg-red-100 text-red-600',
  Offer: 'bg-purple-100 text-purple-700',
};

export default function Dashboard() {
  const user = getUser();
  const [stats, setStats] = useState<any>(null);
  const [jobStats, setJobStats] = useState<any>(null);

  useEffect(() => {
    api.get('/tracker/stats').then(r => setStats(r.data));
    api.get('/jobs').then(r => {
      if (Array.isArray(r.data)) {
        const applied = r.data.filter((j: any) => j.status === 'applied').length;
        setJobStats({ total: r.data.length, applied });
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">
          Hello, {user?.name || 'there'} 👋
        </h1>
        <p className="text-gray-400 mb-8">Your job search overview</p>

        {stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Applications', value: stats.total, color: 'text-blue-600', to: '/tracker' },
                { label: 'Avg Score', value: stats.avgScore ? `${stats.avgScore}/5` : '—', color: 'text-green-600', to: '/tracker' },
                { label: 'In Pipeline', value: stats.pendingPipeline, color: 'text-yellow-500', to: '/pipeline' },
                { label: 'Statuses', value: Object.keys(stats.byStatus || {}).length, color: 'text-purple-600', to: '/tracker' },
              ].map(s => (
                <Link key={s.label} to={s.to} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition">
                  <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{s.label}</p>
                </Link>
              ))}
            </div>

            {Object.keys(stats.byStatus || {}).length > 0 && (
              <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm mb-6">
                <h2 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">By Status</h2>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(stats.byStatus).map(([status, count]: any) => (
                    <div key={status} className={`px-4 py-2 rounded-lg text-sm font-medium ${statusColors[status] || 'bg-gray-100 text-gray-500'}`}>
                      {status} <span className="font-bold ml-1">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-gray-700 mb-3">Quick actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link to="/tracker" className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700 transition">
              Applications Tracker
            </Link>
            <Link to="/pipeline" className="border border-brand-600 text-brand-600 px-4 py-2 rounded-lg text-sm hover:bg-indigo-50 transition">
              Pipeline Queue
            </Link>
            <Link to="/jobs" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition">
              🔍 Job Scanner {jobStats ? `(${jobStats.total} in queue)` : ''}
            </Link>
            <Link to="/opportunities" className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              Browse Opportunities
            </Link>
            <Link to="/linkedin" className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              LinkedIn Search
            </Link>
            <Link to="/reports" className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              Evaluation Reports
            </Link>
            <Link to="/profile" className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              My Profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
