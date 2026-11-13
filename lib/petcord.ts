import raw from './petcord-driest.json' with {type: 'json'};

/** Community driest-streak record. The sheet's rarity string is kept in the JSON and is not a drop rate. */
export type DriestRecord = {
  pet: string;
  username: string;
  count: number;
  unit: string;
  date: string | null;
  note?: string;
  likelihood?: string;
  proof: string | null;
  clog: string | null;
};

type RawRecord = DriestRecord & {rarity?: string};
type RawFile = {source: string; sheet: string; records: RawRecord[]};

const data = raw as RawFile;
const byName = new Map(data.records.map(record => [record.pet.toLowerCase(), record]));

export const PETCORD_SOURCE = data.source;
export const PETCORD_SHEET = data.sheet;

function https(url: string | null | undefined): string | null {
  return typeof url === 'string' && /^https:\/\//.test(url) ? url : null;
}

/** The chance of having had the pet by the record's count, from the sheet's rarity: "1/1,400" per kill (or per unit), or
 * "1/~11.4m XP" per XP. The sheet gives this for a few records; the rest are worked out the same way. A rarity that is
 * not one plain rate (two rates, or none) gives no figure. */
export function driestLikelihood(rarity: string | undefined, count: number, unit: string): string | null {
  if (!rarity || rarity.includes(';') || !(count > 0)) return null;
  const xp = rarity.match(/^1\/~?([\d.,]+)\s*([km])?\s*XP/i);
  const plain = rarity.match(/^1\/~?([\d,]+(?:\.\d+)?)(?!\s*[km]?\s*XP)/i);
  let chance: number;
  if (xp) {
    if (unit.toLowerCase() !== 'xp') return null;
    const rate = Number(xp[1].replaceAll(',', '')) * (xp[2]?.toLowerCase() === 'm' ? 1e6 : xp[2]?.toLowerCase() === 'k' ? 1e3 : 1);
    if (!(rate > 0)) return null;
    chance = -Math.expm1(-count / rate);
  } else if (plain) {
    const rate = Number(plain[1].replaceAll(',', ''));
    if (!(rate > 1)) return null;
    chance = -Math.expm1(count * Math.log1p(-1 / rate));
  } else return null;
  // Two decimals, never rounding a record up to a certain 100%.
  return `${Math.min(99.99, Math.floor(chance * 10000) / 100).toFixed(2)}%`;
}

/** Record for a pet name already used in the journal. Case-insensitive. Pets with no record return null. */
export function driestRecord(petName: string): DriestRecord | null {
  const row = byName.get(petName.toLowerCase());
  if (!row) return null;
  return {
    pet: row.pet,
    username: row.username,
    count: row.count,
    unit: row.unit,
    date: row.date,
    note: row.note,
    likelihood: row.likelihood ?? driestLikelihood(row.rarity, row.count, row.unit) ?? undefined,
    proof: https(row.proof),
    clog: https(row.clog),
  };
}
