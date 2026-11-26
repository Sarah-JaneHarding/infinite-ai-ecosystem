// Document Studio — request and response contracts for the library API.
//
// A document moves DRAFT -> REVIEWED -> COUNTERSIGNED -> RATIFIED by signatures that name a
// revision and its SHA-256, so a signature can never be read as covering text it did not see.
// `allowedActions` carries the refusal reason with every refused action: the UI shows it
// rather than guessing why a button is off.

import { z } from 'zod';

import { LibraryDocumentContent } from './blocks.js';
import { LibraryFileFormat, Sha256Hex } from './manifest.js';

export { LibraryFileFormat };

export const LibrarySignatureKind = z.enum(['REVIEW', 'COUNTERSIGN', 'RATIFY']);
export type LibrarySignatureKind = z.infer<typeof LibrarySignatureKind>;

export const LibraryRevisionStatus = z.enum([
  'DRAFT',
  'REVIEWED',
  'COUNTERSIGNED',
  'RATIFIED',
]);
export type LibraryRevisionStatus = z.infer<typeof LibraryRevisionStatus>;

const Reason = z.string().trim().min(1);

export const LibraryListQuery = z.object({
  dept: z.string().min(1).optional(),
  group: z.enum(['business', 'customer']).optional(),
  kind: z.string().min(1).optional(),
  status: LibraryRevisionStatus.optional(),
  q: z.string().optional(),
});
export type LibraryListQuery = z.infer<typeof LibraryListQuery>;

export const EditRevisionBody = z.object({
  parentRevisionId: z.string().uuid(),
  content: LibraryDocumentContent,
  reason: Reason,
});
export type EditRevisionBody = z.infer<typeof EditRevisionBody>;

export const SignAttestation = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  scope: z.string().min(1),
});
export type SignAttestation = z.infer<typeof SignAttestation>;

export const SignBody = z.object({
  kind: LibrarySignatureKind,
  revisionId: z.string().uuid(),
  revisionSha256: Sha256Hex,
  reason: Reason,
  attestation: SignAttestation.optional(),
});
export type SignBody = z.infer<typeof SignBody>;

export const IngestBody = z.object({
  revisionId: z.string().uuid(),
  revisionSha256: Sha256Hex,
});
export type IngestBody = z.infer<typeof IngestBody>;

export const LibraryDocumentSummary = z.object({
  id: z.string().regex(/^lib-[a-z0-9-]+$/),
  title: z.string(),
  group: z.enum(['business', 'customer']),
  dept: z.string(),
  kind: z.string(),
  review: z.string().nullable(),
  law: z.array(z.string()),
  status: LibraryRevisionStatus,
  currentRevisionId: z.string().uuid(),
});
export type LibraryDocumentSummary = z.infer<typeof LibraryDocumentSummary>;

export const LibraryRevision = z.object({
  id: z.string().uuid(),
  documentId: z.string(),
  parentRevisionId: z.string().uuid().nullable(),
  sha256: Sha256Hex,
  content: LibraryDocumentContent,
  reason: z.string(),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
});
export type LibraryRevision = z.infer<typeof LibraryRevision>;

export const LibrarySignature = z.object({
  id: z.string().uuid(),
  documentId: z.string(),
  revisionId: z.string().uuid(),
  revisionSha256: Sha256Hex,
  kind: LibrarySignatureKind,
  reason: z.string(),
  attestation: SignAttestation.optional(),
  signedBy: z.string(),
  signedAt: z.string().datetime(),
});
export type LibrarySignature = z.infer<typeof LibrarySignature>;

export const LibraryActionVerdict = z.discriminatedUnion('allowed', [
  z.object({ allowed: z.literal(true) }),
  z.object({ allowed: z.literal(false), refusal: z.string().min(1) }),
]);
export type LibraryActionVerdict = z.infer<typeof LibraryActionVerdict>;

export const LibraryDocumentDetail = z.object({
  document: LibraryDocumentSummary,
  revisions: z.array(LibraryRevision),
  signatures: z.array(LibrarySignature),
  status: LibraryRevisionStatus,
  allowedActions: z.object({
    edit: LibraryActionVerdict,
    review: LibraryActionVerdict,
    countersign: LibraryActionVerdict,
    ratify: LibraryActionVerdict,
    ingest: LibraryActionVerdict,
  }),
});
export type LibraryDocumentDetail = z.infer<typeof LibraryDocumentDetail>;
