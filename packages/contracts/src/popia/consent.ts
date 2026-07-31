// The consent ledger's shape — Stage 03 step 6.
//
// "Per data subject, per data category, per purpose: lawful basis, source of consent,
// timestamp, evidence reference, and withdrawal. Consent is versioned and never deleted."
//
// Two things about this model are worth stating up front, because both are easy to get
// backwards.
//
// **Consent is not the only lawful basis, and pretending it is causes harm.** A school
// processes a learner's marks under its public-law duty, not because a guardian ticked a
// box; making that processing consent-based would mean a withdrawal could oblige the
// school to stop keeping a legally required record. POPIA §11(1) lists six bases and the
// ledger records which one applies. Withdrawal is meaningful for consent-based processing
// and, for the rest, it is an *objection* — recorded, routed to a human, and not silently
// treated as though it changed nothing.
//
// **The ledger is a log, not a state table.** Nothing is updated and nothing is deleted.
// Effective consent at any moment is derived by replaying entries up to that moment, which
// is what makes "what were we permitted to do on the day we did it?" an answerable
// question. A mutable `consent_granted` boolean cannot answer it, and that question is
// exactly what an Information Regulator enquiry asks.

import { z } from 'zod';

import { DataCategory, Purpose } from './purpose.js';

/**
 * The lawful bases in POPIA §11(1), named as the Act names them.
 *
 * Kept verbatim in meaning rather than paraphrased into product language, so that a
 * compliance reviewer can map each row to the section it claims.
 */
export const LawfulBasis = z.enum([
  /** §11(1)(a) — the data subject, or a competent person for a child, consents. */
  'CONSENT',
  /** §11(1)(b) — necessary to conclude or perform a contract with the data subject. */
  'CONTRACT',
  /** §11(1)(c) — compliance with an obligation imposed by law. */
  'LEGAL_OBLIGATION',
  /** §11(1)(d) — protects a legitimate interest of the data subject. */
  'SUBJECT_INTEREST',
  /** §11(1)(e) — proper performance of a public law duty by a public body. */
  'PUBLIC_LAW_DUTY',
  /** §11(1)(f) — legitimate interests of the responsible party or a third party. */
  'LEGITIMATE_INTEREST',
]);
export type LawfulBasis = z.infer<typeof LawfulBasis>;

/**
 * Bases a data subject can end unilaterally.
 *
 * Consent may be withdrawn at any time under §11(2)(b). A §11(1)(f) legitimate interest
 * may be objected to under §11(3)(b), and the objection stops the processing unless the
 * responsible party can show otherwise — so both are handled as "withdrawable" here, with
 * the legitimate-interest case routed to a human rather than applied automatically.
 *
 * The other three are not the data subject's to end: a school cannot stop keeping a
 * statutory record because a guardian asked it to. Recording an objection against one of
 * them is still valuable — it is a complaint the school must answer — but it does not by
 * itself remove the basis.
 */
export const WITHDRAWABLE_BASES: readonly LawfulBasis[] = [
  'CONSENT',
  'LEGITIMATE_INTEREST',
];

/** Whether ending this basis is the data subject's decision to make. */
export function isWithdrawable(basis: LawfulBasis): boolean {
  return WITHDRAWABLE_BASES.includes(basis);
}

/**
 * How the school obtained the decision. Recorded because "we have consent" is worth
 * nothing without being able to say where it came from.
 */
export const ConsentSource = z.enum([
  /** Signed admission or consent form, scanned and referenced by `evidenceRef`. */
  'PAPER_FORM',
  /** Captured in the guardian portal by the guardian themselves. */
  'GUARDIAN_PORTAL',
  /** Captured by school staff on a guardian's behalf, from a recorded interaction. */
  'STAFF_CAPTURED',
  /** Carried over from a prior system at migration. The weakest provenance there is. */
  'MIGRATED',
  /** No subject decision involved — the basis is statutory or contractual. */
  'NOT_APPLICABLE',
]);
export type ConsentSource = z.infer<typeof ConsentSource>;

export const ConsentDecision = z.enum([
  /** The basis applies and processing may proceed.  */
  'GRANTED',
  /** The subject ended it: withdrawal of consent, or objection under §11(3)(b). */
  'WITHDRAWN',
]);
export type ConsentDecision = z.infer<typeof ConsentDecision>;

/**
 * One immutable entry in the ledger.
 *
 * The subject is identified by its de-identified token, never by name, so the ledger
 * itself is not a register of who attends the school (rule 4). Re-identifying a token is
 * a separate, audited act.
 *
 * `effectiveFrom` and `recordedAt` are distinct on purpose. A form signed on Monday and
 * captured on Thursday is effective from Monday, and the three-day gap is visible rather
 * than lost. Evaluation uses `effectiveFrom`; the gap is what an auditor examines.
 */
const ConsentEntryShape = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  /** Tenant-salted pseudonym: `LNR_…`, `GDN_…`, `STF_…`. */
  subjectToken: z.string().min(1),
  category: DataCategory,
  purpose: Purpose,
  basis: LawfulBasis,
  decision: ConsentDecision,
  source: ConsentSource,
  /**
   * Where the evidence lives — a document reference, not the document. Required for a
   * grant that rests on the subject's own decision, because a consent nobody can produce
   * evidence for is a consent that will not survive being questioned.
   */
  evidenceRef: z.string().min(1).nullable(),
  /** When the decision took effect in the world. */
  effectiveFrom: z.coerce.date(),
  /** When this system learned of it. */
  recordedAt: z.coerce.date(),
  /** The staff account that captured it. Null for system-generated entries. */
  recordedBy: z.string().uuid().nullable(),
  /** Free text from the subject, for an objection. Never contains a decision. */
  note: z.string().max(2000).nullable(),
});

/**
 * The checks that apply to a grant however it arrives.
 *
 * Factored out because Zod's `.omit()` operates on the object and discards any refinement
 * wrapped around it. Deriving the draft from the refined entry would therefore have
 * produced a schema that validated *less* than the thing it was a subset of — and the
 * draft is the schema the write path actually uses, so the weaker one would have been the
 * only one that ran. A test asserts both refuse the same evidence-less grant.
 */
function refineGrant(
  entry: Pick<
    z.infer<typeof ConsentEntryShape>,
    'basis' | 'decision' | 'evidenceRef' | 'source'
  >,
  ctx: z.RefinementCtx,
): void {
  if (entry.basis !== 'CONSENT' || entry.decision !== 'GRANTED') return;
  if (entry.evidenceRef === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['evidenceRef'],
      message: 'A consent-based grant requires an evidence reference',
    });
  }
  if (entry.source === 'NOT_APPLICABLE') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['source'],
      message: 'A consent-based grant must record how the consent was obtained',
    });
  }
}

export const ConsentEntry = ConsentEntryShape.superRefine((entry, ctx) => {
  if (entry.effectiveFrom.getTime() > entry.recordedAt.getTime()) {
    // A decision cannot take effect after it was recorded — that is a future-dated grant,
    // and a grant that switches itself on later is not something anyone should be able to
    // write into a ledger that nothing can amend.
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['effectiveFrom'],
      message: 'effectiveFrom must not be later than recordedAt',
    });
  }
  refineGrant(entry, ctx);
});
export type ConsentEntry = z.infer<typeof ConsentEntry>;

/**
 * What a caller supplies to append an entry; the store fills in id, tenant and clock.
 *
 * `recordedAt` is not the caller's to state — it is when this system learned of the
 * decision, which is now, by definition. The effectiveFrom-vs-recordedAt check therefore
 * belongs to the write path rather than to this schema, and `appendConsentEntry` applies
 * it against its own clock.
 */
export const ConsentEntryDraft = ConsentEntryShape.omit({
  id: true,
  tenantId: true,
  recordedAt: true,
}).superRefine(refineGrant);
export type ConsentEntryDraft = z.infer<typeof ConsentEntryDraft>;
