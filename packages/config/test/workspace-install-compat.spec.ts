// Install compatibility guard.
//
// The supported package manager is pnpm, but the repository must also install with plain
// `npm install` (some hosted build tools run npm and nothing else). npm cannot read the pnpm-only
// `workspace:` protocol, so every internal dependency is declared with the EXACT version of the
// workspace package it points to and resolved to the local folder: pnpm does that because .npmrc sets
// link-workspace-packages=true, npm does it through the root "workspaces" field. An exact version
// (not "*") because scripts/audit-supply-chain.ts forbids range specifiers. If a declared version
// ever differs from the package's own version, neither tool can link the folder and would look in
// the registry instead, so these tests fail on any difference. These tests keep the two tools in step.
// Definition of Done (§0.4): happy path plus at least two failure paths.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

interface Manifest {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  workspaces?: string[] | undefined;
  overrides?: Record<string, string> | undefined;
  pnpm?: { overrides?: Record<string, string> };
}

const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Everything that would break installing with npm or with pnpm, as readable sentences. Empty means fine. */
function problems(
  root: Manifest,
  workspaceManifests: Record<string, Manifest>,
  pnpmWorkspaceGlobs: string[],
): string[] {
  const found: string[] = [];
  const versionOf = new Map<string, string | undefined>();
  for (const m of Object.values(workspaceManifests)) {
    if (typeof m.name === 'string') versionOf.set(m.name, m.version);
  }

  const all: Record<string, Manifest> = { 'package.json': root, ...workspaceManifests };
  for (const [path, manifest] of Object.entries(all)) {
    for (const field of DEP_FIELDS) {
      for (const [dep, spec] of Object.entries(manifest[field] ?? {})) {
        if (versionOf.has(dep) && spec !== versionOf.get(dep)) {
          found.push(
            `${path}: ${field}.${dep} is "${spec}" but must be exactly "${versionOf.get(dep)}", the version of the workspace package (the workspace: protocol breaks npm install, "*" and other ranges fail audit:supply-chain, and a version that differs from the local package makes the tools look in the registry instead of the local folder)`,
          );
        }
      }
    }
  }

  const npmGlobs = [...(root.workspaces ?? [])].sort();
  const pnpmGlobs = [...pnpmWorkspaceGlobs].sort();
  if (JSON.stringify(npmGlobs) !== JSON.stringify(pnpmGlobs)) {
    found.push(
      `package.json "workspaces" ${JSON.stringify(npmGlobs)} must match pnpm-workspace.yaml packages ${JSON.stringify(pnpmGlobs)}`,
    );
  }

  const pnpmOverrides = root.pnpm?.overrides ?? {};
  const npmOverrides = root.overrides ?? {};
  const sortedEntries = (o: Record<string, string>) =>
    JSON.stringify(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  if (sortedEntries(pnpmOverrides) !== sortedEntries(npmOverrides)) {
    found.push(
      `package.json "overrides" (used by npm) must equal "pnpm.overrides" (used by pnpm): ${sortedEntries(npmOverrides)} vs ${sortedEntries(pnpmOverrides)}`,
    );
  }
  return found;
}

function readManifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
}

function loadRepo(): {
  root: Manifest;
  workspaces: Record<string, Manifest>;
  globs: string[];
} {
  const workspaces: Record<string, Manifest> = {};
  for (const parent of ['apps', 'packages']) {
    for (const entry of readdirSync(join(ROOT, parent), { withFileTypes: true })) {
      const file = join(ROOT, parent, entry.name, 'package.json');
      if (entry.isDirectory() && existsSync(file))
        workspaces[`${parent}/${entry.name}/package.json`] = readManifest(file);
    }
  }
  const yaml = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8');
  const globs = [...yaml.matchAll(/^\s*-\s*['"]?([^'"\n]+?)['"]?\s*$/gm)].map(
    (m) => m[1] as string,
  );
  return { root: readManifest(join(ROOT, 'package.json')), workspaces, globs };
}

// ─── The real repository ──────────────────────────────────────────────────────

describe('workspace install compatibility (real repository)', () => {
  const repo = loadRepo();

  it('has no problems that would break npm or pnpm', () => {
    expect(problems(repo.root, repo.workspaces, repo.globs)).toEqual([]);
  });

  it('actually checks something: there are internal packages and internal dependencies', () => {
    const names = new Set(Object.values(repo.workspaces).map((m) => m.name));
    expect(names.size).toBeGreaterThan(10);
    let internalDeps = 0;
    for (const m of [repo.root, ...Object.values(repo.workspaces)]) {
      for (const field of DEP_FIELDS)
        for (const dep of Object.keys(m[field] ?? {}))
          if (names.has(dep)) internalDeps += 1;
    }
    expect(internalDeps).toBeGreaterThan(20);
  });

  it('no manifest anywhere uses the pnpm-only workspace: protocol', () => {
    for (const [path, m] of Object.entries({
      'package.json': repo.root,
      ...repo.workspaces,
    })) {
      expect(JSON.stringify(m), path).not.toContain('"workspace:');
    }
  });
});

// ─── The checker itself: it must be able to fail ──────────────────────────────

describe('workspace install compatibility checker', () => {
  const root: Manifest = {
    workspaces: ['apps/*', 'packages/*'],
    overrides: { nanoid: '3.3.18' },
    pnpm: { overrides: { nanoid: '3.3.18' } },
  };
  const good: Record<string, Manifest> = {
    'packages/a/package.json': {
      name: '@x/a',
      version: '0.1.0',
      dependencies: { zod: '4.6.7' },
    },
    'packages/b/package.json': {
      name: '@x/b',
      version: '0.1.0',
      dependencies: { '@x/a': '0.1.0' },
    },
  };
  const globs = ['apps/*', 'packages/*'];
  const withB = (b: Manifest): Record<string, Manifest> => ({
    ...good,
    'packages/b/package.json': { name: '@x/b', version: '0.1.0', ...b },
  });

  it('accepts a consistent set of manifests and ignores external dependencies', () => {
    expect(problems(root, good, globs)).toEqual([]);
  });

  it('rejects the workspace: protocol for an internal dependency', () => {
    const out = problems(root, withB({ dependencies: { '@x/a': 'workspace:*' } }), globs);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain(
      'packages/b/package.json: dependencies.@x/a is "workspace:*" but must be exactly "0.1.0"',
    );
  });

  it('rejects a range or tag for an internal dependency, including "*" (audit:supply-chain forbids it)', () => {
    for (const spec of ['*', '^0.1.0', '~0.1.0', '0.x', '>=0.1.0', 'latest']) {
      const out = problems(root, withB({ devDependencies: { '@x/a': spec } }), globs);
      expect(out, spec).toHaveLength(1);
    }
  });

  it('rejects an exact version that is not the workspace package version', () => {
    // A version that differs cannot be linked from the folder, so the tools would go to the registry.
    const out = problems(root, withB({ dependencies: { '@x/a': '0.2.0' } }), globs);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('is "0.2.0" but must be exactly "0.1.0"');
  });

  it('follows a version bump: the declaration must change with the package version', () => {
    const bumped: Record<string, Manifest> = {
      ...good,
      'packages/a/package.json': { name: '@x/a', version: '0.2.0' },
    };
    expect(problems(root, bumped, globs)).toHaveLength(1);
    const updated: Record<string, Manifest> = {
      ...bumped,
      'packages/b/package.json': {
        name: '@x/b',
        version: '0.1.0',
        dependencies: { '@x/a': '0.2.0' },
      },
    };
    expect(problems(root, updated, globs)).toEqual([]);
  });

  it('checks the root manifest as well', () => {
    const out = problems(
      { ...root, devDependencies: { '@x/a': 'workspace:*' } },
      good,
      globs,
    );
    expect(out[0]).toContain('package.json: devDependencies.@x/a');
  });

  it('rejects npm workspaces that differ from the pnpm workspace list', () => {
    expect(problems({ ...root, workspaces: ['packages/*'] }, good, globs)[0]).toContain(
      'must match pnpm-workspace.yaml',
    );
    expect(problems({ ...root, workspaces: undefined }, good, globs)[0]).toContain(
      'must match pnpm-workspace.yaml',
    );
  });

  it('rejects npm overrides that drift from the pnpm overrides', () => {
    const drift = { ...root, overrides: { nanoid: '3.3.17' } };
    expect(problems(drift, good, globs)[0]).toContain(
      '"overrides" (used by npm) must equal "pnpm.overrides"',
    );
    const missing = { ...root, overrides: undefined };
    expect(problems(missing, good, globs)[0]).toContain(
      '"overrides" (used by npm) must equal "pnpm.overrides"',
    );
  });
});
