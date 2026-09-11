import { describe, it, expect } from 'vitest';
import { mapSubjectToCategory } from '../../src/curriculum/subject-mapper.js';

describe('mapSubjectToCategory', () => {
  it('maps home language variants', () => {
    expect(mapSubjectToCategory('English Home Language')).toBe('HOME_LANGUAGE');
    expect(mapSubjectToCategory('isiZulu HL')).toBe('HOME_LANGUAGE');
  });

  it('maps first additional language variants', () => {
    expect(mapSubjectToCategory('English First Additional Language')).toBe(
      'FIRST_ADDITIONAL_LANGUAGE',
    );
    expect(mapSubjectToCategory('Afrikaans FAL')).toBe('FIRST_ADDITIONAL_LANGUAGE');
  });

  it('maps mathematics', () => {
    expect(mapSubjectToCategory('Mathematics')).toBe('MATHEMATICS');
    expect(mapSubjectToCategory('Maths')).toBe('MATHEMATICS');
  });

  it('maps combined NST before its split parts', () => {
    expect(mapSubjectToCategory('Natural Sciences and Technology')).toBe(
      'NATURAL_SCIENCES_AND_TECHNOLOGY',
    );
    expect(mapSubjectToCategory('NST')).toBe('NATURAL_SCIENCES_AND_TECHNOLOGY');
  });

  it('maps split senior-phase sciences and technology', () => {
    expect(mapSubjectToCategory('Natural Sciences')).toBe('NATURAL_SCIENCES');
    expect(mapSubjectToCategory('Technology')).toBe('TECHNOLOGY');
  });

  it('maps social sciences', () => {
    expect(mapSubjectToCategory('Social Sciences')).toBe('SOCIAL_SCIENCES');
  });

  it('distinguishes Life Orientation from Life Skills', () => {
    expect(mapSubjectToCategory('Life Orientation')).toBe('LIFE_ORIENTATION');
    expect(mapSubjectToCategory('Life Skills')).toBe('LIFE_SKILLS');
  });

  it('maps EMS and Creative Arts', () => {
    expect(mapSubjectToCategory('Economic and Management Sciences')).toBe(
      'ECONOMIC_AND_MANAGEMENT_SCIENCES',
    );
    expect(mapSubjectToCategory('Creative Arts')).toBe('CREATIVE_ARTS');
  });

  it('returns null for empty or unmappable input — never guesses', () => {
    expect(mapSubjectToCategory('')).toBeNull();
    expect(mapSubjectToCategory('   ')).toBeNull();
    expect(mapSubjectToCategory('Quantum Basket Weaving')).toBeNull();
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(mapSubjectToCategory('  mAtHeMaTiCs  ')).toBe('MATHEMATICS');
  });
});
