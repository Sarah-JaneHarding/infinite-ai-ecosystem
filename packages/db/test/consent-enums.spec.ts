// The seam between two generators.
//
// The POPIA vocabularies exist twice: as Zod enums in `@infinite-ai/contracts`, which the
// application validates against, and as Postgres enums in the schema, which the database
// enforces. Nothing keeps them in step except this file.
//
// The failure this prevents is quiet and expensive. Add a lawful basis to the contracts
// enum, forget the migration, and every write carrying the new value fails at the database
// with a constraint error nobody can read — in production, on a school's consent capture
// path, at the moment a guardian is standing at the office counter. Add it to the database
// and forget the contracts enum and it is worse: the column can hold a value the
// application will refuse to parse when it reads the row back.

import { readFileSync } from 'node:fs';

import {
  ConsentDecision as PrismaConsentDecision,
  ConsentSource as PrismaConsentSource,
  LawfulBasis as PrismaLawfulBasis,
} from '@prisma/client';
import { ConsentDecision, ConsentSource, LawfulBasis } from '@infinite-ai/contracts';
import { describe, expect, it } from 'vitest';

describe('the POPIA enums agree across the Zod and Postgres generators', () => {
  it('has the same six lawful bases on both sides', () => {
    expect(Object.values(PrismaLawfulBasis).sort()).toEqual(
      [...LawfulBasis.options].sort(),
    );
  });

  it('has the same consent decisions on both sides', () => {
    expect(Object.values(PrismaConsentDecision).sort()).toEqual(
      [...ConsentDecision.options].sort(),
    );
  });

  it('has the same consent sources on both sides', () => {
    expect(Object.values(PrismaConsentSource).sort()).toEqual(
      [...ConsentSource.options].sort(),
    );
  });
});

describe('the taxonomies deliberately not modelled as database enums', () => {
  it('keeps category and purpose as text columns on the ledger', () => {
    // `DataCategory` and `Purpose` are the product's taxonomy and are versioned in
    // contracts. Making them Postgres enums would turn adding a purpose into a migration
    // and a deployment, when the manual's model is that it is a reviewed change to one
    // table plus an update to docs/POPIA.md. Text columns with application-side validation
    // are the deliberate choice, and this asserts it stayed a choice.
    //
    // The trade is real and worth stating: the database will accept a category string the
    // application would refuse. `withTenant` plus `appendConsentEntry` is the only write
    // path, and the caller parses against the Zod enum before reaching it.
    const model = modelBlock('ConsentRecord');
    expect(model).toMatch(/^\s*category\s+String\b/m);
    expect(model).toMatch(/^\s*purpose\s+String\b/m);
    // Whereas the three that come from the Act, and do not change with the product, are.
    expect(model).toMatch(/^\s*basis\s+LawfulBasis\b/m);
    expect(model).toMatch(/^\s*decision\s+ConsentDecision\b/m);
    expect(model).toMatch(/^\s*source\s+ConsentSource\b/m);
  });
});

function modelBlock(name: string): string {
  const schema = readFileSync(
    new URL('../prisma/schema.prisma', import.meta.url),
    'utf8',
  );
  const match = new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`).exec(schema);
  if (match?.[1] === undefined) throw new Error(`No model ${name} in schema.prisma`);
  return match[1];
}
