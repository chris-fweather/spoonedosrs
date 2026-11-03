// Builds lib/untradeable-values.json: the high alchemy value of items that are not sold on the Grand Exchange, for the
// guide price cards (the real-time prices API only lists tradeable items).
//
//   node scripts/build-untradeable-values.mjs
//
// Read from the OSRS Wiki drop tables already saved in lib/drop-snapshots.json and lib/collection-acquisition.json
// (CC BY-NC-SA 3.0): rows whose Price is "Not sold" and whose High Alch is a number, for a quantity of one. Names are
// matched to item IDs through the guide item catalogue, so every ID with that name gets the value.
import {readFileSync, writeFileSync} from 'node:fs';

const read = file => JSON.parse(readFileSync(new URL('../lib/' + file, import.meta.url), 'utf8'));
const pages = [...Object.values(read('drop-snapshots.json')), ...Object.values(read('collection-acquisition.json'))];
const values = new Map();
for (const page of pages) for (const table of page.tables ?? []) {
  const col = name => table.headers.indexOf(name), item = col('Item'), price = col('Price'), alch = col('High Alch'), quantity = col('Quantity');
  if (item < 0 || price < 0 || alch < 0 || quantity < 0) continue;
  for (const row of table.rows) {
    const name = row[item]?.text?.trim(), value = Number((row[alch]?.text ?? '').replaceAll(',', ''));
    if (!name || row[price]?.text !== 'Not sold' || row[quantity]?.text !== '1' || !Number.isSafeInteger(value) || value <= 0) continue;
    values.set(name.toLowerCase(), value);
  }
}
const names = {...read('item-names.json'), ...read('guide-item-catalogue.json'), ...Object.fromEntries(Object.entries(read('wearables.json').items).map(([id, item]) => [id, item.name]))};
const out = {};
for (const [id, name] of Object.entries(names).sort((a, b) => Number(a[0]) - Number(b[0]))) {
  const value = typeof name === 'string' && values.get(name.toLowerCase());
  if (value) out[id] = value;
}
writeFileSync(new URL('../lib/untradeable-values.json', import.meta.url), JSON.stringify(out) + '\n');
console.log(`${Object.keys(out).length} items from ${values.size} untradeable names`);
