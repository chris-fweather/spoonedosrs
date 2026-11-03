import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_STOPS, addStop, applyTripAction, canAddStop, emptyTrip, legKey, moveRow, parseStops, removeRow, reverseTrip, rowMark, setEnd, stopCount, tripLegs, tripOf, tripTime, type TripRow} from './world-map-trip.ts';

const points = (trip: TripRow<string>[]) => trip.map(r => r.point);

test('a trip has a start and a destination, and plans nothing until both are set', () => {
  let trip = emptyTrip<string>();
  assert.deepEqual(points(trip), [null, null]);
  assert.deepEqual(tripLegs(trip), []);
  trip = setEnd(trip, 'to', 'Falador');
  assert.deepEqual(tripLegs(trip), []);
  trip = setEnd(trip, 'from', 'Lumbridge');
  assert.deepEqual(tripLegs(trip), [{from: 'Lumbridge', to: 'Falador', index: 0, fromRow: 0, toRow: 1}]);
});

test('Add a stop goes just before the destination, or becomes the destination when there is none', () => {
  let trip = applyTripAction(emptyTrip<string>(), 'stop', 'Draynor');
  assert.deepEqual(points(trip), [null, 'Draynor']);
  trip = applyTripAction(applyTripAction(trip, 'from', 'Lumbridge'), 'stop', 'Port Sarim');
  assert.deepEqual(points(trip), ['Lumbridge', 'Port Sarim', 'Draynor']);
  trip = applyTripAction(trip, 'stop', 'Rimmington');
  assert.deepEqual(points(trip), ['Lumbridge', 'Port Sarim', 'Rimmington', 'Draynor']);
  // Directions to here keeps the stops and replaces the destination.
  trip = applyTripAction(trip, 'to', 'Falador');
  assert.deepEqual(points(trip), ['Lumbridge', 'Port Sarim', 'Rimmington', 'Falador']);
  assert.equal(stopCount(trip), 2);
});

test('multi-stop trips are planned leg by leg, in order', () => {
  const trip = tripOf('A', ['1', '2'], 'B');
  assert.deepEqual(tripLegs(trip).map(l => l.from + l.to), ['A1', '12', '2B']);
  assert.deepEqual(trip.map((_, i) => rowMark(i, trip.length)), ['A', '1', '2', 'B']);
});

test('the trip time adds up the chosen route of every leg, once all are planned', () => {
  const leg = (ticks: number[], active = 0) => ({routes: ticks.map(t => ({ticks: t})), active});
  assert.equal(tripTime([leg([10, 20]), leg([5, 7], 1), leg([3])]), 10 + 7 + 3);
  assert.equal(tripTime([leg([10]), null]), null);
  assert.equal(tripTime([leg([10]), leg([])]), null);
  assert.equal(tripTime([]), null);
});

test('stops are capped', () => {
  let trip = tripOf('A', [], 'B');
  for (let i = 0; i < MAX_STOPS + 3; i++) trip = addStop(trip, 'S' + i);
  assert.equal(stopCount(trip), MAX_STOPS);
  assert.equal(canAddStop(trip), false);
  assert.equal(trip[trip.length - 1].point, 'B');
  assert.equal(tripOf('A', Array.from({length: 20}, (_, i) => String(i)), 'B').length, MAX_STOPS + 2);
});

test('rows reorder by drag or the move buttons, keeping their ids', () => {
  const trip = tripOf('A', ['1', '2'], 'B');
  const moved = moveRow(trip, 3, 1);
  assert.deepEqual(points(moved), ['A', 'B', '1', '2']);
  assert.deepEqual(moved.map(r => r.id), [trip[0].id, trip[3].id, trip[1].id, trip[2].id]);
  assert.equal(moveRow(trip, 0, 9), trip);
  assert.deepEqual(points(reverseTrip(trip)), ['B', '2', '1', 'A']);
  // An empty row dragged into the middle is skipped; an empty start or destination waits.
  assert.deepEqual(tripLegs(moveRow(tripOf(null, ['1'], 'B'), 0, 1)), [{from: '1', to: 'B', index: 0, fromRow: 0, toRow: 2}]);
  assert.deepEqual(tripLegs(tripOf(null, ['1'], 'B')), []);
});

test('removing a row drops a stop, or clears an end of a two-row trip', () => {
  assert.deepEqual(points(removeRow(tripOf('A', ['1', '2'], 'B'), 2)), ['A', '1', 'B']);
  assert.deepEqual(points(removeRow(tripOf('A', ['1'], 'B'), 0)), ['1', 'B']);
  assert.deepEqual(points(removeRow(tripOf('A', ['1'], 'B'), 2)), ['A', '1']);
  assert.deepEqual(points(removeRow(tripOf('A', [], 'B'), 1)), ['A', null]);
});

test('links carry stops; bad ones are left out', () => {
  const tile = (v: string) => /^\d+,\d+,\d$/.test(v) ? v : null;
  assert.deepEqual(parseStops(['3093,3243,0', 'nope', '3000,3000,1'], tile), ['3093,3243,0', '3000,3000,1']);
  assert.equal(parseStops(Array.from({length: 20}, () => '1,1,0'), tile).length, MAX_STOPS);
  assert.equal(legKey({x: 1, y: 2, plane: 0}, {x: 3, y: 4, plane: 1}, 's'), '1,2,0>3,4,1|s');
});
