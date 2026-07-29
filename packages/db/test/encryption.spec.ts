// Stage 01 step 8 — column encryption for direct identifiers.
//
// Unlike the RLS suite, this needs no database, so it runs everywhere. The exit gate's
// "read the raw column and assert it is not plaintext" lives in rls.spec.ts, where a real
// database exists; what is proven here is that the primitive itself behaves.

import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  DecryptionError,
  EncryptionKey,
  EncryptionKeyError,
  decrypt,
  encrypt,
  lookupHash,
} from '../src/encryption.js';

const KEY = EncryptionKey.generateForTesting(1);

/** Returns a copy of `buffer` with one bit flipped at `index`. */
function flipBit(buffer: Buffer, index: number): Buffer {
  const copy = Buffer.from(buffer);
  copy.writeUInt8(copy.readUInt8(index) ^ 0x01, index);
  return copy;
}
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

describe('key construction', () => {
  it('accepts a 32-byte base64 key', () => {
    const material = Buffer.alloc(32, 7).toString('base64');
    expect(EncryptionKey.fromBase64(material, 1).version).toBe(1);
  });

  it('rejects a key of the wrong length rather than stretching it', () => {
    // Silently padding or hashing a short key would produce ciphertext that looks fine
    // and is weak — worse than refusing to start.
    const short = Buffer.alloc(16, 7).toString('base64');
    expect(() => EncryptionKey.fromBase64(short, 1)).toThrow(EncryptionKeyError);
  });

  it('rejects a non-positive key version', () => {
    const material = Buffer.alloc(32, 7).toString('base64');
    expect(() => EncryptionKey.fromBase64(material, 0)).toThrow(EncryptionKeyError);
  });

  it('rejects material that is not base64, rather than decoding what it can', () => {
    // `Buffer.from(x, 'base64')` never throws. It silently discards every character
    // outside the alphabet and decodes the rest, so the try/catch this replaced could
    // never fire — dead code wearing the shape of a safety check.
    for (const bad of ['not base64 at all!', '****', 'abc$def', ' ']) {
      expect(() => EncryptionKey.fromBase64(bad, 1), bad).toThrow(EncryptionKeyError);
    }
  });

  it('rejects a corrupted key that still decodes to 32 bytes', () => {
    // The case that made this worth fixing rather than merely noting.
    //
    // One character of the key is corrupted and one valid character follows it. The bad
    // character is dropped, the surviving stream still decodes to exactly 32 bytes, and
    // the length check passes — so the old code accepted the key. But the bytes are *not*
    // the real key. Everything encrypted under it would be unreadable by the real key,
    // discovered much later, with no error anywhere to explain why.
    const real = randomBytes(32);
    const good = real.toString('base64');
    const corrupted = `${good.slice(0, 10)}!${good.slice(11, 43)}A=`;

    const salvaged = Buffer.from(corrupted, 'base64');
    // The fixture has to actually reproduce the defect, or the assertion below proves
    // nothing about it.
    expect(salvaged, 'fixture must decode to a full-length key').toHaveLength(32);
    expect(salvaged.equals(real), 'fixture must decode to the wrong key').toBe(false);

    expect(() => EncryptionKey.fromBase64(corrupted, 1)).toThrow(EncryptionKeyError);
  });

  it('still accepts every key the generator produces', () => {
    // The pattern must not be so strict that it rejects real keys. 200 random 32-byte
    // keys exercise the whole alphabet, including `+` and `/`, and the single `=` of the
    // padding that a 32-byte value always ends with.
    for (let i = 0; i < 200; i += 1) {
      const material = randomBytes(32).toString('base64');
      expect(() => EncryptionKey.fromBase64(material, 1), material).not.toThrow();
    }
  });
});

describe('encrypt and decrypt', () => {
  it('round-trips a value', () => {
    const value = '0001015800084';
    expect(decrypt(encrypt(value, KEY), KEY)).toBe(value);
  });

  it('round-trips non-ASCII text', () => {
    const value = 'Nomvula Māhlangu — Grade 6';
    expect(decrypt(encrypt(value, KEY), KEY)).toBe(value);
  });

  it('produces different ciphertext for the same plaintext each time', () => {
    // A fresh nonce per encryption. Deterministic ciphertext would let anyone holding the
    // database see which learners share an identifier value.
    const a = encrypt('same-value', KEY);
    const b = encrypt('same-value', KEY);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });

  it('never contains the plaintext', () => {
    const value = 'Nomvula Mahlangu';
    const { ciphertext } = encrypt(value, KEY);
    expect(ciphertext.toString('utf8')).not.toContain(value);
    expect(ciphertext.toString('latin1')).not.toContain(value);
  });

  it('records the key version alongside the ciphertext', () => {
    const key = EncryptionKey.generateForTesting(4);
    expect(encrypt('x', key).keyVersion).toBe(4);
  });
});

describe('failure paths', () => {
  it('fails on a wrong key rather than returning garbage', () => {
    const other = EncryptionKey.generateForTesting(1);
    expect(() => decrypt(encrypt('secret', KEY), other)).toThrow(DecryptionError);
  });

  it('fails on tampered ciphertext', () => {
    // GCM is authenticated, so a single flipped bit must be detected.
    const value = encrypt('secret', KEY);
    const tampered = flipBit(value.ciphertext, value.ciphertext.length - 1);
    expect(() => decrypt({ ...value, ciphertext: tampered }, KEY)).toThrow(
      DecryptionError,
    );
  });

  it('fails on a tampered nonce', () => {
    const value = encrypt('secret', KEY);
    const tampered = flipBit(value.ciphertext, 0);
    expect(() => decrypt({ ...value, ciphertext: tampered }, KEY)).toThrow(
      DecryptionError,
    );
  });

  it('fails on a key-version mismatch', () => {
    const v2 = EncryptionKey.generateForTesting(2);
    expect(() => decrypt(encrypt('secret', KEY), v2)).toThrow(DecryptionError);
  });

  it('fails on a truncated value', () => {
    const value = encrypt('secret', KEY);
    expect(() =>
      decrypt({ ...value, ciphertext: value.ciphertext.subarray(0, 8) }, KEY),
    ).toThrow(DecryptionError);
  });
});

describe('lookup hash', () => {
  it('is deterministic for the same value in the same tenant', () => {
    expect(lookupHash('0001015800084', TENANT_A, KEY)).toEqual(
      lookupHash('0001015800084', TENANT_A, KEY),
    );
  });

  it('differs across tenants for the same value', () => {
    // Tenant salting denies cross-tenant correlation even to someone holding the whole
    // database. Without it, an identical ID number in two schools would hash identically.
    expect(lookupHash('0001015800084', TENANT_A, KEY)).not.toEqual(
      lookupHash('0001015800084', TENANT_B, KEY),
    );
  });

  it('differs for different values in the same tenant', () => {
    expect(lookupHash('0001015800084', TENANT_A, KEY)).not.toEqual(
      lookupHash('0001015800085', TENANT_A, KEY),
    );
  });

  it('depends on the key, so the database alone cannot reproduce it', () => {
    // This is the property that makes the small search space of ID numbers and dates of
    // birth safe: enumerating them is useless without the key, which lives outside the
    // database.
    const other = EncryptionKey.generateForTesting(1);
    expect(lookupHash('0001015800084', TENANT_A, KEY)).not.toEqual(
      lookupHash('0001015800084', TENANT_A, other),
    );
  });

  it('does not confuse a tenant/value boundary shift', () => {
    // A naive concat would make ("ab","c") and ("a","bc") collide.
    expect(lookupHash('c', 'ab', KEY)).not.toEqual(lookupHash('bc', 'a', KEY));
  });
});
