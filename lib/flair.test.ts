import assert from 'node:assert/strict';
import test from 'node:test';
import {assertFlair, badgeCatalogue, badgeTier, CLOG_UNIQUE, clogMilestones, coerceFlair, displayTitle, DONATOR_TITLE, earnedCapes, emptyEquipped, earnedMarks, isMaxed, obtainedItems, petFloats, profileSaveBody, rankClaims} from './flair.ts';
import type {Journal} from './model.ts';

function journal(partial: Partial<Journal>): Journal {
  return {
    username: 'Test',
    pets: [],
    hiscores: {skills: [], activities: []},
    log: null,
    statsSyncedAt: null,
    logSyncedAt: null,
    revision: 0,
    ...partial,
  } as Journal;
}

test('collection log milestones are shares of 1,734 unique items', () => {
  const steps = clogMilestones();
  assert.equal(CLOG_UNIQUE, 1734);
  assert.deepEqual(steps.map(step => step.count), [17, 87, 173, 347, 434, 694, 867, 1040, 1301, 1561, 1734]);
  assert.equal(steps[0].detail.includes('1,734'), true);
});

test('marks follow pets, max cape, and collection log count', () => {
  const skills = ['Attack', 'Hitpoints', 'Mining', 'Strength', 'Agility', 'Smithing', 'Defence', 'Herblore', 'Fishing', 'Ranged', 'Thieving', 'Cooking', 'Prayer', 'Crafting', 'Firemaking', 'Magic', 'Fletching', 'Woodcutting', 'Runecraft', 'Slayer', 'Farming', 'Construction', 'Hunter', 'Sailing'];
  const early = journal({
    pets: Array.from({length: 71}, (_, index) => ({id: String(index), name: 'Pet', obtained: index < 10})),
    log: {obtained: 171, total: 1734, tabs: []},
  });
  assert.deepEqual(earnedMarks(early).map(mark => mark.id), ['pets-1', 'pets-5', 'pets-10', 'clog-17', 'clog-87']);
  assert.equal(assertFlair(early, {pinnedMark:'pets-5'}).pinnedMark, 'pets-5');
  assert.throws(() => assertFlair(early, {pinnedMark:'pets-15'}), /earned/);
  const full = journal({
    pets: Array.from({length: 71}, (_, index) => ({id: String(index), name: 'Pet', obtained: true})),
    hiscores: {skills: skills.map(name => ({name, level: 99, xp: 13_000_000, rank: 1})), activities: []},
    log: {obtained: 1734, total: 1734, tabs: []},
  });
  assert.equal(isMaxed(full), true);
  assert.equal(earnedMarks(full).some(mark => mark.id === 'max-cape'), true);
  assert.equal(earnedMarks(full).some(mark => mark.id === 'clog-1734'), true);
  assert.equal(earnedMarks(full).some(mark => mark.name === DONATOR_TITLE), false);
  assert.equal(badgeCatalogue(full).find(mark => mark.id === 'max-cape')?.img, '/items/13280.png');
  assert.equal(badgeTier('pets-5'), 'bronze');
  assert.equal(badgeTier('pets-10'), 'silver');
  assert.equal(badgeTier('pets-30'), 'platinum');
  assert.equal(badgeTier('pets-20'), 'gold');
  assert.equal(badgeTier('pets-50'), 'diamond');
  assert.equal(badgeTier('pets-all'), 'legendary');
  assert.equal(badgeCatalogue(full).find(mark => mark.id === 'clog-all')?.img, '/icons/navigation/collection-log.png');
});

test('the legendary combat emblem needs every task in every synced combat tier', () => {
  const tiers = (easy: number, hard: number) => ({quests: [], diaries: [], combat: [{id: 1, name: 'Easy', completed: easy, total: 40}, {id: 2, name: 'Hard', completed: hard, total: 60}], syncedAt: ''});
  const at = (profile: ReturnType<typeof tiers> | undefined) => badgeCatalogue(journal({profile} as never)).find(mark => mark.id === 'combat-all')!;
  // Not synced, or no tiers: nothing to complete, so not earned.
  assert.equal(at(undefined).unlocked, false);
  assert.equal(badgeCatalogue(journal({profile: {quests: [], diaries: [], combat: [], syncedAt: ''}} as never)).find(mark => mark.id === 'combat-all')?.unlocked, false);
  assert.deepEqual([at(tiers(40, 59)).completed, at(tiers(40, 59)).total, at(tiers(40, 59)).unlocked], [99, 100, false]);
  const all = at(tiers(40, 60));
  assert.deepEqual([all.unlocked, all.name, all.img], [true, 'All combat tasks', '/icons/navigation/combat-achievements.png']);
  assert.equal(badgeTier('combat-all'), 'legendary');
  assert.equal(badgeTier('combat-500'), 'diamond');
  assert.equal(assertFlair(journal({profile: tiers(40, 60)} as never), {pinnedMark: 'combat-all'}).pinnedMark, 'combat-all');
  assert.throws(() => assertFlair(journal({profile: tiers(40, 59)} as never), {pinnedMark: 'combat-all'}), /earned/);
});

test('public donor suffixes require server-authorised eligibility', () => {
  assert.equal(displayTitle('Obifloat', null), null);
  assert.equal(displayTitle('obifloat', 'the Maxed'), null);
  assert.equal(displayTitle('Someone', null), null);
  assert.equal(displayTitle('Someone', DONATOR_TITLE), DONATOR_TITLE);
});

test('title is not granted unless it is explicitly the Generous', () => {
  const j = journal({pets: [{id: '1', name: 'Rocky', obtained: true}] as Journal['pets']});
  assert.equal(coerceFlair(j, {title: DONATOR_TITLE}).title, DONATOR_TITLE);
  assert.equal(coerceFlair(j, {title: 'the Maxed'}).title, null);
  assert.throws(() => assertFlair(j, {title: 'the Maxed'}), /not available/);
  assert.equal(assertFlair(j, {title: ''}).title, null);
});

test('profile settings saves appearance and titles without touching Account privacy', () => {
  const j = journal({pets: [{id: '1', name: 'Rocky', obtained: true}] as Journal['pets']});
  const stale = {...coerceFlair(j, {companionPet: '1'}), canEdit: true, visibility: 'private' as const, details: {pets: false, log: false, quests: false, diaries: false, combat: false, skills: false, petRecords: false}, showDonation: false, titleChoice: 'none', appearance: {body: 'female' as const, hair: 'blonde' as const, skin: 'brown' as const, background: 'castle' as const}};
  const body = profileSaveBody(j, stale, false);
  for (const key of ['visibility', 'details', 'showDonation']) assert.equal(key in body, false, key);
  assert.equal(body.titleChoice, 'none');
  assert.deepEqual(body.appearance, stale.appearance);
  assert.equal(body.companionPet, '1');
});

test('companion and displayed piece must already be obtained', () => {
  const j = journal({
    pets: [
      {id: '1', name: 'Rocky', obtained: true},
      {id: '2', name: 'Heron', obtained: false},
    ] as Journal['pets'],
    log: {obtained: 1, total: 2, tabs: [{name: 'Other', pages: [{name: 'Page', obtained: 1, total: 1, items: [{id: 4151, name: 'Abyssal whip', quantity: 1}, {id: 1163, name: 'Rune full helm', quantity: 0}]}]}]},
  });
  assert.equal(assertFlair(j, {companionPet: '1', displayPiece: 'item:4151'}).displayPiece, 'item:4151');
  assert.throws(() => assertFlair(j, {companionPet: '2'}));
  assert.throws(() => assertFlair(j, {displayPiece: 'item:1163'}));
  assert.equal(petFloats('Rocky'), false);
  assert.equal(petFloats('Pet Kraken'), true);
});

test('worn gear has to be an owned item with a model for that slot', () => {
  const j = journal({
    log: {obtained: 2, total: 3, tabs: [{name: 'Other', pages: [{name: 'Page', obtained: 2, total: 3, items: [
      {id: 6570, name: 'Fire cape', quantity: 1},
      {id: 2581, name: 'Robin hood hat', quantity: 1},
      {id: 21295, name: 'Infernal cape', quantity: 0},
    ]}]}]},
  });
  const worn = assertFlair(j, {equipped: {cape: '6570', head: '2581'}});
  assert.equal(worn.equipped.cape, '6570');
  assert.equal(worn.equipped.head, '2581');
  assert.equal(worn.equipped.body, null);
  assert.throws(() => assertFlair(j, {equipped: {cape: '21295'}}), /can wear/);
  const legacy = coerceFlair(j, {displayPiece: 'item:6570'});
  assert.equal(legacy.equipped.cape, '6570');
});

test('leaderboard ranking does not invent rows', () => {
  assert.deepEqual(rankClaims([]), []);
  const ranked = rankClaims([
    {name: 'Bee', title: null, pets: 2, log: 10},
    {name: 'Aay', title: DONATOR_TITLE, pets: 2, log: 40},
    {name: 'Cee', title: null, pets: 5, log: 1},
  ]);
  assert.deepEqual(ranked.map(row => row.name), ['Cee', 'Aay', 'Bee']);
});

test('99s earn their skill capes, trimmed from the second 99, and maxing earns the max cape', () => {
  const at = (levels: Record<string, number>) => journal({hiscores: {skills: Object.entries(levels).map(([name, level]) => ({name, level, xp: 0, rank: 1})), activities: []}});
  assert.deepEqual(earnedCapes(at({Attack: 98, Fishing: 50})), []);
  // One 99: the plain cape only.
  assert.deepEqual(earnedCapes(at({Attack: 99, Fishing: 50})), ['9747']);
  // Two 99s: both capes, plain and trimmed.
  assert.deepEqual(earnedCapes(at({Ranged: 99, Woodcutting: 99})), ['9756', '9757', '9807', '9808']);
  assert.ok(obtainedItems(at({Sailing: 99})).has('31288'));
  const skills = ['Attack', 'Hitpoints', 'Mining', 'Strength', 'Agility', 'Smithing', 'Defence', 'Herblore', 'Fishing', 'Ranged', 'Thieving', 'Cooking', 'Prayer', 'Crafting', 'Firemaking', 'Magic', 'Fletching', 'Woodcutting', 'Runecraft', 'Slayer', 'Farming', 'Construction', 'Hunter', 'Sailing'];
  const maxed = earnedCapes(at(Object.fromEntries(skills.map(s => [s, 99]))));
  assert.equal(maxed.length, 49);
  assert.equal(maxed.at(-1), '13280');
  // A cape the levels earn can be worn, and saved.
  assert.equal(assertFlair(at({Attack: 99}), {equipped: {cape: '9747'}}).equipped.cape, '9747');
  assert.equal(coerceFlair(at({Attack: 98}), {equipped: {cape: '9747'}}).equipped.cape, null);
});

test('the completionist cape is for admins and the owner only, and stays out of guide items', async () => {
  const {COMPLETIONIST_CAPE} = await import('./custom-wearables.ts');
  const {guideItems} = await import('./guides.ts');
  const {wearables} = await import('./flair.ts');
  const j = journal({});
  assert.equal(wearables.items[COMPLETIONIST_CAPE].slot, 'cape');
  for (const role of ['admin', 'owner'] as const) {
    assert.ok(obtainedItems(j, {staffRole: role}).has(COMPLETIONIST_CAPE), role);
    assert.equal(assertFlair(j, {equipped: {cape: COMPLETIONIST_CAPE}}, {staffRole: role}).equipped.cape, COMPLETIONIST_CAPE);
  }
  for (const role of [null, 'helper', 'moderator'] as const) assert.equal(obtainedItems(j, {staffRole: role}).has(COMPLETIONIST_CAPE), false, String(role));
  // Saving it without the rank is refused, and a stored one is dropped when the profile is shown.
  assert.throws(() => assertFlair(j, {equipped: {cape: COMPLETIONIST_CAPE}}, {staffRole: 'moderator'}));
  assert.equal(coerceFlair(j, {equipped: {cape: COMPLETIONIST_CAPE}}).equipped.cape, null);
  assert.equal(COMPLETIONIST_CAPE in guideItems, false);
  // The editor's save keeps it for an admin, and drops it for anyone else.
  const next = {companionPet: null, displayPiece: null, equipped: {...emptyEquipped(), cape: COMPLETIONIST_CAPE}, pinnedMark: null, title: null};
  assert.equal(profileSaveBody(j, next, false, {staffRole: 'admin'}).equipped.cape, COMPLETIONIST_CAPE);
  assert.equal(profileSaveBody(j, next, false).equipped.cape, null);
});

test('on the dev site admins can try every skill cape and the max cape; the live site keeps the 99 rules', async () => {
  const {staffWearables, COMPLETIONIST_CAPE} = await import('./custom-wearables.ts');
  assert.deepEqual(staffWearables('owner', false), [COMPLETIONIST_CAPE]);
  const dev = staffWearables('admin', true);
  assert.ok(dev.includes('13280') && dev.includes('9747') && dev.includes('9748') && dev.includes(COMPLETIONIST_CAPE));
  assert.deepEqual(staffWearables('moderator', true), []);
});
