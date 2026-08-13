// Card generation — Stage 23.
//
// In a low-tech classroom assessment each learner is issued a physical card.
// The card has a unique code (cardNumber 1–MAX_CARDS) and four sides labelled
// A / B / C / D. The teacher scans the room: the orientation of each card
// encodes the learner's answer for that question.
//
// No camera logic here — this module is responsible only for the data model:
// which cards exist, which learner slot they map to, and what a scan result
// looks like once the camera layer has done its work.

import { z } from 'zod';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum cards per class session. */
export const MAX_CARDS = 40;

/** Number of answer orientations per card (A / B / C / D). */
export const CARD_SIDES = 4;

// ─── Schemas ──────────────────────────────────────────────────────────────────

/** The four answer orientations a card can present. */
export const CardSide = z.enum(['A', 'B', 'C', 'D']);
export type CardSide = z.infer<typeof CardSide>;

/**
 * A physical card issued to one learner slot.
 * cardNumber is 1-indexed and unique within a class set.
 * slotLabel is the display label printed on the card back (e.g. "01").
 *
 * No real learner name or ID is stored here — the linkage to a learner record
 * happens outside this package, keyed by cardNumber, after de-identification.
 */
export const Card = z.object({
  cardNumber: z.number().int().min(1).max(MAX_CARDS),
  slotLabel: z.string().min(1),
  /** Opaque code used to identify this card in a scan (not a learner ID). */
  code: z.string().min(1),
});
export type Card = z.infer<typeof Card>;

/**
 * A single scan result: which card was seen, and which side was facing up.
 * Produced by the camera layer and passed to the tally engine.
 */
export const ScanResult = z.object({
  cardNumber: z.number().int().min(1).max(MAX_CARDS),
  side: CardSide,
});
export type ScanResult = z.infer<typeof ScanResult>;

// ─── Card generation ──────────────────────────────────────────────────────────

/**
 * Generates a full set of cards for a class.
 * `count` must be between 1 and MAX_CARDS.
 *
 * The card `code` is a short, deterministic, human-readable token derived
 * from the card number — no randomness, so the same set can be reprinted
 * from the same parameters. Format: "LTA-{padded cardNumber}".
 */
export function generateCardSet(count: number): readonly Card[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_CARDS) {
    throw new RangeError(
      `count must be an integer between 1 and ${MAX_CARDS}, got ${count}`,
    );
  }
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const padded = String(n).padStart(2, '0');
    return Card.parse({
      cardNumber: n,
      slotLabel: padded,
      code: `LTA-${padded}`,
    });
  });
}

/**
 * Returns the card with the given number from a set, or undefined.
 */
export function findCard(cards: readonly Card[], cardNumber: number): Card | undefined {
  return cards.find((c) => c.cardNumber === cardNumber);
}
