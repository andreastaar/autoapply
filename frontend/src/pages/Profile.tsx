import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/client';

export default function Profile() {
  const [form, setForm] = useState({
    headline: '', bio: '', location: '', phone: '',
    linkedin: '', github: '', portfolio: '',
    skills: '', experience: '', education: '', personalStatement: '',
    linkedinCookie: '', linkedinJsessionid: '',
    jobKeywords: '', targetLocation: '', targetCompanies: '',
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/profile').then((r) => { if (r.data) setForm({ ...form, ...r.data }); });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await api.put('/profile', form);
    setSaved(true);
    setLoading(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const field = (label: string, key: keyof typeof form, textarea = false) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {textarea ? (
        <textarea
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      ) : (
        <input
          type="text"
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">My Profile</h1>
        <form onSubmit={save} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-5">
          {field('Headline', 'headline')}
          {field('Bio', 'bio', true)}
          <div className="grid grid-cols-2 gap-4">
            {field('Location', 'location')}
            {field('Phone', 'phone')}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field('LinkedIn URL', 'linkedin')}
            {field('GitHub URL', 'github')}
          </div>
          {field('Portfolio URL', 'portfolio')}
          {field('Skills (comma separated)', 'skills')}
          {field('Experience', 'experience', true)}
          {field('Education', 'education', true)}
          {field('Personal Statement', 'personalStatement', true)}

          <div className="border-t border-gray-200 pt-5">
            <h2 className="text-base font-semibold text-gray-700 mb-4">🔗 LinkedIn Automation</h2>
            <p className="text-xs text-gray-400 mb-3">
              Your LinkedIn session cookies — needed to search jobs and contact recruiters.
              Get them from your browser's cookies after logging into LinkedIn.
            </p>
            <div className="space-y-3">
              {field('li_at cookie', 'linkedinCookie')}
              {field('JSESSIONID cookie', 'linkedinJsessionid')}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-5">
            <h2 className="text-base font-semibold text-gray-700 mb-4">🎯 Job Search Preferences</h2>
            <div className="space-y-3">
              {field('Job keywords (e.g. software engineer, data science)', 'jobKeywords')}
              {field('Preferred location', 'targetLocation')}
              {field('Target companies (comma separated)', 'targetCompanies')}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-medium hover:bg-brand-700 transition disabled:opacity-50"
          >
            {saved ? 'Saved ✓' : loading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
