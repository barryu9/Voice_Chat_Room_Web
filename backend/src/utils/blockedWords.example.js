// Blocked words for nickname validation - EXAMPLE
// Copy this file to blockedWords.js and add your own words:
//   cp blockedWords.example.js blockedWords.js
// Matching: lowercase nickname includes any blocked word (substring match)

const BLOCKED_WORDS = [
  // Add your blocked words here, e.g.:
  // "word1", "word2",
];

function containsBlockedWord(text) {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((w) => lower.includes(w));
}

module.exports = { containsBlockedWord };
