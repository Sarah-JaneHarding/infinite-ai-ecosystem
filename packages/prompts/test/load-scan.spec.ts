import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PromptLoadError, loadPromptFile, scanPromptFiles } from '../src/loader.js';

const VALID_BODY = `
# ROLE

You are a test agent.

# GROUNDING

<constitution>{{l0_context}}</constitution>

# TASK

{{task}}

# HARD CONSTRAINTS

- Be correct.

# STYLE

Plain.

# REFUSAL

Refuse when unsure.

# OUTPUT SCHEMA

{{output_schema}}

# SELF-CHECK

Check everything.
`;

function promptFileContent(agent: string, version: string): string {
  return `---\nagent: ${agent}\nversion: ${version}\nmodel: plan.author\nchangelog: x\nauthor: jane\nratified_by: null\n---\n${VALID_BODY}`;
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'prompts-test-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('loadPromptFile', () => {
  it('loads a correctly named and placed prompt file', () => {
    const dir = path.join(root, 'CE-05');
    mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, '1.0.0.prompt.md');
    writeFileSync(filePath, promptFileContent('CE-05', '1.0.0'));

    const loaded = loadPromptFile(filePath);
    expect(loaded.frontMatter.agent).toBe('CE-05');
    expect(loaded.frontMatter.version).toBe('1.0.0');
  });

  it('throws when the front-matter version does not match the filename', () => {
    const dir = path.join(root, 'CE-05');
    mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, '1.0.0.prompt.md');
    writeFileSync(filePath, promptFileContent('CE-05', '2.0.0'));

    expect(() => loadPromptFile(filePath)).toThrow(PromptLoadError);
  });

  it('throws when the front-matter agent does not match the directory', () => {
    const dir = path.join(root, 'CE-05');
    mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, '1.0.0.prompt.md');
    writeFileSync(filePath, promptFileContent('CE-06', '1.0.0'));

    expect(() => loadPromptFile(filePath)).toThrow(PromptLoadError);
  });
});

describe('scanPromptFiles', () => {
  it('returns an empty array for a directory that does not exist', () => {
    expect(scanPromptFiles(path.join(root, 'does-not-exist'))).toEqual([]);
  });

  it('finds every .prompt.md file recursively, ignoring other files', () => {
    mkdirSync(path.join(root, 'CE-05'), { recursive: true });
    mkdirSync(path.join(root, 'CE-06'), { recursive: true });
    writeFileSync(
      path.join(root, 'CE-05', '1.0.0.prompt.md'),
      promptFileContent('CE-05', '1.0.0'),
    );
    writeFileSync(
      path.join(root, 'CE-06', '1.0.0.prompt.md'),
      promptFileContent('CE-06', '1.0.0'),
    );
    writeFileSync(path.join(root, 'CE-05', 'notes.md'), 'not a prompt file');
    writeFileSync(path.join(root, 'index.ts'), 'export {};');

    const found = [...scanPromptFiles(root)].sort();
    expect(found).toEqual(
      [
        path.join(root, 'CE-05', '1.0.0.prompt.md'),
        path.join(root, 'CE-06', '1.0.0.prompt.md'),
      ].sort(),
    );
  });
});
