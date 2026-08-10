const $ = s => document.querySelector(s);
const views = ['loginView','homeView','quizView','resultView'];
const state = { user:null, sessionToken:null, mode:null, bankId:'2023-A01', bank:null, questions:(window.QUESTION_BANKS||{})['2023-A01']||[], order:[], index:0, answers:{}, checked:{}, startedAt:null, timerId:null, heartbeatId:null, heartbeatFailures:0, remaining:5400, reviewResults:false, scale:2 };
const thresholds={2:36,3:38,4:40,5:42,6:44,7:46,8:46};
const cfg=window.SUPABASE_CONFIG||{};

function showView(id){ views.forEach(v=>$('#'+v).classList.toggle('hidden',v!==id)); window.scrollTo({top:0,behavior:'instant'}); }
function norm(s){ return (s||'').trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' '); }
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function isConfigured(){return /^https:\/\/.+\.supabase\.co\/?$/i.test(cfg.url||'') && /^sb_publishable_/i.test(cfg.publishableKey||'');}
function apiBase(){return (cfg.url||'').replace(/\/$/,'')+'/rest/v1/rpc/';}
async function rpc(name,body,{keepalive=false}={}){
  if(!isConfigured()) throw new Error('Supabase todavía no está configurado.');
  const res=await fetch(apiBase()+name,{method:'POST',headers:{'apikey':cfg.publishableKey,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',keepalive});
  if(!res.ok){const text=await res.text();throw new Error(text||`Error Supabase ${res.status}`);}
  const text=await res.text();return text?JSON.parse(text):null;
}
function makeToken(){return crypto.randomUUID();}
function saveSession(){ sessionStorage.setItem('simSession',JSON.stringify({user:state.user,sessionToken:state.sessionToken})); }
function clearLocalSession(){sessionStorage.removeItem('simSession');state.user=null;state.sessionToken=null;stopHeartbeat();setUserChip();}
async function loadSession(){
  let saved=null;try{saved=JSON.parse(sessionStorage.getItem('simSession'));}catch{}
  if(!saved?.user||!saved?.sessionToken)return;
  state.user=saved.user;state.sessionToken=saved.sessionToken;
  try{
    const alive=await rpc('heartbeat_participante',{p_session_token:state.sessionToken});
    if(alive){setUserChip();startHeartbeat();showHome();}else clearLocalSession();
  }catch(err){
    clearLocalSession();
    $('#loginError').textContent='No fue posible validar la sesión guardada. Verifica tu conexión e inténtalo nuevamente.';
    $('#loginError').classList.remove('hidden');
  }
}
function setUserChip(){ $('#userChip').textContent=state.user?state.user.nombre:''; $('#userChip').classList.toggle('hidden',!state.user); }
function setLoginBusy(busy){const btn=$('#loginSubmit');btn.disabled=busy;btn.textContent=busy?'Verificando…':'Ingresar';}

$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault();$('#loginError').classList.add('hidden');setLoginBusy(true);
  const nombre=$('#nameInput').value, correo=$('#emailInput').value;
  const token=makeToken();
  try{
    const result=await rpc('login_participante',{p_nombre:nombre,p_correo:correo,p_session_token:token});
    if(!result?.ok){
      $('#loginError').textContent=result?.code==='BUSY'?'Este usuario ya tiene una sesión activa en otro dispositivo. Cierra esa sesión o espera aproximadamente 3 minutos sin actividad para volver a intentar.':'Nombre o correo no autorizado. Verifica los datos e inténtalo nuevamente.';
      $('#loginError').classList.remove('hidden');return;
    }
    state.user=result.user;state.sessionToken=token;saveSession();setUserChip();startHeartbeat();showHome();
  }catch(err){
    console.error(err);$('#loginError').textContent='No se pudo conectar con Supabase. Revisa la configuración o tu conexión a Internet.';$('#loginError').classList.remove('hidden');
  }finally{setLoginBusy(false);}
});

$('#logoutBtn').onclick=async()=>{await logout(true);};
async function logout(showLogin=true){
  const token=state.sessionToken;stopTimer();stopHeartbeat();
  if(token){try{await rpc('logout_participante',{p_session_token:token});}catch(err){console.warn('No se pudo liberar la sesión inmediatamente:',err);}}
  clearLocalSession();if(showLogin)showView('loginView');
}

function startHeartbeat(){
  stopHeartbeat();state.heartbeatFailures=0;
  state.heartbeatId=setInterval(async()=>{
    if(!state.sessionToken)return;
    try{
      const alive=await rpc('heartbeat_participante',{p_session_token:state.sessionToken});
      state.heartbeatFailures=0;
      if(!alive){alert('Tu sesión dejó de estar activa. Es posible que se haya iniciado sesión desde otro dispositivo.');clearLocalSession();stopTimer();showView('loginView');}
    }catch(err){
      state.heartbeatFailures++;
      console.warn('Heartbeat fallido',err);
      if(state.heartbeatFailures>=3)$('#connectionWarning').classList.remove('hidden');
    }
  },60000);
}
function stopHeartbeat(){if(state.heartbeatId)clearInterval(state.heartbeatId);state.heartbeatId=null;state.heartbeatFailures=0;$('#connectionWarning')?.classList.add('hidden');}

$('#backHome').onclick=()=>{if(confirm('¿Deseas salir? El intento actual no se guardará.')){stopTimer();showHome();}};
$('#prevBtn').onclick=()=>{if(state.index>0){state.index--;renderQuestion();}};
$('#nextBtn').onclick=()=>{if(state.index<state.order.length-1){state.index++;renderQuestion();}else if(state.mode==='review'){finishQuiz();}};
$('#checkBtn').onclick=checkReview;
$('#finishBtn').onclick=()=>{if(confirm('¿Finalizar la evaluación y ver tus resultados?')) finishQuiz();};
$('#zoomBtn').onclick=()=>{$('#dialogImage').src=$('#questionImage').src;$('#imageDialog').showModal();};
$('#closeDialog').onclick=()=>$('#imageDialog').close();
$('#retryBtn').onclick=showHome;
$('#reviewResultsBtn').onclick=()=>{state.reviewResults=true;state.mode='results';state.index=0;showView('quizView');renderPalette();renderQuestion();};
$('#exportBtn').onclick=exportResult;
$('#clearHistory').onclick=()=>{if(confirm('¿Borrar el historial guardado en este dispositivo?')){localStorage.removeItem(historyKey());renderHistory();}};

document.querySelectorAll('input[name=answer]').forEach(r=>r.addEventListener('change',e=>{const q=currentQ();state.answers[q.id]=e.target.value;if(state.mode==='review'){state.checked[q.id]=false;$('#reviewFeedback').classList.add('hidden');clearOptionStyles();}renderPalette();updateCounts();}));

function selectBank(bankId,mode){const bank=(window.EXAM_BANKS||[]).find(b=>b.id===bankId);const questions=(window.QUESTION_BANKS||{})[bankId];if(!bank||!questions){alert('No se pudo cargar este simulacro.');return;}state.bankId=bankId;state.bank=bank;state.questions=questions;state.scale=Number($('#scaleSelect').value);startQuiz(mode);}
function renderBanks(){const grid=$('#bankGrid');if(!grid)return;grid.innerHTML=(window.EXAM_BANKS||[]).map(b=>`<article class="bank-card card"><span class="bank-year">${b.year}</span><div class="eyebrow">EBR Inicial</div><h2>${b.title}</h2><div class="bank-code">${b.code}</div><p class="muted">${b.subtitle}</p><div class="bank-meta"><span>60 preguntas</span><span>A / B / C</span><span>90 min evaluación</span></div><div class="bank-actions"><button class="btn secondary" data-bank="${b.id}" data-mode="review">📚 Repaso</button><button class="btn primary" data-bank="${b.id}" data-mode="exam">📝 Evaluación</button></div></article>`).join('');grid.querySelectorAll('[data-bank]').forEach(btn=>btn.onclick=()=>selectBank(btn.dataset.bank,btn.dataset.mode));}
function startQuiz(mode){state.mode=mode;state.reviewResults=false;state.order=state.questions.map(q=>q.id);state.index=0;state.answers={};state.checked={};state.startedAt=Date.now();state.remaining=5400;showView('quizView');$('#modeTitle').textContent=`${state.bank?.title||'Simulacro'} · ${mode==='review'?'Modo Repaso':'Modo Evaluación'}`;$('#timerBox').classList.toggle('hidden',mode!=='exam');$('#checkBtn').classList.toggle('hidden',mode!=='review');$('#finishBtn').classList.toggle('hidden',mode!=='exam');renderPalette();renderQuestion();if(mode==='exam')startTimer();}
function currentQ(){return state.questions.find(q=>q.id===state.order[state.index]);}
function renderQuestion(){const q=currentQ();$('#questionNumber').textContent=`Pregunta ${q.id} de ${state.order.length}`;$('#progressText').textContent=`${state.index+1} / ${state.order.length}`;$('#questionImage').src=q.image;document.querySelectorAll('input[name=answer]').forEach(r=>{r.checked=state.answers[q.id]===r.value;r.disabled=state.mode==='results';});$('#prevBtn').disabled=state.index===0;$('#nextBtn').textContent=state.index===state.order.length-1?(state.mode==='review'?'Finalizar repaso':'Siguiente →'):'Siguiente →';$('#nextBtn').disabled=state.mode==='results'&&state.index===state.order.length-1;$('#checkBtn').classList.toggle('hidden',state.mode!=='review');$('#finishBtn').classList.toggle('hidden',state.mode!=='exam');$('#reviewFeedback').classList.add('hidden');clearOptionStyles();if(state.mode==='review'&&state.checked[q.id])showReviewFeedback(q);if(state.mode==='results')showResultFeedback(q);renderPalette();updateCounts();}
function clearOptionStyles(){document.querySelectorAll('.answers label').forEach(l=>l.classList.remove('correct','wrong'));}
function checkReview(){const q=currentQ();const a=state.answers[q.id];if(!a){$('#reviewFeedback').textContent='Selecciona una alternativa antes de comprobar.';$('#reviewFeedback').className='feedback bad';return;}state.checked[q.id]=true;showReviewFeedback(q);renderPalette();}
function showReviewFeedback(q){const a=state.answers[q.id],ok=a===q.correct;const fb=$('#reviewFeedback');fb.className='feedback '+(ok?'good':'bad');fb.textContent=ok?'✓ Respuesta correcta.':`✗ Respuesta incorrecta. La alternativa correcta es ${q.correct}.`;document.querySelectorAll('.answers label').forEach(l=>{const v=l.querySelector('input').value;if(v===q.correct)l.classList.add('correct');if(v===a&&a!==q.correct)l.classList.add('wrong');});}
function showResultFeedback(q){const a=state.answers[q.id];const fb=$('#reviewFeedback');fb.classList.remove('hidden');if(!a){fb.className='feedback bad';fb.textContent=`Sin responder. La alternativa correcta es ${q.correct}.`;}else if(a===q.correct){fb.className='feedback good';fb.textContent='✓ Tu respuesta fue correcta.';}else{fb.className='feedback bad';fb.textContent=`✗ Marcaste ${a}. La alternativa correcta es ${q.correct}.`;}document.querySelectorAll('.answers label').forEach(l=>{const v=l.querySelector('input').value;if(v===q.correct)l.classList.add('correct');if(v===a&&a!==q.correct)l.classList.add('wrong');});}
function renderPalette(){const el=$('#paletteGrid');el.innerHTML='';state.order.forEach((id,i)=>{const b=document.createElement('button');b.textContent=id;b.title='Ir a la pregunta '+id;b.onclick=()=>{state.index=i;renderQuestion();};if(i===state.index)b.classList.add('active');if(state.answers[id])b.classList.add('answered');if((state.mode==='review'&&state.checked[id])||state.mode==='results'){const q=state.questions.find(x=>x.id===id);if(state.answers[id]===q.correct)b.classList.add('correct');else if(state.answers[id])b.classList.add('wrong');}el.appendChild(b);});}
function updateCounts(){const n=Object.keys(state.answers).length;$('#answeredCount').textContent=`${n}/${state.order.length} respondidas`;}
function startTimer(){stopTimer();updateTimer();state.timerId=setInterval(()=>{state.remaining--;updateTimer();if(state.remaining<=0){stopTimer();finishQuiz(true);}},1000);}
function stopTimer(){if(state.timerId)clearInterval(state.timerId);state.timerId=null;}
function updateTimer(){const m=Math.floor(state.remaining/60),s=state.remaining%60;$('#timer').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;$('#timerBox').classList.toggle('urgent',state.remaining<=300);}
function finishQuiz(auto=false){stopTimer();const completedMode=state.mode;const total=state.order.length;let correct=0,blank=0;state.order.forEach(id=>{const q=state.questions.find(x=>x.id===id),a=state.answers[id];if(!a)blank++;else if(a===q.correct)correct++;});const incorrect=total-correct-blank,pct=Math.round(correct/total*1000)/10;const used=completedMode==='exam'?5400-state.remaining:Math.round((Date.now()-state.startedAt)/1000);state.lastResult={date:new Date().toISOString(),mode:completedMode,bankId:state.bankId,bankTitle:state.bank?.title||state.bankId,correct,incorrect,blank,total,pct,used,scale:state.scale,auto};if(completedMode==='exam'){saveHistory(state.lastResult);saveRemoteResult(state.lastResult);}$('#resultTitle').textContent=auto?'Tiempo finalizado':'Intento finalizado';$('#scorePct').textContent=pct+'%';$('#scoreRaw').textContent=`${correct} / ${total}`;$('#correctStat').textContent=correct;$('#incorrectStat').textContent=incorrect;$('#blankStat').textContent=blank;$('#timeStat').textContent=formatSeconds(used);if(completedMode==='exam'){const need=thresholds[state.scale],ok=correct>=need;$('#scaleResult').innerHTML=`Referencia Convocatoria ${state.bank?.year||''} - ${ordinalScale(state.scale)} escala: <strong>${ok?'alcanzaste':'no alcanzaste'} el mínimo de ${need} aciertos</strong>.`;}else{$('#scaleResult').textContent='Repaso completado. Puedes revisar tus respuestas o volver a practicar.';}showView('resultView');}
async function saveRemoteResult(r){
  if(!state.sessionToken)return;
  try{
    const ok=await rpc('guardar_resultado',{p_session_token:state.sessionToken,p_simulacro:r.bankId,p_modalidad:r.mode,p_correctas:r.correct,p_incorrectas:r.incorrect,p_sin_responder:r.blank,p_total:r.total,p_porcentaje:r.pct,p_tiempo_segundos:r.used,p_escala:r.scale,p_envio_automatico:!!r.auto});
    if(!ok)console.warn('El resultado no pudo guardarse en Supabase porque la sesión ya no estaba activa.');
  }catch(err){console.warn('No se pudo guardar el resultado remoto:',err);}
}
function formatSeconds(sec){const m=Math.floor(sec/60),s=sec%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
function ordinalScale(n){return ({2:'segunda',3:'tercera',4:'cuarta',5:'quinta',6:'sexta',7:'séptima',8:'octava'})[n]||n;}
function historyKey(){return 'examHistory:'+norm(state.user?.correo||'anon');}
function saveHistory(r){const arr=JSON.parse(localStorage.getItem(historyKey())||'[]');arr.unshift(r);localStorage.setItem(historyKey(),JSON.stringify(arr.slice(0,10)));}
function renderHistory(){const el=$('#historyList');const arr=JSON.parse(localStorage.getItem(historyKey())||'[]');if(!arr.length){el.className='muted';el.textContent='Aún no hay intentos guardados en este dispositivo.';return;}el.className='';el.innerHTML=arr.map(r=>`<div class="attempt-row"><span>${new Date(r.date).toLocaleString('es-PE')}</span><span>${r.bankTitle||r.bankId||'Simulacro'} · ${r.correct}/${r.total} (${r.pct}%)</span><span>${ordinalScale(r.scale)} escala</span><span>${formatSeconds(r.used)}</span></div>`).join('');}
function showHome(){showView('homeView');renderBanks();renderHistory();}
function exportResult(){const r=state.lastResult;if(!r)return;const rows=[['nombre','correo','fecha','simulacro','modalidad','correctas','incorrectas','sin_responder','total','porcentaje','tiempo_segundos','escala'],[state.user.nombre,state.user.correo,r.date,r.bankId,r.mode,r.correct,r.incorrect,r.blank,r.total,r.pct,r.used,r.scale]];const csv=rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`resultado-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);}

(async()=>{
  if(!isConfigured()){
    $('#loginError').innerHTML='Falta configurar Supabase. Abre <strong>data/supabase-config.js</strong> y pega tu Project URL y Publishable key.';
    $('#loginError').classList.remove('hidden');$('#loginSubmit').disabled=true;return;
  }
  await loadSession();
})();
