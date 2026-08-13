// Public API — Stage 24 (Document Annotation).

export {
  HexColor,
  Point,
  HighlightPayload,
  CommentPayload,
  TextBoxPayload,
  FreehandPayload,
  StampPayload,
  AnnotationPayload,
  AnnotationType,
  Annotation,
} from './annotation.js';

export type {
  HexColor as HexColorValue,
  Point as PointShape,
  HighlightPayload as HighlightPayloadShape,
  CommentPayload as CommentPayloadShape,
  TextBoxPayload as TextBoxPayloadShape,
  FreehandPayload as FreehandPayloadShape,
  StampPayload as StampPayloadShape,
  AnnotationPayload as AnnotationPayloadShape,
  AnnotationType as AnnotationTypeValue,
  Annotation as AnnotationShape,
} from './annotation.js';

export {
  AnnotationReply,
  AnnotationThread,
  createThread,
  addReply,
  resolveThread,
} from './thread.js';

export type {
  AnnotationReply as AnnotationReplyShape,
  AnnotationThread as AnnotationThreadShape,
} from './thread.js';

export {
  AnnotatedDocument,
  DocumentExport,
  createDocument,
  addAnnotation,
  getAnnotationsForPage,
  addReplyToThread,
  resolveAnnotationThread,
  exportDocument,
} from './document.js';

export type {
  AnnotatedDocument as AnnotatedDocumentShape,
  DocumentExport as DocumentExportShape,
} from './document.js';
