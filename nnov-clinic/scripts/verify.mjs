import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync('dist/index.html','utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function runtime(storage=new Map()){
 const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',style:{},focus(){},setCustomValidity(){},reportValidity(){},click(){}});return elements.get(id);};
 const ctx=vm.createContext({document:{getElementById:el,body:{style:{}},activeElement:null,querySelector(){return null;},addEventListener(){},createElement(){return {click(){}};}},window:{scrollTo(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setTimeout(){return 0;},clearTimeout(){},Blob,URL,console});
 vm.runInContext(js,ctx);return {ctx,run:code=>vm.runInContext(code,ctx),el,storage};
}
const r=runtime();const {run,el}=r;
assert.equal(run('NAV.length'),16);
assert.equal(run('DB.implant.plans.length+DB.endo.plans.length'),32);
for(const key of ['implant','endo']){
 run(`clinic='${key}';render()`);
 assert.equal(run('new Set(allLedger().map(x=>x.id)).size'),run('allLedger().length'));
 assert.equal(run('financials().revenue'),run('sum(data().monthLedger,x=>x.amount)+sum(data().plans,planDone)'));
 assert.equal(run('allLedger().every(x=>x.paid<=x.amount&&x.paid>=0)'),true);
 assert.equal(run('availablePlanSlots().every(a=>!data().plans.some(p=>p.stages.some(s=>s.appointment?.day===a.day&&s.appointment.room===a.room&&s.appointment.col===a.col)))'),true);
 for(const currentRole of ['owner','admin','coordinator']){run(`role='${currentRole}'`);for(const currentView of JSON.parse(run('JSON.stringify(ROLES[role].views)'))){run(`view='${currentView}';filter='all';render()`);assert.ok(el('main').innerHTML.length>100,currentView);assert.ok(!el('main').innerHTML.includes('NaN'),currentView);}}run("role='owner'");
}
run("clinic='implant';view='plans';render()");
const initial=JSON.parse(run('JSON.stringify({f:financials(),u:utilization()})'));
el('planChoice').value='agreed';el('pauseReason').value='Подтверждено время';el('planOwner').value='Мария';
run("savePlanDecision('P-101');togglePlanConsent('P-101',true);schedulePlanStage('P-101','S2')");
el('planSlot').value='0';run("confirmPlanSlot('P-101','S2')");
assert.equal(run("data().plans[0].stages[1].appointment.day"),27);
assert.equal(run('utilization().occupied'),initial.u.occupied+1);
assert.equal(run('financials().revenue'),initial.f.revenue,'booking is not revenue');
run("completePlanStage('P-101','S2')");
assert.equal(run('financials().revenue'),initial.f.revenue+90000);
assert.equal(run('financials().paid'),initial.f.paid,'service is not payment');
run("completePlanStage('P-101','S2')");assert.equal(run('financials().revenue'),initial.f.revenue+90000,'duplicate completion blocked');
el('stagePayment').value='500';run("confirmStagePayment('P-101','S2')");
assert.equal(run('financials().paid'),initial.f.paid+500);
el('stagePayment').value='1000000';run("confirmStagePayment('P-101','S2')");assert.equal(run('financials().paid'),initial.f.paid+500,'overpayment blocked');
assert.equal(run('financials().complete'),false);
el('materialValue').value='6000';el('costBasis').value='Демо-расчёт';run("confirmMaterialCost('prosthetics')");
assert.equal(run('financials().complete'),true);assert.equal(run('financials().coverage'),100);
const otherRevenue=run('DB.endo.monthLedger.reduce((s,x)=>s+x.amount,0)');
run("persist()");const restored=runtime(r.storage);
assert.equal(restored.run('data().plans[0].stages[1].paid'),500,'progress restored');
assert.equal(restored.run('financials().complete'),true);
assert.equal(restored.run('DB.endo.monthLedger.reduce((s,x)=>s+x.amount,0)'),otherRevenue,'clinic state isolated');
run("toggleCare('R-301','ack',true)");assert.equal(run('data().care[0].ack'),false,'ack cannot precede delivery');
run("toggleCare('R-301','sent',true);toggleCare('R-301','ack',true);finishCare('R-301')");assert.equal(run('data().care[0].closed'),true);
run("role='admin';view='economics';render()");assert.equal(run('view'),'overview');assert.ok(!el('navigation').innerHTML.includes('data-view="economics"'));
run("role='owner';view='training';selectedStaff='Анна';render()");const moneyBefore=run('financials().paid');
run("startLesson('alternatives');answerQuiz(1);nextQuiz();answerQuiz(2);nextQuiz()");
assert.equal(run("data().lessons['Анна'].alternatives.passed"),true);
assert.equal(run('financials().paid'),moneyBefore,'learning does not invent financial results');
assert.equal(/<(?:script|img|iframe|link)\b[^>]*(?:src|href)=["']https?:|url\(\s*["']?https?:/i.test(html),false,'offline HTML has no external assets; source citations are ordinary links');
// The assistant must remain grounded as the demo changes.
const a=runtime();const ar=a.run;
assert.match(ar("JSON.stringify(assistantAnswer('Почему нельзя посчитать прибыль?'))"),/не хватает расходов/);
assert.equal(ar("assistantAnswer('Что сделать первым сегодня?').steps[0].action.id"),'D-104');
assert.match(ar("assistantAnswer('Какой препарат назначить?').title"),/специалисту/);
assert.match(ar("assistantAnswer('Какая погода в Казани?').title"),/Уточните/);
assert.match(ar("assistantAnswer('Поставь задачу по P-999').title"),/нет/);
ar("askAssistant('Кому поставить задачу?');var proposal=assistantThread().messages.at(-1).actions[0]");
assert.equal(ar("find('D-104').task"),false,'a chat proposal is not a task mutation');
ar('executeAssistantAction(proposal)');
assert.equal(ar("find('D-104').task"),true);
assert.equal(ar("find('D-104').state"),'contact');
const taskCount=ar('data().managerTasks.length');
ar('executeAssistantAction(proposal)');
assert.equal(ar('data().managerTasks.length'),taskCount,'repeat action reuses task');
ar("askAssistant('Поставь задачу по P-101')");
assert.equal(ar("assistantThread().messages.at(-1).actions[0].type"),'manager-task','existing plan task is reused');
const signatures=ar('assistantThread().messages.length');
ar("view='schedule';render();view='assistant';render()");
assert.equal(ar('assistantThread().messages.length'),signatures,'navigation/chat history do not trigger update loops');
a.el('materialValue').value='6000';a.el('costBasis').value='Демо-расчёт';ar("confirmMaterialCost('prosthetics')");
assert.equal(ar('assistantThread().messages.at(-1).kind'),'update');
assert.match(ar('assistantThread().messages.at(-1).paragraphs.join()'),/Прямые расходы заполнены/);
assert.match(ar("assistantAnswer('Почему нельзя посчитать прибыль?').title"),/рассчитана/);
assert.match(ar("assistantMessageMarkup(assistantThread().messages[0],'page')"),/После этого ответа данные изменились/);
ar('data().scenario.price=7;data().scenario.visits=5;render()');
assert.equal(ar('assistantThread().messages.at(-1).kind'),'update','consecutive state changes coalesce');
assert.equal(ar("assistantAnswer('Сценарий экономики').facts[2].value"),ar('money(scenarioValues().result)'));
const ownerHistory=ar('assistantThread().messages.length');
ar("role='admin';render()");
assert.equal(ar('assistantThread().messages.length'),1,'role has a separate thread');
assert.match(ar("assistantAnswer('Прибыль').title"),/руководителя/);
ar("clinic='endo';render()");
assert.equal(ar('assistantThread().messages.length'),1,'clinic has a separate thread');
ar("clinic='implant';role='owner';render();persist()");
assert.equal(ar('assistantThread().messages.length'),ownerHistory);
assert.equal(runtime(a.storage).run('assistantThread().messages.length'),ownerHistory,'chat survives reload');
assert.equal(ar("assistantMessageMarkup({from:'user',text:'<img src=x onerror=alert(1)>',time:'12:00'},'page').includes('<img')"),false,'user HTML is escaped');
const stale=runtime();stale.run("var p=assistantAnswer('Кому поставить задачу?').actions[0];find('D-104').state='booked';executeAssistantAction(p)");
assert.equal(stale.run("find('D-104').task"),false,'stale proposal cannot create a task after booking');
const oldState=JSON.parse(a.storage.get('nnov-clinic-suite-v2'));
delete oldState.db.implant.assistant;delete oldState.db.endo.assistant;
const migration=runtime(new Map([['nnov-clinic-suite-v2',JSON.stringify(oldState)]]));
assert.equal(migration.run('financials().complete'),true,'existing schema-2 business progress is retained');
assert.equal(migration.run('assistantThread().messages.length'),1,'assistant is added to old state');
console.log('Verified: 70 page renders across all three workspaces and both clinics; two isolated clinic models; coherent ledger; booking/service/payment separation; duplicate and overpayment guards; cost coverage; browser-local restore; care prerequisites; role UI; training without invented revenue; offline assets.');
console.log('Assistant verified: live-data answers; missing-cost guard; explicit and idempotent task creation; stale-action protection; state-change updates; no navigation loops; history isolation and restore; schema-2 migration; escaped user text; shared scenario arithmetic.');

// Twelve scenario outcomes for the v0.4 coordinator flow, independent of vendor claims.
function workflowFixture(){
 const x=runtime();x.run("clinic='implant';role='coordinator';var wp=data().plans[0];wp.choice='agreed';Object.assign(wp.workflow,{contactAllowed:true,pauseKind:'none',nextAt:'',sourceLinked:true});wp.stages[1].status='pending';wp.stages[1].appointment=null;");return x;
}
const w1=workflowFixture();assert.equal(w1.run('workflowCase(wp).group'),'action','T01: unscheduled stage needs action');
const w2=workflowFixture();w2.run("wp.stages[1].status='scheduled';wp.stages[1].appointment={day:28,room:0,col:4}");assert.equal(w2.run('workflowCase(wp).group'),'scheduled','T02: matching booking removes contact request');
const w3=workflowFixture();w3.run("wp.workflow.pauseKind='medical';wp.workflow.nextAt='2026-10-29T12:00'");assert.equal(w3.run('workflowCase(wp).actionable'),false,'T03: medical pause suppresses contact');w3.run("schedulePlanStage('P-101','S2');completePlanStage('P-101','S2')");assert.equal(w3.run('wp.stages[1].status'),'pending');
const w4=workflowFixture();w4.run("wp.choice='declined';wp.workflow.contactAllowed=false");assert.equal(w4.run('workflowCase(wp).group'),'excluded','T04: refusal suppresses contact');assert.equal(w4.run("assistantAnswer('Поставь задачу по P-101').actions.some(a=>a.type==='create-task')"),false);
const w5=workflowFixture();w5.run("wp.choice='considering';wp.doctorApproved=true");assert.match(w5.run('workflowCase(wp).title'),/решение пациента/,'T05: doctor approval does not imply patient agreement');
const w6=workflowFixture();w6.run("wp.workflow.nextAt='2026-10-28T12:00'");assert.equal(w6.run('workflowCase(wp).group'),'waiting','T06: future agreed contact waits');w6.run("wp.workflow.nextAt='2026-10-26T12:00'");assert.equal(w6.run('workflowCase(wp).group'),'action');
const w7=workflowFixture();w7.run("var wt=createWorkflowTask('P-101');");w7.el('planSlot').value='0';w7.run("confirmPlanSlot('P-101','S2')");assert.equal(w7.run('wt.state'),'done','T07: booking confirms organizational outcome');w7.run("cancelPlanStage('P-101','S2')");assert.equal(w7.run('wt.state'),'new','T07: cancellation reopens the same case');assert.equal(w7.run("data().managerTasks.filter(t=>t.kind==='plan'&&t.target==='P-101'&&t.state!=='done').length"),1);
const w8=workflowFixture();w8.run("var oldFingerprint=workflowFingerprint(wp);var wt=createWorkflowTask('P-101');wp.version++;render()");assert.equal(w8.run('wt.workflow.outcome'),'Прежняя версия плана','T08: old-version task is retired');assert.equal(w8.run("createWorkflowTask('P-101',oldFingerprint)"),null);
const w9=workflowFixture();w9.run("var wt=createWorkflowTask('P-101');var total=data().managerTasks.length;createWorkflowTask('P-101');persist()");assert.equal(w9.run('data().managerTasks.length'),w9.run('total'),'T09: repeated creation reuses task');assert.equal(runtime(w9.storage).run("data().plans[0].workflow.schema"),1,'workflow survives reload');
const w10=workflowFixture();const preRevenue=w10.run('financials().revenue'),prePaid=w10.run('financials().paid');w10.el('planSlot').value='0';w10.run("confirmPlanSlot('P-101','S2')");assert.equal(w10.run('financials().revenue'),preRevenue,'T10: booking does not invent service revenue');assert.equal(w10.run('financials().paid'),prePaid,'T10: booking does not invent payment');w10.run("markWorkflowAttendance('P-101','S2')");assert.equal(w10.run('wp.stages[1].attendedDay'),27);assert.equal(w10.run('financials().revenue'),preRevenue,'T10: attendance does not invent service revenue');assert.equal(w10.run('financials().paid'),prePaid,'T10: attendance does not invent payment');
const w11=workflowFixture();w11.run("var staleFingerprint=workflowFingerprint(wp);wp.workflow.contactAllowed=false");assert.equal(w11.run("createWorkflowTask('P-101',staleFingerprint)"),null,'T11: changed source invalidates proposal');
const w12=workflowFixture();w12.run("wp.workflow.sourceLinked=false");assert.equal(w12.run('workflowCase(wp).group'),'data','T12: unresolved source is not an actionable patient request');assert.equal(w12.run("createWorkflowTask('P-101')"),null);w12.run("wp.workflow.sourceLinked=true;wp.stages[1].id=''");assert.equal(w12.run('workflowCase(wp).group'),'data','T12: missing stage ID blocks outcome');
const oldWorkflow=JSON.parse(w9.storage.get('nnov-clinic-suite-v2'));delete oldWorkflow.db.implant.plans[0].workflow;const migratedWorkflow=runtime(new Map([['nnov-clinic-suite-v2',JSON.stringify(oldWorkflow)]]));assert.equal(migratedWorkflow.run('data().plans[0].choice'),'agreed','v0.3 decisions survive additive migration');
w1.run("wp.workflow.note='<img src=x onerror=alert(1)>';openWorkflowCase('P-101')");assert.ok(!w1.el('overlayRoot').innerHTML.includes('<img'),'workflow note is escaped');
console.log('Workflow verified: T01-T12 over fictional events; source/decision separation; pauses/refusal; booking and cancellation; version/stale guards; idempotency; financial invariants; additive restore and escaped notes. This does not verify DentalPRO or Statum.');

// The dashboard must select the same eligible cases as the coordinator queue.
for(const key of ['implant','endo']){
 for(const currentRole of ['owner','coordinator']){
  for(const condition of ['action','restricted','refused','medical','future','scheduled','source','complete']){
   const d=runtime();
   d.run(`clinic='${key}';role='${currentRole}';for(const p of data().plans)p.workflow.contactAllowed=false;var p=data().plans[0];p.choice='considering';Object.assign(p.workflow,{contactAllowed:true,pauseKind:'none',nextAt:'',sourceLinked:true});`);
   const changes={action:'',restricted:'p.workflow.contactAllowed=false',refused:"p.choice='declined'",medical:"p.workflow.pauseKind='medical';p.workflow.nextAt='2026-10-29T12:00'",future:"p.workflow.nextAt='2026-10-28T12:00'",scheduled:"p.stages[1].status='scheduled';p.stages[1].appointment={day:28,room:0,col:4}",source:'p.workflow.sourceLinked=false',complete:"for(const s of p.stages)s.status='done'"};
   d.run(changes[condition]);
   assert.equal(d.run("dashboardSignals().filter(s=>s.icon==='note').length"),condition==='action'?1:0,`${key}/${currentRole}: dashboard excludes ${condition} cases consistently with the queue`);
   if(condition==='action')assert.equal(d.run("dashboardSignals().find(s=>s.icon==='note').action"),"openWorkflowCase('P-101')");
  }
 }
}
const pulse=runtime();pulse.run("for(const p of data().plans)p.workflow.contactAllowed=false;role='owner';data().plans[3].workflow.contactAllowed=true");
assert.match(pulse.run("dashboardSignals().find(s=>s.icon==='note').title"),/P-104/,'dashboard includes an eligible agreed plan after excluding restricted cases');
pulse.run("role='admin'");assert.equal(pulse.run("dashboardSignals().some(s=>s.icon==='note')"),false,'admin dashboard keeps its existing scope');
console.log('Dashboard verified: shared workflow eligibility across two clinics and two workspaces, seven excluded states, agreed plans, and administrator scope.');

// CJM is an independent organizational audit, not a clinical or financial event.
const cj=runtime();
assert.equal(cj.run('CJM_TEMPLATE.stages.length'),16);assert.equal(cj.run('CJM_TEMPLATE.items.length'),225);
assert.equal(cj.run('CJM_TEMPLATE.touchpoints.length'),57);assert.equal(cj.run('CJM_TEMPLATE.crm.length'),17);
assert.equal(cj.run('new Set(CJM_TEMPLATE.items.map(x=>x.id)).size'),225);
assert.equal(cj.run('CJM_TEMPLATE.stages.every(s=>cjmItems(s.id).length>0)'),true);
assert.equal(cj.run('cjmStats(CJM_TEMPLATE.items).checked'),0,'unreviewed audit has no invented score');
for(const scenario of ['master','zabota','high','acute','base'])for(const mode of ['journey','matrix','contacts','crm']){
 cj.run(`cjmSetScenario('${scenario}');cjmSetMode('${mode}');view='journey';render()`);
 assert.ok(cj.el('main').innerHTML.length>100);assert.ok(!cj.el('main').innerHTML.includes('undefined'));
}
const cRevenue=cj.run('financials().revenue'),cPaid=cj.run('financials().paid');
for(const [key,value] of Object.entries({cjmAuditStatus:'done',cjmAuditScore:'4',cjmAuditOwner:'Координатор',cjmAuditDue:'2026-10-28',cjmAuditProblem:'Нет согласованной даты',cjmAuditAction:'Проверить следующий шаг',cjmAuditEvidence:''}))cj.el(key).value=value;
assert.equal(cj.run("saveCjmAudit('s11_1')"),false,'audit completion needs evidence');
cj.el('cjmAuditEvidence').value='Проверен вымышленный регламент';assert.equal(cj.run("saveCjmAudit('s11_1',true)"),true);
assert.equal(cj.run('cjmStats(cjmItems(11)).done'),1);assert.equal(cj.run("data().managerTasks.filter(t=>t.kind==='cjm').length"),1);
cj.run("createCjmTask('s11_1')");assert.equal(cj.run("data().managerTasks.filter(t=>t.kind==='cjm').length"),1,'CJM task deduplicated');
assert.equal(cj.run('financials().revenue'),cRevenue);assert.equal(cj.run('financials().paid'),cPaid,'audit does not invent payments');
cj.run('persist()');assert.equal(runtime(cj.storage).run("data().cjm.records.s11_1.status"),'done','CJM restored additively');
cj.run("clinic='endo';render()");assert.equal(cj.run('cjmStats(CJM_TEMPLATE.items).checked'),0,'clinic audits isolated');
cj.run("clinic='implant';data().cjm.records.s11_1.problem='<img src=x onerror=alert(1)>';cjmStageId=11");assert.ok(!cj.run('cjmCheckRows()').includes('<img'),'CJM user notes escaped');
cj.el('managerState').value='done';cj.el('managerOwner').value='Координатор';cj.el('managerNote').value='';cj.run("saveManagerTask('CJM-001')");assert.equal(cj.run("data().managerTasks.find(t=>t.id==='CJM-001').state"),'new','CJM task completion requires result');
const pl=runtime();for(const key of ['implant','endo'])for(const period of ['month','week','today']){
 pl.run(`clinic='${key}';platformPeriod='${period}';render()`);
 assert.equal(pl.run('sum(marketingRows(),x=>x.revenue)'),pl.run('platformTotals().revenue'));
 assert.equal(pl.run('sum(marketingRows(),x=>x.paid)'),pl.run('platformTotals().paid'));
 assert.equal(pl.run('sum(marketingRows(),x=>x.rows.length)'),pl.run('platformRows().length'));
}
pl.run("setSourceState('mis','offline')");assert.equal(pl.run('platformTotals().revenue'),null,'unavailable source is not zero');
pl.run("setSourceState('mis','fresh')");assert.ok(pl.run('platformTotals().revenue')>0);
pl.run("setSourceState('payments','fresh')");assert.equal(pl.run('data().quality.sync'),true);
pl.run("data().quality.sync=false;resolveQuality('sync')");assert.equal(pl.run('data().platform.sources.payments.state'),'fresh');
assert.equal(pl.run('visitSourceRows().filter(x=>x.included).length'),pl.run('utilization().done'));
assert.equal(pl.run('visitSourceRows().length'),pl.run('utilization().done')+2);
const f0=pl.run('financials().revenue');pl.run('applyVisitRule()');assert.equal(pl.run('data().quality.visits'),true);assert.equal(pl.run('financials().revenue'),f0);
assert.equal(pl.run('loyaltySimulation(10000,1500,5,20).cash'),8500);assert.equal(pl.run('loyaltySimulation(10000,5000,5,20).redeemed'),2000);
assert.equal(pl.run('loyaltySimulation(-1,100,5,20)'),null);assert.equal(pl.run('loyaltySimulation(100,100,50,20)'),null);
assert.equal(pl.run("loyaltyAccounts().find(x=>x.plan.id==='P-107').case.actionable"),false,'loyalty respects restricted contact');
console.log('CJM/platform verified: 16 stages, 225 checks, five routes, isolated audit restore, evidence and task guards, financial conservation across periods, source availability, visit reconciliation and loyalty arithmetic.');
