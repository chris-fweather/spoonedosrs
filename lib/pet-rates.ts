// Wiki skill-pet rates at the player's level. Spreadsheet figures stay labeled as unverified.
import {petUnitLabel} from './pet-record';
import raw from './skill-pet-rates.json';
import type {Journal, Method, Pet} from './model';
import {lapMethod} from './agility-laps';
import {isTreeRun, treeRunStats} from './farming-runs';
import {lifetimeSkill, phoenixRollChance, oddsMethod,usesAcquisition, HONOUR_PER_GAMBLE} from './estimates';

export {atLevel, wikiMethod, methodWiki, skillPetFormula} from './skill-rates';
import {atLevel, wikiMethod, type WikiMethod, skillPetFormula} from './skill-rates';
const data = raw as {formula: string; pets: Record<string, {skill: string; methods: WikiMethod[]}>};

export type RateLine = {label: string; value: string; tone?: string};
export type PetOutlook = {lines: RateLine[]; note: string; chance: number | null; hours: number | null; averageXp: number | null};

/** Wiki rates that are not a flat roll per hiscore kill. The number stays the snapshot figure. */
const CONDITIONAL: Record<string, {value: string; note: string}> = {
  Olmlet: {
    value: '1/53 on a unique',
    note: 'OSRS Wiki: 1/53 when a unique is received from the ancient chest. That is not 1/53 per raid. https://oldschool.runescape.wiki/w/Olmlet',
  },
  "Tumeken's guardian": {
    value: 'Varies with the raid level',
    note: 'OSRS Wiki item sources list the Tombs of Amascut chest rate as varies. https://oldschool.runescape.wiki/w/Tumeken%27s_guardian',
  },
};

export function petRateLines(pet: Pet, journal: Journal): PetOutlook {
  const m = oddsMethod(pet);
  const skill = lifetimeSkill(pet, journal);
  if (!m) return {lines: [{label: 'Rate', value: 'No method stored'}], note: '', chance: null, hours: null, averageXp: null};

  if(m.rateOverride){
    const averageXp=m.unit==='XP'?m.rate:null;
    const chance=m.rate&&m.kc!=null?(m.kc===0?0:m.unit==='XP'?-Math.expm1(-m.kc/m.rate):-Math.expm1(m.kc*Math.log1p(-1/m.rate))):null;
    const hours=m.rate&&m.kph?m.rate/m.kph:null;
    return {lines:[{label:'Personal estimate',value:m.rate?`${m.unit==='XP'?'Mean ': '1 / '}${m.rate.toLocaleString()} ${petUnitLabel(pet,m.unit)}`:'No personal estimate set'}],note:[m.source,'Your planning estimate. This does not change the game drop rate or other players’ profiles.'].filter(Boolean).join(' '),chance,hours,averageXp};
  }
  if (pet.name === 'Tangleroot' && isTreeRun(m)) {
    const run = treeRunStats(skill?.level ?? 99), averageXp = m.rate;
    const chance = m.rate && m.kc != null ? -Math.expm1(-m.kc / m.rate) : null;
    const hours = m.rate && m.kph ? m.rate / m.kph : null;
    const lines: RateLine[] = [
      {label: 'Method', value: 'Tree run: 6 magic + 6 palm trees'},
      {label: `Chance per run at level ${run.level}`, value: `1 / ${Math.round(run.runsPerPet).toLocaleString()}`},
      {label: 'XP per run', value: Math.round(run.xp).toLocaleString()},
      {label: 'Average XP', value: averageXp ? Math.round(averageXp).toLocaleString() : '—', tone: 'y'},
      ...(chance !== null ? [{label: 'Chance at your Farming XP', value: `${(chance * 100).toFixed(1)}%`}] : []),
      ...(hours !== null ? [{label: 'Mean hunt (active)', value: `~${Math.round(hours).toLocaleString()} h`, tone: 'y'}] : []),
    ];
    const note = `OSRS Wiki: each tree checked is one 1/(base − 25 × Farming level) roll (magic 9,368, palm 9,000). Average XP = XP per run ÷ −ln(chance of no pet in a run).${skill ? '' : ' Level 99 assumed until hiscores sync.'} Lifetime Farming XP also counts other crops, quests and lamps.`;
    return {lines, note, chance, hours, averageXp};
  }
  if (m.unit === 'XP' || wikiMethod(pet.name, m.name)) {
    const lines: RateLine[] = [];
    const wiki = wikiMethod(pet.name, m.name);
    const calc = wiki && skill ? atLevel(wiki, skill.level) : null;
    let chance: number | null = null;
    let hours: number | null = null;
    let averageXp: number | null = null;
    if (calc && skill) {
      lines.push({label: 'Method', value: wiki!.name});
      lines.push({label: `Drop rate at level ${skill.level}`, value: `1 / ${calc.actions.toLocaleString(undefined, {maximumFractionDigits: 2})}`});
      if (calc.expectedXp != null && calc.xpEach != null && calc.xpEach > 0) {
        averageXp = Math.round(calc.expectedXp);
        lines.push({label: 'Average XP', value: averageXp.toLocaleString(), tone: 'y'});
        chance = m.kc == null ? null : m.unit === 'XP' ? -Math.expm1(-m.kc / calc.expectedXp) : -Math.expm1(m.kc * Math.log1p(-1 / calc.denom));
        if (chance !== null) lines.push({label: 'Chance at recorded method effort', value: `${(chance * 100).toFixed(1)}%`});
        const pace = m.kph && m.kph > 0 ? m.kph : null;
        if (pace) {
          hours = (m.unit === 'XP' ? averageXp : calc.actions) / pace;
          lines.push({label: 'Mean hunt', value: `~${Math.round(hours).toLocaleString()} h`, tone: 'y'});
          lines.push({label: 'Pace used', value: `${Math.round(pace).toLocaleString()} ${petUnitLabel(pet,m.unit)}/h stored for this method`});
        }
      } else lines.push({label: 'Average XP', value: 'XP per action is not in the wiki snapshot'});
    } else if (m.rate && skill) {
      chance = m.kc == null ? null : -Math.expm1(-m.kc / m.rate);
      lines.push({label: 'Stored planning figure', value: `1 per ${Math.round(m.rate).toLocaleString()} XP`, tone: 'y'});
      if (chance !== null) lines.push({label: 'Chance at recorded method XP', value: `${(chance * 100).toFixed(1)}%`});
      lines.push({label: 'Basis', value: 'Unverified spreadsheet. Not a wiki rate.'});
      if (m.kph && m.kph > 0) {
        hours = m.rate / m.kph;
        lines.push({label: 'Mean hunt', value: `~${Math.round(hours).toLocaleString()} h`});
      }
    } else lines.push({label: 'Rate', value: m.rate ? `1 per ${Math.round(m.rate).toLocaleString()} ${petUnitLabel(pet,m.unit)}` : 'No wiki rate for this method'});
    if (calc && m.unit !== 'XP') {
      chance = m.kc == null ? null : -Math.expm1(m.kc * Math.log1p(-1 / calc.denom));
      if (chance !== null && !lines.some(l => l.label === 'Chance at recorded method effort')) lines.push({label:'Chance at recorded method effort', value:`${(chance * 100).toFixed(1)}%`});
      if (m.kph && !lines.some(l => l.label === 'Mean hunt')) {hours = calc.actions / m.kph; lines.push({label:'Mean hunt',value:`~${Math.round(hours).toLocaleString()} h`}); lines.push({label:'Pace used',value:`${m.kph.toLocaleString()} ${petUnitLabel(pet,m.unit)}/h`});}
    }
    const note = skill
      ? `${skillPetFormula} Current-level projection for ${wiki?.name ?? m.name}; historical level changes are not reconstructed. Lifetime ${skill.name} XP is not used as eligible method effort.`
      : 'Sync hiscores to use your level in the wiki formula.';
    return {lines, note, chance, hours, averageXp};
  }

  const lines: RateLine[] = [];
  const conditional = !m.rate ? CONDITIONAL[pet.name] : undefined;
  let chance: number | null = null;
  let hours: number | null = null;
  if (m.rate) lines.push({label: 'Drop rate', value: dropRateText(m) + (m.unit ? ` ${petUnitLabel(pet,m.unit)}` : ''), tone: 'y'});
  else if (conditional) lines.push({label: 'Drop rate', value: conditional.value, tone: 'y'});
  else lines.push({label: 'Drop rate', value: 'No drop-style rate is stored'});
  if (m.kc != null && m.rate) {
    lines.push({label: `Your ${petUnitLabel(pet,m.unit)}`, value: m.kc.toLocaleString()});
    chance = -Math.expm1(m.kc * Math.log1p(-1 / m.rate));
    lines.push({label: 'Chance at your count', value: `${(chance * 100).toFixed(1)}%`});
  } else if (m.kc != null) lines.push({label: `Your ${petUnitLabel(pet,m.unit)}`, value: m.kc.toLocaleString()});
  if (m.kph && m.kph > 0 && m.rate) {
    hours = m.rate / m.kph;
    lines.push({label: 'Mean hunt', value: `~${Math.round(hours).toLocaleString()} h`, tone: 'y'});
  }
  if (m.kph && m.kph > 0 && m.unit === 'gambles') lines.push({label: 'Honour points per hour', value: Math.round(m.kph * HONOUR_PER_GAMBLE).toLocaleString()});
  if (m.kph && m.kph > 0 && ['games', 'runs', 'raids', 'crates', 'rolls', 'uniques'].includes(m.unit)) {
    lines.push({label: `Minutes per ${m.unit.replace(/s$/, '')}`, value: (60 / m.kph).toFixed(1)});
  }
  const score = (name: string) => journal.hiscores.activities.find(a => a.name.toLowerCase() === name.toLowerCase())?.score;
  if (pet.name === 'Phoenix'&&!usesAcquisition(pet)&&!pet.obtained) {
    const subdues = score('Wintertodt');
    if (subdues != null) lines.push({label: 'Hiscores subdues', value: `${subdues.toLocaleString()} (not rolls)`});
    const firemaking=journal.hiscores.skills.find(s=>s.name==='Firemaking');
    const rollChance = firemaking && firemaking.xp<200_000_000 ? phoenixRollChance(pet.crateRolls, 5000) : null;
    if (pet.crateRolls != null) lines.push({label: 'Crate rolls', value: pet.crateRolls.toLocaleString()});
    if (rollChance != null) {
      chance = rollChance;
      lines.push({label: 'Chance at your rolls', value: `${(chance * 100).toFixed(1)}%`});
    }
  }
  if (pet.name === 'Olmlet') {
    const raids = score('Chambers of Xeric');
    const challenge = score('Chambers of Xeric: Challenge Mode');
    if (raids != null) lines.push({label: 'Hiscores raids', value: `${raids.toLocaleString()} (not uniques)`});
    if (challenge != null) lines.push({label: 'Hiscores Challenge Mode', value: `${challenge.toLocaleString()} (not uniques)`});
  }

  const bits = [conditional?.note ?? m.source];
  if (m.rate && !m.rateConfirmed) bits.push('Unverified planning figure unless the source cites the wiki.');
  if (m.kph && !m.paceConfirmed) bits.push('Pace is a stored example, not a measured session.');
  if (pet.name==='Phoenix') bits.push('Historical chance uses the standard rate before 200M Firemaking. For accounts at 200M, the total must be split into pre- and post-200M rolls before calculating historical chance.');
  return {lines, note: bits.filter(Boolean).join(' '), chance, hours, averageXp: null};
}

/** Hours of play until the chance of having the pet reaches its next milestone (50%, 90%, then 95%). A pet roll has
 * no memory, so the mean hunt never shrinks; this counts down as you play instead. Effort so far comes from the chance
 * itself (chance = 1 − e^(−hours ÷ mean)). */
export function hoursToMilestone(meanHours: number | null, chance: number | null): {hours: number; percent: number} | null {
  if (meanHours == null || !(meanHours > 0)) return null;
  const done = chance && chance > 0 && chance < 1 ? -meanHours * Math.log1p(-chance) : 0;
  const percent = [50, 90, 95].find(p => (chance ?? 0) < p / 100);
  if (percent == null) return null;
  return {hours: Math.max(0, -meanHours * Math.log1p(-percent / 100) - done), percent};
}
export function dropRateText(m: {name: string; rate: number | null} | undefined): string {
  if (!m?.rate) return '';
  if (m.name === '200 million Firemaking') return '1/5,000 ÷ 15';
  return `1/${Math.round(m.rate).toLocaleString()}`;
}

export function methodsForSkill(skill: string): {pet: string; methods: WikiMethod[]} | null {
  const hit = Object.entries(data.pets).find(([, p]) => p.skill === skill);
  return hit ? {pet: hit[0], methods: hit[1].methods} : null;
}

/** What one roll is for each skill when the Wiki has no XP per action for a method. */
const ACTION_UNIT:Record<string,string>={Agility:'laps',Farming:'plants',Hunter:'catches',Fishing:'catches',Woodcutting:'logs',Mining:'ores',Runecraft:'crafts'};

/** A Wiki skilling method as a method a player can add. With XP per action it counts XP (hiscores can fill it);
 * otherwise it counts the action itself, like laps for an Agility course, with the per-action chance. */
export function skillMethodChoice(skill:string,w:WikiMethod,level:number|null):Method {
 if(skill==='Agility'){const lap=lapMethod(w.name,level??99);if(lap)return {...lap,source:lap.source+` OSRS Wiki: ${w.link}`};}
 const calc=atLevel(w,level??99),xp=w.xp!=null&&calc?.expectedXp!=null;
 const unit=xp?'XP':skill==='Thieving'?(/stall/i.test(w.name)?'thefts':'pickpockets'):ACTION_UNIT[skill]??'actions';
 return {name:w.name,unit,kc:null,kph:null,rate:calc?(xp?calc.expectedXp:calc.actions):null,activity:null,rateConfirmed:!!calc,paceConfirmed:false,source:`OSRS Wiki: ${w.link}`};
}
