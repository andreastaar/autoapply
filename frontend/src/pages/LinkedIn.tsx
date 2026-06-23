import { useState } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/client';

type Tab = 'jobs' | 'people';

export default function LinkedIn() {
  const [tab, setTab] = useState<Tab>('jobs');

  // Jobs search
  const [jobKeywords, setJobKeywords] = useState('');
  const [jobLocation, setJobLocation] = useState('');
  const [remote, setRemote] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobLoading, setJobLoading] = useState(false);
  const [jobError, setJobError] = useState('');
  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported] = useState<Set<string>>(new Set());

  // People search
  const [peopleKeywords, setPeopleKeywords] = useState('recruiter');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [people, setPeople] = useState<any[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState('');
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [messagingUrn, setMessagingUrn] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const searchJobs = async () => {
    if (!jobKeywords) return;
    setJobLoading(true);
    setJobError('');
    try {
      const { data } = await api.get('/linkedin/jobs', {
        params: { keywords: jobKeywords, location: jobLocation, remote, limit: 10 },
      });
      setJobs(Array.isArray(data) ? data : data.jobs || data.results || []);
    } catch (err: any) {
      setJobError(err.response?.data?.message || 'Search failed — check your LinkedIn credentials in Profile');
    } finally {
      setJobLoading(false);
    }
  };

  const importJob = async (job: any) => {
    const key = job.id || job.title;
    setImporting(key);
    try {
      await api.post('/opportunities/import-linkedin', { jobs: [job] });
      setImported((prev) => new Set([...prev, key]));
    } finally {
      setImporting(null);
    }
  };

  const searchPeople = async () => {
    setPeopleLoading(true);
    setPeopleError('');
    try {
      const { data } = await api.get('/linkedin/people', {
        params: { keywords: peopleKeywords, company, title, limit: 10 },
      });
      setPeople(Array.isArray(data) ? data : data.people || data.results || []);
    } catch (err: any) {
      setPeopleError(err.response?.data?.message || 'Search failed — check your LinkedIn credentials in Profile');
    } finally {
      setPeopleLoading(false);
    }
  };

  const connect = async (person: any) => {
    const urn = person.urn || person.profileUrn;
    setConnecting(urn);
    try {
      await api.post('/linkedin/connect', { profileUrn: urn });
      await api.post('/outreach', {
        type: 'connection',
        personName: person.name || person.firstName + ' ' + person.lastName,
        personTitle: person.title || person.headline,
        company: person.company || company,
        profileUrn: urn,
        profileUrl: person.profileUrl,
      });
      setConnected((prev) => new Set([...prev, urn]));
    } finally {
      setConnecting(null);
    }
  };

  const sendMessage = async () => {
    if (!messagingUrn || !messageText) return;
    setSendingMsg(true);
    try {
      await api.post('/linkedin/message', { profileUrns: [messagingUrn], message: messageText });
      const person = people.find((p) => (p.urn || p.profileUrn) === messagingUrn);
      await api.post('/outreach', {
        type: 'message',
        personName: person?.name || person?.firstName + ' ' + person?.lastName,
        personTitle: person?.title || person?.headline,
        company: person?.company || company,
        profileUrn: messagingUrn,
        message: messageText,
      });
      setMessagingUrn(null);
      setMessageText('');
    } finally {
      setSendingMsg(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">LinkedIn</h1>
        <p className="text-sm text-gray-500 mb-6">
          Requires LinkedIn credentials in your{' '}
          <a href="/profile" className="text-brand-600 hover:underline">Profile</a>.
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['jobs', 'people'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition capitalize ${
                tab === t ? 'bg-brand-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t === 'jobs' ? '💼 Search Jobs' : '🔍 Find Recruiters'}
            </button>
          ))}
        </div>

        {/* JOBS TAB */}
        {tab === 'jobs' && (
          <div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
              <div className="flex gap-3 flex-wrap">
                <input
                  type="text"
                  placeholder="Keywords (e.g. software engineer)"
                  value={jobKeywords}
                  onChange={(e) => setJobKeywords(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchJobs()}
                  className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <input
                  type="text"
                  placeholder="Location"
                  value={jobLocation}
                  onChange={(e) => setJobLocation(e.target.value)}
                  className="w-40 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} className="rounded" />
                  Remote only
                </label>
                <button
                  onClick={searchJobs}
                  disabled={jobLoading || !jobKeywords}
                  className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
                >
                  {jobLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {jobError && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded">{jobError}</p>}

            <div className="space-y-3">
              {jobs.map((job, i) => {
                const key = job.id || job.title || i;
                return (
                  <div key={key} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{job.title}</h3>
                      <p className="text-sm text-gray-500">{job.company || job.companyName} · {job.location}</p>
                      {job.description && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{job.description}</p>}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {imported.has(key) ? (
                        <span className="text-xs text-green-600 font-medium px-3 py-1.5 bg-green-50 rounded-lg">Saved ✓</span>
                      ) : (
                        <button
                          onClick={() => importJob(job)}
                          disabled={importing === key}
                          className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-700 transition disabled:opacity-50"
                        >
                          {importing === key ? 'Saving...' : 'Save to tracker'}
                        </button>
                      )}
                      {job.url && (
                        <a href={job.url} target="_blank" rel="noreferrer" className="text-xs text-center text-brand-600 hover:underline">
                          View on LinkedIn →
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
              {jobs.length === 0 && !jobLoading && !jobError && (
                <div className="bg-white rounded-xl p-10 text-center text-gray-400 shadow-sm border border-gray-100">
                  Search for jobs above to see results
                </div>
              )}
            </div>
          </div>
        )}

        {/* PEOPLE TAB */}
        {tab === 'people' && (
          <div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
              <div className="flex gap-3 flex-wrap">
                <input
                  type="text"
                  placeholder="Keywords (e.g. recruiter, hiring manager)"
                  value={peopleKeywords}
                  onChange={(e) => setPeopleKeywords(e.target.value)}
                  className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <input
                  type="text"
                  placeholder="Company name"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-44 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <input
                  type="text"
                  placeholder="Title filter"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-36 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  onClick={searchPeople}
                  disabled={peopleLoading}
                  className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
                >
                  {peopleLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {peopleError && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded">{peopleError}</p>}

            <div className="space-y-3">
              {people.map((person, i) => {
                const urn = person.urn || person.profileUrn || i;
                return (
                  <div key={urn} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800">{person.name || `${person.firstName} ${person.lastName}`}</h3>
                        <p className="text-sm text-gray-500">{person.title || person.headline}</p>
                        {person.company && <p className="text-xs text-gray-400">{person.company}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {connected.has(urn) ? (
                          <span className="text-xs text-green-600 font-medium px-3 py-1.5 bg-green-50 rounded-lg">Connected ✓</span>
                        ) : (
                          <button
                            onClick={() => connect(person)}
                            disabled={connecting === urn}
                            className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-700 transition disabled:opacity-50"
                          >
                            {connecting === urn ? '...' : 'Connect'}
                          </button>
                        )}
                        <button
                          onClick={() => setMessagingUrn(urn)}
                          className="border border-brand-600 text-brand-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-50 transition"
                        >
                          Message
                        </button>
                      </div>
                    </div>

                    {/* Inline message composer */}
                    {messagingUrn === urn && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <textarea
                          rows={3}
                          placeholder="Write your message..."
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={sendMessage}
                            disabled={sendingMsg || !messageText}
                            className="bg-brand-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-700 transition disabled:opacity-50"
                          >
                            {sendingMsg ? 'Sending...' : 'Send'}
                          </button>
                          <button onClick={() => setMessagingUrn(null)} className="text-xs text-gray-500 hover:text-gray-700">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {people.length === 0 && !peopleLoading && !peopleError && (
                <div className="bg-white rounded-xl p-10 text-center text-gray-400 shadow-sm border border-gray-100">
                  Search for recruiters or hiring managers above
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
