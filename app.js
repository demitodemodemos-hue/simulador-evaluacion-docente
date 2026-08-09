
const $ = s => document.querySelector(s);
const views = ['loginView','homeView','quizView','resultView'];
const state = { user:null, mode:null, questions:window.QUESTION_BANK, order:[], index:0, answers:{}, checked:{}, startedAt:null, timerId:null, remaining:3600, reviewResults:false, scale:2 };
const thresholds={2:36,3:38,4:40,5:42,6:44,7:46,8:46};
let authorizedUsers=[];

function showView(id){ views.forEach(v=>$('#'+v).classList.toggle('hidden',v!==id)); window.scrollTo({top:0,behavior:'instant'}); }
function norm(s){ return (s||'').trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' '); }
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
async function loadUsers(){
  const res=await fetch('data/usuarios.csv',{cache:'no-store'}); if(!res.ok) throw new Error('No se pudo cargar la lista de usuarios.');
  const txt=await res.text(); const lines=txt.split(/\r?\n/).filter(Boolean); authorizedUsers=lines.slice(1).map(line=>{const i=line.lastIndexOf(',');return {nombre:line.slice(0,i).trim(),correo:line.slice(i+1).trim()};});
}
function saveSession(){ sessionStorage.setItem('simUser',JSON.stringify(state.user)); }
function loadSession(){ try{state.user=JSON.parse(sessionStorage.getItem('simUser'));}catch{} if(state.user){setUserChip();showHome();} }
function setUserChip(){ $('#userChip').textContent=state.user?state.user.nombre:''; $('#userChip').classList.toggle('hidden',!state.user); }

$('#loginForm').addEventListener('submit',e=>{e.preventDefault(); const nombre=$('#nameInput').value, correo=$('#emailInput').value; const found=authorizedUsers.find(u=>norm(u.nombre)===norm(nombre)&&norm(u.correo)===norm(correo)); if(!found){$('#loginError').textContent='Nombre o correo no autorizado. Verifica los datos e inténtalo nuevamente.';$('#loginError').classList.remove('hidden');return;} state.user=found;saveSession();setUserChip();showHome();});
$('#logoutBtn').onclick=()=>{sessionStorage.removeItem('simUser');state.user=null;setUserChip();showView('loginView');};
$('#startReview').onclick=()=>startQuiz('review');
$('#startExam').onclick=()=>{state.scale=Number($('#scaleSelect').value);startQuiz('exam');};
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

function startQuiz(mode){state.mode=mode;state.reviewResults=false;state.order=state.questions.map(q=>q.id);state.index=0;state.answers={};state.checked={};state.startedAt=Date.now();state.remaining=3600;showView('quizView');$('#modeTitle').textContent=mode==='review'?'Modo Repaso':'Modo Evaluación';$('#timerBox').classList.toggle('hidden',mode!=='exam');$('#checkBtn').classList.toggle('hidden',mode!=='review');$('#finishBtn').classList.toggle('hidden',mode!=='exam');renderPalette();renderQuestion();if(mode==='exam')startTimer();}
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
function finishQuiz(auto=false){stopTimer();const total=state.order.length;let correct=0,blank=0;state.order.forEach(id=>{const q=state.questions.find(x=>x.id===id),a=state.answers[id];if(!a)blank++;else if(a===q.correct)correct++;});const incorrect=total-correct-blank,pct=Math.round(correct/total*1000)/10;const used=state.mode==='exam'?3600-state.remaining:Math.round((Date.now()-state.startedAt)/1000);state.lastResult={date:new Date().toISOString(),mode:state.mode,correct,incorrect,blank,total,pct,used,scale:state.scale,auto};if(state.mode==='exam')saveHistory(state.lastResult);$('#resultTitle').textContent=auto?'Tiempo finalizado':'Intento finalizado';$('#scorePct').textContent=pct+'%';$('#scoreRaw').textContent=`${correct} / ${total}`;$('#correctStat').textContent=correct;$('#incorrectStat').textContent=incorrect;$('#blankStat').textContent=blank;$('#timeStat').textContent=formatSeconds(used);if(state.mode==='exam'){const need=thresholds[state.scale],ok=correct>=need;$('#scaleResult').innerHTML=`Referencia Convocatoria 2023 - ${ordinalScale(state.scale)} escala: <strong>${ok?'alcanzaste':'no alcanzaste'} el mínimo de ${need} aciertos</strong>.`;}else{$('#scaleResult').textContent='Repaso completado. Puedes revisar tus respuestas o volver a practicar.';}showView('resultView');}
function formatSeconds(sec){const m=Math.floor(sec/60),s=sec%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
function ordinalScale(n){return ({2:'segunda',3:'tercera',4:'cuarta',5:'quinta',6:'sexta',7:'séptima',8:'octava'})[n]||n;}
function historyKey(){return 'examHistory:'+norm(state.user?.correo||'anon');}
function saveHistory(r){const arr=JSON.parse(localStorage.getItem(historyKey())||'[]');arr.unshift(r);localStorage.setItem(historyKey(),JSON.stringify(arr.slice(0,10)));}
function renderHistory(){const el=$('#historyList');const arr=JSON.parse(localStorage.getItem(historyKey())||'[]');if(!arr.length){el.className='muted';el.textContent='Aún no hay intentos guardados en este dispositivo.';return;}el.className='';el.innerHTML=arr.map(r=>`<div class="attempt-row"><span>${new Date(r.date).toLocaleString('es-PE')}</span><span>${r.correct}/${r.total} (${r.pct}%)</span><span>${ordinalScale(r.scale)} escala</span><span>${formatSeconds(r.used)}</span></div>`).join('');}
function showHome(){showView('homeView');renderHistory();}
function exportResult(){const r=state.lastResult;if(!r)return;const rows=[['nombre','correo','fecha','modalidad','correctas','incorrectas','sin_responder','total','porcentaje','tiempo_segundos','escala'],[state.user.nombre,state.user.correo,r.date,r.mode,r.correct,r.incorrect,r.blank,r.total,r.pct,r.used,r.scale]];const csv=rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`resultado-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);}

(async()=>{try{await loadUsers();loadSession();}catch(err){$('#loginError').textContent='Error al cargar la lista de acceso. Si abriste index.html directamente, usa un servidor web local o publícalo en GitHub Pages.';$('#loginError').classList.remove('hidden');}})();
