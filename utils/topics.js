// Topic summary from video titles via frequency analysis + n-gram detection.
// Pure browser-side, no external dependencies.

const STOPWORDS = new Set([
  "the","a","an","and","or","but","is","are","was","were","be","being","been",
  "of","to","in","on","at","by","for","with","from","as","into","onto","upon",
  "this","that","these","those","it","its","they","them","their","there","here",
  "you","your","yours","we","our","ours","my","mine","i","me","he","she","his","her",
  "do","does","did","done","doing","have","has","had","having",
  "not","no","yes","so","very","just","than","then","also","too","more","most","much","many",
  "what","when","where","why","how","who","whom","whose","which",
  "if","else","while","until","because","since","about","over","under","again","ever","never",
  "all","any","some","every","each","both","few","other","another",
  "up","down","out","off","through","between","among","without","within",
  "vs","ft","feat","official","video","videos","new","latest","best","top","tutorial","tutorials",
  "ep","episode","episodes","part","parts","chapter","chapters","lesson","lessons","day","days",
  "intro","introduction","beginner","beginners","guide","tips","tricks",
  "youtube","watch","subscribe","like","share","comment","channel",
  "free","full","complete","series","season","update","updated","review","reviews",
  "vs.","feat.","ft.","|","-","–","—","_",
  "hd","4k","1080p","720p","2k","ultra"
]);

function tokenizeTitle(title) {
  if (!title) return [];
  return title
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, " ") // en/em dashes
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(t => t.length > 1 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function extractBigrams(tokens) {
  const grams = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    grams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return grams;
}

function extractTrigrams(tokens) {
  const grams = [];
  for (let i = 0; i < tokens.length - 2; i++) {
    grams.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }
  return grams;
}

export function summarizeTopics(titles, options = {}) {
  const maxTopics = options.maxTopics || 8;
  const wordCounts = new Map();
  const bigramCounts = new Map();
  const trigramCounts = new Map();

  for (const title of titles) {
    const tokens = tokenizeTitle(title);
    const seenWords = new Set();
    for (const t of tokens) {
      if (seenWords.has(t)) continue; // count each word once per title
      seenWords.add(t);
      wordCounts.set(t, (wordCounts.get(t) || 0) + 1);
    }
    for (const bg of extractBigrams(tokens)) {
      bigramCounts.set(bg, (bigramCounts.get(bg) || 0) + 1);
    }
    for (const tg of extractTrigrams(tokens)) {
      trigramCounts.set(tg, (trigramCounts.get(tg) || 0) + 1);
    }
  }

  const totalTitles = titles.length || 1;

  const sortedBigrams = [...bigramCounts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1]);
  const sortedTrigrams = [...trigramCounts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1]);
  const sortedWords = [...wordCounts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1]);

  // Build topics: prefer multi-word phrases over single words they contain.
  const topics = [];
  const used = new Set();

  for (const [phrase, count] of sortedTrigrams) {
    if (topics.length >= maxTopics) break;
    topics.push({ topic: phrase, count, coverage: +((count / totalTitles) * 100).toFixed(1) });
    phrase.split(" ").forEach(w => used.add(w));
  }
  for (const [phrase, count] of sortedBigrams) {
    if (topics.length >= maxTopics) break;
    const parts = phrase.split(" ");
    // Skip if this bigram is fully a substring of an already-added trigram topic.
    if (topics.some(t => t.topic.includes(phrase))) continue;
    topics.push({ topic: phrase, count, coverage: +((count / totalTitles) * 100).toFixed(1) });
    parts.forEach(w => used.add(w));
  }
  for (const [word, count] of sortedWords) {
    if (topics.length >= maxTopics) break;
    if (used.has(word)) continue;
    topics.push({ topic: word, count, coverage: +((count / totalTitles) * 100).toFixed(1) });
    used.add(word);
  }

  // Capitalize first letter of each word for display.
  for (const t of topics) {
    t.topic = t.topic.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
  }

  return {
    topics,
    keywordCount: wordCounts.size,
    titleCount: titles.length
  };
}
