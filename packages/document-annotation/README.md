# @infinite-ai/document-annotation

Collaborative document annotation engine — five annotation types (highlight, comment,
text box, freehand, stamp) placed on a paginated document, with threaded replies on
comment annotations.

## What's here

- `annotation.ts` — `HexColor`, `Point`, and the five payload schemas
  (`HighlightPayload`, `CommentPayload`, `TextBoxPayload`, `FreehandPayload`,
  `StampPayload`), unioned into `AnnotationPayload`. `Annotation` is the envelope
  wrapping a payload with `annotationId`/`documentId`/`authorId`/`createdAt` — `authorId`
  is an opaque de-identified token, never a real name.
- `thread.ts` — `AnnotationThread`/`AnnotationReply`, and the pure thread operations
  (`createThread`, `addReply`, `resolveThread` — resolving is idempotent, and a resolved
  thread refuses further replies).
- `document.ts` — `AnnotatedDocument`, `createDocument()`, `addAnnotation()` (validates
  the annotation's `documentId` matches and its page is within `pageCount`),
  `getAnnotationsForPage()`, `addReplyToThread()`/`resolveAnnotationThread()` (document-
  level thread operations, auto-creating a thread on its first reply), and
  `exportDocument()` (a portable export attaching each comment annotation's thread).

## Where it fits

An L7 module. All operations here are pure — they return a new document value rather
than mutating one — so whichever caller adopts this package owns persisting the result.
As of this README, no other package or app imports it yet; `scripts/verify-stage.ts`
references it only to run its own test suite as part of a stage gate.

## Running its tests

```bash
pnpm --filter @infinite-ai/document-annotation test
pnpm --filter @infinite-ai/document-annotation test:coverage
```

Unit tier only, no external services required.
