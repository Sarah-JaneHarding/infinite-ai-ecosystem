// The tenant lexicon — names a school's own data already knows about, for the
// free-text scrubber's dictionary layer (Stage 03 step 4) and the Model Gateway's
// inbound PII guard (Stage 04 step 9).
//
// Three sources, one tenant-scoped read:
//   - learner legal names, which live encrypted in `learner_identifier` — never plaintext
//     in the database, decrypted here and only here, for the one purpose that needs it
//   - staff display names, which are plaintext already (`staff_member.display_name`);
//     staff are not learner personal information, but a teacher's name appearing in a
//     colleague's note is still worth catching
//   - school names, so a campus mentioned by name scrubs the same as a person's
//
// A learner whose identifiers were destroyed by `eraseSubject` (Stage 03 step 6) drops out
// of this automatically — `learnerIdentifier.deleteMany` removes the row the query reads,
// not a flag this function has to know to check.

import type { TenantClient } from './client.js';
import { DecryptionError, decrypt, type EncryptionKey } from './encryption.js';

function dedupeNonEmpty(values: readonly string[]): readonly string[] {
  return [
    ...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  ];
}

/**
 * Reads the tenant's known names for the current encryption key.
 *
 * A learner identifier encrypted under a different key version than `key` is skipped
 * rather than thrown on — key rotation is Stage 16 work, and one stale row should narrow
 * the detector's dictionary, not take the whole lexicon down. Every skip is genuinely rare
 * in practice: a tenant has one active key version until rotation is built.
 */
export async function readTenantLexicon(
  tx: TenantClient,
  key: EncryptionKey,
): Promise<{
  readonly personNames: readonly string[];
  readonly schoolNames: readonly string[];
}> {
  const [identifiers, staff, schools] = await Promise.all([
    tx.learnerIdentifier.findMany({
      where: { kind: 'LEGAL_NAME' },
      select: { ciphertext: true, keyVersion: true },
    }),
    tx.staffMember.findMany({ select: { displayName: true } }),
    tx.school.findMany({ select: { name: true } }),
  ]);

  const learnerNames: string[] = [];
  for (const identifier of identifiers) {
    try {
      learnerNames.push(
        decrypt(
          {
            ciphertext: Buffer.from(identifier.ciphertext),
            keyVersion: identifier.keyVersion,
          },
          key,
        ),
      );
    } catch (error) {
      if (!(error instanceof DecryptionError)) throw error;
    }
  }

  return {
    personNames: dedupeNonEmpty([...learnerNames, ...staff.map((s) => s.displayName)]),
    schoolNames: dedupeNonEmpty(schools.map((s) => s.name)),
  };
}
