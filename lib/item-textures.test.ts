import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

/** Male models whose female model has a different number of faces, so scripts/repair-male-textures.mjs cannot match
 * them face for face: Lava dragon mask, and both Farmer's strawhats. They keep their flat colours for now. */
const UNMATCHED = new Set(['12371', '13646', '13647']);

test('male item models keep the textured faces their female models have', () => {
  const wear = JSON.parse(readFileSync('lib/wearables.json', 'utf8')), female = JSON.parse(readFileSync('lib/appearance-models.json', 'utf8')).femaleItems;
  const textured = (file: string) => {
    const g = JSON.parse(readFileSync('public/models/look/' + file, 'utf8'));
    let faces = 0;
    for (const p of g.meshes[0].primitives) if (g.materials[p.material].name?.startsWith('flow:')) {
      assert.ok(p.attributes.TEXCOORD_0 !== undefined, file);
      faces += g.accessors[p.indices ?? p.attributes.POSITION].count / 3;
    }
    return faces;
  };
  let checked = 0;
  for (const [id, item] of Object.entries(wear.items) as [string, {file: string; flow?: number[]}][]) {
    const file = female[id];
    if (!file || file === item.file || UNMATCHED.has(id)) continue;
    const faces = textured(file);
    if (!faces) continue;
    assert.equal(textured(item.file), faces, `${id}: male model has the female model's ${faces} textured faces`);
    checked++;
  }
  assert.ok(checked >= 25, 'the capes, staves, whips, shields and clan cloaks are all checked');
});
