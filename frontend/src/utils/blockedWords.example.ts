// Blocked words for nickname validation - EXAMPLE
// Copy this file to blockedWords.ts and add your own words:
//   cp blockedWords.example.ts blockedWords.ts
// Matching: lowercase nickname includes any blocked word (substring match)

const BLOCKED_WORDS: string[] = [
  // Add your blocked words here, e.g.:
  // "word1", "word2",
];

export function containsBlockedWord(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((w) => lower.includes(w));
}
