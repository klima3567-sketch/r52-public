// v0.4: a demonstrable coordinator workflow. All source events remain fictional.
const WF_NOW = '2026-10-27T15:00';
const WF_LABELS = {action:'К действию',scheduled:'Записаны',waiting:'Ожидают срока',excluded:'Контакт ограничен',data:'Проверить данные',complete:'Этапы выполнены'};
let workflowFilter = 'action';
CHOICE.declined = 'Отказ';

function workflowDefaults(p, index = -1) {
  const tomorrow = p.nextContact?.includes('28 октября');
  return {schema:1,revision:1,contactAllowed:index!==6,pauseKind:index===7?'medical':p.choice==='paused'?'patient':'none',
    nextAt:index===7?'2026-10-29T12:00':tomorrow?'2026-10-28T12:00':'2026-10-27T14:00',
    sourceLinked:index!==8,note:index===7?'В модели врач задал паузу до 29 октября':p.pauseReason||'',
    checkedAt:'2026-10-27T11:40',history:[]};
}
function ensureWorkflow(d) {
  d.plans.forEach((p,i)=>{if(!p.workflow)p.workflow=workflowDefaults(p,i);});
}
const workflowSeedBase = suiteSeed;
suiteSeed = function(key) { const d=workflowSeedBase(key); ensureWorkflow(d); return d; };
for (const d of Object.values(DB)) ensureWorkflow(d);

function workflowDate(value) {
  if(!value)return 'Не согласован';
  const m=/^2026-10-(\d\d)T(\d\d:\d\d)$/.exec(value);
  return m?`${Number(m[1])} октября, ${m[2]}`:value.replace('T',', ');
}
function workflowFingerprint(p) {
  return JSON.stringify([p.version,p.choice,p.coordinator,p.doctorApproved,p.workflow,p.stages]);
}
function workflowCase(p) {
  const w=p.workflow,stage=p.stages.find(s=>s.status!=='done');
  const result={p,stage,group:'action',title:'Согласовать следующий шаг',reason:'У следующего этапа нет записи или согласованного контакта.',proof:'Требуется подтверждение координатора',actionable:true};
  const set=(group,title,reason,proof)=>Object.assign(result,{group,title,reason,proof,actionable:group==='action'});
  if(!w.sourceLinked||!p.id||(stage&&!stage.id)||!w.checkedAt||!p.doctorApproved||(stage?.status==='scheduled'&&!stage.appointment))return set('data','Сверить источник','Не подтверждены связь этапа, врачебный план или актуальность данных.','Результат не присваивается до сверки');
  if(stage?.attendedDay&&stage.status==='pending')return set('data','Сверить явку и отмену','Есть факт явки, но действующая запись отменена. Требуется сверка.',`Явка: ${stage.attendedDay} октября`);
  if(!stage)return set('complete','Этапы выполнены','Все этапы имеют факт оказания. Оплаты проверяются отдельно.',`Оказано ${money(planDone(p))} · оплачено ${money(planPaid(p))}`);
  if(p.choice==='declined'||!w.contactAllowed)return set('excluded',p.choice==='declined'?'Зафиксирован отказ':'Контакт ограничен','Повторное поручение на контакт не предлагается.',w.note||p.pauseReason||'Ограничение контакта в модели');
  if(w.pauseKind==='medical')return set(w.nextAt>WF_NOW?'waiting':'data','Медицинская пауза',w.nextAt>WF_NOW?'До срока контакт по продолжению лечения не предлагается.':'Срок пересмотра наступил. Сначала требуется подтверждение специалиста.',w.note||'Допустимость следующего этапа определяет врач');
  if(stage.status==='scheduled'&&stage.appointment)return set('scheduled','Следующий этап записан','Действующая запись связана с нужным этапом.',`${stage.id} · ${stage.appointment.day} октября, ${9+stage.appointment.col}:00${stage.attendedDay?' · явка ' + stage.attendedDay + ' октября':''}`);
  if(w.nextAt>WF_NOW)return set('waiting',p.choice==='paused'?'Согласована пауза':'Следующий контакт согласован','До договорённого срока повторное поручение не нужно.',workflowDate(w.nextAt));
  if(p.choice==='paused'&&!w.nextAt)return set('data','Уточнить срок паузы','У паузы нет даты пересмотра. Сначала нужно проверить договорённость.',w.note||p.pauseReason||'Нет подтверждённого срока');
  if(p.choice==='considering')Object.assign(result,{title:'Уточнить решение пациента',reason:'Утверждение врачом не подтверждает решение пациента.'});
  if(w.nextAt&&w.nextAt<WF_NOW)result.reason+=' Согласованный срок наступил.';
  return result;
}
function workflowRows(){return data().plans.map(workflowCase);}
function workflowTaskSync(){
  for(const t of data().managerTasks.filter(t=>t.workflow)){
    const p=data().plans.find(p=>p.id===t.target);
    if(!p||p.version!==t.workflow.planVersion){t.state='done';t.workflow.outcome='Прежняя версия плана';continue;}
    const c=workflowCase(p);
    if(['scheduled','waiting','excluded','complete'].includes(c.group)){
      t.state='done';t.workflow.outcome=c.title;t.workflow.proof=c.proof;
    }else if(c.group==='action'&&t.state==='done'){
      t.state='new';t.workflow.outcome=null;t.workflow.proof=null;
    }
    if(c.group==='data'){t.state='new';t.workflow.outcome=null;t.workflow.proof='Нужна сверка данных';}
    t.admin=p.coordinator;t.due=workflowDate(t.workflow.dueAt||'2026-10-27T17:00');t.workflow.blocked=c.group==='data';
  }
}
function createWorkflowTask(id,expected){
  const p=data().plans.find(p=>p.id===id);
  if(!p||role==='admin')return null;
  const c=workflowCase(p);
  if((expected&&expected!==workflowFingerprint(p))||!c.actionable){toast('Ситуация изменилась. Проверьте актуальную карточку.');return null;}
  let t=data().managerTasks.find(t=>t.kind==='plan'&&t.target===id&&t.state!=='done');
  if(!t){t={id:'M-'+(103+data().managerTasks.length),kind:'plan',target:id,title:c.title+' по '+id,admin:p.coordinator,state:'new',due:workflowDate(p.workflow.nextAt),note:''};data().managerTasks.push(t);}
  t.title=c.title+' по '+id;t.workflow={planVersion:p.version,dueAt:'2026-10-27T17:00',outcome:null,proof:null,blocked:false};t.due=workflowDate(t.workflow.dueAt);
  logEvent(`${t.id}: следующий шаг по ${id}, ответственный ${p.coordinator}`,'tasks');render();toast('Поручение: '+t.id);return t;
}
function openWorkflowTaskPrompt(id){
  const p=data().plans.find(p=>p.id===id);if(!p||!workflowCase(p).actionable)return;
  const fingerprint=workflowFingerprint(p);
  showModal('Поручение координатору',`<p>${esc(id)} · ${esc(workflowCase(p).title)}</p><p>Ответственный: ${esc(p.coordinator)}. Срок поручения: 27 октября, 17:00 МСК.</p><p>Перед созданием повторно проверим состояние плана. Сообщения пациенту не отправляются.</p>`,`<button class="btn" onclick="closeModal()">Назад</button><button id="workflowConfirm" class="btn primary">Создать поручение</button>`);
  document.getElementById('workflowConfirm').onclick=()=>{const t=createWorkflowTask(id,fingerprint);closeModal();if(t)openManagerTask(t.id);};
}
function workflowCard(c){
  const t=data().managerTasks.find(t=>t.kind==='plan'&&t.target===c.p.id&&t.state!=='done');
  return `<article class="workflow-card"><div class="workflow-card-head"><div><span class="eyebrow">${esc(c.p.id)} · ${esc(c.p.patient)}</span><h3>${esc(c.title)}</h3></div><span class="badge ${c.group==='action'?'orange':c.group==='scheduled'?'green':'neutral'}">${WF_LABELS[c.group]}</span></div><p>${esc(c.reason)}</p><dl class="workflow-facts"><div><dt>Основание</dt><dd>${esc(c.stage?.name||'Все этапы')} · версия ${c.p.version}</dd></div><div><dt>Координатор и следующий контакт</dt><dd>${esc(c.p.coordinator)} · ${esc(workflowDate(c.p.workflow.nextAt))}</dd></div><div><dt>Подтверждение</dt><dd>${esc(c.proof)}</dd></div></dl><div class="workflow-card-foot"><button class="btn sm primary" onclick="openWorkflowCase('${c.p.id}')">Разобрать случай ${ic('arrow')}</button>${t?`<button class="btn sm" onclick="openManagerTask('${t.id}')">${t.id} · до 17:00</button>`:''}<small>Источник: модель плана · ${esc(workflowDate(c.p.workflow.checkedAt))}</small></div></article>`;
}
plansPage = function(){
  const all=workflowRows(),rows=workflowFilter==='all'?all:all.filter(c=>c.group===workflowFilter);
  return heading('Следующий шаг по плану','Очередь координатора · 27 октября 2026, 15:00 МСК · вымышленные данные',`<button class="btn" onclick="exportWorkflow()">${ic('down')}Сводка по случаям</button>`)+
    `<section class="workflow-intro"><div><div class="eyebrow">Первый рабочий сценарий / v0.4</div><h2>Каждый случай имеет причину и проверяемый исход</h2><p>Разберите договорённость, назначьте ответственного и подтвердите следующий шаг. Пауза, отказ и запись учитываются раздельно.</p></div><span class="workflow-number">${all.filter(c=>c.actionable).length}<small>к действию сейчас</small></span></section><div class="workflow-tabs" role="group" aria-label="Состояние случаев">${[...Object.entries(WF_LABELS),['all','Все планы']].map(([id,label])=>`<button class="${workflowFilter===id?'active':''}" aria-pressed="${workflowFilter===id}" onclick="workflowFilter='${id}';render()">${label}<span>${id==='all'?all.length:all.filter(c=>c.group===id).length}</span></button>`).join('')}</div><div class="workflow-list">${rows.map(workflowCard).join('')||'<section class="panel panel-pad empty">В этой группе случаев нет. Выберите другую группу.</section>'}</div><p class="method">Закрытое поручение, запись, оказанная услуга и платёж - отдельные события. Случаи и подтверждения смоделированы внутри HTML.</p>`;
};
function openWorkflowCase(id){
  const p=data().plans.find(p=>p.id===id);if(!p||role==='admin')return;
  const c=workflowCase(p),w=p.workflow,fingerprint=workflowFingerprint(p);
  showSuiteDrawer('workflow',id,`Координатор / ${id}`,`<span class="badge">${WF_LABELS[c.group]}</span><h2 id="drawerTitle">${esc(c.title)}</h2><p>${esc(c.reason)}</p><div class="formula-box"><strong>Основание</strong><br>${esc(c.stage?.name||'Все этапы')} · версия ${p.version}<br>${esc(c.proof)}<br>Источник: модель плана, проверено ${esc(workflowDate(w.checkedAt))}</div><div class="workflow-form"><div class="field"><label for="wfOwner">Ответственный</label><select id="wfOwner">${ADMINS.map(n=>`<option ${n===p.coordinator?'selected':''}>${n}</option>`).join('')}</select></div><div class="field"><label for="wfChoice">Решение пациента</label><select id="wfChoice" ${p.choice==='completed'?'disabled':''}>${Object.entries(CHOICE).filter(([k])=>k!=='completed'||p.choice==='completed').map(([k,v])=>`<option value="${k}" ${k===p.choice?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label for="wfPause">Причина ожидания</label><select id="wfPause">${[['none','Нет паузы'],['patient','Договорённость с пациентом'],['medical','Пауза по решению врача']].map(([k,v])=>`<option value="${k}" ${k===w.pauseKind?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label for="wfDate">Следующий контакт / пересмотр, МСК</label><input id="wfDate" type="datetime-local" value="${esc(w.nextAt)}"></div></div><label class="workflow-check"><input id="wfContact" type="checkbox" ${w.contactAllowed?'checked':''}>Контакт допустим по текущей договорённости</label><label class="workflow-check"><input id="wfLinked" type="checkbox" ${w.sourceLinked?'checked':''}>Связь этапа с источником проверена в демо</label>${w.pauseKind==='medical'?'<label class="workflow-check"><input id="wfMedicalRelease" type="checkbox">Есть подтверждение врача о завершении медицинской паузы (демо)</label>':''}<div class="field"><label for="wfNote">Основание решения / результат контакта</label><textarea id="wfNote" maxlength="500" placeholder="Что согласовано, причина паузы или отказа">${esc(w.note)}</textarea></div><p class="method">Утверждение врачом, решение пациента и медицинское согласие различаются. Медицинская пауза снимается только по подтверждению специалиста.</p><div class="actions"><button id="wfSave" class="btn primary">Сохранить договорённость</button>${c.actionable?`<button class="btn" onclick="openWorkflowTaskPrompt('${id}')">Назначить поручение</button>`:''}<button class="btn" onclick="openPlan('${id}')">Этапы и расчёты</button></div><div class="drawer-section"><h3>Проверяемые события</h3><div class="status-line"><span>Действующая запись этапа</span><strong>${c.stage?.status==='scheduled'?'Есть':'Нет'}</strong></div><div class="status-line"><span>Явка на следующий этап</span><strong>${c.stage?.attendedDay?esc(c.stage.attendedDay)+' октября':'Не подтверждена'}</strong></div>${c.stage?.status==='scheduled'&&c.stage.appointment?.day<=27&&!c.stage.attendedDay?`<button class="btn sm" onclick="markWorkflowAttendance('${id}','${c.stage.id}')">Подтвердить явку в демо</button>`:''}<div class="status-line"><span>Оказано услуг по плану</span><strong>${money(planDone(p))}</strong></div><div class="status-line"><span>Получено оплат по плану</span><strong>${money(planPaid(p))}</strong></div><p class="method">Суммы вымышленные. Запись и договорённость не добавляют выручку.</p></div><div class="drawer-section"><h3>История договорённостей</h3>${w.history.slice(-6).reverse().map(h=>`<p>${esc(h)}</p>`).join('')||'<p>Изменений договорённости ещё нет.</p>'}</div>`);
  document.getElementById('wfSave').onclick=()=>saveWorkflowCase(id,fingerprint);
}
function saveWorkflowCase(id,expected){
  const p=data().plans.find(p=>p.id===id);if(!p||role==='admin')return;
  if(expected!==workflowFingerprint(p)){toast('План изменился. Откройте актуальный случай.');openWorkflowCase(id);return;}
  const val=id=>document.getElementById(id).value,choice=p.choice==='completed'?'completed':val('wfChoice'),pause=val('wfPause'),date=val('wfDate'),note=val('wfNote').trim();
  if(!CHOICE[choice]||!['none','patient','medical'].includes(pause)||date&&!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(date))return;
  if((choice==='paused'||choice==='declined'||pause!=='none'||!document.getElementById('wfContact').checked)&&!note){toast('Укажите основание паузы, отказа или ограничения.');return;}
  if(p.workflow.pauseKind==='medical'&&pause!=='medical'&&(!document.getElementById('wfMedicalRelease').checked||!note)){toast('Нужны подтверждение врача и основание завершения паузы.');return;}
  if((choice==='paused'||pause!=='none')&&!date){toast('Укажите срок пересмотра.');return;}
  p.choice=choice;p.discussed=choice!=='considering';p.coordinator=val('wfOwner');p.pauseReason=note;
  Object.assign(p.workflow,{pauseKind:pause,nextAt:date,note,contactAllowed:document.getElementById('wfContact').checked,sourceLinked:document.getElementById('wfLinked').checked,checkedAt:WF_NOW,revision:p.workflow.revision+1});
  p.nextContact=workflowDate(date);p.workflow.history.push(`27 окт, 15:00 · ${CHOICE[choice]} · ${note||'Договорённость обновлена'} · ${p.coordinator}`);
  p.log.push('27 окт · Уточнена договорённость и организационный следующий шаг');logEvent(id+': сохранена договорённость; факты услуг и оплат не изменены','note');render();openWorkflowCase(id);toast('Договорённость сохранена');
}

function markWorkflowAttendance(pid,sid){
  const p=data().plans.find(p=>p.id===pid),s=p?.stages.find(s=>s.id===sid);
  if(!s||s.status!=='scheduled'||!s.appointment||s.appointment.day>27||s.attendedDay)return;
  s.attendedDay=27;p.log.push('27 окт · Подтверждена явка. Оказание и оплата учитываются отдельно.');logEvent(pid+': явка подтверждена без начисления услуги и оплаты','check');render();openWorkflowCase(pid);
}

const workflowRenderBase=render;
render=function(){ensureWorkflow(data());workflowTaskSync();workflowRenderBase();};
const workflowOverviewBase=overview;
overview=function(){const html=workflowOverviewBase();if(role==='admin')return html;const n=workflowRows().filter(c=>c.actionable).length;return html.replace('<section class="metrics',`<section class="workflow-overview panel"><div><div class="eyebrow">Первый сценарий / v0.4</div><h2>Следующий шаг по планам</h2><p>${n} случаев к действию сейчас. Паузы, ограничения и записи вынесены в отдельные группы.</p></div><button class="btn primary" onclick="navigate('plans')">Открыть очередь ${ic('arrow')}</button></section><section class="metrics`);};
const workflowOpenPlanBase=openPlan;
openPlan=function(id){workflowOpenPlanBase(id);const root=document.getElementById('overlayRoot');root.innerHTML=root.innerHTML.replace('<div class="drawer-section"><h3>Решение пациента',`<button class="btn primary space-top" onclick="openWorkflowCase('${id}')">Договорённость и следующий шаг</button><div class="drawer-section"><h3>Решение пациента`);};
savePlanDecision=function(id){
  const p=data().plans.find(p=>p.id===id);if(!p)return;
  const choice=p.stages.every(s=>s.status==='done')?'completed':document.getElementById('planChoice').value,reason=document.getElementById('pauseReason').value.trim();
  if(!CHOICE[choice])return;
  if(['paused','declined'].includes(choice)&&!reason){toast('Укажите причину паузы или отказа.');return;}
  p.choice=choice;p.pauseReason=reason;p.coordinator=document.getElementById('planOwner').value;p.discussed=choice!=='considering';
  p.workflow.revision++;p.workflow.note=reason;if(p.workflow.pauseKind!=='medical')p.workflow.pauseKind=choice==='paused'?'patient':'none';if(choice==='declined')p.workflow.contactAllowed=false;
  p.log.push('27 окт · Решение: '+CHOICE[choice]+(reason?' · '+reason:''));logEvent(id+': решение пациента обновлено. Исход поручения проверяется отдельно.','note');render();openPlan(id);toast('Решение сохранено');
};
const workflowCreateManagerBase=createManagerTask;
createManagerTask=function(kind,target,title,admin){return kind==='plan'?createWorkflowTask(target):workflowCreateManagerBase(kind,target,title,admin);};
const workflowSaveTaskBase=saveManagerTask;
saveManagerTask=function(id){const t=data().managerTasks.find(t=>t.id===id),p=t?.workflow&&data().plans.find(p=>p.id===t.target);if(p&&document.getElementById('managerState').value==='done'&&['action','data'].includes(workflowCase(p).group)){toast('Сначала подтвердите исход в карточке случая.');return;}if(p)p.coordinator=document.getElementById('managerOwner').value;workflowSaveTaskBase(id);};
const workflowOpenManagerBase=openManagerTask;
openManagerTask=function(id){workflowOpenManagerBase(id);const t=data().managerTasks.find(t=>t.id===id);if(!t?.workflow)return;const root=document.getElementById('modalRoot');root.innerHTML=root.innerHTML.replace('<div class="field space-top">',`<div class="formula-box space-top"><strong>${esc(t.workflow.outcome||'Исход ещё не подтверждён')}</strong><br>${esc(t.workflow.proof||'Проверьте договорённость и фактическое событие в карточке случая.')}<br><button class="btn sm" onclick="closeModal();openWorkflowCase('${t.target}')">Открыть связанный случай</button></div><div class="field space-top">`);};
const workflowPlanCountsBase=planCounts;
planCounts=function(){const counts=workflowPlanCountsBase();counts.active=data().plans.filter(p=>!['completed','paused','declined'].includes(p.choice)).length;return counts;};
const workflowActionCurrentBase=assistantActionCurrent;
assistantActionCurrent=function(a){if(a.kind==='plan'){const p=data().plans.find(p=>p.id===a.target);if(!p||!workflowCase(p).actionable||a.workflowFingerprint&&a.workflowFingerprint!==workflowFingerprint(p))return false;}return workflowActionCurrentBase(a);};
const workflowPrioritiesBase=assistantPriorities;
assistantPriorities=function(){const others=workflowPrioritiesBase().filter(s=>s.task?.kind!=='plan');if(role==='admin')return others;const c=workflowRows().find(c=>c.actionable);if(c)others.splice(role==='owner'?1:0,0,{title:c.title+' по '+c.p.id,why:c.reason,owner:c.p.coordinator,due:'27 октября, до 17:00 МСК',action:{type:'plan',id:c.p.id,label:'Открыть случай'},task:{kind:'plan',target:c.p.id,title:c.title+' по '+c.p.id,admin:c.p.coordinator,condition:'open-plan',workflowFingerprint:workflowFingerprint(c.p)}});return others.slice(0,3);};
const workflowAnswerBase=assistantAnswer;
assistantAnswer=function(q,context){
  const answer=workflowAnswerBase(q,context);
  for(const s of answer.steps||[]){if(s.task?.kind!=='plan')continue;const p=data().plans.find(p=>p.id===s.task.target);if(p)s.task.workflowFingerprint=workflowFingerprint(p);}
  answer.steps=(answer.steps||[]).filter(s=>!s.task||s.task.kind!=='plan'||assistantActionCurrent(s.task));
  for(const a of answer.actions||[]){
    if(a.type!=='create-task'||a.kind!=='plan')continue;
    const p=data().plans.find(p=>p.id===a.target);if(!p)continue;
    const c=workflowCase(p);
    if(!c.actionable){answer.title=c.title;answer.paragraphs=[c.reason,c.proof];answer.actions=[{type:'plan',id:p.id,label:'Проверить договорённость'}];break;}
    a.workflowFingerprint=workflowFingerprint(p);answer.paragraphs=[a.title+'. Ответственный: '+p.coordinator+'. Срок поручения: 27 октября, 17:00 МСК.','Подтвердите создание поручения. Перед действием проверяется актуальность.'];
  }
  return answer;
};
const workflowScheduleBase=schedulePlanStage,workflowConfirmSlotBase=confirmPlanSlot,workflowCompleteBase=completePlanStage;
function workflowCanSchedule(p){return p&&p.doctorApproved&&p.workflow.sourceLinked&&p.workflow.pauseKind!=='medical'&&p.workflow.contactAllowed&&p.choice==='agreed';}
function workflowStageCurrent(p,sid){return workflowCanSchedule(p)&&p.stages.find(s=>s.status!=='done')?.id===sid;}
schedulePlanStage=function(pid,sid){const p=data().plans.find(p=>p.id===pid);if(!workflowStageCurrent(p,sid)){toast('Сначала проверьте договорённость, паузу и источник.');return;}workflowScheduleBase(pid,sid);};
confirmPlanSlot=function(pid,sid){const p=data().plans.find(p=>p.id===pid);if(!workflowStageCurrent(p,sid)){toast('Условия записи изменились. Проверьте случай.');return;}workflowConfirmSlotBase(pid,sid);};
completePlanStage=function(pid,sid){const p=data().plans.find(p=>p.id===pid);if(!workflowCanSchedule(p)){toast('Сначала проверьте допустимость этапа и источник.');return;}workflowCompleteBase(pid,sid);};

const workflowPilotBase=pilotPage;
pilotPage=function(){return heading('NNOV Клиника: логика первого релиза','Управленческий помощник для собственника, управляющего и координатора.')+`<section class="panel panel-pad"><div class="eyebrow">Уточнение после разбора конкурентов</div><h2>Рабочая гипотеза: удобное сопровождение следующего шага</h2><p>МИС и аналитические сервисы уже предлагают планы, отчёты и задачи. В NNOV проверяем ежедневную работу координатора, корректность исключений, время команды и подтверждение исхода на данных конкретной клиники.</p><div class="actions"><button class="btn primary" onclick="navigate('plans')">Показать первый сценарий</button><button class="btn" onclick="showWorkflowPositioning()">Основания и статус</button></div></section><div class="workflow-scope"><section class="panel panel-pad"><h2>Реализовано в v0.4</h2><ul><li>Очередь случаев с объяснением</li><li>Пауза, отказ и следующий контакт</li><li>Ответственный и поручение</li><li>Проверка актуальности и защита от дублей</li><li>Отмена записи возвращает случай к проверке</li></ul></section><section class="panel panel-pad"><h2>Предстоит проверить</h2><ul><li>Возможности текущих DentalPRO и Statum</li><li>Источник и условия подключения</li><li>Нагрузка сотрудников и качество отбора</li><li>Полная стоимость и готовность оплачивать</li></ul></section></div><p class="method">Это обновление прототипа до практической проверки. Подтверждённого преимущества, реальных подключений и результата пилота пока нет.</p><details class="workflow-details"><summary>Все возможности демонстрационного продукта</summary>${workflowPilotBase()}</details>`;};
function showWorkflowPositioning(){showModal('Основания для обновления',`<p>DentalPRO описывает планы, незаписанные приёмы, будущие записи и тикеты. Dental Intelligence документирует ежедневную работу и разные механизмы задач. Сводка, чат и поручения сами по себе не устанавливают уникальность.</p><p>В v0.4 проверяем гипотезу удобства одного процесса. Для рабочего продукта нужны сверка данных, реальное подключение, серверное хранение и права.</p><p><a href="https://dental-pro.online/support/plany-lecheniya-patsientov/" target="_blank" rel="noopener noreferrer">DentalPRO: планы лечения</a><br><a href="https://educate.dentalintel.com/en/articles/10770834-team-tasks" target="_blank" rel="noopener noreferrer">Dental Intelligence: Team Tasks</a><br><a href="https://statum.pro/" target="_blank" rel="noopener noreferrer">Statum</a></p>`,`<button class="btn primary" onclick="closeModal()">Понятно</button>`);}
function exportWorkflow(){downloadText('NNOV_Clinic_workflow_v0_4.json',JSON.stringify({version:'0.4.0',notice:'Вымышленные данные. Практическая проверка не проведена.',demoTime:WF_NOW,clinic,rows:workflowRows().map(c=>({plan:c.p.id,version:c.p.version,stage:c.stage?.id||null,group:c.group,reason:c.reason,owner:c.p.coordinator,nextAt:c.p.workflow.nextAt,proof:c.proof})),tasks:data().managerTasks.filter(t=>t.workflow)},null,2),'application/json;charset=utf-8');}
render();
