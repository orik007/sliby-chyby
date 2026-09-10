export function calculateSlavaIndex(scores: number[]): number | null {
  if (scores.length === 0) return null;

  const sum = scores.reduce((total, score) => total + score, 0);
  return Math.round((sum / (2 * scores.length)) * 100);
}
