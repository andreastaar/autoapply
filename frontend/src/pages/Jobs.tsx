import { useEffect, useState, useRef } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/client';

const STATUS_COLORS: Record<string, string> = {
  discovered:   'bg-gray-100 text-gray-500',
  ats_checked:  'bg-blue-100 text-blue-700',
  cv_generated: 'bg-purple-100 text-purple-700',
  applied:      'bg-green-100 text-green-700',
  rejected:     'bg-red-100 text-red-500',
  analyzed:     'bg-indigo-100 text-indigo-700',
};

const SOURCE_EMOJI: Record<string, string> = {
  greenhouse: '🌱', ashby: '🔵', lever: '🟠', indeed: '🔍',
  remoteok: '🌐', ycombinator: '🚀', workday: '🏢', manual: '✍️',
};

const atsColor = (s: number) =>
  s >= 90 ? 'text-green-600 font-bold' : s >= 70 ? 'text-yellow-600 font-bold' : 'text-red-500 font-bold';

const FIT_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-700',
  B: 'bg-yellow-100 text-yellow-700',
};

export default function Jobs() {
  const [jobs, setJobs]         = useState<any[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [stats, setStats]       = useState<any>(null);

  // filters
  const [filterText, setFilterText] = useState('');
  const [fStatus, setFStatus]       = useState('');
  const [fSource, setFSource]       = useState('');
  const [fFit, setFfit]             = useState(0);
  const [fRemote, setFRemote]       = useState(false);

  // pipeline form
  const [company, setCompany] = useState('');
  const [role, setRole]       = useState('');
  const [jd, setJd]           = useState('');

  // scanner
  const [scanKw, setScanKw]     = useState('data analytics intern engineer');
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg]   = useState('');

  // result panel for ATS
  const [atsResult, setAtsResult]   = useState<any>(null);
  const [atsBusy, setAtsBusy]       = useState(false);
  const [prepBusy, setPrepBusy]     = useState<string | null>(null);

  // contact modal
  const [contact, setContact] = useState<any>(null);

  // wishlist input
  const [wlInput, setWlInput] = useState('');

  const load = async () => {
    const [j, w] = await Promise.all([
      api.get('/jobs').then(r => r.data).catch(() => []),
      api.get('/jobs/wishlist').then(r => r.data).catch(() => []),
    ]);
    setJobs(Array.isArray(j) ? j : []);
    setWishlist(Array.isArray(w) ? w : []);
    if (Array.isArray(j) && j.length) {
      const applied = j.filter((x: any) => x.status === 'applied').length;
      const cvReady = j.filter((x: any) => x.status === 'cv_generated').length;
      const scored  = j.filter((x: any) => x.ats_score);
      const avg     = scored.length ? Math.round(scored.reduce((a: number, x: any) => a + x.ats_score, 0) / scored.length) : 0;
      setStats({ total: j.length, applied, cvReady, avg });
    }
  };

  useEffect(() => { load(); }, []);

  const scan = async () => {
    setScanning(true); setScanMsg('Scanning job boards...');
    try {
      const r = await api.post('/jobs/scan', { keywords: scanKw, limit: 200 });
      setScanMsg(`Found ${r.data.found} jobs · ${r.data.added} new added to queue`);
      await load();
    } catch { setScanMsg('Scan failed — is career-autopilot running?'); }
    setScanning(false);
  };

  const digest = async () => {
    setScanning(true); setScanMsg('Running curated digest...');
    try {
      const r = await api.post('/jobs/digest', {});
      setScanMsg(r.data.message || `${r.data.a} A-fits + ${r.data.b} B-fits · ${r.data.added} new`);
      await load();
    } catch { setScanMsg('Digest failed'); }
    setScanning(false);
  };

  const checkAts = async () => {
    if (!jd) return;
    setAtsBusy(true); setAtsResult(null);
    try {
      const r = await api.post('/jobs/ats', { jd });
      setAtsResult(r.data);
    } catch { alert('ATS check failed'); }
    setAtsBusy(false);
  };

  const genCV = async () => {
    if (!atsResult) return;
    setAtsBusy(true);
    try {
      const r = await api.post('/jobs/generate', { company, jd, missing: atsResult.missing });
      setAtsResult({ ...atsResult, ...r.data });
    } catch { alert('CV generation failed'); }
    setAtsBusy(false);
  };

  const prepare = async (id: string) => {
    setPrepBusy(id);
    try {
      const r = await api.post(`/jobs/${id}/prepare`);
      setJobs(prev => prev.map(j => j.id == id ? { ...j, ...r.data, status: 'cv_generated' } : j));
    } catch { alert('Prepare failed'); }
    setPrepBusy(null);
  };

  const applyJob = async (id: string) => {
    try {
      await api.post(`/jobs/${id}/apply`);
      setJobs(prev => prev.map(j => j.id == id ? { ...j, status: 'applied' } : j));
    } catch { alert('Apply failed'); }
  };

  const openContact = async (id: string) => {
    try {
      const r = await api.post(`/jobs/${id}/contact`);
      setContact(r.data);
    } catch { alert('Contact pack failed'); }
  };

  const addWishlist = async () => {
    if (!wlInput.trim()) return;
    const r = await api.post('/jobs/wishlist', { action: 'add', name: wlInput.trim() });
    setWishlist(Array.isArray(r.data) ? r.data : wishlist);
    setWlInput('');
  };

  const removeWishlist = async (name: string) => {
    const r = await api.post('/jobs/wishlist', { action: 'remove', name });
    setWishlist(Array.isArray(r.data) ? r.data : wishlist.filter(w => w !== name));
  };

  const filtered = jobs.filter(j => {
    if (fStatus && j.status !== fStatus) return false;
    if (fSource && j.platform !== fSource) return false;
    if (fFit > 0 && (!j.ats_score || j.ats_score < fFit)) return false;
    if (fRemote && !(j.location || '').toLowerCase().includes('remote')) return false;
    if (filterText) {
      const t = filterText.toLowerCase();
      return (j.company || '').toLowerCase().includes(t) ||
             (j.title || '').toLowerCase().includes(t) ||
             (j.location || '').toLowerCase().includes(t);
    }
    return true;
  });

  const Chip = ({ label, active, onClick, color = '' }: any) => (
    <button onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
        active
          ? color || 'bg-brand-600 text-white border-brand-600'
          : 'bg-white text-gray-500 border-gray-200 hover:border-brand-400 hover:text-brand-600'
      }`}>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Jobs in queue', val: stats.total, color: 'text-blue-600' },
              { label: 'CVs ready',     val: stats.cvReady, color: 'text-purple-600' },
              { label: 'Applied',       val: stats.applied, color: 'text-green-600' },
              { label: 'Avg ATS',       val: stats.avg ? `${stats.avg}%` : '—', color: 'text-amber-500' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <p className={`text-3xl font-bold ${s.color}`}>{s.val}</p>
                <p className="text-xs text-gray-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Wishlist */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">⭐ Wishlist — Priority companies</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {wishlist.map(w => (
              <span key={w} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1 rounded-full">
                {w}
                <button onClick={() => removeWishlist(w)} className="text-indigo-300 hover:text-red-400 ml-1">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={wlInput} onChange={e => setWlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addWishlist()}
              placeholder="Add company (e.g. Nvidia, HuggingFace...)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <button onClick={addWishlist}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
              + Add
            </button>
          </div>
        </div>

        {/* Scanner */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">🔍 Job Scanner — 7 sources (Greenhouse · Ashby · Lever · Workday · RemoteOK · YC · Indeed)</h2>
          <div className="flex gap-3 flex-wrap">
            <input value={scanKw} onChange={e => setScanKw(e.target.value)}
              className="flex-1 min-w-[280px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Keywords..." />
            <button onClick={scan} disabled={scanning}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">
              {scanning ? 'Scanning...' : '🔍 Scan'}
            </button>
            <button onClick={digest} disabled={scanning}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50">
              🎯 Curated Digest
            </button>
          </div>
          {scanMsg && <p className="text-xs text-gray-500 mt-2">{scanMsg}</p>}
        </div>

        {/* Pipeline (manual ATS + CV gen) */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-600 mb-4">🚀 Full Pipeline — Analyze → CV → Apply</h2>
          <div className="flex gap-3 flex-wrap mb-3">
            <input value={company} onChange={e => setCompany(e.target.value)}
              placeholder="Company" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <input value={role} onChange={e => setRole(e.target.value)}
              placeholder="Role" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <textarea value={jd} onChange={e => setJd(e.target.value)}
            rows={4} placeholder="Paste full job description..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y mb-3" />
          <div className="flex gap-3">
            <button onClick={checkAts} disabled={atsBusy || !jd}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50">
              {atsBusy ? 'Analyzing...' : '1 · Check ATS'}
            </button>
            {atsResult && (
              <button onClick={genCV} disabled={atsBusy}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50">
                {atsBusy ? 'Generating...' : '3 · Generate Tailored CV'}
              </button>
            )}
          </div>

          {atsResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center gap-6 mb-3">
                <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center text-xl font-bold flex-shrink-0 ${
                  atsResult.score >= 90 ? 'border-green-400 text-green-600' :
                  atsResult.score >= 70 ? 'border-yellow-400 text-yellow-600' : 'border-red-400 text-red-500'
                }`}>
                  {Math.round(atsResult.score || 0)}%
                </div>
                <div>
                  <p className="text-sm text-gray-500">{atsResult.matched_count}/{atsResult.total} keywords matched</p>
                  {atsResult.semantic && (
                    <p className="text-sm text-gray-500 mt-1">Semantic fit: <strong>{atsResult.semantic}%</strong> — {atsResult.recommendation}</p>
                  )}
                  {atsResult.docx && (
                    <a href={`http://localhost:8800/api/download?file=${atsResult.docx}`}
                      target="_blank" rel="noreferrer"
                      className="inline-block mt-2 text-xs bg-green-50 text-green-700 px-3 py-1 rounded-lg hover:bg-green-100 transition">
                      ⬇ Download {atsResult.docx}
                    </a>
                  )}
                </div>
              </div>
              {(atsResult.missing || []).length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-2">❌ Missing keywords ({atsResult.missing.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {(atsResult.missing || []).slice(0, 30).map((m: any) => (
                      <span key={m?.keyword || m}
                        className="bg-red-50 text-red-600 text-xs px-2 py-0.5 rounded">
                        {m?.keyword || m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Jobs Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-600">📋 Application Queue ({filtered.length}/{jobs.length})</h2>
              <button onClick={load} className="text-xs text-gray-400 hover:text-gray-600 transition">↻</button>
            </div>

            <input value={filterText} onChange={e => setFilterText(e.target.value)}
              placeholder="🔎 Filter by company, role, location..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />

            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-gray-400 font-semibold">STATUS:</span>
              {['', 'discovered', 'cv_generated', 'applied'].map(s => (
                <Chip key={s || 'all'} label={s || 'All'} active={fStatus === s}
                  onClick={() => setFStatus(s)}
                  color={s === 'applied' ? 'bg-green-600 text-white border-green-600' : s === 'cv_generated' ? 'bg-purple-600 text-white border-purple-600' : ''} />
              ))}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-gray-400 font-semibold">FIT:</span>
              {[0, 50, 70, 90].map(f => (
                <Chip key={f} label={f === 0 ? 'All' : `${f}%+`} active={fFit === f} onClick={() => setFfit(f)} />
              ))}
              <span className="text-xs text-gray-400 font-semibold ml-2">SOURCE:</span>
              {['', 'greenhouse', 'ashby', 'lever', 'indeed', 'remoteok', 'ycombinator', 'workday'].map(s => (
                <Chip key={s || 'all'} label={s ? `${SOURCE_EMOJI[s] || ''} ${s}` : 'All'}
                  active={fSource === s} onClick={() => setFSource(s)} />
              ))}
              <Chip label="Remote" active={fRemote} onClick={() => setFRemote(!fRemote)}
                color="bg-blue-600 text-white border-blue-600" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3">Company</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Src</th>
                  <th className="text-left px-4 py-3">Location</th>
                  <th className="text-left px-4 py-3">ATS</th>
                  <th className="text-left px-4 py-3">Fit</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-gray-400 py-10 text-sm">
                    No jobs yet — scan above or add one manually 🚀
                  </td></tr>
                )}
                {filtered.map((j: any) => (
                  <tr key={j.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{j.company}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">{j.title}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {SOURCE_EMOJI[j.platform] || ''} {j.platform}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[120px] truncate">{j.location}</td>
                    <td className={`px-4 py-3 text-sm ${j.ats_score ? atsColor(j.ats_score) : 'text-gray-300'}`}>
                      {j.ats_score != null ? `${Math.round(j.ats_score)}%` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {j.semantic_score ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          j.semantic_score >= 80 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{j.semantic_score}%</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[j.status] || 'bg-gray-100 text-gray-400'}`}>
                        {j.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <a href={j.url} target="_blank" rel="noreferrer"
                          className="text-xs text-blue-500 hover:text-blue-700 transition">↗</a>
                        {j.status === 'discovered' && (
                          <button onClick={() => prepare(j.id)}
                            disabled={prepBusy === j.id}
                            className="text-xs text-purple-600 hover:text-purple-800 transition disabled:opacity-40">
                            {prepBusy === j.id ? '...' : 'Prepare'}
                          </button>
                        )}
                        {j.status === 'cv_generated' && (
                          <button onClick={() => applyJob(j.id)}
                            className="text-xs text-green-600 hover:text-green-800 transition">
                            Apply
                          </button>
                        )}
                        <button onClick={() => openContact(j.id)}
                          className="text-xs text-gray-400 hover:text-gray-700 transition">
                          Contact
                        </button>
                        {j.cv_file && (
                          <a href={`http://localhost:8800/api/download?file=${j.cv_file}`}
                            target="_blank" rel="noreferrer"
                            className="text-xs text-green-500 hover:text-green-700 transition">
                            CV ⬇
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Contact modal */}
      {contact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
          onClick={() => setContact(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-gray-800">👥 Contacts & Outreach — {contact.company}</h2>
              <button onClick={() => setContact(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">LinkedIn Search</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(contact.links || {}).map(([k, v]: any) => (
                    <a key={k} href={v} target="_blank" rel="noreferrer"
                      className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-100 transition capitalize">
                      {k.replace(/_/g, ' ')} ↗
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">LinkedIn Note (copy → paste)</p>
                <textarea readOnly value={contact.li_note}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono resize-none"
                  rows={3} onClick={e => (e.target as HTMLTextAreaElement).select()} />
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Cold Email — Subject: {contact.cold_email_subject}</p>
                <textarea readOnly value={contact.cold_email}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono resize-none"
                  rows={8} onClick={e => (e.target as HTMLTextAreaElement).select()} />
              </div>

              {contact.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Conversation Notes (PGP method)</p>
                  <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap">{contact.notes}</pre>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Email Tools</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(contact.email_tools || {}).map(([k, v]: any) => (
                    <a key={k} href={v} target="_blank" rel="noreferrer"
                      className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-200 transition capitalize">
                      {k.replace(/_/g, ' ')} ↗
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
