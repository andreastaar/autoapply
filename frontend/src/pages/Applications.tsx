import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/client';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  interview: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  waitlisted: 'bg-orange-100 text-orange-700',
};

const statuses = ['draft', 'submitted', 'interview', 'accepted', 'rejected', 'waitlisted'];

export default function Applications() {
  const [applications, setApplications] = useState<any[]>([]);

  useEffect(() => {
    api.get('/applications').then((r) => setApplications(r.data));
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { data } = await api.patch(`/applications/${id}/status`, { status });
    setApplications((prev) => prev.map((a) => (a.id === id ? data : a)));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">My Applications</h1>

        {applications.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center text-gray-400 shadow-sm border border-gray-100">
            No applications yet. Go browse opportunities!
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((a) => (
              <div key={a.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-800">{a.opportunity?.title}</h3>
                    <p className="text-sm text-gray-500">{a.opportunity?.organization} · {a.opportunity?.type}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Applied {new Date(a.appliedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <select
                      value={a.status}
                      onChange={(e) => updateStatus(a.id, e.target.value)}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${statusColors[a.status]}`}
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
