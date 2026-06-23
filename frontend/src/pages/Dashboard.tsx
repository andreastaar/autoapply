import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/client';
import { getUser } from '../store/auth';

export default function Dashboard() {
  const user = getUser();
  const [stats, setStats] = useState({ opportunities: 0, applications: 0 });

  useEffect(() => {
    Promise.all([api.get('/opportunities'), api.get('/applications')]).then(
      ([opp, apps]) => setStats({ opportunities: opp.data.length, applications: apps.data.length }),
    );
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">
          Hello, {user?.name || 'there'} 👋
        </h1>
        <p className="text-gray-500 mb-8">Here's your application overview</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">Open Opportunities</p>
            <p className="text-4xl font-bold text-brand-600">{stats.opportunities}</p>
            <Link to="/opportunities" className="text-sm text-brand-600 hover:underline mt-2 inline-block">
              Browse →
            </Link>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">My Applications</p>
            <p className="text-4xl font-bold text-brand-600">{stats.applications}</p>
            <Link to="/applications" className="text-sm text-brand-600 hover:underline mt-2 inline-block">
              Track →
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-700 mb-3">Quick actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link to="/opportunities" className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700 transition">
              Find opportunities
            </Link>
            <Link to="/profile" className="border border-brand-600 text-brand-600 px-4 py-2 rounded-lg text-sm hover:bg-indigo-50 transition">
              Update profile
            </Link>
            <Link to="/applications" className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              View applications
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
