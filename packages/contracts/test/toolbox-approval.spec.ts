import { describe, expect, it } from 'vitest';

import {
  TeacherEditSignal,
  ToolboxEditDiff,
  ToolboxEditField,
} from '../src/toolbox/approval.js';

const VALID_FIELD_EDIT = {
  field: 'slides[2].content',
  before: 'The sun heats the earth.',
  after: 'The sun heats the Earth, causing evaporation.',
};

const VALID_DIFF: ToolboxEditDiff = {
  artefactId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  artefactType: 'BOARD_DECK',
  editedAt: '2026-08-11T10:00:00.000Z',
  editedBy: 'teacher@school.za',
  fieldEdits: [VALID_FIELD_EDIT],
  totalCharactersChanged: 32,
};

const VALID_SIGNAL: TeacherEditSignal = {
  signalId: '11111111-2222-3333-4444-555555555555',
  tenantId: 'aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb',
  agentId: 'TB-02',
  artefactId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  artefactType: 'BOARD_DECK',
  capsTopicId: 'CAPS-NS-GR5-WATER',
  editDiff: VALID_DIFF,
  capturedAt: '2026-08-11T10:05:00.000Z',
};

describe('ToolboxEditField', () => {
  it('accepts a valid field edit', () => {
    expect(() => ToolboxEditField.parse(VALID_FIELD_EDIT)).not.toThrow();
  });

  it('rejects an empty field path', () => {
    expect(() => ToolboxEditField.parse({ ...VALID_FIELD_EDIT, field: '' })).toThrow();
  });

  it('rejects an empty before value', () => {
    expect(() => ToolboxEditField.parse({ ...VALID_FIELD_EDIT, before: '' })).toThrow();
  });

  it('rejects an empty after value', () => {
    expect(() => ToolboxEditField.parse({ ...VALID_FIELD_EDIT, after: '' })).toThrow();
  });
});

describe('ToolboxEditDiff', () => {
  it('accepts a valid edit diff', () => {
    expect(() => ToolboxEditDiff.parse(VALID_DIFF)).not.toThrow();
  });

  it('rejects a non-UUID artefactId', () => {
    expect(() =>
      ToolboxEditDiff.parse({ ...VALID_DIFF, artefactId: 'not-a-uuid' }),
    ).toThrow();
  });

  it('rejects an invalid artefactType', () => {
    expect(() =>
      ToolboxEditDiff.parse({ ...VALID_DIFF, artefactType: 'UNKNOWN_TYPE' }),
    ).toThrow();
  });

  it('rejects an empty fieldEdits array — EDITED outcome with no edits is a contract violation', () => {
    expect(() => ToolboxEditDiff.parse({ ...VALID_DIFF, fieldEdits: [] })).toThrow();
  });

  it('rejects a negative totalCharactersChanged', () => {
    expect(() =>
      ToolboxEditDiff.parse({ ...VALID_DIFF, totalCharactersChanged: -1 }),
    ).toThrow();
  });

  it('rejects a non-integer totalCharactersChanged', () => {
    expect(() =>
      ToolboxEditDiff.parse({ ...VALID_DIFF, totalCharactersChanged: 1.5 }),
    ).toThrow();
  });

  it('accepts zero totalCharactersChanged (e.g. reformatting only)', () => {
    expect(() =>
      ToolboxEditDiff.parse({ ...VALID_DIFF, totalCharactersChanged: 0 }),
    ).not.toThrow();
  });

  it('accepts multiple field edits in a single diff', () => {
    const multiEdit = {
      ...VALID_DIFF,
      fieldEdits: [
        VALID_FIELD_EDIT,
        { field: 'slides[0].title', before: 'Old', after: 'New' },
      ],
      totalCharactersChanged: 35,
    };
    expect(() => ToolboxEditDiff.parse(multiEdit)).not.toThrow();
  });
});

describe('TeacherEditSignal', () => {
  it('accepts a valid teacher edit signal', () => {
    expect(() => TeacherEditSignal.parse(VALID_SIGNAL)).not.toThrow();
  });

  it('rejects a non-UUID signalId', () => {
    expect(() =>
      TeacherEditSignal.parse({ ...VALID_SIGNAL, signalId: 'bad-id' }),
    ).toThrow();
  });

  it('rejects a non-UUID tenantId', () => {
    expect(() =>
      TeacherEditSignal.parse({ ...VALID_SIGNAL, tenantId: 'bad-id' }),
    ).toThrow();
  });

  it('rejects an empty agentId', () => {
    expect(() => TeacherEditSignal.parse({ ...VALID_SIGNAL, agentId: '' })).toThrow();
  });

  it('rejects an empty capsTopicId', () => {
    expect(() => TeacherEditSignal.parse({ ...VALID_SIGNAL, capsTopicId: '' })).toThrow();
  });

  it('rejects a signal whose editDiff has an empty fieldEdits array', () => {
    const badSignal = {
      ...VALID_SIGNAL,
      editDiff: { ...VALID_DIFF, fieldEdits: [] },
    };
    expect(() => TeacherEditSignal.parse(badSignal)).toThrow();
  });

  it('correctly identifies the producing agent through agentId', () => {
    const parsed = TeacherEditSignal.parse({ ...VALID_SIGNAL, agentId: 'TB-10' });
    expect(parsed.agentId).toBe('TB-10');
  });
});
