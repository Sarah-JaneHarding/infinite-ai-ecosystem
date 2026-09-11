import { describe, it, expect } from 'vitest';
import {
  DBE_ALLOCATIONS,
  getDbeAllocation,
  getDbeAllocationsByPhase,
  assertRegistryIntegrity,
} from '../../src/curriculum/dbe-allocations.js';

describe('DBE Allocation Registry', () => {
  it('assertRegistryIntegrity() does not throw', () => {
    expect(() => assertRegistryIntegrity()).not.toThrow();
  });

  it('covers all GET grades (R through 9)', () => {
    for (let g = 0; g <= 9; g++) {
      expect(getDbeAllocation(g)).toBeDefined();
    }
  });

  it('returns undefined for FET grades (10-12)', () => {
    for (let g = 10; g <= 12; g++) {
      expect(getDbeAllocation(g)).toBeUndefined();
    }
  });

  describe('Foundation Phase (Grades R-3)', () => {
    it.each([0, 1, 2])('Grade %i: HL=6, FAL=4, Maths=7, LS=6, total=23', (grade) => {
      const alloc = getDbeAllocation(grade)!;
      expect(alloc.phase).toBe('FOUNDATION');
      expect(alloc.totalHoursPerWeek).toBe(23);
      const byCategory = Object.fromEntries(
        alloc.timeAllocations.map((t) => [t.category, t.hoursPerWeek]),
      );
      expect(byCategory.HOME_LANGUAGE).toBe(6);
      expect(byCategory.FIRST_ADDITIONAL_LANGUAGE).toBe(4);
      expect(byCategory.MATHEMATICS).toBe(7);
      expect(byCategory.LIFE_SKILLS).toBe(6);
    });

    it('Grade 3: HL=6, FAL=5, Maths=7, LS=7, total=25', () => {
      const alloc = getDbeAllocation(3)!;
      expect(alloc.totalHoursPerWeek).toBe(25);
      const byCategory = Object.fromEntries(
        alloc.timeAllocations.map((t) => [t.category, t.hoursPerWeek]),
      );
      expect(byCategory.HOME_LANGUAGE).toBe(6);
      expect(byCategory.FIRST_ADDITIONAL_LANGUAGE).toBe(5);
      expect(byCategory.MATHEMATICS).toBe(7);
      expect(byCategory.LIFE_SKILLS).toBe(7);
    });

    it('100% SBA, 0% exam', () => {
      for (let g = 0; g <= 3; g++) {
        expect(getDbeAllocation(g)!.assessmentWeighting).toEqual({ sba: 100, exam: 0 });
      }
    });
  });

  describe('Intermediate Phase (Grades 4-6)', () => {
    it.each([4, 5, 6])('Grade %i: total=27.5, 6 subjects', (grade) => {
      const alloc = getDbeAllocation(grade)!;
      expect(alloc.phase).toBe('INTERMEDIATE');
      expect(alloc.totalHoursPerWeek).toBe(27.5);
      const byCategory = Object.fromEntries(
        alloc.timeAllocations.map((t) => [t.category, t.hoursPerWeek]),
      );
      expect(byCategory.HOME_LANGUAGE).toBe(6);
      expect(byCategory.FIRST_ADDITIONAL_LANGUAGE).toBe(5);
      expect(byCategory.MATHEMATICS).toBe(6);
      expect(byCategory.NATURAL_SCIENCES_AND_TECHNOLOGY).toBe(3.5);
      expect(byCategory.SOCIAL_SCIENCES).toBe(3);
      expect(byCategory.LIFE_SKILLS).toBe(4);
    });

    it('80% SBA, 20% exam (Circular S8/2023)', () => {
      for (let g = 4; g <= 6; g++) {
        expect(getDbeAllocation(g)!.assessmentWeighting).toEqual({ sba: 80, exam: 20 });
      }
    });
  });

  describe('Senior Phase (Grades 7-9)', () => {
    it.each([7, 8, 9])('Grade %i: 9 subjects, total=27.5', (grade) => {
      const alloc = getDbeAllocation(grade)!;
      expect(alloc.phase).toBe('SENIOR');
      expect(alloc.totalHoursPerWeek).toBe(27.5);
      expect(alloc.timeAllocations).toHaveLength(9);
      const byCategory = Object.fromEntries(
        alloc.timeAllocations.map((t) => [t.category, t.hoursPerWeek]),
      );
      expect(byCategory.HOME_LANGUAGE).toBe(5);
      expect(byCategory.FIRST_ADDITIONAL_LANGUAGE).toBe(4);
      expect(byCategory.MATHEMATICS).toBe(4.5);
      expect(byCategory.NATURAL_SCIENCES).toBe(3);
      expect(byCategory.SOCIAL_SCIENCES).toBe(3);
      expect(byCategory.TECHNOLOGY).toBe(2);
      expect(byCategory.ECONOMIC_AND_MANAGEMENT_SCIENCES).toBe(2);
      expect(byCategory.LIFE_ORIENTATION).toBe(2);
      expect(byCategory.CREATIVE_ARTS).toBe(2);
    });

    it('60% SBA, 40% exam (Circular S8/2023)', () => {
      for (let g = 7; g <= 9; g++) {
        expect(getDbeAllocation(g)!.assessmentWeighting).toEqual({ sba: 60, exam: 40 });
      }
    });
  });

  describe('getDbeAllocationsByPhase', () => {
    it('FOUNDATION → 4 grades', () =>
      expect(getDbeAllocationsByPhase('FOUNDATION')).toHaveLength(4));
    it('INTERMEDIATE → 3 grades', () =>
      expect(getDbeAllocationsByPhase('INTERMEDIATE')).toHaveLength(3));
    it('SENIOR → 3 grades', () =>
      expect(getDbeAllocationsByPhase('SENIOR')).toHaveLength(3));
    it('FET → 0 grades (unmapped)', () =>
      expect(getDbeAllocationsByPhase('FET')).toHaveLength(0));
  });

  it('IP uses combined NST; SP uses split NS + Technology', () => {
    const ip = getDbeAllocation(6)!.timeAllocations.map((t) => t.category);
    expect(ip).toContain('NATURAL_SCIENCES_AND_TECHNOLOGY');
    expect(ip).not.toContain('NATURAL_SCIENCES');

    const sp = getDbeAllocation(7)!.timeAllocations.map((t) => t.category);
    expect(sp).toContain('NATURAL_SCIENCES');
    expect(sp).toContain('TECHNOLOGY');
    expect(sp).not.toContain('NATURAL_SCIENCES_AND_TECHNOLOGY');
  });

  it('every allocation carries sourceRef and effectiveFrom', () => {
    for (const alloc of Object.values(DBE_ALLOCATIONS)) {
      expect(alloc.sourceRef).toBeTruthy();
      expect(alloc.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
