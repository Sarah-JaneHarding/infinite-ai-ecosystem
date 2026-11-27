// Public API — Stage 23 (Low-Tech Assessment).

export {
  MAX_CARDS,
  CARD_SIDES,
  CardSide,
  Card,
  ScanResult,
  generateCardSet,
  findCard,
} from './cards.js';

export type {
  CardSide as CardSideValue,
  Card as CardShape,
  ScanResult as ScanResultShape,
} from './cards.js';

export {
  AnswerOption,
  Question,
  SessionStatus,
  AssessmentSession,
  startSession,
  advanceQuestion,
  closeSession,
  currentQuestion,
} from './session.js';

export type {
  AnswerOption as AnswerOptionShape,
  Question as QuestionShape,
  SessionStatus as SessionStatusValue,
  AssessmentSession as AssessmentSessionShape,
} from './session.js';

export {
  OptionTally,
  QuestionTally,
  SessionResult,
  tallyQuestion,
  tallySession,
  unscannedCards,
} from './tally.js';

export type {
  OptionTally as OptionTallyShape,
  QuestionTally as QuestionTallyShape,
  SessionResult as SessionResultShape,
} from './tally.js';

export {
  GRID,
  CARD_CELLS,
  rotateGrid,
  hamming,
  patternFor,
  cardBitmap,
} from './marker/grid.js';

export { PATTERN_SEARCH, generatePatterns } from './marker/generate.js';
export type { PatternSearch } from './marker/generate.js';

export { MARKER_PATTERNS, MARKER_MIN_DISTANCE } from './marker/patterns.js';

export { MAX_CORRECTABLE_BITS, sideForRotation, decodeGrid } from './marker/decode.js';
export type { Rotation, GridMatch } from './marker/decode.js';
