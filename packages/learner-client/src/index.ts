// Public API — Stage 25 (Learner Client).
// OQ-010 (PWA vs integrated shell) is still open; this package provides the
// pure-logic data model that is shared regardless of the UI choice.

export {
  ActivityStatus,
  ActivityRecord,
  GamificationSnapshot,
  LearnerProfile,
  getRecord,
  upsertRecord,
  allCompleted,
  countByStatus,
} from './profile';

export type {
  ActivityStatus as ActivityStatusValue,
  ActivityRecord as ActivityRecordShape,
  GamificationSnapshot as GamificationSnapshotShape,
  LearnerProfile as LearnerProfileShape,
} from './profile';

export {
  ActivityType,
  ActivityNode,
  CourseGraph,
  isUnlocked,
  nextActivities,
  unlockedActivities,
  courseProgress,
} from './navigation';

export type {
  ActivityType as ActivityTypeValue,
  ActivityNode as ActivityNodeShape,
  CourseGraph as CourseGraphShape,
} from './navigation';

export {
  QuizAnsweredPayload,
  ActivityCompletedPayload,
  AssessmentSubmittedPayload,
  OfflineEventPayload,
  OfflineEvent,
  OfflineQueue,
  createQueue,
  enqueue,
  dequeue,
  pendingCount,
  peek,
} from './offline';

export type {
  OfflineEventPayload as OfflineEventPayloadShape,
  OfflineEvent as OfflineEventShape,
  OfflineQueue as OfflineQueueShape,
} from './offline';
