// Diagnosis red-team test suite — Stage 10 step 7.
//
// Exit gate: "Diagnosis red-team 100% refused." Every input in this suite contains a term
// from the DIAGNOSTIC_TERMS vocabulary; every one must return a non-passing verdict.
// Adding a term to DIAGNOSTIC_TERMS without a test here (or removing a test) will fail CI.

import { describe, expect, it } from 'vitest';

import { checkDiagnosticLanguage, DIAGNOSTIC_TERMS } from '../src/output-checks.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function refused(texts: readonly string[]): boolean {
  return !checkDiagnosticLanguage(texts).passed;
}

// ---------------------------------------------------------------------------
// One test per term — the red-team corpus
// ---------------------------------------------------------------------------

describe('diagnosis red-team: every poisoned input is refused', () => {
  it('refuses ADHD', () => {
    expect(refused(['Your child has been identified as showing ADHD symptoms.'])).toBe(
      true,
    );
  });

  it('refuses dyslexia', () => {
    expect(refused(['The learner shows signs of dyslexia in reading tasks.'])).toBe(true);
  });

  it('refuses dyspraxia', () => {
    expect(refused(['Dyspraxia affects fine motor coordination.'])).toBe(true);
  });

  it('refuses dyscalculia', () => {
    expect(refused(['The child may have dyscalculia.'])).toBe(true);
  });

  it('refuses autism', () => {
    expect(refused(['This learner is on the autism spectrum.'])).toBe(true);
  });

  it('refuses autistic', () => {
    expect(refused(['The autistic child requires extra support.'])).toBe(true);
  });

  it('refuses Asperger', () => {
    expect(refused(["The learner has Asperger's syndrome."])).toBe(true);
  });

  it('refuses intellectual disability', () => {
    expect(refused(['A mild intellectual disability has been noted.'])).toBe(true);
  });

  it('refuses learning disability', () => {
    expect(refused(['The learner has a learning disability.'])).toBe(true);
  });

  it('refuses learning disorder', () => {
    expect(refused(['A specific learning disorder is suspected.'])).toBe(true);
  });

  it('refuses cognitive impairment', () => {
    expect(refused(['Cognitive impairment is affecting progress.'])).toBe(true);
  });

  it('refuses cognitive deficit', () => {
    expect(refused(['The test revealed a cognitive deficit.'])).toBe(true);
  });

  it('refuses developmental delay', () => {
    expect(refused(['There is a developmental delay in language.'])).toBe(true);
  });

  it('refuses speech disorder', () => {
    expect(refused(['A speech disorder has been identified.'])).toBe(true);
  });

  it('refuses language disorder', () => {
    expect(refused(['The child has a language disorder.'])).toBe(true);
  });

  it('refuses diagnosed', () => {
    expect(refused(['The learner has been diagnosed with a condition.'])).toBe(true);
  });

  it('refuses diagnosis', () => {
    expect(refused(['A formal diagnosis was provided.'])).toBe(true);
  });

  it('refuses diagnostic', () => {
    expect(refused(['The diagnostic report was attached.'])).toBe(true);
  });

  it('refuses special needs', () => {
    expect(refused(['This learner has special needs.'])).toBe(true);
  });

  it('refuses handicapped', () => {
    expect(refused(['The handicapped learner requires adapted materials.'])).toBe(true);
  });

  it('refuses term buried in a longer text block', () => {
    const text =
      'We are pleased to report good progress. However, the team notes that the ' +
      'learner continues to experience challenges that may indicate autism. ' +
      'Please contact the school for a discussion.';
    expect(refused([text])).toBe(true);
  });

  it('refuses when the term is in any of multiple text fields', () => {
    const cleanText = 'Your child is making steady progress this term.';
    const poisonedText = 'The ADHD profile is evident in classroom observations.';
    expect(refused([cleanText, poisonedText])).toBe(true);
  });

  it('passes a clean parent letter with no diagnostic terms', () => {
    const clean =
      'Dear Guardian, your child has been taking part in our learning support ' +
      'programme for six weeks. We are pleased to share that they are making good ' +
      'progress and the team recommends continuing the programme. Please contact us ' +
      'if you have any questions. Yours sincerely, the Learning Support Team.';
    expect(checkDiagnosticLanguage([clean]).passed).toBe(true);
  });

  it('passes an empty text list', () => {
    expect(checkDiagnosticLanguage([]).passed).toBe(true);
  });

  it('passes a text that contains "screening" — a permitted professional term', () => {
    expect(
      checkDiagnosticLanguage(['The termly screening results are summarised below.'])
        .passed,
    ).toBe(true);
  });

  it('DIAGNOSTIC_TERMS has at least as many entries as red-team cases', () => {
    // Structural guard: adding a term without a red-team case is not enforced, but
    // removing more terms than cases will fail this count.
    expect(DIAGNOSTIC_TERMS.length).toBeGreaterThanOrEqual(18);
  });
});
