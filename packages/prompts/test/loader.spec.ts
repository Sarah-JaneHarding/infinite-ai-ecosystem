import { describe, expect, it } from 'vitest';

import { PromptLoadError, hashPromptContent, parsePromptFile } from '../src/loader.js';

const VALID_FRONT_MATTER = `agent: CE-05
version: 1.0.0
model: plan.author
changelog: Initial version.
author: jane@school.example
ratified_by: null`;

const VALID_BODY = `

# ROLE

You are a South African CAPS lesson-planning engine.

# GROUNDING

<constitution>{{l0_context}}</constitution>

# TASK

{{task}}

# HARD CONSTRAINTS

- Output MUST validate against the provided schema.

# STYLE

Concrete, teacher-usable, no filler.

# REFUSAL

If the task would require inventing curriculum, refuse.

# OUTPUT SCHEMA

{{output_schema}}

# SELF-CHECK

Verify every section is present before returning.
`;

function validPromptFile(frontMatter = VALID_FRONT_MATTER, body = VALID_BODY): string {
  return `---\n${frontMatter}\n---\n${body}`;
}

describe('parsePromptFile', () => {
  it('parses a fully valid prompt file', () => {
    const parsed = parsePromptFile(validPromptFile(), 'CE-05/1.0.0.prompt.md');

    expect(parsed.frontMatter).toEqual({
      agent: 'CE-05',
      version: '1.0.0',
      model: 'plan.author',
      changelog: 'Initial version.',
      author: 'jane@school.example',
      ratified_by: null,
    });
    expect(parsed.body).toContain('# ROLE');
    expect(parsed.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('accepts a non-null ratified_by value', () => {
    const raw = validPromptFile(
      VALID_FRONT_MATTER.replace('ratified_by: null', 'ratified_by: hod-uuid-1234'),
    );
    const parsed = parsePromptFile(raw, 'test');
    expect(parsed.frontMatter.ratified_by).toBe('hod-uuid-1234');
  });

  it('strips quotes from a quoted front-matter value', () => {
    const raw = validPromptFile(
      VALID_FRONT_MATTER.replace(
        'changelog: Initial version.',
        `changelog: "Initial version: tightened grounding."`,
      ),
    );
    const parsed = parsePromptFile(raw, 'test');
    expect(parsed.frontMatter.changelog).toBe('Initial version: tightened grounding.');
  });

  it('two files with identical content hash identically', () => {
    const a = parsePromptFile(validPromptFile(), 'a');
    const b = parsePromptFile(validPromptFile(), 'b');
    expect(a.hash).toBe(b.hash);
  });

  it('a changed body produces a different hash than an unchanged one', () => {
    const original = parsePromptFile(validPromptFile(), 'a');
    const edited = parsePromptFile(
      validPromptFile(VALID_FRONT_MATTER, VALID_BODY.replace('refuse.', 'decline.')),
      'a',
    );
    expect(edited.hash).not.toBe(original.hash);
  });

  it('throws when front matter is missing entirely', () => {
    expect(() => parsePromptFile('# ROLE\nJust a body.', 'test')).toThrow(
      PromptLoadError,
    );
  });

  it('throws on a malformed front-matter line with no colon', () => {
    const raw = validPromptFile(`${VALID_FRONT_MATTER}\nthis line has no colon`);
    expect(() => parsePromptFile(raw, 'test')).toThrow(PromptLoadError);
  });

  it('throws when a required front-matter field is missing', () => {
    const raw = validPromptFile(
      VALID_FRONT_MATTER.split('\n')
        .filter((line) => !line.startsWith('model:'))
        .join('\n'),
    );
    expect(() => parsePromptFile(raw, 'test')).toThrow(PromptLoadError);
  });

  it('throws when version is not a semver string', () => {
    const raw = validPromptFile(
      VALID_FRONT_MATTER.replace('version: 1.0.0', 'version: v1'),
    );
    expect(() => parsePromptFile(raw, 'test')).toThrow(PromptLoadError);
  });

  it('throws when model is not a valid logical model name', () => {
    const raw = validPromptFile(
      VALID_FRONT_MATTER.replace('model: plan.author', 'model: gpt-4o'),
    );
    expect(() => parsePromptFile(raw, 'test')).toThrow(PromptLoadError);
  });

  it('throws when a mandatory section is missing', () => {
    const bodyWithoutRefusal = VALID_BODY.replace(
      /# REFUSAL[\s\S]*?(?=# OUTPUT SCHEMA)/,
      '',
    );
    expect(() =>
      parsePromptFile(validPromptFile(VALID_FRONT_MATTER, bodyWithoutRefusal), 'test'),
    ).toThrow(PromptLoadError);
  });

  it('throws when sections are present but out of order', () => {
    const reordered = VALID_BODY.replace('# ROLE', '# TEMP_MARKER')
      .replace('# TASK', '# ROLE')
      .replace('# TEMP_MARKER', '# TASK');
    expect(() =>
      parsePromptFile(validPromptFile(VALID_FRONT_MATTER, reordered), 'test'),
    ).toThrow(PromptLoadError);
  });

  it('throws when an extra, non-mandatory section is present', () => {
    const withExtra = `${VALID_BODY}\n# EXTRA SECTION\n\nNot part of the mandated structure.\n`;
    expect(() =>
      parsePromptFile(validPromptFile(VALID_FRONT_MATTER, withExtra), 'test'),
    ).toThrow(PromptLoadError);
  });
});

describe('hashPromptContent', () => {
  it('is a deterministic sha256 hex digest', () => {
    expect(hashPromptContent('abc')).toBe(hashPromptContent('abc'));
    expect(hashPromptContent('abc')).not.toBe(hashPromptContent('abd'));
    expect(hashPromptContent('abc')).toMatch(/^[0-9a-f]{64}$/);
  });
});
