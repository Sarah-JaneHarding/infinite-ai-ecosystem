// Static registry of the 55 CAPS Canon Ingestion Console documents.
//
// The console tracks 52 CAPS PDFs + 3 ATP sets. Of those, 21 have structured
// data in ALL_CAPS_SOURCES (packages/curriculum-seed); those entries carry a
// `brainDocumentId`. The remaining 34 language-variant docs are tracked for
// download/SHA-256 provenance only — ingest is disabled until CE-01 parses
// the full PDFs.
//
// Multiple console IDs may share the same brainDocumentId (e.g. CAPS-SP-HIS
// and CAPS-SP-GEO both map to the Social Sciences SP document because the DBE
// publishes Social Sciences as a single subject including both strands).
//
// Source URLs point to the official DBE CAPS portal — these are the only
// permitted sources per the "Never synthesise curriculum" governing rule.

import type { CapsSourceInfo } from '@infinite-ai/curriculum-seed';

export interface CapsCanonDoc {
  readonly id: string;
  readonly title: string;
  readonly phase: 'FP' | 'IP' | 'SP' | 'ATP';
  readonly grades: string;
  readonly subject: string;
  readonly lang: string;
  readonly sourceUrl: string;
  readonly group: 'CAPS' | 'ATP';
  /**
   * The `documentId` from ALL_CAPS_SOURCES (packages/curriculum-seed).
   * null = no structured data; ingest button is disabled in the UI.
   * Some console IDs share a Brain documentId — both reflect the same submission.
   */
  readonly brainDocumentId: string | null;
}

const URL_FP =
  'https://www.education.gov.za/Curriculum/CurriculumAssessmentPolicyStatements(CAPS)/CAPSFoundation/tabid/571/Default.aspx';
const URL_IP =
  'https://www.education.gov.za/Curriculum/CurriculumAssessmentPolicyStatements(CAPS).aspx';
const URL_SP =
  'https://www.education.gov.za/Curriculum/CurriculumAssessmentPolicyStatements(CAPS)/CAPSSenior/tabid/573/Default.aspx';
const URL_ATP =
  'https://www.education.gov.za/Curriculum/NationalCurriculumStatementsGradesR-12/2023ATPs.aspx';

const LANGS: ReadonlyArray<readonly [string, string]> = [
  ['af', 'Afrikaans'],
  ['en', 'English'],
  ['zu', 'isiZulu'],
  ['xh', 'isiXhosa'],
  ['nso', 'Sepedi'],
  ['st', 'Sesotho'],
  ['tn', 'Setswana'],
  ['ss', 'siSwati'],
  ['ve', 'Tshivenda'],
  ['ts', 'Xitsonga'],
  ['nr', 'isiNdebele'],
] as const;

// Brain document IDs from packages/contracts — the canonical string literals.
// These must match CapsSourceInfo.documentId in ALL_CAPS_SOURCES exactly.
const B = {
  MATHS_FP: 'caps-mathematics-fp-gr-r3-2011',
  ENG_HL_FP: 'caps-english-hl-fp-gr-r3-2011',
  FAL_FP: 'caps-fal-fp-gr-r3-2011',
  LIFE_SKILLS_R3: 'caps-life-skills-r3-2011',
  ISIZULU_FAL_FP: 'caps-isizulu-fal-gr1-3-2011',
  CODING_ROBOTICS_R3: 'caps-coding-robotics-r3-draft-2021',
  MATHS_IP: 'caps-mathematics-ip-gr46-2011',
  ENG_HL_IP: 'caps-english-hl-ip-gr46-2011',
  ENG_FAL_IP: 'caps-english-fal-ip-gr46-2011',
  NST_IP: 'caps-nst-ip-gr46-2011',
  SS_IP: 'caps-social-sciences-ip-gr46-2011',
  LIFE_SKILLS_IP: 'caps-life-skills-ip-gr46-2011',
  MATHS_SP: 'caps-mathematics-sp-gr79-2011',
  EMS_SP: 'caps-ems-sp-gr79-2011',
  CA_SP: 'caps-creative-arts-sp-gr79-2011',
  FAL_SP: 'caps-fal-sp-gr79-2011',
  HL_SP: 'caps-hl-sp-gr79-2011',
  NS_SP: 'caps-natural-sciences-sp-gr79-2011',
  SS_SP: 'caps-social-sciences-sp-gr79-2011',
  TECH_SP: 'caps-technology-sp-gr79-2011',
  LO_SP: 'caps-life-orientation-sp-gr79-2011',
} as const;

function fpHlBrainId(langCode: string): string | null {
  if (langCode === 'en') return B.ENG_HL_FP;
  return null; // other FP HL languages await CE-01 PDF parsing
}

function ipHlBrainId(langCode: string): string | null {
  if (langCode === 'en') return B.ENG_HL_IP;
  return null;
}

function spHlBrainId(_langCode: string): string {
  // All SP HL language variants map to the single generic HL SP document in contracts.
  // The DBE publishes separate language-specific PDFs but the structured content
  // skeleton is identical; CE-01 specialises each by language at parse time.
  return B.HL_SP;
}

const DOCS: CapsCanonDoc[] = [];

// Foundation Phase (14)
DOCS.push({
  id: 'CAPS-FP-ALL',
  title: 'CAPS Foundation Phase — All Subjects (consolidated)',
  phase: 'FP',
  grades: 'R–3',
  subject: 'All subjects',
  lang: 'English (master)',
  sourceUrl: URL_FP,
  group: 'CAPS',
  // Consolidated PDF — individual structured docs (maths, life skills, coding & robotics)
  // are submitted via the seed job, not individually through this console.
  brainDocumentId: null,
});
for (const [code, name] of LANGS) {
  DOCS.push({
    id: `CAPS-FP-HL-${code}`,
    title: `CAPS FP Home Language — ${name}`,
    phase: 'FP',
    grades: 'R–3',
    subject: 'Home Language',
    lang: name,
    sourceUrl: URL_FP,
    group: 'CAPS',
    brainDocumentId: fpHlBrainId(code),
  });
}
DOCS.push(
  {
    id: 'CAPS-FP-FAL-EN',
    title: 'CAPS FP First Additional Language — English',
    phase: 'FP',
    grades: 'R–3',
    subject: 'First Additional Language',
    lang: 'English',
    sourceUrl: URL_FP,
    group: 'CAPS',
    brainDocumentId: B.FAL_FP,
  },
  {
    id: 'CAPS-FP-FAL-AF',
    title: 'CAPS FP First Additional Language — Afrikaans',
    phase: 'FP',
    grades: 'R–3',
    subject: 'First Additional Language',
    lang: 'Afrikaans',
    sourceUrl: URL_FP,
    group: 'CAPS',
    brainDocumentId: null, // no Afrikaans FAL FP structured data in contracts yet
  },
);

// Intermediate Phase (17)
for (const [code, name] of LANGS) {
  DOCS.push({
    id: `CAPS-IP-HL-${code}`,
    title: `CAPS IP Home Language — ${name}`,
    phase: 'IP',
    grades: '4–6',
    subject: 'Home Language',
    lang: name,
    sourceUrl: URL_IP,
    group: 'CAPS',
    brainDocumentId: ipHlBrainId(code),
  });
}
DOCS.push(
  {
    id: 'CAPS-IP-FAL-EN',
    title: 'CAPS IP First Additional Language — English',
    phase: 'IP',
    grades: '4–6',
    subject: 'First Additional Language',
    lang: 'English',
    sourceUrl: URL_IP,
    group: 'CAPS',
    brainDocumentId: B.ENG_FAL_IP,
  },
  {
    id: 'CAPS-IP-FAL-AF',
    title: 'CAPS IP First Additional Language — Afrikaans',
    phase: 'IP',
    grades: '4–6',
    subject: 'First Additional Language',
    lang: 'Afrikaans',
    sourceUrl: URL_IP,
    group: 'CAPS',
    brainDocumentId: null,
  },
  {
    id: 'CAPS-IP-MATH',
    title: 'CAPS IP Mathematics',
    phase: 'IP',
    grades: '4–6',
    subject: 'Mathematics',
    lang: 'English',
    sourceUrl: URL_IP,
    group: 'CAPS',
    brainDocumentId: B.MATHS_IP,
  },
  {
    id: 'CAPS-IP-NS',
    title: 'CAPS IP Natural Sciences and Technology',
    phase: 'IP',
    grades: '4–6',
    subject: 'Natural Sciences',
    lang: 'English',
    sourceUrl: URL_IP,
    group: 'CAPS',
    brainDocumentId: B.NST_IP,
  },
  {
    id: 'CAPS-IP-LS',
    title: 'CAPS IP Life Skills',
    phase: 'IP',
    grades: '4–6',
    subject: 'Life Skills',
    lang: 'English',
    sourceUrl: URL_IP,
    group: 'CAPS',
    brainDocumentId: B.LIFE_SKILLS_IP,
  },
  {
    id: 'CAPS-IP-SS',
    title: 'CAPS IP Social Sciences',
    phase: 'IP',
    grades: '4–6',
    subject: 'Social Sciences',
    lang: 'English',
    sourceUrl: URL_IP,
    group: 'CAPS',
    brainDocumentId: B.SS_IP,
  },
);

// Senior Phase — Grade 7 (21)
for (const [code, name] of LANGS) {
  DOCS.push({
    id: `CAPS-SP-HL-${code}`,
    title: `CAPS SP Home Language — ${name}`,
    phase: 'SP',
    grades: '7–9 (Gr 7)',
    subject: 'Home Language',
    lang: name,
    sourceUrl: URL_SP,
    group: 'CAPS',
    brainDocumentId: spHlBrainId(code),
  });
}
DOCS.push(
  {
    id: 'CAPS-SP-FAL-EN',
    title: 'CAPS SP First Additional Language — English',
    phase: 'SP',
    grades: '7–9 (Gr 7)',
    subject: 'First Additional Language',
    lang: 'English',
    sourceUrl: URL_SP,
    group: 'CAPS',
    brainDocumentId: B.FAL_SP,
  },
  {
    id: 'CAPS-SP-FAL-AF',
    title: 'CAPS SP First Additional Language — Afrikaans',
    phase: 'SP',
    grades: '7–9 (Gr 7)',
    subject: 'First Additional Language',
    lang: 'Afrikaans',
    sourceUrl: URL_SP,
    group: 'CAPS',
    brainDocumentId: null,
  },
  {
    id: 'CAPS-SP-MATH',
    title: 'CAPS SP Mathematics',
    phase: 'SP',
    grades: '7–9 (Gr 7)',
    subject: 'Mathematics',
    lang: 'English',
    sourceUrl: URL_SP,
    group: 'CAPS',
    brainDocumentId: B.MATHS_SP,
  },
  {
    id: 'CAPS-SP-NS',
    title: 'CAPS SP Natural Sciences',
    phase: 'SP',
    grades: '7–9 (Gr 7)',
    subject: 'Natural Sciences',
    lang: 'English',
    sourceUrl: URL_SP,
    group: 'CAPS',
    brainDocumentId: B.NS_SP,
  },
  {
    id: 'CAPS-SP-HIS',
    title: 'CAPS SP History (Social Sciences)',
    phase: 'SP',
    grades: '7–9 (Gr 7)',
    subject: 'History (Social Sciences)',
    lang: 'English',
    sourceUrl: URL_SP,
    group: 'CAPS',
    // CAPS SP Social Sciences covers both History and Geography in one document.
    brainDocumentId: B.SS_SP,
  },
  {
    id: 'CAPS-SP-GEO',
    title: 'CAPS SP Geography (Social Sciences)',
    phase: 'SP',
    grades: '7–9 (Gr 7)',
    subject: 'Geography (Social Sciences)',
    lang: 'English',
    sourceUrl: URL_SP,
    group: 'CAPS',
    brainDocumentId: B.SS_SP,
  },
  {
    id: 'CAPS-SP-LO',
    title: 'CAPS SP Life Orientation',
    phase: 'SP',
    grades: '7–9 (Gr 7)',
    subject: 'Life Orientation',
    lang: 'English',
    sourceUrl: URL_SP,
    group: 'CAPS',
    brainDocumentId: B.LO_SP,
  },
  {
    id: 'CAPS-SP-CA',
    title: 'CAPS SP Creative Arts',
    phase: 'SP',
    grades: '7–9 (Gr 7)',
    subject: 'Creative Arts',
    lang: 'English',
    sourceUrl: URL_SP,
    group: 'CAPS',
    brainDocumentId: B.CA_SP,
  },
  {
    id: 'CAPS-SP-TECH',
    title: 'CAPS SP Technology',
    phase: 'SP',
    grades: '7–9 (Gr 7)',
    subject: 'Technology',
    lang: 'English',
    sourceUrl: URL_SP,
    group: 'CAPS',
    brainDocumentId: B.TECH_SP,
  },
  {
    id: 'CAPS-SP-EMS',
    title: 'CAPS SP Economic and Management Sciences',
    phase: 'SP',
    grades: '7–9 (Gr 7)',
    subject: 'Economic and Management Sciences',
    lang: 'English',
    sourceUrl: URL_SP,
    group: 'CAPS',
    brainDocumentId: B.EMS_SP,
  },
);

// ATPs (3) — download/verify only; actual Brain submission is CE-02's job
for (const [code, label] of [
  ['FP', 'Foundation Phase'],
  ['IP', 'Intermediate Phase'],
  ['SP', 'Senior Phase'],
] as const) {
  DOCS.push({
    id: `ATP-2324-${code}`,
    title: `Annual Teaching Plans 2023/24 — ${label}`,
    phase: 'ATP',
    grades: 'per phase',
    subject: 'ATP calendar',
    lang: 'All subjects',
    sourceUrl: URL_ATP,
    group: 'ATP',
    brainDocumentId: null, // CE-02 ATP Sequencer handles ATP Brain submissions
  });
}

export const ALL_CAPS_CANON_DOCS: readonly CapsCanonDoc[] = DOCS;

/**
 * Finds the console doc for a given console ID.
 * Returns undefined if the ID is not in the registry.
 */
export function findCanonDoc(consoleId: string): CapsCanonDoc | undefined {
  return ALL_CAPS_CANON_DOCS.find((d) => d.id === consoleId);
}

/**
 * Given a Brain documentId, returns the CapsSourceInfo from ALL_CAPS_SOURCES.
 * Imported lazily in API routes to avoid loading the full curriculum-seed package
 * in client components.
 */
export function findCapsSourceByBrainDocId(
  allCapsSources: readonly CapsSourceInfo[],
  brainDocumentId: string,
): CapsSourceInfo | undefined {
  return allCapsSources.find((s) => s.documentId === brainDocumentId);
}
