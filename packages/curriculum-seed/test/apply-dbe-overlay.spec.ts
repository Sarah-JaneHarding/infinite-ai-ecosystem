import { describe, it, expect } from 'vitest';
import { applyDbeOverlay } from '../src/apply-dbe-overlay.js';
import type { GradeFramework } from '../src/apply-dbe-overlay.js';

function makeFramework(grade: string, subjectNames: string[]): GradeFramework {
  return {
    grade,
    subjects: subjectNames.map((name) => ({ name })),
  };
}

describe('applyDbeOverlay', () => {
  it('populates hoursPerWeek, assessmentWeighting and totalHoursPerWeek for Grade 4', () => {
    const fw = makeFramework('Grade 4', [
      'English Home Language',
      'Mathematics',
      'Life Skills',
    ]);
    const [enriched, report] = applyDbeOverlay(fw);

    expect(report.isComplete).toBe(true);
    expect(report.phase).toBe('INTERMEDIATE');
    expect(report.totalHoursPerWeek).toBe(27.5);
    expect(report.assessmentWeighting).toEqual({ sba: 80, exam: 20 });
    expect(enriched.totalHoursPerWeek).toBe(27.5);

    const maths = enriched.subjects.find((s) => s.name === 'Mathematics');
    expect(maths?.hoursPerWeek).toBe(6);
    expect(maths?.assessmentWeighting).toEqual({ sba: 80, exam: 20 });
  });

  it('applies Foundation Phase 100% SBA for Grade 2', () => {
    const fw = makeFramework('Grade 2', ['Home Language', 'Mathematics']);
    const [, report] = applyDbeOverlay(fw);

    expect(report.isComplete).toBe(true);
    expect(report.phase).toBe('FOUNDATION');
    expect(report.totalHoursPerWeek).toBe(23);
    expect(report.assessmentWeighting).toEqual({ sba: 100, exam: 0 });
  });

  it('applies Grade 3 totals (25h: FAL=5, LS=7)', () => {
    const fw = makeFramework('Grade 3', [
      'Home Language',
      'First Additional Language',
      'Mathematics',
      'Life Skills',
    ]);
    const [, report] = applyDbeOverlay(fw);

    expect(report.isComplete).toBe(true);
    expect(report.totalHoursPerWeek).toBe(25);
    expect(
      report.mappedSubjects.find((m) => m.name === 'First Additional Language')
        ?.hoursPerWeek,
    ).toBe(5);
    expect(
      report.mappedSubjects.find((m) => m.name === 'Life Skills')?.hoursPerWeek,
    ).toBe(7);
  });

  it('applies Senior Phase 60/40 weighting and split NS/Technology for Grade 8', () => {
    const fw = makeFramework('Grade 8', [
      'Natural Sciences',
      'Technology',
      'Life Orientation',
    ]);
    const [, report] = applyDbeOverlay(fw);

    expect(report.isComplete).toBe(true);
    expect(report.phase).toBe('SENIOR');
    expect(report.assessmentWeighting).toEqual({ sba: 60, exam: 40 });
    expect(
      report.mappedSubjects.find((m) => m.name === 'Natural Sciences')?.hoursPerWeek,
    ).toBe(3);
    expect(report.mappedSubjects.find((m) => m.name === 'Technology')?.hoursPerWeek).toBe(
      2,
    );
  });

  it('maps combined NST in Grade 6', () => {
    const fw = makeFramework('Grade 6', ['Natural Sciences and Technology']);
    const [, report] = applyDbeOverlay(fw);

    expect(report.isComplete).toBe(true);
    expect(report.mappedSubjects[0]?.hoursPerWeek).toBe(3.5);
  });

  it('treats a combined-NST subject name in Grade 7 as unmapped — split phase, honest gap', () => {
    const fw = makeFramework('Grade 7', ['Natural Sciences and Technology']);
    const [, report] = applyDbeOverlay(fw);

    expect(report.isComplete).toBe(false);
    expect(report.unmappedSubjects).toEqual(['Natural Sciences and Technology']);
  });

  it('treats Life Orientation in Foundation Phase as unmapped — valid category, absent table entry', () => {
    const fw = makeFramework('Grade 2', ['Life Orientation']);
    const [, report] = applyDbeOverlay(fw);

    expect(report.isComplete).toBe(false);
    expect(report.unmappedSubjects).toEqual(['Life Orientation']);
  });

  it('reports an unmapped subject and sets isComplete=false', () => {
    const fw = makeFramework('Grade 5', ['Mathematics', 'Quantum Basket Weaving']);
    const [, report] = applyDbeOverlay(fw);

    expect(report.isComplete).toBe(false);
    expect(report.unmappedSubjects).toEqual(['Quantum Basket Weaving']);
    expect(report.mappedSubjects.map((m) => m.name)).toEqual(['Mathematics']);
  });

  it('treats FET grades as unmapped — honest gap, not a guess', () => {
    const fw = makeFramework('Grade 11', ['Mathematics']);
    const [, report] = applyDbeOverlay(fw);

    expect(report.isComplete).toBe(false);
    expect(report.phase).toBe('UNMAPPED');
    expect(report.mappedSubjects).toHaveLength(0);
  });

  it('treats an unrecognised grade string as UNKNOWN', () => {
    const fw = makeFramework('Year Seven', ['Mathematics']);
    const [, report] = applyDbeOverlay(fw);

    expect(report.isComplete).toBe(false);
    expect(report.phase).toBe('UNKNOWN');
    expect(report.grade).toBe(-1);
  });

  it('parses "Grade R" as grade 0', () => {
    const fw = makeFramework('Grade R', ['Home Language', 'Life Skills']);
    const [, report] = applyDbeOverlay(fw);

    expect(report.isComplete).toBe(true);
    expect(report.grade).toBe(0);
    expect(report.phase).toBe('FOUNDATION');
  });
});
