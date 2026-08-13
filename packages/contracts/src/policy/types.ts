// Shared types for policy document source registrations.
// All 14 South African education policy and legislative documents ingested in Stage 08
// use this metadata shape. Curriculum sources (packages/contracts/src/curriculum/sources/)
// have their own per-document interfaces because their structured data (study areas,
// weightings, topic graphs) differs too widely for a single type; policy documents are
// all the same shape so a shared type is the correct call here.

export type PolicyDocKind =
  | 'ACT' // Act of Parliament
  | 'AMENDMENT_ACT' // Amendment Act modifying an existing Act
  | 'POLICY' // Ministerial or departmental policy
  | 'SCHEDULE' // Regulatory schedule (point values, fees)
  | 'GUIDELINE' // Implementation guideline
  | 'PLAN' // Government plan or strategy document
  | 'FRAMEWORK'; // Policy framework document

export interface PolicyDocMetadata {
  readonly documentId: string;
  readonly documentVersion: string;
  readonly title: string;
  readonly publisher: string;
  readonly kind: PolicyDocKind;
  /** Gazette number and date, for gazetted instruments. */
  readonly gazetteRef?: string;
  readonly isbnOrIssn?: string;
  /** ISO-format date the Act was assented to by the President, where applicable. */
  readonly dateAssented?: string;
  /** Null until a human countersigns this registration into L0. */
  readonly ratifiedBy: null;
  readonly pageCount?: number;
}
