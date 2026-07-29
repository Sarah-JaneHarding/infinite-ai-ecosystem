// Seed data — Stage 01 step 9.
//
// Three tenants of genuinely different shape, because a seed where every tenant looks the
// same hides exactly the bugs seeds exist to catch: pagination, rollups, cross-campus
// scoping, and any code that quietly assumes one school per tenant.
//
// Everything here is invented. No real school, staff member, learner or guardian is
// represented, and no real identifier is used — the ID numbers below are structurally
// plausible and deliberately not valid. OQ-004 asks whether one tenant should model a real
// school's structure; until that is answered, generic is the safe default, because seeds
// end up in screenshots, demos and CI logs.
//
// Idempotent by deterministic natural keys: every write is an upsert on a stable unique
// key, so a second run is a no-op rather than a duplicate. CI proves this by seeding twice
// and comparing row counts.

import { PrismaClient } from '@prisma/client';

import { EncryptionKey, encrypt, lookupHash } from '../src/encryption.js';

/** A fixed actor id for seed provenance, so `created_by` is never null in seeded data. */
const SEED_ACTOR = '00000000-0000-4000-8000-00000000f00d';

/**
 * Deterministic tenant ids. Fixed rather than random so re-running the seed targets the
 * same rows, and so a developer can hard-code a tenant id in a scratch query.
 */
const TENANTS = {
  smallPrimary: '10000000-0000-4000-8000-000000000001',
  largePrimary: '10000000-0000-4000-8000-000000000002',
  schoolGroup: '10000000-0000-4000-8000-000000000003',
} as const;

/**
 * The seed's encryption key.
 *
 * Rule 7 forbids a secret in the repository, and a hard-coded key here would be exactly
 * that. Taken from the environment when present; otherwise generated per run, which is
 * fine because seeded identifiers are invented and nothing needs to decrypt them later.
 */
function seedKey(): EncryptionKey {
  const material = process.env['DB_ENCRYPTION_KEY'];
  return material === undefined || material === ''
    ? EncryptionKey.generateForTesting(1)
    : EncryptionKey.fromBase64(material, 1);
}

const KEY = seedKey();

/** Sets the tenant context, then runs `fn`. Mirrors the production client's contract. */
async function inTenant<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.actor_id', ${SEED_ACTOR}, true)`;
      return fn(tx as unknown as PrismaClient);
    },
    // A tenant is seeded in one transaction on purpose: a seed that half-applies is worse
    // than one that fails, and atomicity is what makes re-running it safe. The large
    // primary is ~1,200 learners with four upserts each, which is comfortably past
    // Prisma's 5s interactive default — that default is sized for request handlers, not
    // for a bulk fixture load, and leaving it would have made the seed's own atomicity
    // the thing that broke it.
    { timeout: 180_000, maxWait: 15_000 },
  );
}

interface CampusSpec {
  readonly name: string;
  readonly lolt: string;
  /** Grade label to number of classes. */
  readonly classesPerGrade: number;
  readonly learnersPerClass: number;
  readonly grades: readonly { label: string; ordinal: number; phase: string }[];
}

/** Grades R–7, the shape of a South African primary school. */
const PRIMARY_GRADES = [
  { label: 'R', ordinal: 0, phase: 'Foundation' },
  { label: '1', ordinal: 1, phase: 'Foundation' },
  { label: '2', ordinal: 2, phase: 'Foundation' },
  { label: '3', ordinal: 3, phase: 'Foundation' },
  { label: '4', ordinal: 4, phase: 'Intermediate' },
  { label: '5', ordinal: 5, phase: 'Intermediate' },
  { label: '6', ordinal: 6, phase: 'Intermediate' },
  { label: '7', ordinal: 7, phase: 'Senior' },
] as const;

const SUBJECTS = [
  'Home Language',
  'First Additional Language',
  'Mathematics',
  'Natural Sciences and Technology',
  'Social Sciences',
  'Life Skills',
] as const;

/** Invented surnames and given names, drawn from South African naming patterns. */
const GIVEN_NAMES = [
  'Nomvula',
  'Sipho',
  'Ayanda',
  'Thabo',
  'Lerato',
  'Kagiso',
  'Zanele',
  'Mpho',
  'Aisha',
  'Ruan',
  'Chanel',
  'Divan',
  'Keanu',
  'Palesa',
  'Tshepo',
  'Yusuf',
] as const;
const FAMILY_NAMES = [
  'Mahlangu',
  'Dlamini',
  'Naidoo',
  'Van Wyk',
  'Botha',
  'Nkosi',
  'Adams',
  'Pillay',
  'Mokoena',
  'Jacobs',
  'Khumalo',
  'Fourie',
] as const;
const HOME_LANGUAGES = ['zu', 'xh', 'af', 'en', 'nso', 'tn', 'st'] as const;

/**
 * Node's `Buffer` is `Buffer<ArrayBufferLike>`; Prisma's `Bytes` columns want
 * `Uint8Array<ArrayBuffer>`. The two are structurally incompatible under strict mode even
 * though the bytes are identical, so convert explicitly at the boundary rather than
 * casting the difference away.
 */
function toBytes(value: Buffer): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(value.byteLength));
  copy.set(value);
  return copy;
}

/** Deterministic pick, so the same seed run produces the same people every time. */
function pick<T>(list: readonly T[], n: number): T {
  return list[n % list.length]!;
}

async function seedTenant(
  prisma: PrismaClient,
  tenantId: string,
  name: string,
  slug: string,
  kind: 'SCHOOL' | 'SCHOOL_GROUP',
  campuses: readonly CampusSpec[],
): Promise<void> {
  await inTenant(prisma, tenantId, async (tx) => {
    await tx.tenant.upsert({
      where: { id: tenantId },
      update: { name },
      create: { id: tenantId, name, slug, kind, createdBy: SEED_ACTOR },
    });

    await tx.tenantSetting.upsert({
      where: { tenantId_key: { tenantId, key: 'lolt' } },
      update: {},
      create: {
        tenantId,
        key: 'lolt',
        value: { value: campuses[0]!.lolt },
        createdBy: SEED_ACTOR,
      },
    });

    let learnerCounter = 0;
    let staffCounter = 0;

    for (const campus of campuses) {
      const school = await tx.school.upsert({
        where: { tenantId_name: { tenantId, name: campus.name } },
        update: {},
        create: { tenantId, name: campus.name, lolt: campus.lolt, createdBy: SEED_ACTOR },
      });

      const year = await tx.academicYear.upsert({
        where: { tenantId_schoolId_year: { tenantId, schoolId: school.id, year: 2026 } },
        update: {},
        create: {
          tenantId,
          schoolId: school.id,
          year: 2026,
          startsOn: new Date('2026-01-14'),
          endsOn: new Date('2026-12-09'),
          createdBy: SEED_ACTOR,
        },
      });

      // The 2026 DBE four-term calendar shape. Dates are illustrative: the authoritative
      // ATP calendar is ingested in Stage 08 from supplied source documents (OQ-002), and
      // is not invented here.
      const termDates = [
        ['2026-01-14', '2026-03-27'],
        ['2026-04-07', '2026-06-26'],
        ['2026-07-14', '2026-09-25'],
        ['2026-10-06', '2026-12-09'],
      ] as const;

      for (const [index, [startsOn, endsOn]] of termDates.entries()) {
        await tx.term.upsert({
          where: {
            tenantId_academicYearId_number: {
              tenantId,
              academicYearId: year.id,
              number: index + 1,
            },
          },
          update: {},
          create: {
            tenantId,
            academicYearId: year.id,
            number: index + 1,
            startsOn: new Date(startsOn),
            endsOn: new Date(endsOn),
            createdBy: SEED_ACTOR,
          },
        });
      }

      const subjectIds: string[] = [];
      for (const subjectName of SUBJECTS) {
        const subject = await tx.subject.upsert({
          where: { tenantId_name: { tenantId, name: subjectName } },
          update: {},
          create: { tenantId, name: subjectName, createdBy: SEED_ACTOR },
        });
        subjectIds.push(subject.id);
      }

      const phaseIds = new Map<string, string>();
      for (const phaseName of ['Foundation', 'Intermediate', 'Senior']) {
        const phase = await tx.phase.upsert({
          where: {
            tenantId_schoolId_name: { tenantId, schoolId: school.id, name: phaseName },
          },
          update: {},
          create: {
            tenantId,
            schoolId: school.id,
            name: phaseName,
            createdBy: SEED_ACTOR,
          },
        });
        phaseIds.set(phaseName, phase.id);
      }

      for (const gradeSpec of campus.grades) {
        const grade = await tx.grade.upsert({
          where: {
            tenantId_phaseId_label: {
              tenantId,
              phaseId: phaseIds.get(gradeSpec.phase)!,
              label: gradeSpec.label,
            },
          },
          update: {},
          create: {
            tenantId,
            phaseId: phaseIds.get(gradeSpec.phase)!,
            label: gradeSpec.label,
            ordinal: gradeSpec.ordinal,
            createdBy: SEED_ACTOR,
          },
        });

        for (let c = 0; c < campus.classesPerGrade; c += 1) {
          const className = `${gradeSpec.label}${String.fromCharCode(65 + c)}`;
          const classGroup = await tx.classGroup.upsert({
            where: {
              tenantId_schoolId_name: { tenantId, schoolId: school.id, name: className },
            },
            update: {},
            create: {
              tenantId,
              schoolId: school.id,
              gradeId: grade.id,
              name: className,
              createdBy: SEED_ACTOR,
            },
          });

          // One register teacher per class.
          staffCounter += 1;
          const teacherName = `${pick(GIVEN_NAMES, staffCounter)} ${pick(FAMILY_NAMES, staffCounter)}`;
          const subjectValue = `seed-teacher-${slug}-${campus.name}-${className}`;
          const account = await tx.userAccount.upsert({
            where: { tenantId_subject: { tenantId, subject: subjectValue } },
            update: {},
            create: {
              tenantId,
              subject: subjectValue,
              email: `${className.toLowerCase()}.${slug}@example.invalid`,
              displayName: teacherName,
              createdBy: SEED_ACTOR,
            },
          });

          await tx.roleAssignment.upsert({
            where: { id: deterministicId('role', tenantId, subjectValue) },
            update: {},
            create: {
              id: deterministicId('role', tenantId, subjectValue),
              tenantId,
              userAccountId: account.id,
              role: 'teacher',
              schoolId: school.id,
              classGroupId: classGroup.id,
              createdBy: SEED_ACTOR,
            },
          });

          const staff = await tx.staffMember.upsert({
            where: { userAccountId: account.id },
            update: {},
            create: {
              tenantId,
              schoolId: school.id,
              userAccountId: account.id,
              displayName: teacherName,
              createdBy: SEED_ACTOR,
            },
          });

          for (const subjectId of subjectIds) {
            await tx.teachingAssignment.upsert({
              where: {
                tenantId_staffMemberId_classGroupId_subjectId: {
                  tenantId,
                  staffMemberId: staff.id,
                  classGroupId: classGroup.id,
                  subjectId,
                },
              },
              update: {},
              create: {
                tenantId,
                staffMemberId: staff.id,
                classGroupId: classGroup.id,
                subjectId,
                createdBy: SEED_ACTOR,
              },
            });
          }

          for (let l = 0; l < campus.learnersPerClass; l += 1) {
            learnerCounter += 1;
            const token = `LNR_${slug.toUpperCase()}_${String(learnerCounter).padStart(5, '0')}`;
            const learner = await tx.learner.upsert({
              where: { tenantId_token: { tenantId, token } },
              update: {},
              create: {
                tenantId,
                schoolId: school.id,
                gradeId: grade.id,
                classGroupId: classGroup.id,
                token,
                homeLanguage: pick(HOME_LANGUAGES, learnerCounter),
                createdBy: SEED_ACTOR,
              },
            });

            // Identifiers go through the real encryption path rather than around it, so
            // the seeds exercise the code the exit gate checks.
            const legalName = `${pick(GIVEN_NAMES, learnerCounter)} ${pick(FAMILY_NAMES, learnerCounter * 3)}`;
            const encrypted = encrypt(legalName, KEY);
            await tx.learnerIdentifier.upsert({
              where: {
                tenantId_learnerId_kind: {
                  tenantId,
                  learnerId: learner.id,
                  kind: 'LEGAL_NAME',
                },
              },
              update: {},
              create: {
                tenantId,
                learnerId: learner.id,
                kind: 'LEGAL_NAME',
                ciphertext: toBytes(encrypted.ciphertext),
                keyVersion: encrypted.keyVersion,
                lookupHash: toBytes(lookupHash(legalName, tenantId, KEY)),
                createdBy: SEED_ACTOR,
              },
            });

            const guardianToken = `GDN_${slug.toUpperCase()}_${String(learnerCounter).padStart(5, '0')}`;
            const guardian = await tx.guardian.upsert({
              where: { tenantId_token: { tenantId, token: guardianToken } },
              update: {},
              create: {
                tenantId,
                token: guardianToken,
                homeLanguage: pick(HOME_LANGUAGES, learnerCounter),
                createdBy: SEED_ACTOR,
              },
            });

            await tx.guardianLink.upsert({
              where: {
                tenantId_guardianId_learnerId: {
                  tenantId,
                  guardianId: guardian.id,
                  learnerId: learner.id,
                },
              },
              update: {},
              create: {
                tenantId,
                guardianId: guardian.id,
                learnerId: learner.id,
                relationship: 'parent',
                isPrimary: true,
                createdBy: SEED_ACTOR,
              },
            });
          }
        }
      }
    }
  });
}

/**
 * A UUID derived deterministically from its parts.
 *
 * Some tables have no natural unique key to upsert on. Rather than inventing one, the id
 * itself is made deterministic so the upsert has a stable target.
 */
function deterministicId(kind: string, ...parts: string[]): string {
  const source = [kind, ...parts].join('|');
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < source.length; i += 1) {
    h1 = Math.imul(h1 ^ source.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + source.charCodeAt(i), 0x85ebca6b) >>> 0;
  }
  const hex = (n: number): string => n.toString(16).padStart(8, '0');
  const body = `${hex(h1)}${hex(h2)}${hex(h1 ^ h2)}${hex((h1 + h2) >>> 0)}`;
  // Force a valid v4-shaped UUID so the client's UUID validation accepts it.
  return [
    body.slice(0, 8),
    body.slice(8, 12),
    `4${body.slice(13, 16)}`,
    `8${body.slice(17, 20)}`,
    body.slice(20, 32),
  ].join('-');
}

/** Row counts per tenant, used to prove a second run changes nothing. */
export interface SeedCounts {
  readonly schools: number;
  readonly classes: number;
  readonly learners: number;
  readonly staff: number;
  readonly identifiers: number;
}

/**
 * Seeds the three reference tenants. Idempotent: every write is an upsert on a stable
 * natural key, so running this twice leaves the same rows.
 *
 * Takes the client as an argument so the integration tier can seed a Testcontainers
 * database and assert that second property rather than take it on trust.
 */
export async function seed(prisma: PrismaClient): Promise<Record<string, SeedCounts>> {
  // A small primary: one campus, one class per grade.
  await seedTenant(
    prisma,
    TENANTS.smallPrimary,
    'Kleinbos Primary',
    'kleinbos',
    'SCHOOL',
    [
      {
        name: 'Kleinbos Primary',
        lolt: 'af',
        classesPerGrade: 1,
        learnersPerClass: 22,
        grades: PRIMARY_GRADES,
      },
    ],
  );

  // A large primary: one campus, four classes per grade — the pagination and rollup case.
  await seedTenant(
    prisma,
    TENANTS.largePrimary,
    'Thabo Mbeki Primary',
    'thabo-mbeki',
    'SCHOOL',
    [
      {
        name: 'Thabo Mbeki Primary',
        lolt: 'en',
        classesPerGrade: 4,
        learnersPerClass: 38,
        grades: PRIMARY_GRADES,
      },
    ],
  );

  // A school group: two campuses under one tenant, with different LoLT. This is the shape
  // that breaks code assuming one school per tenant.
  await seedTenant(
    prisma,
    TENANTS.schoolGroup,
    'Umoya Schools Trust',
    'umoya',
    'SCHOOL_GROUP',
    [
      {
        name: 'Umoya North Campus',
        lolt: 'en',
        classesPerGrade: 2,
        learnersPerClass: 30,
        grades: PRIMARY_GRADES,
      },
      {
        name: 'Umoya South Campus',
        lolt: 'zu',
        classesPerGrade: 2,
        learnersPerClass: 28,
        grades: PRIMARY_GRADES,
      },
    ],
  );

  const summary: Record<string, SeedCounts> = {};
  for (const [label, tenantId] of Object.entries(TENANTS)) {
    summary[label] = await inTenant(prisma, tenantId, async (tx) => ({
      schools: await tx.school.count(),
      classes: await tx.classGroup.count(),
      learners: await tx.learner.count(),
      staff: await tx.staffMember.count(),
      identifiers: await tx.learnerIdentifier.count(),
    }));
  }
  return summary;
}

/** CLI entry point: `pnpm --filter @infinite-ai/db db:seed`. */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const summary = await seed(prisma);
    for (const [label, counts] of Object.entries(summary)) {
      console.log(
        `seeded ${label}: ${counts.schools} schools, ${counts.classes} classes, ` +
          `${counts.learners} learners, ${counts.staff} staff`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Only run when invoked directly, so importing this module for tests does not seed.
if (process.argv[1]?.endsWith('seed.ts') === true) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
