export {
  SA_LANGUAGES,
  CAPS_PHASES,
  CAPS_SUBJECTS,
  GRADES_BY_PHASE,
  ALL_GRADES,
  STAFF_ROLES,
  LanguageSettings,
  TermWeeks,
  SubjectGradePeriods,
  StaffMember,
  SchoolConfig,
} from './types';

export type { SaLanguage, CapsPhase, CapsSubject, StaffRole } from './types';

export {
  periodsFromHours,
  totalWeeks,
  validateLanguageConflicts,
  validateSchoolConfig,
} from './validate';
