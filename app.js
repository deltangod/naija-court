const diagnosticElement = document.getElementById('diagnostic');
if (diagnosticElement) diagnosticElement.textContent = 'Diagnostic: external JavaScript file loaded; starting app…';
const $=id=>document.getElementById(id);
let supabase=null,user=null,profile=null,selected=null,channel=null;
const fmt=n=>'₦'+Number(n||0).toLocaleString('en-NG');
function message(id,t){$(id).textContent=t}
function reportDiagnostic(t){const d=$('diagnostic');if(d)d.textContent='Diagnostic: '+t}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function ready(){return window.NAIJA_COURT_CONFIG&&window.NAIJA_COURT_CONFIG.supabaseUrl.startsWith('https://')&&!window.NAIJA_COURT_CONFIG.supabaseUrl.includes('YOUR_PROJECT')&&window.NAIJA_COURT_CONFIG.supabaseAnonKey&&!window.NAIJA_COURT_CONFIG.supabaseAnonKey.includes('YOUR_SUPABASE')}
async function init(){
 reportDiagnostic('signup script is running; checking Supabase and config…');
 if(!window.supabase || typeof window.supabase.createClient !== 'function'){
   message('authMsg','Could not load the Supabase library. Check your internet connection and reload the page.');reportDiagnostic('Supabase library did not load.');
   return;
 }
 if(!ready()){
   message('authMsg','Setup issue: config.js is missing or its Supabase URL/key is not configured. Upload config.js alongside index.html in Netlify.');reportDiagnostic('config.js is missing or invalid.');
   return;
 }
 try {
 supabase=window.supabase.createClient(window.NAIJA_COURT_CONFIG.supabaseUrl,window.NAIJA_COURT_CONFIG.supabaseAnonKey);
 reportDiagnostic('Supabase client created; checking session…');
 const {data:{session}}=await supabase.auth.getSession();user=session?.user||null;reportDiagnostic('JavaScript and Supabase initialized. Buttons should respond.');await renderSession();
 supabase.auth.onAuthStateChange(async(_event,session)=>{user=session?.user||null;await renderSession()});
 } catch(e) {
   message('authMsg','Setup error: '+(e?.message||'Could not initialize account services.'));reportDiagnostic('Supabase initialization failed: '+(e?.message||'unknown error'));
 }
}
async function renderSession(){
 $('auth').classList.toggle('hidden',!!user);$('app').classList.toggle('hidden',!user);
 $('sessionLabel').textContent=user?(user.email||'Signed in'):'Not signed in';
 if(!user){if(channel){await supabase.removeChannel(channel);channel=null}return}
 await loadProfile();await loadCases();
}
$('signupBtn').onclick=async()=>{try{if(!supabase){message('authMsg','Account service is not initialized. Reload the page and check config.js.');return}const email=$('loginEmail').value.trim(),password=$('loginPassword').value;if(!email||password.length<8){message('authMsg','Enter an email and password of at least 8 characters.');return}const {error}=await supabase.auth.signUp({email,password});message('authMsg',error?error.message:'Account created. If email confirmation is enabled, confirm your email before signing in.')}catch(e){message('authMsg','Sign-up failed: '+(e?.message||'Unexpected error. Check your connection and config.'))}};
$('loginBtn').onclick=async()=>{try{if(!supabase){message('authMsg','Account service is not initialized. Reload the page and check config.js.');return}const {error}=await supabase.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});message('authMsg',error?error.message:'Signed in.')}catch(e){message('authMsg','Sign-in failed: '+(e?.message||'Unexpected error. Check your connection and config.'))}};
$('signoutBtn').onclick=async()=>{await supabase.auth.signOut()};
async function loadProfile(){const {data,error}=await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle();if(error){message('profileMsg','Profile load error: '+error.message);return}profile=data;if(profile){$('username').value=profile.username||'';$('displayName').value=profile.display_name||'';$('wallet').textContent=fmt(profile.wallet)}}
$('saveProfile').onclick=async()=>{const username=$('username').value.trim().replace(/^@/,'').toLowerCase(),display_name=$('displayName').value.trim();if(!/^[a-z0-9_]{3,24}$/.test(username)){message('profileMsg','Username must be 3–24 characters: letters, numbers, underscores.');return}const {data,error}=await supabase.from('profiles').upsert({id:user.id,username,display_name},{onConflict:'id'}).select().single();if(error){message('profileMsg','Could not save profile: '+error.message);return}profile=data;$('wallet').textContent=fmt(profile.wallet);message('profileMsg','Profile saved. Your court identity is ready.')};
$('createCase').onclick=async()=>{if(!profile?.username){message('caseMsg','Save your username first.');return}const opponentName=$('opponent').value.trim().replace(/^@/,'').toLowerCase(),claim=$('claim').value.trim();if(!opponentName||!claim){message('caseMsg','Enter an opponent username and claim.');return}if(opponentName===profile.username){message('caseMsg','You cannot sue yourself.');return}
const {data:opp,error:oe}=await supabase.from('profiles').select('id,username').eq('username',opponentName).maybeSingle();if(oe||!opp){message('caseMsg','Opponent not found. They must create an account and save their username first.');return}if(opp.id===user.id){message('caseMsg','You cannot sue yourself.');return}
const {data,error}=await supabase.rpc('create_case',{p_defendant:opp.id,p_category:$('category').value,p_claim:claim});if(error){message('caseMsg','Case could not be filed: '+error.message);return}message('caseMsg','Case filed and invitation created. Share the case ID with your opponent: '+data);$('claim').value='';await loadCases();selectCase(data)};
async function loadCases(){if(!user)return;const {data,error}=await supabase.from('cases').select('*').or(`plaintiff.eq.${user.id},defendant.eq.${user.id}`).order('created_at',{ascending:false});if(error){$('caseList').textContent='Could not load cases: '+error.message;return}if(!data.length){$('caseList').textContent='No cases yet. File one and invite another player.';return}
$('caseList').innerHTML=data.map(c=>`<div class="case"><span class="status">${esc(c.status)}</span><h3>${esc(c.case_number)} · ${esc(c.category)}</h3><p>${esc(c.claim)}</p><div class="small muted">You are ${c.plaintiff===user.id?'the plaintiff':'the defendant'} · ${new Date(c.created_at).toLocaleString()}</div><button data-open="${esc(c.id)}">Open hearing</button></div>`).join('');
document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>selectCase(b.dataset.open));
if(channel)await supabase.removeChannel(channel);channel=supabase.channel('case-updates-'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'cases'},()=>loadCases()).subscribe()}
async function selectCase(id){const {data,error}=await supabase.from('cases').select('*').eq('id',id).single();if(error){message('hearingMsg',error.message);return}selected=data;$('selectedCase').innerHTML=`<span class="status">${esc(data.status)}</span><h3>${esc(data.case_number)} · ${esc(data.category)}</h3><p>${esc(data.claim)}</p><div class="small muted">Plaintiff: ${esc(data.plaintiff_username||'Player')} · Defendant: ${esc(data.defendant_username||'Player')}</div>`;$('submitArgument').disabled=data.status==='closed';await loadTimeline();document.querySelector('[data-tab="hearing"]').click()}
async function loadTimeline(){if(!selected)return;const {data,error}=await supabase.from('case_events').select('*').eq('case_id',selected.id).order('created_at');if(error){$('timeline').textContent=error.message;return}$('timeline').innerHTML=data.length?data.map(e=>`<div class="case"><b>${esc(e.event_type)}</b><p>${esc(e.body)}</p><div class="small muted">${new Date(e.created_at).toLocaleString()}</div></div>`).join(''):'No arguments submitted yet.'}
$('submitArgument').onclick=async()=>{if(!selected)return;const body=$('argument').value.trim();if(!body){message('hearingMsg','Write an argument first.');return}const {error}=await supabase.from('case_events').insert({case_id:selected.id,event_type:'Argument / evidence note',body});if(error){message('hearingMsg','Could not submit: '+error.message);return}$('argument').value='';message('hearingMsg','Your argument is visible to the case participants.');await loadTimeline()};
$('closeCase').onclick=async()=>{if(!selected)return;const {error}=await supabase.from('cases').update({status:'closed',verdict:$('verdict').value}).eq('id',selected.id);if(error){message('hearingMsg','Could not record verdict: '+error.message);return}const {error:ee}=await supabase.from('case_events').insert({case_id:selected.id,event_type:'Demo verdict',body:$('verdict').value});message('hearingMsg',ee?'Verdict recorded; timeline event failed.':'Demo verdict recorded for both participants.');await selectCase(selected.id);await loadCases()};
$('refreshCases').onclick=loadCases;
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['newcase','mycases','hearing'].forEach(id=>$(id).classList.toggle('hidden',id!==b.dataset.tab))});
init();
