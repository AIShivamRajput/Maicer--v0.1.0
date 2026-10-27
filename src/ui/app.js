const $=(s,r=document)=>r.querySelector(s),$$=s=>[...document.querySelectorAll(s)],esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=n=>n.toLocaleString(),D=864e5;
const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':new Date(t).toLocaleDateString()};
const group=t=>{const d=new Date(),s=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();return t>=s?'Today':t>=s-D?'Yesterday':t>=s-7*D?'Previous 7 days':'Older'};
const keys=hk=>String(hk).split('+').map(k=>`<kbd>${esc(k==='Control'?'Ctrl':k)}</kbd>`).join(' ');
const IC={mic:'<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',copy:'<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',trash:'<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'};
const row=r=>`<div class="row" tabindex="0" data-id="${r.id}"><div class="av">${esc((r.application||(r.kind==='code'?'</>':'T'))[0]||'T')}</div><div class="t"><b>${esc(r.transcription)}</b><small><span class="tag">${r.kind==='code'?'Code':'Text'}</span>${esc(r.application||'')}</small></div><span class="when">${ago(r.created_at)}</span></div>`;
function countTo(el,v){const from=Number(el.dataset.v||0);el.dataset.v=v;if(from===v){el.textContent=fmt(v);return}const t0=performance.now();(function f(t){const p=Math.min(1,(t-t0)/450),e=1-Math.pow(1-p,3);el.textContent=fmt(Math.round(from+(v-from)*e));if(p<1)requestAnimationFrame(f)})(t0)}
let cache=[],sel=null;
async function home(){const[s,r,d]=await Promise.all([maicer.stats(),maicer.recent(6),maicer.daily(7)]);cache=r;countTo($('#total'),s.total);countTo($('#today'),s.today);
 $('#cnt').textContent=s.count?`${fmt(s.count)} ${s.count===1?'insertion':'insertions'}`:'No activity yet';const mx=Math.max(1,...d);$('#bars').innerHTML=d.map(n=>`<i style="height:${Math.max(3,Math.round(n/mx*34))}px" title="${n} lines"></i>`).join('');
 $('#recent').innerHTML=r.length?r.map(row).join(''):`<div class="empty"><div class="orb">${IC.mic}</div><h3>Start creating with Maicer</h3><p>Hold <kbd>Ctrl</kbd> <kbd>M</kbd>, speak, then let go.</p><p>Your activity will appear here.</p></div>`}
async function hist(){const r=await maicer.search($('#q').value.trim());cache=r;let h='',g='';for(const x of r){const k=group(x.created_at);if(k!==g){h+=`<div class="glabel">${k}</div>`;g=k}h+=row(x)}
 $('#hlist').innerHTML=h||'<div class="empty"><p>No matching activity.</p></div>';if(!r.find(x=>x.id===sel))sel=null;detail()}
function detail(){const r=cache.find(x=>x.id===sel),el=$('#detail');$$('#hlist .row').forEach(x=>x.classList.toggle('sel',x.dataset.id===sel));
 if(!r){el.innerHTML='<div class="empty" style="padding:40px 10px"><p>Select an entry to see the details.</p></div>';return}
 el.innerHTML=`<h3>${esc(r.transcription)}</h3><div class="chips"><span>${new Date(r.created_at).toLocaleString()}</span><span>${esc(r.application||'Unknown app')}</span><span>${r.line_count} lines</span><span>${r.word_count} words</span></div><pre>${esc(r.generated_output)}</pre><div style="display:flex;gap:8px"><button class="btn" id="cp">${IC.copy}Copy</button><button class="btn g" id="rm">${IC.trash}Delete</button></div>`;
 $('#cp').onclick=()=>{maicer.copy(r.generated_output);$('#cp').lastChild.textContent='Copied'};$('#rm').onclick=async()=>{await maicer.del(r.id);sel=null;hist();home()}}
document.addEventListener('click',e=>{const r=e.target.closest('.row');if(r){sel=r.dataset.id;if($('#home').classList.contains('on')){go('history')}else detail()}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.classList?.contains('row'))e.target.click()});
function go(p){$$('section,nav button').forEach(x=>x.classList.remove('on'));$('#'+p).classList.add('on');$(`[data-p=${p}]`).classList.add('on');p==='history'?hist():p==='home'?home():settings()}
$$('nav button').forEach(b=>b.onclick=()=>go(b.dataset.p));$('#q').oninput=hist;
const h=new Date().getHours();$('#greet').textContent=h<12?'Good morning':h<18?'Good afternoon':'Good evening';
let cur={};
function apply(s){cur=s;showMic(!!s.micReady);document.documentElement.dataset.theme=s.theme;
 $$('[data-k]').forEach(el=>{const k=el.dataset.k,v=s[k];if(el.classList.contains('sw'))el.setAttribute('aria-checked',!!v);else if(el.classList.contains('seg'))el.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v==v));else el.value=v??''});
 $('#hkb').innerHTML=keys(s.hotkey);$('#hkmini').innerHTML=keys(s.hotkey);$('#hk1').innerHTML=keys(s.hotkey);$('#err').textContent=s.hotkeyError||'';$('#idleRow').style.display=s.performance==='saver'?'flex':'none'}
async function save(p){const r=await maicer.setSettings(p);if(r.error)$('#err').textContent=r.error;else apply(r)}
async function loadMics(){try{const d=(await navigator.mediaDevices.enumerateDevices()).filter(x=>x.kind==='audioinput'&&!['default','communications'].includes(x.deviceId));
 $('#micId').innerHTML='<option value="">System default</option>'+d.map((x,i)=>`<option value="${esc(x.deviceId)}">${esc(x.label||'Microphone '+(i+1))}</option>`).join('')}catch{}}
async function settings(){await loadMics();apply(await maicer.getSettings())}
document.addEventListener('click',e=>{const sw=e.target.closest('.sw');if(sw)save({[sw.dataset.k]:sw.getAttribute('aria-checked')!=='true'});const sb=e.target.closest('.seg button');if(sb)save({[sb.parentNode.dataset.k]:sb.dataset.v})});
document.addEventListener('change',e=>{if(e.target.matches('select[data-k]'))save({[e.target.dataset.k]:e.target.value})});
$('#hkb').onclick=()=>{$('#hkb').textContent='Press new shortcut…';$('#err').textContent='';const on=e=>{e.preventDefault();if(e.key==='Escape'){done();return}if(['Control','Shift','Alt','Meta'].includes(e.key))return;
 const m=[e.ctrlKey&&'Control',e.altKey&&'Alt',e.shiftKey&&'Shift',e.metaKey&&'Super'].filter(Boolean);if(!m.length){$('#err').textContent='Include Ctrl, Alt, or Shift.';return}
 const k=e.key.length===1?e.key.toUpperCase():e.key.replace('Arrow','');done();save({hotkey:[...m,k].join('+')})};
 const done=()=>{document.removeEventListener('keydown',on,true);apply(cur)};document.addEventListener('keydown',on,true)};
$('#mbtn').onclick=async()=>{const m=$('#mtest');m.textContent='Say something…';m.className='';let st,c,t;try{st=await navigator.mediaDevices.getUserMedia({audio:$('#micId').value?{deviceId:{exact:$('#micId').value}}:true});
 c=new AudioContext();const a=c.createAnalyser(),buf=new Float32Array(a.fftSize);c.createMediaStreamSource(st).connect(a);let peak=0;t=setInterval(()=>{a.getFloatTimeDomainData(buf);let p=0;for(const v of buf)p=Math.max(p,Math.abs(v));peak=Math.max(peak,p);$('#lvl').style.width=Math.min(100,p*300)+'%'},60);
 await new Promise(r=>setTimeout(r,3000));m.textContent=peak>0.02?'Your microphone is working.':"We didn't hear anything. Try speaking again."}catch{m.textContent='Microphone unavailable. Check your microphone and try again.'}finally{clearInterval(t);$('#lvl').style.width='0';st?.getTracks().forEach(x=>x.stop());c?.close()}};
$('#diag').onclick=()=>maicer.openDiag();
$('#clr').onclick=async()=>{if(confirm('Delete all history and reset your line counts?')){await maicer.clear();sel=null;home();hist()}};
maicer.onChange(()=>{home();hist()});maicer.onGoto(go);
maicer.onRec(s=>{$('#dot').className='dot '+s;$('#stxt').textContent=s==='listening'?'Listening':s==='processing'?'Processing':'Ready'});maicer.onChange(()=>{$('#dot').className='dot';$('#stxt').textContent='Ready'});
function showMic(ready){ const c=document.getElementById('micCard'); if(c) c.style.display = ready ? 'none' : 'block'; }
$('#micBtn').onclick=async()=>{
  const m=$('#micMsg'); m.textContent='Checking your microphone…';
  try{
    const st=await navigator.mediaDevices.getUserMedia({audio:true}); st.getTracks().forEach(t=>t.stop());
    await maicer.setSettings({micReady:true});
    m.textContent='Ready. Hold Ctrl + M, speak, then let go.';
  }catch{
    m.textContent='Microphone blocked. Turn on Settings → Privacy & security → Microphone → Let desktop apps access your microphone, then click again.';
  }
};
maicer.getSettings().then(apply); home();
