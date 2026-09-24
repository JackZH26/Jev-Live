// Summarize one frozen Steam cohort. Never merge different builds or drop losses.
const fs = require('node:fs');
const path = require('node:path');

function wilson(successes, total) {
  if (!total) return null;
  const z = 1.959963984540054, p = successes / total, denominator = 1 + z * z / total;
  const centre = (p + z * z / (2 * total)) / denominator;
  const radius = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator;
  return [Math.max(0, centre - radius), Math.min(1, centre + radius)];
}

function summarize(source) {
  const results = source.results;
  if (!Array.isArray(results) || !Array.isArray(source.interrupted)) throw Error('Missing evaluation records');
  const ids = new Set();
  for (const r of results) {
    if (!r.id || ids.has(r.id)) throw Error('Missing or duplicate match ID');
    ids.add(r.id);
    if (!r.finished || !r.eligible || !Number.isInteger(r.placement) || r.placement < 1 || r.placement > 50
      || typeof r.won !== 'boolean' || r.won !== (r.placement === 1)
      || !Number.isInteger(r.kills) || r.kills < 0 || !Number.isFinite(r.damage) || r.damage < 0
      || !Number.isFinite(r.durationSeconds) || r.durationSeconds < 0) throw Error('Invalid formal result: ' + r.id);
  }
  const n = results.length, ranks = results.map(r => r.placement).sort((a, b) => a - b);
  const wins = results.filter(r => r.won).length, topTen = results.filter(r => r.placement <= 10).length;
  const total = key => results.reduce((s, r) => s + (r[key] ?? 0), 0);
  const avg = key => n ? total(key) / n : null;
  const waits = (source.lobbyDelays ?? []).filter(x => x.afterResult && Number.isFinite(x.waitSeconds));
  const nativeSamples = total('nativeSamples'), playingSamples = total('playingSamples');
  return {
    label: source.label, steamBuild: source.steamBuild, strategy: source.build?.strategyRevision,
    provider: source.provider, complete: source.complete === true, released: source.released === true,
    completedMatches: n, interruptedMatches: source.interrupted.length,
    wins, winRate: n ? wins / n : null, winRateWilson95: wilson(wins, n),
    topTen, topTenRate: n ? topTen / n : null, topTenRateWilson95: wilson(topTen, n),
    bestPlacement: n ? ranks[0] : null,
    medianPlacement: n ? (ranks[Math.floor((n - 1) / 2)] + ranks[Math.floor(n / 2)]) / 2 : null,
    playerKills: total('kills'), averagePlayerKills: avg('kills'), averagePlayerDamage: avg('damage'),
    averageSurvivalSeconds: avg('durationSeconds'),
    shots: results.every(r => Number.isFinite(r.shots)) && n ? total('shots') : null,
    nativeSampleFraction: playingSamples ? nativeSamples / playingSamples : null,
    postResultLobbyWaits: waits.map(x => x.waitSeconds),
    lobbyWaitsWithin5To8Seconds: waits.length ? waits.every(x => x.waitSeconds >= 5 && x.waitSeconds <= 8.25) : null,
    caveats: ['Random maps and encounters; intervals assume independent matches and are descriptive, not proof of improvement.',
      'Interrupted runs are listed separately; every valid completed loss is included.',
      'Mechanical engagement frames are not kills. Low-motion samples are not proof of a navigation stall.',
      'Lobby measurement allows 250 ms sampling tolerance; loading is excluded. Missing measurements stay unknown.']
  };
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw Error('Usage: node scripts/summarize-steam-evaluation.cjs <summary.json>');
    const file = path.resolve(process.argv[2]);
    const summary = summarize(JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')));
    console.log(JSON.stringify(summary, null, 2));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { summarize, wilson };
