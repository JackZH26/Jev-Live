const test = require('node:test');
const assert = require('node:assert/strict');
const { summarize, wilson, combineCohorts } = require('./summarize-steam-evaluation.cjs');
const match = (id, placement, damage = 0) => ({ id, placement, damage, kills: 0,
  won: placement === 1, finished: true, eligible: true, durationSeconds: 20 });
const cohort = results => ({ results, interrupted: [], complete: true, released: true });

test('counts losses, wins and interruptions without excluding poor outcomes', () => {
  const input = cohort([match('a', 50), match('b', 1, 100), match('c', 10, 20), match('d', 40)]);
  input.interrupted.push({ id: 'e', reason: 'focus lost' });
  const s = summarize(input);
  assert.equal(s.completedMatches, 4); assert.equal(s.interruptedMatches, 1);
  assert.equal(s.wins, 1); assert.equal(s.winRate, .25); assert.equal(s.topTenRate, .5);
  assert.equal(s.medianPlacement, 25); assert.equal(s.averagePlayerDamage, 30);
  assert.equal(s.shots, null); assert.equal(s.lobbyWaitsWithin5To8Seconds, null);
});
test('zero-win confidence interval does not assert a proven zero chance', () => {
  const [low, high] = wilson(0, 5);
  assert.equal(low, 0); assert.ok(Math.abs(high - .4344824648) < 1e-9);
  assert.equal(wilson(0, 0), null);
  const empty = summarize(cohort([])); assert.equal(empty.winRate, null); assert.equal(empty.medianPlacement, null);
});
test('rejects duplicates and contradictory results', () => {
  assert.throws(() => summarize(cohort([match('a', 40), match('a', 40)])), /duplicate/);
  assert.throws(() => summarize(cohort([{ ...match('a', 40), won: true }])), /Invalid/);
  assert.throws(() => summarize(cohort([{ ...match('a', 40), eligible: false }])), /Invalid/);
});
test('separates actual lobby waits from first start and loading', () => {
  const input = cohort([match('a', 40)]);
  input.lobbyDelays = [{ afterResult: false, waitSeconds: 1 }, { afterResult: true, waitSeconds: 7, seconds: 11 }];
  assert.equal(summarize(input).lobbyWaitsWithin5To8Seconds, true);
  input.lobbyDelays.push({ afterResult: true, waitSeconds: 9, seconds: 12 });
  assert.equal(summarize(input).lobbyWaitsWithin5To8Seconds, false);
});

test('combines recovery runs without turning an interrupted run into a pass', () => {
  const identity = { steamBuild: '25507242', build: { strategyRevision: 'native-r2' }, provider: 'native-pro' };
  const first = { ...identity, ...cohort([match('a', 47)]), label: 'first', complete: false,
    interrupted: [{ id: 'b', reason: 'focus lost', placement: 40 }] };
  const second = { ...identity, ...cohort([match('c', 32, 102)]), label: 'resumed' };
  const result = summarize(combineCohorts([first, second]));
  assert.equal(result.completedMatches, 2); assert.equal(result.interruptedMatches, 1);
  assert.equal(result.complete, false); assert.equal(result.released, true);
  assert.equal(result.averagePlayerDamage, 51); assert.equal(first.results.length, 1);
  assert.throws(() => combineCohorts([first, { ...second, steamBuild: 'another' }]), /different/);
  assert.throws(() => combineCohorts([first, { ...second, provider: 'local' }]), /different/);
  assert.throws(() => combineCohorts([first, { ...second, build: { strategyRevision: 'other' } }]), /different/);
  assert.throws(() => combineCohorts([{ ...first, steamBuild: undefined }]), /identity/);
  assert.throws(() => combineCohorts([first, { ...second, results: [match('b', 1)] }]), /Overlapping/);
});
