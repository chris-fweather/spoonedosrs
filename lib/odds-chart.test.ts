import test from 'node:test';
import assert from 'node:assert/strict';
import {initial} from './model.ts';
import {oddsCurve, petChartRecord} from './odds-chart.ts';

test('compact and full charts contain the exact 775 reward-search point, with matching odds', () => {
  for (const steps of [40,60]) {
    const model = oddsCurve(1/4000,775,false,steps);
    const point = model.curve.find(p => p.a === 775)!;
    assert.ok(point);
    assert.equal(point.c,model.chance);
    assert.equal((point.c*100).toFixed(1),'17.6');
    assert.ok(model.curve.every(p => Number.isInteger(p.a)));
    assert.equal(new Set(model.curve.map(p => p.a)).size,model.curve.length);
    const updated=oddsCurve(1/4000,1200,false,steps);
    assert.ok(updated.curve.some(p=>p.a===1200));
    assert.ok(updated.chance!>model.chance!);
  }
});
test('graphs use obtained effort first, current progress only when acquisition is unknown, and do not cross units', () => {
  const p=structuredClone(initial.pets.find(p=>p.name==='Abyssal protector')!);
  p.methods=[{name:'Abyssal protector',unit:'rewards',kc:1800,rate:4000,kph:null,activity:null,source:'Wiki'}];
  Object.assign(p,{obtained:true,obtainedCount:775,obtainedUnit:'rewards',obtainedMethod:'Abyssal protector'});
  assert.equal(petChartRecord(p).method?.kc,775);
  assert.equal(petChartRecord(p).label,'Obtained');
  p.obtainedCount=null;
  assert.equal(petChartRecord(p).method?.kc,1800);
  assert.equal(petChartRecord(p).label,'Current progress');
  p.obtainedCount=775;p.obtainedUnit='games';
  assert.equal(petChartRecord(p).method?.kc,null);
  p.obtained=false;
  assert.equal(petChartRecord(p).method?.kc,1800);
});
test('unknown counts have no marker; zero, fractional XP and counts beyond the usual domain remain exact', () => {
  assert.equal(oddsCurve(1/4000,null).chance,null);
  assert.equal(oddsCurve(1/4000,0).chance,0);
  const xp=oddsCurve(1/25000000,6517253.5,true);
  assert.ok(xp.curve.some(p=>p.a===6517253.5));
  const far=oddsCurve(1/4000,40000);
  assert.ok(far.max>40000);
  assert.ok(far.curve.some(p=>p.a===40000));
  assert.deepEqual(oddsCurve(1,1).curve,[{a:0,c:0},{a:1,c:1}]);
});
test('without a chosen method the graph and luck name the method with a count; a chosen XP method uses lifetime XP',async()=>{
  const {normalizeRates}=await import('./estimates.ts');
  const {petLuck}=await import('./pet-luck.ts');
  const seed=(await import('./seed.json',{with:{type:'json'}})).default;
  const j=normalizeRates(structuredClone(seed) as never);
  const skill=(name:string,xp:number)=>{const row=j.hiscores.skills.find(s=>s.name===name);if(row)row.xp=xp;else j.hiscores.skills.push({name,level:99,xp,rank:1});};
  skill('Farming',175_100_000);skill('Agility',13_580_000);skill('Runecraft',30_000_000);
  const pet=(name:string)=>j.pets.find(p=>p.name.toLowerCase()===name.toLowerCase())!;
  // Tangleroot obtained, no count, no method chosen, 40 Hespori kills: the graph shows Hespori, by name, and luck agrees.
  const tangleroot=pet('Tangleroot');tangleroot.obtained=true;
  const hespori=tangleroot.methods.find(m=>m.name.startsWith('Hespori'))!;hespori.kc=40;
  const byHespori=petChartRecord(tangleroot,j);
  assert.equal(byHespori.method?.name,hespori.name);assert.equal(byHespori.method?.kc,40);assert.equal(byHespori.label,`Current progress (${hespori.name})`);
  assert.equal(petLuck(tangleroot,j).luck,petLuck(tangleroot).luck,'luck reads the same Hespori count as before');
  // Once the player says they got it from Tree runs (counted in XP), graph and luck use lifetime Farming XP.
  tangleroot.obtainedMethod='Tree runs';
  const byRuns=petChartRecord(tangleroot,j);
  assert.deepEqual([byRuns.method?.name,byRuns.method?.kc,byRuns.label,byRuns.chosen],['Tree runs',175_100_000,'Lifetime XP',true]);
  assert.ok(petLuck(tangleroot,j).luck!<0,'175M XP of tree runs is unlucky');
  // Giant squirrel's planned laps have no count: no XP conversion and no marker, but still a graph.
  const squirrel=pet('Giant squirrel');squirrel.obtained=true;
  const sq=petChartRecord(squirrel,j);assert.equal(sq.method?.unit,'laps');assert.equal(sq.method?.kc,null);assert.ok(sq.method?.rate);
  // Rift guardian's default method has no rate: the graph borrows the first rated XP method, marked at lifetime XP.
  const rift=pet('Rift guardian');assert.equal(rift.methods[rift.plannedMethod??0].rate,null);
  const rg=petChartRecord(rift,j);assert.ok(rg.method?.rate);assert.equal(rg.method?.kc,30_000_000);
  assert.ok(petChartRecord(rift).method?.rate,'a graph even without the journal');
  // A recorded count wins over lifetime XP.
  const heron=pet('Heron');const planned=heron.methods[heron.plannedMethod??0];planned.kc=1_000_000;skill('Fishing',50_000_000);
  assert.deepEqual([petChartRecord(heron,j).label,petChartRecord(heron,j).method?.kc],['Current progress',1_000_000]);
});
test('Rocky before it is obtained is read at lifetime Thieving XP; Tumeken\'s guardian follows its raid inputs',async()=>{
  const {normalizeRates,upgradeEstimates}=await import('./estimates.ts');
  const seed=(await import('./seed.json',{with:{type:'json'}})).default;
  const j=upgradeEstimates(normalizeRates(structuredClone(seed) as never));
  const thieving=j.hiscores.skills.find(s=>s.name==='Thieving');if(thieving)thieving.xp=13_034_431;else j.hiscores.skills.push({name:'Thieving',level:99,xp:13_034_431,rank:1});
  const rocky=j.pets.find(p=>p.name==='Rocky')!;rocky.obtained=false;
  assert.equal(rocky.methods[rocky.plannedMethod??0].name,'Ardougne knights');
  const chart=petChartRecord(rocky,j);
  assert.deepEqual([chart.label,chart.method?.name,chart.method?.kc],['Lifetime XP','Ardy Knights',13_034_431]);
  rocky.obtained=true;assert.notEqual(petChartRecord(rocky,j).method?.name,'Ardy Knights','an obtained Rocky keeps its own method');
  const toa=j.pets.find(p=>p.name==="Tumeken's guardian")!;
  assert.deepEqual(toa.methods.map(m=>[m.name,m.rate,m.unit,m.activity,m.rateConfirmed]),[['Tombs of Amascut',1225,'raids','Tombs of Amascut',true],['Tombs of Amascut: Expert Mode',350,'raids','Tombs of Amascut: Expert Mode',true]]);
  assert.ok(petChartRecord(toa,j).method?.rate,'a graph now');
});
