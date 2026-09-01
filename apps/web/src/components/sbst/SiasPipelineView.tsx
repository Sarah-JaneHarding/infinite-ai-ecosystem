'use client';

// SIAS — Screening, Identification, Assessment, and Support process (South African DoE).
// Four phases:
//   Phase 1: School-based screening (class teacher referral → SBST)
//   Phase 2: Assessment (formal assessment by SBST / district psychologist)
//   Phase 3: Intervention (support plan drafted and implemented)
//   Phase 4: Review (ILST / district review, escalation if needed)

type SiasPhase = 'Phase 1' | 'Phase 2' | 'Phase 3' | 'Phase 4';
type CaseStatus = 'draft' | 'pending' | 'active' | 'review' | 'closed';

interface SiasCase {
  readonly ref: string;
  readonly phase: SiasPhase;
  readonly stage: string;
  readonly status: CaseStatus;
  readonly tier: 2 | 3;
  readonly nextReview: string;
  readonly egra: readonly string[];
}

const MOCK_CASES: SiasCase[] = [
  {
    ref: 'SIAS-001',
    phase: 'Phase 2',
    stage: 'Assessment scheduled',
    status: 'pending',
    tier: 2,
    nextReview: '2026-09-10',
    egra: ['ORF', 'RC'],
  },
  {
    ref: 'SIAS-002',
    phase: 'Phase 3',
    stage: 'Support plan active',
    status: 'active',
    tier: 3,
    nextReview: '2026-09-05',
    egra: ['LSI', 'NWF', 'ORF', 'RC'],
  },
  {
    ref: 'SIAS-003',
    phase: 'Phase 1',
    stage: 'Teacher referral received',
    status: 'draft',
    tier: 2,
    nextReview: '2026-09-15',
    egra: ['PA', 'LC'],
  },
  {
    ref: 'SIAS-004',
    phase: 'Phase 4',
    stage: 'ILST review',
    status: 'review',
    tier: 3,
    nextReview: '2026-09-08',
    egra: ['LSI', 'NWF', 'WR', 'ORF'],
  },
  {
    ref: 'SIAS-005',
    phase: 'Phase 3',
    stage: 'Progress monitoring',
    status: 'active',
    tier: 2,
    nextReview: '2026-09-12',
    egra: ['RC'],
  },
];

const PHASE_META: Record<SiasPhase, { colour: string; description: string }> = {
  'Phase 1': { colour: '#3b82f6', description: 'School screening' },
  'Phase 2': { colour: '#f59e0b', description: 'Assessment' },
  'Phase 3': { colour: '#8b5cf6', description: 'Intervention' },
  'Phase 4': { colour: '#ef4444', description: 'ILST / Review' },
};

const STATUS_STYLES: Record<CaseStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: '#e5e7eb', text: '#374151', label: 'Draft' },
  pending: { bg: '#fef3c7', text: '#92400e', label: 'Pending' },
  active: { bg: '#d1fae5', text: '#065f46', label: 'Active' },
  review: { bg: '#ede9fe', text: '#5b21b6', label: 'In review' },
  closed: { bg: '#f3f4f6', text: '#9ca3af', label: 'Closed' },
};

const ALL_PHASES: SiasPhase[] = ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'];

interface CaseCardProps {
  c: SiasCase;
}

function CaseCard({ c }: CaseCardProps) {
  const status = STATUS_STYLES[c.status];

  return (
    <article
      className="rounded-[var(--iai-radius-lg)] border p-4 space-y-2"
      style={{ borderColor: 'var(--iai-border)', background: 'var(--iai-bg)' }}
      aria-label={`Case ${c.ref}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-sm font-bold"
          style={{ color: 'var(--iai-text)', fontFamily: 'var(--iai-font-mono)' }}
        >
          {c.ref}
        </span>
        <span
          className="px-2 py-0.5 rounded-full text-xs font-bold shrink-0"
          style={{ background: status.bg, color: status.text }}
        >
          {status.label}
        </span>
      </div>

      <p className="text-xs" style={{ color: 'var(--iai-text-subtle)' }}>
        {c.stage}
      </p>

      <div className="flex items-center gap-1 flex-wrap">
        <span
          className="text-xs px-1.5 py-0.5 rounded font-bold text-white"
          style={{ background: c.tier === 3 ? '#e8273c' : '#c99400' }}
        >
          T{c.tier}
        </span>
        {c.egra.map((f) => (
          <span
            key={f}
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: '#fee2e2',
              color: '#991b1b',
              fontFamily: 'var(--iai-font-mono)',
            }}
          >
            {f}
          </span>
        ))}
      </div>

      <p
        className="text-xs"
        style={{ color: 'var(--iai-text-subtle)', fontFamily: 'var(--iai-font-mono)' }}
      >
        Next review: {c.nextReview}
      </p>
    </article>
  );
}

export function SiasPipelineView() {
  return (
    <div>
      <p className="text-xs mb-4" style={{ color: 'var(--iai-text-subtle)' }}>
        Cases are de-identified. Learner tokens are resolved by the case coordinator only.
      </p>

      {/* Kanban-style phase columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {ALL_PHASES.map((phase) => {
          const meta = PHASE_META[phase];
          const cases = MOCK_CASES.filter((c) => c.phase === phase);

          return (
            <div key={phase} className="flex flex-col gap-3">
              {/* Column header */}
              <div
                className="rounded-[var(--iai-radius-lg)] px-4 py-3 text-white"
                style={{ background: meta.colour }}
              >
                <p className="text-sm font-bold">{phase}</p>
                <p className="text-xs opacity-80">{meta.description}</p>
                <p
                  className="text-xs mt-0.5 opacity-70"
                  style={{ fontFamily: 'var(--iai-font-mono)' }}
                >
                  {cases.length} case{cases.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Case cards */}
              {cases.length > 0 ? (
                cases.map((c) => <CaseCard key={c.ref} c={c} />)
              ) : (
                <p
                  className="text-xs px-2 py-4 text-center rounded-[var(--iai-radius-lg)] border border-dashed"
                  style={{
                    color: 'var(--iai-text-subtle)',
                    borderColor: 'var(--iai-border)',
                  }}
                >
                  No cases
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs mt-6" style={{ color: 'var(--iai-text-subtle)' }}>
        SIAS phases follow the DoE SIAS Guidelines (2014). Escalation to district ILST
        occurs at Phase 4 when school-based support has been exhausted.
      </p>
    </div>
  );
}
