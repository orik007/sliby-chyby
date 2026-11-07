export function calculateSlavaIndex(scores: number[]): number | null {
  if (scores.length === 0) return null;

  const sum = scores.reduce((total, score) => total + score, 0);
  return Math.round((sum / (2 * scores.length)) * 100);
}

/**
 * The index's positive and negative parts: the promises' positive scores and
 * their negative scores, each on the index's own scale (docs/slava-index.md).
 */
export function calculateSlavaIndexParts(scores: number[]): { positive: number; negative: number } | null {
  if (scores.length === 0) return null;
  const scale = (sum: number) => Math.round((sum / (2 * scores.length)) * 100) || 0;
  return {
    positive: scale(scores.filter((score) => score > 0).reduce((total, score) => total + score, 0)),
    negative: scale(scores.filter((score) => score < 0).reduce((total, score) => total + score, 0)),
  };
}
