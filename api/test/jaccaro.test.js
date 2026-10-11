import test from 'node:test';
import assert from 'node:assert/strict';
import { handleJaccaroAction } from '../src/games/jaccaro.js';

test('Jackaroo skip card skips exactly one opponent', () => {
  const state = {
    game: 'jaccaro',
    players: ['A', 'B', 'C', 'D'],
    hands: {
      A: [{ type: 'skip' }],
      B: [{ type: 'move', value: 1 }],
      C: [{ type: 'move', value: 2 }],
      D: [{ type: 'move', value: 3 }]
    },
    deck: [{ type: 'move', value: 4 }],
    discard: [],
    marbles: {
      A: { home: 4, track: 0, safe: 0, finished: 0 },
      B: { home: 4, track: 0, safe: 0, finished: 0 },
      C: { home: 4, track: 0, safe: 0, finished: 0 },
      D: { home: 4, track: 0, safe: 0, finished: 0 }
    },
    currentIndex: 0,
    finished: false,
    winner: null,
    log: []
  };

  const next = handleJaccaroAction(state, 'A', { type: 'play', cardIndex: 0 });
  assert.equal(next.currentIndex, 2, 'the next turn should go to C, skipping B');
  assert.equal(next.hands.A.length, 1, 'the player should draw one replacement card');
  assert.equal(next.discard.at(-1).type, 'skip');
});

test('Jackaroo ignores actions from a player who does not own the turn', () => {
  const state = {
    game: 'jaccaro',
    players: ['A', 'B'],
    hands: { A: [{ type: 'move', value: 2 }], B: [{ type: 'move', value: 3 }] },
    deck: [{ type: 'move', value: 4 }],
    discard: [],
    marbles: {
      A: { home: 4, track: 0, safe: 0, finished: 0 },
      B: { home: 4, track: 0, safe: 0, finished: 0 }
    },
    currentIndex: 0,
    finished: false,
    winner: null,
    log: []
  };

  const next = handleJaccaroAction(state, 'B', { type: 'play', cardIndex: 0 });
  assert.deepEqual(next, state);
});


test('Jackaroo swap card exchanges active positions with the chosen opponent', () => {
  const state = {
    game: 'jaccaro',
    players: ['A', 'B', 'C'],
    hands: { A: [{ type: 'swap' }], B: [{ type: 'move', value: 2 }], C: [{ type: 'move', value: 3 }] },
    deck: [{ type: 'move', value: 4 }],
    discard: [],
    marbles: {
      A: { home: 3, track: 5, safe: 0, finished: 0 },
      B: { home: 3, track: 21, safe: 1, finished: 0 },
      C: { home: 4, track: 0, safe: 0, finished: 0 }
    },
    currentIndex: 0,
    finished: false,
    winner: null,
    log: []
  };
  const next = handleJaccaroAction(state, 'A', { type: 'play', cardIndex: 0, targetPlayer: 'B' });
  assert.equal(next.marbles.A.track, 21);
  assert.equal(next.marbles.B.track, 5);
  assert.equal(next.marbles.A.safe, 1);
  assert.equal(next.marbles.B.safe, 0);
});

test('Jackaroo rejects a swap without a valid active opponent and keeps the card', () => {
  const state = {
    game: 'jaccaro',
    players: ['A', 'B'],
    hands: { A: [{ type: 'swap' }], B: [{ type: 'move', value: 2 }] },
    deck: [{ type: 'move', value: 4 }],
    discard: [],
    marbles: {
      A: { home: 4, track: 0, safe: 0, finished: 0 },
      B: { home: 4, track: 0, safe: 0, finished: 0 }
    },
    currentIndex: 0,
    finished: false,
    winner: null,
    log: []
  };
  const next = handleJaccaroAction(state, 'A', { type: 'play', cardIndex: 0, targetPlayer: 'B' });
  assert.equal(next.hands.A.length, 1);
  assert.equal(next.discard.length, 0);
  assert.equal(next.currentIndex, 0);
});
