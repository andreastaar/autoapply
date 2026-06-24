
let lastJD="", lastMissing=[], lastScore=0;
// ── CPT/OPT friendly companies (hardcoded — verified accept F-1 students) ──
const CPT_OPT_COMPANIES = new Set([
  // Big Tech (always accept CPT/OPT)
  "google","meta","amazon","microsoft","apple","netflix","spotify",
  // AI / ML
  "openai","anthropic","cohere","perplexity","cursor","langchain","llamaindex",
  "runway","pika","elevenlabs","deepgram","vapi","mistral","harvey","writer",
  "decagon","sierra","glean","arize ai","scale ai","scaleai",
  // Data / Analytics
  "databricks","snowflake","datadog","figma","stripe","mongodb","elastic",
  "cloudflare","brex","robinhood","duolingo","fivetran","hightouch","amplitude",
  "mixpanel","mercury","coinbase","gemini","starburst","chime","gusto",
  // Workday (confirmed)
  "salesforce","nvidia","intel",
  // Platforms / Tools
  "vercel","airtable","notion","linear","replit","ramp","zip","vanta","drata",
  "benchling","deel","merge","hyperscience","ramp",
  // Other scanned companies
  "waymo","coreweave","motional","sofi","dremio","comet","klue","aquant",
  "intercom","klaviyo","lattice","asana","twilio","pagerduty",
  // Career-ops portals
  "hume ai","arize ai","runpod","temporal","palantir",
  // Generally known to accept OPT/CPT
  "bloomberg","two sigma","jane street","de shaw","citadel","hudson river",
  "nvidia","qualcomm","amd","intel","broadcom","applied materials",
  "uber","lyft","airbnb","doordash","instacart","pinterest","snap","twitter",
  "adobe","oracle","sap","vmware","servicenow","workday","zendesk","okta",
  "crowdstrike","palo alto networks","zscaler","sentinelone",
  "databricks","tableau","looker","dbt labs","fivetran","airbyte",
]);

// ── Filter chip helpers ──
function setSource(val,btn){
  document.getElementById('fSource').value=val;
  document.querySelectorAll('[id^="src-"]').forEach(b=>b.classList.remove('active','active-amber','active-green'));
  btn.classList.add('active');
  loadJobs();
}
function setStatus(val,btn){
  document.getElementById('fStatus').value=val;
  document.querySelectorAll('[id^="chip-all"],[id^="chip-discovered"],[id^="chip-cv"],[id^="chip-applied"]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  loadJobs();
}
function setDate(val,btn){
  document.getElementById('fDate').value=val;
  document.querySelectorAll('[id^="date-"]').forEach(b=>{b.classList.remove('active','active-amber');});
  btn.classList.add(val>0?'active-amber':'active');
  loadJobs();
}
function setFit(val,btn){
  document.getElementById('fFit').value=val;
  document.querySelectorAll('[id^="fit-"]').forEach(b=>{b.classList.remove('active','active-green');});
  btn.classList.add(val>0?'active-green':'active');
  loadJobs();
}
function toggleChip(btn,type){
  const active=btn.classList.toggle('active-green');
  if(type==='remote') document.getElementById('fRemote').value=active?'1':'0';
  if(type==='prepared') document.getElementById('fPrepared').value=active?'1':'0';
  if(type==='cptopt') document.getElementById('fCptOpt').value=active?'1':'0';
  loadJobs();
}
function copyBlock(btn){const el=btn.parentNode.parentNode.querySelector('.cmtext');navigator.clipboard.writeText(el.innerText||el.textContent);btn.textContent='✓ Copied';setTimeout(()=>btn.textContent='Copy',1500);}
async function findContact(id){
  const m=document.getElementById('contactModal');const b=document.getElementById('cmBody');
  document.getElementById('cmTitle').textContent='👥 Loading…';
  b.innerHTML='Finding people + drafting outreach + conversation notes (GPT-4o)…';m.style.display='flex';
  try{
    const r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
    const d=await r.json();
    document.getElementById('cmTitle').textContent='👥 '+(d.company||'')+(d.role?' — '+d.role:'');
    const block=(title,txt,bid)=>'<div style="margin:14px 0"><div style="display:flex;justify-content:space-between;align-items:center"><b style="color:#e8e8ef">'+title+'</b><button class="btn ghost" style="padding:3px 10px;font-size:11px" onclick="copyBlock(this)">Copy</button></div><div class="cmtext" style="background:#0a0a0f;border:1px solid #25253a;border-radius:8px;padding:10px;margin-top:6px;white-space:pre-wrap;font-size:12px">'+txt+'</div></div>';
    let h='<div style="margin-bottom:10px"><b style="color:#34d399">1) Find people →</b> '
      +'<a href="'+d.links.alumni+'" target="_blank" style="color:#818cf8">Lewis Alumni</a> · '
      +'<a href="'+d.links.company_people+'" target="_blank" style="color:#818cf8">Company people</a> · '
      +'<a href="'+d.links.recruiter+'" target="_blank" style="color:#818cf8">Recruiters</a></div>';
    // Email finder section
    if(d.email_tools){
      h+='<div style="margin:14px 0"><b style="color:#fbbf24">2) Find their email →</b> '
        +'<a href="'+d.email_tools.hunter+'" target="_blank" style="color:#818cf8">Hunter</a> · '
        +'<a href="'+d.email_tools.apollo+'" target="_blank" style="color:#818cf8">Apollo</a> · '
        +'<a href="'+d.email_tools.rocketreach+'" target="_blank" style="color:#818cf8">RocketReach</a> · '
        +'<a href="'+d.email_tools.google_format+'" target="_blank" style="color:#818cf8">Google format</a>'
        +'<div style="background:#0a0a0f;border:1px solid #25253a;border-radius:8px;padding:10px;margin-top:6px;font-size:12px">'
        +'<b>Likely patterns</b> (once you have their name):<br>'+d.email_patterns.join('<br>')
        +'<br><span style="color:#8888a0">domains: '+d.email_domains.join(' / ')+'</span></div></div>';
    }
    h+=block('3) LinkedIn connection note (≤300 chars)',d.li_note,'cmNote');
    h+=block('4) Cold email — Subject: '+d.cold_email_subject,d.cold_email,'cmEmail');
    h+=block('5) Post-application message (recruiter/hiring)',d.post_apply,'cmPost');
    if(d.notes)h+=block('6) Conversation prep notes (PGP 3-step)',d.notes,'cmNotes');
    b.innerHTML=h;
  }catch(e){b.innerHTML='<span style="color:#fca5a5">Error: '+e.message+'</span>';}
}
function setStep(n){for(let i=1;i<=4;i++){const e=document.getElementById('st'+i);e.classList.remove('active','done');if(i<n)e.classList.add('done');if(i===n)e.classList.add('active');}}
async function runATS(){
  const jd=document.getElementById('jd').value.trim();
  if(!jd){alert('Paste a job description first');return}
  const btn=document.getElementById('run');btn.disabled=true;btn.textContent='Analyzing...';
  try{
    const r=await fetch('/api/ats',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jd})});
    const d=await r.json();
    lastJD=jd;lastMissing=d.missing||[];lastScore=d.score;
    document.getElementById('result').style.display='block';
    const ring=document.getElementById('ring');ring.textContent=d.score+'%';
    const col=d.score>=90?'#34d399':d.score>=70?'#fbbf24':'#fca5a5';
    ring.style.background='conic-gradient('+col+' '+(d.score*3.6)+'deg,#1c1c28 0deg)';
    document.getElementById('meta').textContent=d.matched_count+' matched · '+(d.total-d.matched_count)+' missing · '+d.total+' total';
    document.getElementById('missing').innerHTML=(d.missing||[]).slice(0,30).map(m=>'<span class="kw">'+m.keyword+(m.freq>1?' ×'+m.freq:'')+'</span>').join('')||'<span style="color:#34d399">No critical gaps!</span>';
    // auto-save to queue
    await fetch('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company:document.getElementById('company').value||'(no name)',title:document.getElementById('role').value||'(no role)',jd_text:jd,ats_score:d.score})});
    setStep(3);document.getElementById('gen').disabled=false;loadJobs();
  }catch(e){alert('Error: '+e.message)}
  btn.disabled=false;btn.textContent='1 · Analyze ATS';
}
async function genCV(){
  const company=document.getElementById('company').value||'job';
  const btn=document.getElementById('gen');btn.disabled=true;btn.textContent='Generating CV + PDF...';
  try{
    const r=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company,jd:lastJD,missing:lastMissing})});
    const d=await r.json();
    let html='<div class="lbl2">✅ CV generated — download:</div>';
    if(d.docx)html+='<a class="dl" href="/api/download?file='+encodeURIComponent(d.docx)+'">⬇ '+d.docx+'</a>';
    if(d.pdf)html+='<a class="dl" href="/api/download?file='+encodeURIComponent(d.pdf)+'">⬇ '+d.pdf+'</a>';
    if(!d.docx)html+='<span style="color:#fca5a5">Error generating CV</span>';
    document.getElementById('downloads').innerHTML=html;
    setStep(4);loadJobs();
  }catch(e){alert('Error: '+e.message)}
  btn.disabled=false;btn.textContent='3 · Generate tailored CV';
}
async function loadWishlist(){
  try{
    const r=await fetch('/api/wishlist');const names=await r.json();
    document.getElementById('wlTags').innerHTML=names.map(n=>
      '<span style="display:inline-flex;align-items:center;gap:4px;background:#1c1c2a;color:#a5b4fc;padding:4px 10px;border-radius:20px;font-size:12px;margin:3px">'
      +'⭐ '+n+'<button onclick="removeWishlist(\''+n.replace(/'/g,'')+'\',this)" style="background:none;border:none;color:#8888a0;cursor:pointer;font-size:14px;padding:0 2px">×</button></span>'
    ).join('');
  }catch(e){}
}
async function addWishlist(){
  const inp=document.getElementById('wlInput');const name=inp.value.trim();
  if(!name)return;inp.disabled=true;
  try{
    await fetch('/api/wishlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add',name})});
    inp.value='';loadWishlist();
  }catch(e){alert('Error: '+e.message);}
  inp.disabled=false;
}
async function removeWishlist(name,btn){
  btn.disabled=true;
  try{
    await fetch('/api/wishlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'remove',name})});
    loadWishlist();
  }catch(e){}
}
async function scanJobs(){
  const kw=document.getElementById('scankw').value.trim();
  const btn=document.getElementById('scan');btn.disabled=true;btn.textContent='Scanning...';
  document.getElementById('scanres').textContent='Searching across 129 companies...';
  try{
    const r=await fetch('/api/scan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({keywords:kw})});
    const d=await r.json();
    if(d.error){document.getElementById('scanres').innerHTML='<span style="color:#fca5a5">Error: '+d.error+'</span>';}
    else{document.getElementById('scanres').innerHTML='✅ <b style="color:#34d399">'+d.found+'</b> jobs found · <b style="color:#818cf8">'+d.added+'</b> new added to queue';loadJobs();}
  }catch(e){document.getElementById('scanres').innerHTML='<span style="color:#fca5a5">Error: '+e.message+'</span>';}
  btn.disabled=false;btn.textContent='🔍 Scan';
}
async function runDigest(){
  const btn=document.getElementById('digest');btn.disabled=true;btn.textContent='Curating...';
  document.getElementById('scanres').textContent='Scanning + grading fits (A/B)...';
  try{
    const r=await fetch('/api/digest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
    const d=await r.json();
    if(d.error){document.getElementById('scanres').innerHTML='<span style="color:#fca5a5">Error: '+d.error+'</span>';}
    else{document.getElementById('scanres').innerHTML='🎯 <b style="color:#34d399">'+d.a+'</b> strong (A) · <b style="color:#fbbf24">'+d.b+'</b> adjacent (B) fits · <b>'+d.added+'</b> new — sent to Discord 📱';loadJobs();}
  }catch(e){document.getElementById('scanres').innerHTML='<span style="color:#fca5a5">Error: '+e.message+'</span>';}
  btn.disabled=false;btn.textContent='🎯 Curated Digest';
}
async function loadJobs(){
  let d=[];
  try{
    if(typeof PRELOADED_JOBS!=='undefined'&&PRELOADED_JOBS.length){
      d=PRELOADED_JOBS;
    } else {
      const r=await fetch('/api/jobs?t='+Date.now());
      const txt=await r.text();
      d=JSON.parse(txt);
    }
  }catch(e){document.getElementById('jobs').innerHTML='<tr><td colspan="9" style="color:red;padding:16px">Error: '+e+'</td></tr>';return;}
  try{
    document.getElementById('s-total').textContent=d.length;
    document.getElementById('s-cv').textContent=d.filter(j=>j.cv_file).length;
    const sc=d.filter(j=>j.ats_score).map(j=>j.ats_score);
    if(sc.length)document.getElementById('s-avg').textContent=Math.round(sc.reduce((a,b)=>a+b)/sc.length)+'%';
    // ── filters ──
    const q=(document.getElementById('fLoc')?.value||'').toLowerCase().trim();
    const onlyRemote=document.getElementById('fRemote')?.value==='1';
    const onlyPrep=document.getElementById('fPrepared')?.value==='1';
    const minFit=parseInt(document.getElementById('fFit')?.value||'0');
    const maxHrs=parseInt(document.getElementById('fDate')?.value||'0');
    const fGrade=document.getElementById('fStatus')?.value||'';
    const fSource=document.getElementById('fSource')?.value||'';
    const fCptOpt=document.getElementById('fCptOpt')?.value==='1';
    const now=Date.now();
    const hrsAgo=(iso)=>{
      if(!iso)return null;
      // Handle ISO strings without timezone (assume local/UTC)
      const s=iso.endsWith('Z')||iso.includes('+')||iso.includes('-',10)?iso:iso+'Z';
      const t=Date.parse(s);
      return isNaN(t)?null:(now-t)/3600000;
    };
    const totalAll=d.length;
    const allJobs=d.slice();
    d=d.filter(j=>{
      const blob=((j.company||'')+' '+(j.title||'')+' '+(j.location||'')).toLowerCase();
      if(q && !blob.includes(q))return false;
      if(onlyRemote && !/remote/i.test(j.location||''))return false;
      if(onlyPrep && !j.cv_file)return false;
      if(minFit && (j.semantic_score||0)<minFit)return false;
      if(maxHrs){
        // Use posted_at first, fall back to created_at (when added to DB)
        const h=hrsAgo(j.posted_at)??hrsAgo(j.created_at);
        if(h===null||h>maxHrs)return false;
      }
      if(fGrade && j.status!==fGrade)return false;
      if(fSource && (j.platform||'manual')!==fSource)return false;
      if(fCptOpt && !CPT_OPT_COMPANIES.has((j.company||'').toLowerCase()))return false;
      return true;
    });
    const fc=document.getElementById('fCount'); if(fc)fc.textContent=d.length+' / '+totalAll+' jobs';
    // ── Top 5 best matches (by semantic fit, then ATS) ──
    const scored=allJobs.filter(j=>j.semantic_score||j.ats_score)
      .sort((a,b)=>((b.semantic_score||0)-(a.semantic_score||0))||((b.ats_score||0)-(a.ats_score||0))).slice(0,5);
    const t5=document.getElementById('top5');
    if(t5){
      if(!scored.length){t5.innerHTML='Prepare some jobs (▶ Prepare) to see your best matches here…';}
      else t5.innerHTML=scored.map((j,i)=>{
        const s=Math.round(j.semantic_score||j.ats_score||0);
        const col=s>=70?'#34d399':s>=50?'#fbbf24':'#fca5a5';
        const lk=j.url?'<a href="'+j.url+'" target="_blank" style="color:#818cf8;text-decoration:none">↗</a>':'';
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1c1c28">'
          +'<span style="font-size:16px;font-weight:700;color:#6366f1;width:22px">'+(i+1)+'</span>'
          +'<div style="flex:1"><b style="color:#e8e8ef">'+j.company+'</b> — '+j.title
          +'<div style="font-size:11px;color:#8888a0">'+(j.location||'')+'</div></div>'
          +'<span style="font-weight:700;color:'+col+'">'+s+'%</span> '+lk+'</div>';
      }).join('');
    }
    // sort by best fit: semantic score desc, then keyword ats desc
    d.sort((a,b)=>((b.semantic_score||0)-(a.semantic_score||0))||((b.ats_score||0)-(a.ats_score||0)));
    document.getElementById('jobs').innerHTML=d.length?d.map(j=>{
      const cvdl=j.cv_file?'<a class="dl" style="padding:4px 8px;margin:0" href="/api/download?file='+encodeURIComponent(j.cv_file)+'">⬇</a>':'—';
      const prep='<button class="btn ghost" style="padding:6px 10px;font-size:12px" onclick="prepare('+j.id+',this)">Prepare</button>';
      const fill='<button class="btn" style="padding:6px 10px;font-size:12px;margin-left:6px;background:#7c3aed" onclick="fillForm('+j.id+',this)" title="Auto-fill the application form">⚡Fill</button>';
      const contact='<button class="btn" style="padding:6px 10px;font-size:12px;margin-left:6px;background:#0ea5e9" onclick="findContact('+j.id+')" title="Find people + outreach">👥Contact</button>';
      const apply='<button class="btn green" style="padding:6px 10px;font-size:12px;margin-left:6px" onclick="applyJob('+j.id+',this)">Apply</button>';
      let fit='—';
      if(j.semantic_score!=null){
        const s=Math.round(j.semantic_score);
        const col=s>=70?'#34d399':s>=50?'#fbbf24':'#fca5a5';
        const rec=j.recommendation?('<div style="font-size:10px;color:'+col+'">'+j.recommendation+'</div>'):'';
        fit='<b style="color:'+col+'">'+s+'%</b>'+rec;
      }
      // Location + Remote badge + link to posting
      const locRaw=(j.location||'').toString();
      const isRemote=/remote/i.test(locRaw);
      const remoteBadge=isRemote?'<span style="background:#14241c;color:#34d399;padding:1px 6px;border-radius:5px;font-size:10px;margin-left:4px">Remote</span>':'';
      const locShort=locRaw.replace(/remote/ig,'').trim().slice(0,28)||(isRemote?'':'—');
      const link=j.url?'<a href="'+j.url+'" target="_blank" style="color:#818cf8;text-decoration:none;font-size:11px;margin-left:6px" title="Open posting">↗</a>':'';
      const locCell='<span style="font-size:12px;color:#b8b8c8">'+locShort+'</span>'+remoteBadge+link;
      // Posted "Xh/Xd ago"
      let posted='—';const ph=hrsAgo(j.posted_at);
      if(ph!=null){const col=ph<=24?'#34d399':ph<=72?'#fbbf24':'#8888a0';
        posted='<span style="font-size:11px;color:'+col+'">'+(ph<24?Math.max(1,Math.round(ph))+'h':Math.round(ph/24)+'d')+' ago</span>';}
      // Source badge
      const srcMap={'greenhouse':'🌱','ashby':'🔵','lever':'🟠','indeed':'🔍','remoteok':'🌐','ycombinator':'🚀','workday':'🏢','manual':'✍️','google':'🔍'};
      const srcLabel={'greenhouse':'Greenhouse','ashby':'Ashby','lever':'Lever','indeed':'Indeed','remoteok':'RemoteOK','ycombinator':'YC HN','workday':'Workday','manual':'Manual','google':'Google'};
      const src=j.platform||'manual';
      const isCptOpt=CPT_OPT_COMPANIES.has((j.company||'').toLowerCase());
      const cptBadge=isCptOpt?'<span style="font-size:10px;background:#14241c;color:#34d399;padding:2px 6px;border-radius:10px;margin-left:4px">🎓OPT</span>':'';
      const srcCell='<span style="font-size:11px;background:#16162a;color:#a5b4fc;padding:3px 8px;border-radius:12px;white-space:nowrap">'+(srcMap[src]||'•')+' '+(srcLabel[src]||src)+'</span>'+cptBadge;
      return '<tr><td>'+j.company+'</td><td>'+j.title+'</td><td>'+srcCell+'</td><td>'+locCell+'</td><td>'+posted+'</td><td>'+(j.ats_score?Math.round(j.ats_score)+'%':'—')+'</td><td>'+fit+'</td><td>'+cvdl+'</td><td><span class="tag">'+j.status+'</span></td><td style="white-space:nowrap">'+prep+fill+contact+apply+'</td></tr>';
    }).join(''):'<tr><td colspan="10" class="empty">No jobs match the filters 🔎</td></tr>';
  }catch(e){document.getElementById('jobs').innerHTML='<tr><td colspan="9" style="color:#fca5a5;padding:16px">JS Error: '+e.message+' | '+e.stack+'</td></tr>';}
}
async function prepare(id,btn){
  btn.disabled=true;btn.textContent='...';
  try{const r=await fetch('/api/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
    const d=await r.json();
    if(d.error){alert(d.error);}
    else{let msg='Keyword ATS: '+d.before+'% → '+d.score+'%';
      if(d.semantic!=null)msg+='\\nSemantic match (GPT-4o): '+d.semantic+'%';
      if(d.recommendation)msg+='\\nRecommendation: '+d.recommendation;
      msg+='\\n\\n✅ Tailored CV generated';alert(msg);}
    loadJobs();
  }catch(e){alert('Error: '+e.message)}
  btn.disabled=false;btn.textContent='Prepare';
}
async function fillForm(id,btn){
  if(!confirm('This opens a browser, fills the application form and uploads your CV, then PAUSES before Submit. You review and submit yourself. Continue?'))return;
  btn.disabled=true;btn.textContent='...';
  try{const r=await fetch('/api/fill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
    const d=await r.json();
    if(d.error)alert(d.error);else alert('Form-filler launched — a browser window will open, fill the form, and pause before Submit. Review and submit yourself.');
  }catch(e){alert('Error: '+e.message)}
  btn.disabled=false;btn.textContent='Fill';
}
async function applyJob(id,btn){
  if(!confirm('This opens the job posting in Chrome and marks it as applied. You submit the final application yourself. Continue?'))return;
  btn.disabled=true;
  try{const r=await fetch('/api/apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
    const d=await r.json();
    if(!d.opened)alert('This job has no URL saved — open the posting manually. (Scanned jobs have URLs and open automatically.)');
    loadJobs();}
  catch(e){alert('Error: '+e.message)}
  btn.disabled=false;
}
loadJobs();
loadWishlist();
