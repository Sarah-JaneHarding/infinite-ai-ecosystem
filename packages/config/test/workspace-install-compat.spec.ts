// Install compatibility guard.
//
// The supported package manager is pnpm, but the repository must also install with plain
// `npm install` (some hosted build tools run npm and nothing else). npm cannot read the pnpm-only
// `workspace:` protocol, so every internal dependency is declared as "*" and resolved to the local
// folder: pnpm does that because .npmrc sets link-workspace-packages=true, npm does it through the
// root "workspaces" field. These tests keep the two tools in step.
// Definition of Done (§0.4): happy path plus at least two failure paths.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

interface Manifest {
  name?: string;
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
  const internal = new Set(
    Object.values(workspaceManifests)
      .map((m) => m.name)
      .filter((n): n is string => typeof n === 'string'),
  );

  const all: Record<string, Manifest> = { 'package.json': root, ...workspaceManifests };
  for (const [path, manifest] of Object.entries(all)) {
    for (const field of DEP_FIELDS) {
      for (const [dep, spec] of Object.entries(manifest[field] ?? {})) {
        if (internal.has(dep) && spec !== '*') {
          found.push(
            `${path}: ${field}.${dep} is "${spec}" but internal packages must be "*" (the workspace: protocol breaks npm install; a pinned version could be fetched from the registry instead of the local folder)`,
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
    'packages/a/package.json': { name: '@x/a', dependencies: { zod: '4.6.7' } },
    'packages/b/package.json': { name: '@x/b', dependencies: { '@x/a': '*' } },
  };
  const globs = ['apps/*', 'packages/*'];

  it('accepts a consistent set of manifests and ignores external dependencies', () => {
    expect(problems(root, good, globs)).toEqual([]);
  });

  it('rejects the workspace: protocol for an internal dependency', () => {
    const bad = {
      ...good,
      'packages/b/package.json': {
        name: '@x/b',
        dependencies: { '@x/a': 'workspace:*' },
      },
    };
    const out = problems(root, bad, globs);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain(
      'packages/b/package.json: dependencies.@x/a is "workspace:*"',
    );
  });

  it('rejects a pinned or ranged version for an internal dependency', () => {
    for (const spec of ['0.1.0', '^0.1.0', 'latest']) {
      const bad = {
        ...good,
        'packages/b/package.json': { name: '@x/b', devDependencies: { '@x/a': spec } },
      };
      expect(problems(root, bad, globs), spec).toHaveLength(1);
    }
  });

  it('rejects an internal dependency declared in the root manifest as anything but "*"', () => {
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
