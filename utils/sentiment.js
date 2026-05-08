// Lightweight lexicon-based sentiment analyzer.
// Inspired by AFINN-165 / VADER. Scores: positive (>0.05), negative (<-0.05), neutral.
// Pure browser-side, no network calls, no external dependencies.

const POSITIVE = {
  amazing: 3, awesome: 3, beautiful: 3, best: 3, brilliant: 3, excellent: 3,
  fantastic: 3, fabulous: 3, great: 2, good: 2, nice: 2, lovely: 2, perfect: 3,
  wonderful: 3, outstanding: 3, superb: 3, splendid: 3, marvelous: 3, magnificent: 3,
  helpful: 2, useful: 2, clear: 2, concise: 2, informative: 2, insightful: 2,
  enjoyable: 2, fun: 2, funny: 2, hilarious: 3, entertaining: 2, engaging: 2,
  inspiring: 3, motivating: 2, empowering: 2, encouraging: 2, refreshing: 2,
  love: 3, loved: 3, like: 1, liked: 1, enjoy: 2, enjoyed: 2, recommend: 2, recommended: 2,
  thanks: 2, thank: 2, thankful: 2, grateful: 2, appreciate: 2, appreciated: 2,
  praise: 2, praises: 2, praising: 2, kudos: 2, bravo: 3, applause: 2,
  pleased: 2, happy: 2, glad: 2, joy: 2, joyful: 2, delight: 2, delighted: 3,
  satisfied: 2, content: 1, peaceful: 2, calm: 1, relaxed: 1, comforting: 2,
  smart: 2, clever: 2, genius: 3, intelligent: 2, talented: 2, skilled: 2, expert: 2,
  professional: 2, polished: 2, quality: 2, premium: 2, top: 2, ace: 2,
  effective: 2, efficient: 2, productive: 2, fast: 1, smooth: 2, seamless: 2, easy: 1,
  win: 2, winning: 2, winner: 2, success: 3, successful: 3, achievement: 2, accomplished: 2,
  flawless: 3, masterpiece: 3, gem: 3, treasure: 3, gold: 2, golden: 2,
  cool: 2, dope: 2, sick: 2, lit: 2, fire: 2, banger: 3, slay: 2, vibes: 1,
  underrated: 2, deserves: 1, deserved: 1, worth: 2, worthy: 2, valuable: 2,
  yes: 1, yeah: 1, yep: 1, yay: 2, woohoo: 3, wow: 2,
  pro: 1, true: 1, truly: 1, real: 1, legit: 2, solid: 2, strong: 2,
  loving: 2, adore: 3, adored: 3, hooked: 2, addicted: 1, obsessed: 2,
  smile: 2, smiling: 2, laugh: 2, laughing: 2, laughs: 2, chuckle: 2,
  agree: 2, agreed: 2, correct: 2, right: 1, accurate: 2, precise: 2,
  clean: 1, neat: 1, nicely: 2, well: 1, finally: 1, blessed: 2,
  improve: 1, improved: 2, improvement: 2, better: 2, upgrade: 1, upgraded: 1
};

const NEGATIVE = {
  awful: -3, terrible: -3, horrible: -3, horrendous: -3, atrocious: -3, dreadful: -3,
  bad: -2, poor: -2, worst: -3, worse: -2, weak: -2, lame: -2, lousy: -2, mediocre: -1,
  boring: -2, dull: -2, tedious: -2, slow: -1, dragging: -1, bland: -2, generic: -1,
  hate: -3, hated: -3, hating: -3, dislike: -2, disliked: -2, despise: -3,
  trash: -3, garbage: -3, crap: -2, rubbish: -2, junk: -2, shit: -3, suck: -2, sucks: -3, sucked: -2,
  annoying: -2, irritating: -2, frustrating: -2, frustrated: -2, infuriating: -3,
  confusing: -2, unclear: -2, vague: -1, misleading: -2, deceptive: -2, fake: -2, scam: -3,
  wrong: -2, incorrect: -2, inaccurate: -2, false: -2, lie: -2, lies: -2, lying: -2,
  broken: -2, buggy: -2, glitchy: -2, laggy: -2, slow: -1, crashes: -2, broken: -2,
  disappointing: -3, disappointed: -3, letdown: -3, underwhelming: -2,
  ugly: -2, gross: -2, disgusting: -3, nasty: -2, vile: -3, repulsive: -3, revolting: -3,
  difficult: -1, hard: -1, painful: -2, painfully: -2, struggle: -1, struggling: -1,
  stupid: -2, dumb: -2, idiotic: -3, ridiculous: -2, absurd: -2, nonsense: -2, nonsensical: -2,
  cringe: -2, cringy: -2, cringey: -2, awkward: -1, weird: -1, strange: -1,
  cliche: -1, predictable: -1, generic: -1, repetitive: -1, boring: -2,
  overrated: -2, oversold: -2, hype: -1, clickbait: -3,
  spam: -3, spammy: -3, ad: -1, ads: -1, advertisement: -1, sponsored: -1,
  fail: -2, failed: -2, failure: -2, flop: -2, flopped: -2,
  angry: -2, mad: -2, furious: -3, upset: -2, sad: -2, depressed: -2, depressing: -2,
  no: -1, nope: -1, nah: -1, never: -1,
  toxic: -3, abusive: -3, hateful: -3, racist: -3, sexist: -3, offensive: -2,
  worst: -3, useless: -3, pointless: -2, meaningless: -2, waste: -2, wasted: -2, wasting: -2,
  ugh: -2, meh: -1, ew: -2, yikes: -2, oof: -1,
  unwatchable: -3, unbearable: -3, intolerable: -3, insufferable: -3,
  shallow: -2, superficial: -2, lazy: -2, sloppy: -2, careless: -2,
  expensive: -1, overpriced: -2, ripoff: -3, rip: -1
};

const NEGATIONS = new Set([
  "not", "no", "never", "none", "nobody", "nothing", "nowhere", "neither",
  "cannot", "cant", "can't", "won't", "wont", "don't", "dont", "didn't", "didnt",
  "doesn't", "doesnt", "isn't", "isnt", "wasn't", "wasnt", "aren't", "arent",
  "weren't", "werent", "ain't", "aint", "shouldn't", "shouldnt", "wouldn't", "wouldnt",
  "couldn't", "couldnt", "hardly", "barely"
]);

const INTENSIFIERS = {
  very: 1.3, really: 1.3, extremely: 1.5, super: 1.3, totally: 1.3, absolutely: 1.5,
  completely: 1.4, utterly: 1.5, incredibly: 1.5, insanely: 1.5, ridiculously: 1.4,
  remarkably: 1.3, exceptionally: 1.4, particularly: 1.2, especially: 1.2, so: 1.2,
  too: 1.2, quite: 1.15, rather: 1.1, fairly: 1.05, pretty: 1.1
};

const DIMINISHERS = {
  slightly: 0.7, somewhat: 0.7, kinda: 0.8, sortof: 0.7, "sort": 0.85,
  little: 0.8, bit: 0.85, barely: 0.5, hardly: 0.5, scarcely: 0.5, marginally: 0.6
};

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")            // strip HTML tags from API responses
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/([!?])/g, " $1 ")          // separate ! and ? as their own tokens
    .replace(/[^a-z0-9'\s!?]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function scoreText(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return { score: 0, label: "neutral", positive: 0, negative: 0, hits: [] };

  let total = 0;
  let positive = 0;
  let negative = 0;
  const hits = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    let baseScore = POSITIVE[t] !== undefined ? POSITIVE[t]
                  : NEGATIVE[t] !== undefined ? NEGATIVE[t]
                  : 0;
    if (baseScore === 0) continue;

    let multiplier = 1;
    // Look back up to 2 tokens for negation/intensifier/diminisher.
    for (let j = 1; j <= 2 && i - j >= 0; j++) {
      const prev = tokens[i - j];
      if (NEGATIONS.has(prev)) { multiplier *= -0.85; break; }
      if (INTENSIFIERS[prev] !== undefined) multiplier *= INTENSIFIERS[prev];
      if (DIMINISHERS[prev] !== undefined) multiplier *= DIMINISHERS[prev];
    }

    // Exclamation marks amplify slightly.
    const next = tokens[i + 1] || "";
    if (next === "!" || /!+$/.test(t)) multiplier *= 1.15;

    const finalScore = baseScore * multiplier;
    total += finalScore;
    if (finalScore > 0) positive += finalScore;
    else negative += Math.abs(finalScore);
    hits.push({ word: t, score: finalScore });
  }

  // Normalize roughly to [-1, 1] using soft saturation similar to VADER.
  const normalized = total / Math.sqrt((total * total) + 15);
  let label = "neutral";
  if (normalized >= 0.05) label = "positive";
  else if (normalized <= -0.05) label = "negative";

  return { score: +normalized.toFixed(3), label, positive, negative, hits };
}

// Analyze an array of comment strings. Yields control via setTimeout(0)
// every `chunkSize` items so the popup UI stays responsive.
export function analyzeBatch(comments, chunkSize = 25, onProgress) {
  return new Promise(resolve => {
    const results = [];
    let i = 0;

    function step() {
      const end = Math.min(i + chunkSize, comments.length);
      for (; i < end; i++) {
        results.push(scoreText(comments[i]));
      }
      if (typeof onProgress === "function") {
        onProgress({ done: i, total: comments.length });
      }
      if (i < comments.length) {
        setTimeout(step, 0);
      } else {
        resolve(summarize(results, comments));
      }
    }
    if (comments.length === 0) resolve(summarize([], []));
    else step();
  });
}

function summarize(results, originalTexts) {
  const total = results.length;
  if (total === 0) {
    return {
      total: 0, positive: 0, neutral: 0, negative: 0,
      positivePct: 0, neutralPct: 0, negativePct: 0,
      averageScore: 0, overall: "neutral",
      topPositiveWords: [], topNegativeWords: []
    };
  }

  let pos = 0, neu = 0, neg = 0, sum = 0;
  const posWords = new Map();
  const negWords = new Map();

  for (const r of results) {
    if (r.label === "positive") pos++;
    else if (r.label === "negative") neg++;
    else neu++;
    sum += r.score;
    for (const h of r.hits) {
      if (h.score > 0) posWords.set(h.word, (posWords.get(h.word) || 0) + 1);
      else if (h.score < 0) negWords.set(h.word, (negWords.get(h.word) || 0) + 1);
    }
  }

  const avg = sum / total;
  let overall = "neutral";
  if (avg >= 0.05) overall = "positive";
  else if (avg <= -0.05) overall = "negative";

  const topN = (m, n = 8) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([word, count]) => ({ word, count }));

  return {
    total,
    positive: pos,
    neutral: neu,
    negative: neg,
    positivePct: +((pos / total) * 100).toFixed(1),
    neutralPct: +((neu / total) * 100).toFixed(1),
    negativePct: +((neg / total) * 100).toFixed(1),
    averageScore: +avg.toFixed(3),
    overall,
    topPositiveWords: topN(posWords),
    topNegativeWords: topN(negWords)
  };
}
