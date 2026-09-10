export const ALL_GRADES = [
  'Grade R',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
] as const;

export const CAPS_SUBJECTS = [
  'Mathematics',
  'Mathematical Literacy',
  'English Home Language',
  'English First Additional Language',
  'Afrikaans Home Language',
  'Afrikaans First Additional Language',
  'isiZulu Home Language',
  'isiZulu First Additional Language',
  'Life Skills',
  'Life Orientation',
  'Natural Sciences',
  'Natural Sciences and Technology',
  'Social Sciences',
  'Technology',
  'Economic and Management Sciences',
  'Creative Arts',
  'Coding and Robotics',
] as const;

export const SA_LANGUAGES = [
  'English',
  'Afrikaans',
  'isiZulu',
  'isiXhosa',
  'Sesotho',
  'Setswana',
  'Sepedi',
  'Xitsonga',
  'siSwati',
  'Tshivenda',
  'isiNdebele',
  'South African Sign Language',
] as const;

export const STAFF_ROLES = [
  'Class Teacher',
  'Subject Teacher',
  'Head of Department',
  'Deputy Principal',
  'Principal',
  'Support Teacher',
] as const;

export interface LanguageSettings {
  lolt?: string;
  fal?: string[];
  sal?: string[];
}

export interface StaffMember {
  name: string;
  role: (typeof STAFF_ROLES)[number] | string;
}

export interface SubjectGradePeriods {
  subject: string;
  grades: string[];
  hoursPerWeek: number;
}

export interface TermWeeks {
  term1?: number;
  term2?: number;
  term3?: number;
  term4?: number;
}

export function periodsFromHours(hours: number): number {
  if (!hours || hours <= 0) return 0;
  return Math.round(hours / 0.75);
}

export function validateLanguageConflicts(langs: {
  lolt?: string;
  fal?: string[];
  sal?: string[];
}): string | null {
  if (!langs.lolt) return null;
  if (langs.fal && langs.fal.includes(langs.lolt)) {
    return `Language of Learning & Teaching (${langs.lolt}) cannot also be a First Additional Language.`;
  }
  if (langs.sal && langs.sal.includes(langs.lolt)) {
    return `Language of Learning & Teaching (${langs.lolt}) cannot also be a Second Additional Language.`;
  }
  return null;
}
