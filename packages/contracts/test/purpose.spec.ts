// The purpose taxonomy — Stage 03 step 3's "drops disallowed columns rather than failing
// silently".

import { describe, expect, it } from 'vitest';

import {
  DataCategory,
  PURPOSES,
  Purpose,
  definitionOf,
  permits,
  projectCategories,
} from '../src/popia/purpose.js';

describe('the table is complete and consistent', () => {
  it('defines every declared purpose', () => {
    // definitionOf throws rather than returning a permissive default, so a gap here would
    // be a runtime error at the first query — but catching it in CI is better.
    for (const purpose of Purpose.options) {
      expect(() => definitionOf(purpose)).not.toThrow();
    }
  });

  it('throws rather than defaulting when asked for a purpose it does not know', () => {
    // Unreachable while the enum and the table agree, which the case above asserts. It is
    // covered anyway because the branch is the one that decides what a gap *means*: a
    // missing definition must read as "refuse", never as "allow". Reaching it needs a
    // value the type system forbids, which is the point — the cast here stands in for a
    // future edit that adds an enum member and forgets the row.
    expect(() => definitionOf('marketing' as Purpose)).toThrow(/incomplete/i);
  });

  it('declares no purpose that is not in the enum', () => {
    const declared = new Set<string>(Purpose.options);
    for (const definition of PURPOSES) {
      expect(declared).toContain(definition.purpose);
    }
  });

  it('names only real data categories', () => {
    const known = new Set<string>(DataCategory.options);
    for (const definition of PURPOSES) {
      for (const category of definition.categories) {
        expect(
          known,
          `${definition.purpose} names unknown category ${category}`,
        ).toContain(category);
      }
    }
  });

  it('gives every purpose a description someone could act on', () => {
    for (const definition of PURPOSES) {
      expect(definition.description.length).toBeGreaterThan(20);
    }
  });
});

describe('the limits that matter most', () => {
  it('keeps planning learner-blind', () => {
    // MOD-01 generating a term plan has no business seeing a child's marks. This is what
    // makes "no learner personal information in any planning artefact" enforceable rather
    // than aspirational.
    const learnerLevel: DataCategory[] = [
      'DIRECT_IDENTIFIER',
      'ACADEMIC_PERFORMANCE',
      'ATTENDANCE',
      'BEHAVIOUR',
      'SUPPORT_NEED',
      'SPECIAL_PERSONAL',
      'FAMILY_CONTEXT',
    ];
    for (const category of learnerLevel) {
      expect(permits('planning', category), `planning must not touch ${category}`).toBe(
        false,
      );
    }
  });

  it('gives product_improvement nothing at all', () => {
    // The purpose most likely to be stretched, because it sounds harmless. Improving the
    // product using a school's learner data is not something this system does; if it ever
    // should, that is a conversation and a change to this row.
    const definition = definitionOf('product_improvement');
    expect(definition.categories).toHaveLength(0);
    expect(definition.permitsModelProcessing).toBe(false);
    for (const category of DataCategory.options) {
      expect(permits('product_improvement', category)).toBe(false);
    }
  });

  it('confines special personal information to intervention alone', () => {
    // POPIA §26 material — health, disability, biometrics. The narrowest grant in the
    // table, and it should stay that way.
    const permitted = PURPOSES.filter((p) => p.categories.includes('SPECIAL_PERSONAL'));
    expect(permitted.map((p) => p.purpose)).toEqual(['intervention']);
  });

  it('permits re-identification only where naming the child is the point', () => {
    const permitted = PURPOSES.filter((p) => p.permitsReidentification).map(
      (p) => p.purpose,
    );
    // The SBST must know which learner; a parent report names the child by definition.
    // Nothing else does.
    expect(permitted.sort()).toEqual(['intervention', 'reporting_parent']);
  });

  it('keeps district reporting away from direct identifiers', () => {
    expect(permits('reporting_district', 'DIRECT_IDENTIFIER')).toBe(false);
    expect(permits('reporting_district', 'IDENTIFIER_TOKEN')).toBe(false);
    expect(definitionOf('reporting_district').permitsReidentification).toBe(false);
  });

  it('keeps pd_analytics away from learner support records', () => {
    // Teacher development analytics has no business in a child's support file.
    expect(permits('pd_analytics', 'SUPPORT_NEED')).toBe(false);
    expect(permits('pd_analytics', 'SPECIAL_PERSONAL')).toBe(false);
  });
});

describe('projection drops rather than fails', () => {
  it('returns what is allowed and what was dropped', () => {
    const projection = projectCategories('screening', [
      'ACADEMIC_PERFORMANCE',
      'SPECIAL_PERSONAL',
      'ATTENDANCE',
    ]);
    expect(projection.allowed).toEqual(['ACADEMIC_PERFORMANCE', 'ATTENDANCE']);
    expect(projection.dropped).toEqual(['SPECIAL_PERSONAL']);
  });

  it('drops everything for a purpose that permits nothing', () => {
    const projection = projectCategories('product_improvement', [
      'ACADEMIC_PERFORMANCE',
      'ATTENDANCE',
    ]);
    expect(projection.allowed).toEqual([]);
    expect(projection.dropped).toHaveLength(2);
  });

  it('drops nothing when everything requested is permitted', () => {
    const projection = projectCategories('intervention', ['SUPPORT_NEED', 'ATTENDANCE']);
    expect(projection.dropped).toEqual([]);
  });

  it('handles an empty request', () => {
    const projection = projectCategories('screening', []);
    expect(projection.allowed).toEqual([]);
    expect(projection.dropped).toEqual([]);
  });

  it('reports the purpose it projected under, so a log line is self-contained', () => {
    expect(projectCategories('screening', ['ATTENDANCE']).purpose).toBe('screening');
  });
});
