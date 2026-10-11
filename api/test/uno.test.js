import test from 'node:test';
import assert from 'node:assert/strict';
import { handleUnoAction } from '../src/games/uno.js';

function state(overrides = {}) {
  return {
    game: 'uno',
    players: ['A', 'B', 'C'],
    hands: {
      A: [{ color: 'red', value: 'skip' }, { color: 'wild', value: 'wild' }, { color: 'wild', value: 'wild4' }],
      B: [{ color: 'blue', value: '2' }],
      C: [{ color: 'green', value: '3' }]
    },
    deck: [{ color: 'yellow', value: '4' }, { color: 'blue', value: '5' }],
    discard: [{ color: 'red', value: '4' }],
    currentIndex: 0,
    direction: 1,
    currentColor: 'red',
    finished: false,
    winner: null,
    log: [],
    ...overrides
  };
}

test('UNO skip skips exactly one opponent', () => {
  const next = handleUnoAction(state(), 'A', { type: 'play', card: { color: 'red', value: 'skip' } });
  assert.equal(next.currentIndex, 2);
  assert.equal(next.hands.A.length, 2);
});

test('UNO rejects a wild card with an invalid color without changing the hand', () => {
  const before = state();
  const next = handleUnoAction(before, 'A', { type: 'play', card: { color: 'wild', value: 'wild' }, color: 'pink' });
  assert.equal(next.hands.A.length, before.hands.A.length);
  assert.equal(next.currentIndex, 0);
});

test('UNO rejects Wild Draw Four when the player holds a card of the current color', () => {
  const before = state({ hands: { A: [{ color: 'red', value: '2' }, { color: 'wild', value: 'wild4' }], B: [{ color: 'blue', value: '2' }], C: [{ color: 'green', value: '3' }] } });
  const next = handleUnoAction(before, 'A', { type: 'play', card: { color: 'wild', value: 'wild4' }, color: 'blue' });
  assert.equal(next.hands.A.length, 2);
  assert.equal(next.currentIndex, 0);
});

test('UNO recycles discard cards when the draw pile runs out', () => {
  const before = state({ deck: [], discard: [{ color: 'blue', value: '1' }, { color: 'green', value: '2' }, { color: 'yellow', value: '3' }], hands: { A: [{ color: 'red', value: '1' }], B: [{ color: 'blue', value: '2' }], C: [{ color: 'green', value: '3' }] }, currentColor: 'yellow' });
  const next = handleUnoAction(before, 'A', { type: 'draw' });
  assert.equal(next.hands.A.length, 2);
  assert.equal(next.discard.length, 1);
  assert.ok(next.discard[0].value === '3');
});

test('UNO ignores actions from the wrong player and does not mutate input', () => {
  const before = state();
  const snapshot = JSON.stringify(before);
  const next = handleUnoAction(before, 'B', { type: 'play', card: { color: 'blue', value: '2' } });
  assert.equal(JSON.stringify(before), snapshot);
  assert.equal(next.currentIndex, 0);
  assert.deepEqual(next.hands, before.hands);
});


test('UNO reverse acts like skip with two players', () => {
  const before = state({
    players: ['A', 'B'],
    hands: { A: [{ color: 'red', value: 'reverse' }, { color: 'blue', value: '3' }], B: [{ color: 'blue', value: '2' }] },
    deck: [{ color: 'green', value: '4' }],
    currentColor: 'red'
  });
  const next = handleUnoAction(before, 'A', { type: 'play', card: { color: 'red', value: 'reverse' } });
  assert.equal(next.direction, -1);
  assert.equal(next.currentIndex, 0, 'the same player should take the next turn');
});
