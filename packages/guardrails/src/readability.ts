// Readability scoring — Stage 06 step 6.
//
// "readability check" (the manual's own output-checks bullet). The Flesch-Kincaid Grade
// Level is the one readability formula this file implements for real: a well-published,
// deterministic arithmetic formula (words per sentence, syllables per word), not a model
// call — the same "a real, computable metric rather than an invented one" bar the token
// estimate in `packages/brain/src/retrieval-assembly.ts` already sets for a placeholder
// that still has to be honest about what it measures.
//
// Syllable counting is a heuristic (vowel-group counting with the common English
// exceptions), the same kind of approximation the token estimate already is: exact
// syllabification needs a pronouncing dictionary this stage has no reason to add, and nothing
// downstream depends on the count being exact — only on the grade estimate being in the
// right neighbourhood, which the standard heuristic already gets right for ordinary prose.

export interface ReadabilityResult {
  readonly gradeLevel: number;
  readonly words: number;
  readonly sentences: number;
  readonly syllables: number;
}

const VOWEL_GROUPS = /[aeiouy]+/gi;
const SILENT_TRAILING_E = /e$/i;
const SENTENCE_BOUNDARY = /[.!?]+(?:\s|$)/g;
const WORD_BOUNDARY = /[^a-zA-Z']+/;

function countSyllables(word: string): number {
  const lower = word.toLowerCase();
  const groups = lower.match(VOWEL_GROUPS);
  let count = groups === null ? 0 : groups.length;
  if (SILENT_TRAILING_E.test(lower) && count > 1) count -= 1;
  return Math.max(count, 1);
}

/**
 * Scores `text` with the Flesch-Kincaid Grade Level formula:
 * `0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59`.
 * Empty or whitespace-only text scores as zero words/sentences/syllables and a grade level
 * of 0 — there is nothing to be unreadable about.
 */
export function scoreReadability(text: string): ReadabilityResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { gradeLevel: 0, words: 0, sentences: 0, syllables: 0 };
  }

  const words = trimmed.split(WORD_BOUNDARY).filter((word) => word.length > 0);
  const sentenceMatches = trimmed.match(SENTENCE_BOUNDARY);
  // A final sentence with no closing punctuation still counts as one sentence.
  const sentences = Math.max(sentenceMatches === null ? 1 : sentenceMatches.length, 1);
  const syllables = words.reduce((total, word) => total + countSyllables(word), 0);

  if (words.length === 0) {
    return { gradeLevel: 0, words: 0, sentences: 0, syllables: 0 };
  }

  const gradeLevel =
    0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;

  return { gradeLevel, words: words.length, sentences, syllables };
}
