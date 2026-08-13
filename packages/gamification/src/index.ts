// Public API — Stage 22 (Game-Based Learning).

export {
  GamificationEventType,
  LessonCompletedEvent,
  AssessmentCompletedEvent,
  AssessmentPassedEvent,
  LearningStreakDayEvent,
  ModuleCompletedEvent,
  GateApprovedEvent,
  GamificationEvent,
  LearnerGamificationProfile,
} from './events.js';

export type {
  LessonCompletedEvent as LessonCompletedEventShape,
  AssessmentCompletedEvent as AssessmentCompletedEventShape,
  AssessmentPassedEvent as AssessmentPassedEventShape,
  LearningStreakDayEvent as LearningStreakDayEventShape,
  ModuleCompletedEvent as ModuleCompletedEventShape,
  GateApprovedEvent as GateApprovedEventShape,
  GamificationEvent as GamificationEventShape,
  LearnerGamificationProfile as LearnerGamificationProfileShape,
} from './events.js';

export {
  XP_VALUES,
  HIGH_SCORE_BONUS_XP,
  HIGH_SCORE_THRESHOLD,
  STREAK_MILESTONE_BONUS,
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
  computeLevel,
  computeLessonXp,
  computeAssessmentCompletedXp,
  computeAssessmentPassedXp,
  computeStreakXp,
} from './points.js';

export {
  BadgeCategory,
  BadgeDefinition,
  BADGE_CATALOGUE,
  getBadge,
  evaluateBadges,
} from './badges.js';

export type { BadgeContext, BadgeDefinition as BadgeDefinitionShape } from './badges.js';

export { GamificationUpdate, processEvent } from './engine.js';

export type { GamificationUpdate as GamificationUpdateShape } from './engine.js';
