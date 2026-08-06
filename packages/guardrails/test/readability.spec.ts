// Flesch-Kincaid grade-level scoring — Stage 06 step 6.

import { describe, expect, it } from 'vitest';

import { scoreReadability } from '../src/readability.js';

describe('scoreReadability', () => {
  it('scores empty or whitespace-only text as zero, with nothing to be unreadable about', () => {
    expect(scoreReadability('')).toEqual({
      gradeLevel: 0,
      words: 0,
      sentences: 0,
      syllables: 0,
    });
    expect(scoreReadability('   \n\t  ')).toEqual({
      gradeLevel: 0,
      words: 0,
      sentences: 0,
      syllables: 0,
    });
  });

  it('scores short, simple sentences at a low grade level', () => {
    const result = scoreReadability('The cat sat on the mat. The dog ran.');
    expect(result.sentences).toBe(2);
    expect(result.words).toBeGreaterThan(0);
    expect(result.gradeLevel).toBeLessThan(5);
  });

  it('scores long, complex sentences at a higher grade level than simple ones', () => {
    const simple = scoreReadability('The cat sat. The dog ran. I like cats.');
    const complex = scoreReadability(
      'The extraordinarily sophisticated methodology employed by the interdisciplinary ' +
        'research consortium necessitated a comprehensive reevaluation of the ' +
        'organisation’s previously established administrative frameworks.',
    );
    expect(complex.gradeLevel).toBeGreaterThan(simple.gradeLevel);
  });

  it('treats a final sentence with no closing punctuation as one sentence', () => {
    const result = scoreReadability('This has no closing punctuation at all');
    expect(result.sentences).toBe(1);
  });

  it('counts at least one syllable per real word', () => {
    const result = scoreReadability('I saw a cat.');
    expect(result.syllables).toBeGreaterThanOrEqual(result.words);
  });
});
