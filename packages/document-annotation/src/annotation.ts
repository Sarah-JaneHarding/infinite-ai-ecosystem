// Annotation type schemas — Stage 24.
// Five annotation payload types that a collaborator can place on a document page.
// authorId is an opaque de-identified token; no real learner identity is stored here.

import { z } from 'zod';

// ─── Primitive building blocks ────────────────────────────────────────────────

/** Six-digit hex colour string (e.g. "#FFDD00"). */
export const HexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a 6-digit hex colour (#RRGGBB)');
export type HexColor = z.infer<typeof HexColor>;

/** A point within a page coordinate system (top-left origin, positive y down). */
export const Point = z.object({ x: z.number(), y: z.number() });
export type Point = z.infer<typeof Point>;

// ─── Per-type payload schemas ─────────────────────────────────────────────────

/**
 * A text highlight spanning a character offset range on one page.
 * startOffset < endOffset, both nonnegative.
 */
export const HighlightPayload = z
  .object({
    type: z.literal('highlight'),
    page: z.number().int().min(1),
    startOffset: z.number().int().nonnegative(),
    endOffset: z.number().int().nonnegative(),
    color: HexColor,
  })
  .refine((h) => h.startOffset < h.endOffset, {
    message: 'startOffset must be less than endOffset',
  });
export type HighlightPayload = z.infer<typeof HighlightPayload>;

/** A sticky comment pinned to an (x, y) position on a page. */
export const CommentPayload = z.object({
  type: z.literal('comment'),
  page: z.number().int().min(1),
  x: z.number(),
  y: z.number(),
  body: z.string().min(1),
});
export type CommentPayload = z.infer<typeof CommentPayload>;

/** A free-floating text box placed on a page. */
export const TextBoxPayload = z.object({
  type: z.literal('text_box'),
  page: z.number().int().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  body: z.string(),
});
export type TextBoxPayload = z.infer<typeof TextBoxPayload>;

/**
 * A freehand ink path: a sequence of ≥2 points forming a stroke.
 */
export const FreehandPayload = z.object({
  type: z.literal('freehand'),
  page: z.number().int().min(1),
  points: z.array(Point).min(2),
  color: HexColor,
  strokeWidth: z.number().positive(),
});
export type FreehandPayload = z.infer<typeof FreehandPayload>;

/** A named stamp (e.g. "Excellent", "See me") placed at a position. */
export const StampPayload = z.object({
  type: z.literal('stamp'),
  page: z.number().int().min(1),
  x: z.number(),
  y: z.number(),
  label: z.string().min(1),
});
export type StampPayload = z.infer<typeof StampPayload>;

/** Union of all payload types. Uses z.union (not discriminatedUnion) because
 * HighlightPayload carries a .refine() that produces ZodEffects. */
export const AnnotationPayload = z.union([
  HighlightPayload,
  CommentPayload,
  TextBoxPayload,
  FreehandPayload,
  StampPayload,
]);
export type AnnotationPayload = z.infer<typeof AnnotationPayload>;

// ─── Annotation envelope ─────────────────────────────────────────────────────

export const AnnotationType = z.enum([
  'highlight',
  'comment',
  'text_box',
  'freehand',
  'stamp',
]);
export type AnnotationType = z.infer<typeof AnnotationType>;

/**
 * A single annotation: an envelope wrapping a payload with metadata.
 * annotationId and authorId are opaque strings; authorId is a de-identified token.
 */
export const Annotation = z.object({
  annotationId: z.string().min(1),
  documentId: z.string().min(1),
  authorId: z.string().min(1),
  createdAt: z.string().datetime(),
  payload: AnnotationPayload,
});
export type Annotation = z.infer<typeof Annotation>;
