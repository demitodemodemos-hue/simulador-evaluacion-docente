const $ = s => document.querySelector(s);
const cfg = window.SUPABASE_CONFIG || {};
let auth = null;
let selectedParticipant = null;

function isConfigured(){return /^https:\/\/.+\.supabase\.co\/?$/i.test(cfg.url||'') && /^sb_publishable_/i.test(cfg.publishableKey||'');}
function base(){return (cfg.url||'').replace(/\/$/,'');}
function show(el,yes=true){$(el).classList.toggle('hidden',!yes);}
function formatDate(v){return v?new Date(v).toLocaleString('es-PE'):'—';}
function formatSeconds(sec){if(sec==null)return '—';const m=Math.floor(sec/60),s=sec%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function setMsg(msg,type='good'){const el=$('#adminMessage');el.textContent=msg;el.className='admin-message '+type;}
function hideMsg(){show('#adminMessage',false);}

async function authRequest(path,body){
  const r=await fetch(base()+path,{method:'POST',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error_description||data.msg||data.message||'Error de autenticación');return data;
}
async function login(email,password){return authRequest('/auth/v1/token?grant_type=password',{email,password});}
async function refreshSession(){
  if(!auth?.refresh_token)throw new Error('No hay sesión para renovar.');
  auth=await authRequest('/auth/v1/token?grant_type=refresh_token',{refresh_token:auth.refresh_token});
  sessionStorage.setItem('adminAuth',JSON.stringify(auth));return auth;
}
async function rpc(name,body={},retry=true){
  if(!auth?.access_token)throw new Error('Sesión administrativa no disponible.');
  const r=await fetch(`${base()}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:cfg.publishableKey,Authorization:`Bearer ${auth.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  if(r.status===401 && retry){await refreshSession();return rpc(name,body,false);}
  const text=await r.text();if(!r.ok)throw new Error(text||`Error ${r.status}`);return text?JSON.parse(text):null;
}
function saveAuth(data){auth=data;sessionStorage.setItem('adminAuth',JSON.stringify(data));}
function clearAuth(){auth=null;sessionStorage.removeItem('adminAuth');}

async function loadDashboard(){
  hideMsg();
  const [summary,users,results]=await Promise.all([rpc('admin_resumen'),rpc('admin_listar_participantes',{p_busqueda:$('#userSearch').value.trim()}),rpc('admin_listar_resultados',{p_participante_id:null,p_limite:100})]);
  $('#mUsers').textContent=summary.usuarios??0;$('#mOnline').textContent=summary.conectados??0;$('#mResults').textContent=summary.evaluaciones??0;$('#mAverage').textContent=summary.promedio==null?'—':`${Number(summary.promedio).toFixed(1)}%`;
  renderUsers(users||[]);renderResults(results||[]);selectedParticipant=null;$('#resultsTitle').textContent='Todos los participantes';
}
function renderUsers(rows){
  const tb=$('#usersBody');if(!rows.length){tb.innerHTML='<tr><td class="empty-row" colspan="8">No se encontraron participantes.</td></tr>';return;}
  tb.innerHTML=rows.map(u=>`<tr>
    <td><strong>${escapeHtml(u.nombre)}</strong></td><td>${escapeHtml(u.correo)}</td>
    <td><span class="status ${u.activo?'on':'disabled'}">${u.activo?'Habilitado':'Deshabilitado'}</span></td>
    <td><span class="status ${u.conectado?'on':'off'}">${u.conectado?'● Conectado':'○ Desconectado'}</span><div class="muted-cell">${u.conectado?formatDate(u.session_last_seen):''}</div></td>
    <td>${u.intentos||0}</td><td>${u.mejor_porcentaje==null?'—':Number(u.mejor_porcentaje).toFixed(1)+'%'}</td><td>${u.ultimo_porcentaje==null?'—':Number(u.ultimo_porcentaje).toFixed(1)+'%'}</td>
    <td><div class="row-actions"><button class="mini-btn" data-edit="${u.id}">Editar</button><button class="mini-btn" data-results="${u.id}" data-name="${escapeHtml(u.nombre)}">Resultados</button>${u.conectado?`<button class="mini-btn warn" data-release="${u.id}">Liberar sesión</button>`:''}</div></td>
  </tr>`).join('');
  rows.forEach(u=>{const e=document.querySelector(`[data-edit="${u.id}"]`);if(e)e.onclick=()=>openEdit(u);const r=document.querySelector(`[data-results="${u.id}"]`);if(r)r.onclick=()=>loadParticipantResults(u.id,u.nombre);const l=document.querySelector(`[data-release="${u.id}"]`);if(l)l.onclick=()=>releaseSession(u.id,u.nombre);});
}
function renderResults(rows){
  const tb=$('#resultsBody');if(!rows.length){tb.innerHTML='<tr><td class="empty-row" colspan="7">No hay resultados registrados.</td></tr>';return;}
  tb.innerHTML=rows.map(r=>`<tr><td>${formatDate(r.fecha)}</td><td><strong>${escapeHtml(r.nombre)}</strong><div class="muted-cell">${escapeHtml(r.correo)}</div></td><td>${escapeHtml(r.modalidad)}</td><td>${r.correctas}/${r.total}</td><td>${Number(r.porcentaje).toFixed(1)}%</td><td>${formatSeconds(r.tiempo_segundos)}</td><td>${r.escala??'—'}</td></tr>`).join('');
}
async function loadParticipantResults(id,name){try{selectedParticipant=id;const rows=await rpc('admin_listar_resultados',{p_participante_id:id,p_limite:100});renderResults(rows||[]);$('#resultsTitle').textContent=`Resultados de ${name}`;$('#resultsTitle').scrollIntoView({behavior:'smooth',block:'center'});}catch(e){setMsg(e.message,'bad');}}
async function releaseSession(id,name){if(!confirm(`¿Liberar la sesión activa de ${name}?`))return;try{await rpc('admin_liberar_sesion',{p_participante_id:id});setMsg('Sesión liberada correctamente.');await loadDashboard();}catch(e){setMsg(e.message,'bad');}}
function openNew(){$('#userDialogTitle').textContent='Nuevo usuario';$('#editUserId').value='';$('#editName').value='';$('#editEmail').value='';$('#editActive').checked=true;show('#userFormError',false);$('#userDialog').showModal();}
function openEdit(u){$('#userDialogTitle').textContent='Editar usuario';$('#editUserId').value=u.id;$('#editName').value=u.nombre;$('#editEmail').value=u.correo;$('#editActive').checked=!!u.activo;show('#userFormError',false);$('#userDialog').showModal();}
async function saveUser(){
  const id=$('#editUserId').value,name=$('#editName').value.trim(),email=$('#editEmail').value.trim(),active=$('#editActive').checked;if(!name||!email)return;
  try{if(id)await rpc('admin_actualizar_participante',{p_participante_id:Number(id),p_nombre:name,p_correo:email,p_activo:active});else await rpc('admin_crear_participante',{p_nombre:name,p_correo:email});$('#userDialog').close();setMsg(id?'Usuario actualizado.':'Usuario registrado.');await loadDashboard();}catch(e){const el=$('#userFormError');el.textContent=e.message.includes('duplicate')?'Ese correo ya está registrado.':e.message;el.classList.remove('hidden');}
}

$('#adminLoginForm').addEventListener('submit',async e=>{e.preventDefault();const btn=$('#adminLoginBtn');btn.disabled=true;show('#adminLoginError',false);try{const data=await login($('#adminEmail').value.trim(),$('#adminPassword').value);saveAuth(data);await rpc('admin_resumen');$('#adminIdentity').textContent=data.user?.email||'';show('#adminLogin',false);show('#adminPanel',true);await loadDashboard();}catch(err){clearAuth();$('#adminLoginError').textContent=err.message.includes('ADMIN_REQUIRED')?'Tu cuenta existe, pero no tiene permisos de administrador.':err.message;show('#adminLoginError',true);}finally{btn.disabled=false;}});
$('#adminLogoutBtn').onclick=()=>{clearAuth();location.reload();};$('#refreshAdmin').onclick=()=>loadDashboard().catch(e=>setMsg(e.message,'bad'));$('#newUserBtn').onclick=openNew;$('#searchBtn').onclick=()=>loadDashboard().catch(e=>setMsg(e.message,'bad'));$('#userSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){$('#searchBtn').click();}});$('#allResultsBtn').onclick=async()=>{try{selectedParticipant=null;renderResults(await rpc('admin_listar_resultados',{p_participante_id:null,p_limite:100})||[]);$('#resultsTitle').textContent='Todos los participantes';}catch(e){setMsg(e.message,'bad');}};$('#closeUserDialog').onclick=()=>$('#userDialog').close();$('#cancelUser').onclick=()=>$('#userDialog').close();$('#userForm').addEventListener('submit',e=>{e.preventDefault();saveUser();});

(async()=>{
  if(!isConfigured()){const el=$('#adminLoginError');el.innerHTML='Falta configurar <strong>data/supabase-config.js</strong>.';show('#adminLoginError',true);$('#adminLoginBtn').disabled=true;return;}
  try{const saved=JSON.parse(sessionStorage.getItem('adminAuth')||'null');if(!saved)return;auth=saved;const summary=await rpc('admin_resumen');$('#adminIdentity').textContent=auth.user?.email||'';show('#adminLogin',false);show('#adminPanel',true);await loadDashboard();}catch{clearAuth();}
})();
