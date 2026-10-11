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
