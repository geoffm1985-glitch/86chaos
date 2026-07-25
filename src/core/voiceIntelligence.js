const KITCHEN_SYNONYMS = {
  onions: ['onion', 'diced onion', 'dice onion', 'chopped onion', 'chop onion'],
  onion: ['onions', 'diced onions', 'dice onions', 'chopped onions', 'chop onions'],
  tomatoes: ['tomato', 'slice tomato', 'sliced tomato', 'sliced tomatoes'],
  tomato: ['tomatoes', 'slice tomatoes', 'sliced tomatoes'],
  ranch: ['ranch bottles', 'fill ranch', 'fill ranch bottles', 'ranch cups'],
  burgers: ['burger patties', 'portion burgers', 'burger patty', 'patties'],
  burger: ['burger patties', 'portion burgers', 'burger patty', 'patty'],
  fryer: ['fryers', 'fryer wall', 'behind fryers', 'fryer floor'],
  fryers: ['fryer', 'fryer wall', 'behind fryer', 'fryer floor'],
  hood: ['hood filters', 'hood oil pan', 'oil pan'],
  chicken: ['chicken breast', 'chicken breasts'],
  ribeye: ['rib eye', 'ribeyes'],
  brioche: ['brioche bun', 'brioche buns']
};

export const normalizeVoicePhrase = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const singularizeVoiceWord = (value = '') => String(value || '')
  .replace(/\b([a-z]{4,})ies\b/g, '$1y')
  .replace(/\b([a-z]{4,})es\b/g, '$1')
  .replace(/\b([a-z]{4,})s\b/g, '$1')
  .trim();

const tokens = (value = '') => singularizeVoiceWord(normalizeVoicePhrase(value)).split(' ').filter(w => w.length > 1);

const levenshtein = (a = '', b = '') => {
  const aa = String(a || '');
  const bb = String(b || '');
  if (aa === bb) return 0;
  if (!aa) return bb.length;
  if (!bb) return aa.length;
  const prev = Array.from({ length: bb.length + 1 }, (_, idx) => idx);
  const curr = Array.from({ length: bb.length + 1 }, () => 0);
  for (let i = 1; i <= aa.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= bb.length; j += 1) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= bb.length; j += 1) prev[j] = curr[j];
  }
  return prev[bb.length];
};

export const expandKitchenSynonyms = (value = '') => {
  const base = normalizeVoicePhrase(value);
  const found = new Set([base]);
  Object.entries(KITCHEN_SYNONYMS).forEach(([key, aliases]) => {
    if (new RegExp(`\\b${key}\\b`).test(base)) aliases.forEach(alias => found.add(normalizeVoicePhrase(base.replace(new RegExp(`\\b${key}\\b`, 'g'), alias))));
  });
  return Array.from(found).filter(Boolean);
};

export const getVoiceMatchScore = (spoken = '', candidate = '', aliases = []) => {
  const spokenOptions = expandKitchenSynonyms(spoken);
  const candidateOptions = [candidate, ...(aliases || [])].flatMap(expandKitchenSynonyms);
  let best = 0;
  spokenOptions.forEach(spokenText => {
    candidateOptions.forEach(candidateText => {
      const q = singularizeVoiceWord(normalizeVoicePhrase(spokenText));
      const name = singularizeVoiceWord(normalizeVoicePhrase(candidateText));
      if (!q || !name) return;
      let score = 0;
      if (q === name) score += 180;
      if (name.includes(q) || q.includes(name)) score += 95;
      const qTokens = tokens(q);
      const nTokens = tokens(name);
      const exactHits = qTokens.filter(token => nTokens.includes(token)).length;
      const partialHits = qTokens.filter(token => !nTokens.includes(token) && nTokens.some(other => other.includes(token) || token.includes(other))).length;
      score += exactHits * 28;
      score += partialHits * 14;
      if (qTokens.length && exactHits === qTokens.length) score += 42;
      if (nTokens.length && exactHits === nTokens.length) score += 16;
      const maxLen = Math.max(q.length, name.length, 1);
      const editRatio = 1 - (levenshtein(q, name) / maxLen);
      if (editRatio >= 0.9) score += 50;
      else if (editRatio >= 0.8) score += 30;
      else if (editRatio >= 0.72) score += 16;
      best = Math.max(best, Math.round(score));
    });
  });
  return best;
};

export const rankVoiceMatches = (items = [], spoken = '', getLabel = item => item?.name || item?.title || item?.text || '', getAliases = item => item?.aliases || []) => {
  return (items || [])
    .map(item => {
      const label = getLabel(item) || '';
      const aliases = getAliases(item) || [];
      const score = getVoiceMatchScore(spoken, label, Array.isArray(aliases) ? aliases : [aliases]);
      return { item, label, score };
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score);
};

export const resolveVoiceMatch = (items = [], spoken = '', options = {}) => {
  const ranked = rankVoiceMatches(items, spoken, options.getLabel, options.getAliases).filter(row => row.score >= (options.minScore || 40));
  const top = ranked[0] || null;
  const second = ranked[1] || null;
  const highThreshold = options.highThreshold || 92;
  const margin = top && second ? top.score - second.score : top ? top.score : 0;
  return {
    top,
    alternatives: ranked.slice(0, options.limit || 5),
    confidence: top?.score || 0,
    isHighConfidence: Boolean(top && top.score >= highThreshold && (!second || margin >= (options.margin || 18))),
    isAmbiguous: Boolean(top && second && margin < (options.margin || 18))
  };
};
