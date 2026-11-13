import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

// Guards for the development and testing sandbox (infra/sandbox, scripts/sandbox.sh, docs/SANDBOX.md).
//
// The sandbox is a place to run the platform with synthetic data, so what it must never become is a
// place with a guessable password, a database reachable from the LAN, a container that can rewrite the
// developer's checkout or reach the Docker daemon, or a committed secret (rule 7). These tests read the
// real files and run the real secret generator; they need bash and openssl, not Docker.

const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const SCRIPT = join(ROOT, 'scripts/sandbox.sh');

const scratch = mkdtempSync(join(tmpdir(), 'sandbox-spec-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

// An explicit environment: the generator needs only a PATH.
const BASE_ENV = { PATH: '/usr/local/bin:/usr/bin:/bin' };

function generate(
  name: string,
  extraEnv: Record<string, string> = {},
): Record<string, string> {
  const out = join(scratch, name);
  execFileSync('bash', [SCRIPT, 'env', '--out', out], {
    env: { ...BASE_ENV, ...extraEnv },
  });
  const values: Record<string, string> = {};
  for (const line of readFileSync(out, 'utf8').split('\n')) {
    if (line.startsWith('#') || !line.includes('=')) continue;
    const at = line.indexOf('=');
    values[line.slice(0, at)] = line.slice(at + 1);
  }
  return values;
}

// A credential is a password, secret, salt or key. `KEYCLOAK_ADMIN` is a user name that merely contains
// "KEY", and `OBJECT_STORE_ACCESS_KEY` is MinIO's user name by another name: identifiers, fixed on purpose.
const IDENTIFIERS = new Set(['OBJECT_STORE_ACCESS_KEY']);
const isCredential = (name: string): boolean =>
  /PASSWORD|SECRET|SALT|(^|_)KEY(_|$)/.test(name) && !IDENTIFIERS.has(name);

const REQUIRED = read('infra/docker/.env.example')
  .split('\n')
  .filter((l) => /^[A-Z][A-Z0-9_]*=$/.test(l))
  .map((l) => l.slice(0, -1));

describe('the generated environment', () => {
  const env = generate('one.env');
  const other = generate('two.env');

  it('fills every variable infra/docker/.env.example asks for — none blank', () => {
    expect(REQUIRED.length).toBeGreaterThan(30);
    for (const name of REQUIRED) {
      expect(env[name], `${name} missing or empty`).toBeTruthy();
    }
  });

  it('is readable by its owner only', () => {
    expect(statSync(join(scratch, 'one.env')).mode & 0o777).toBe(0o600);
  });

  it('gives every credential fresh randomness: two generations share no secret', () => {
    const secretNames = REQUIRED.filter(isCredential);
    expect(secretNames.length).toBeGreaterThan(15);
    for (const name of secretNames) {
      expect(other[name], name).not.toBe(env[name]);
    }
  });

  it('never repeats a credential across services', () => {
    const passwords = REQUIRED.filter((n) => /PASSWORD$/.test(n)).map((n) => env[n]);
    expect(new Set(passwords).size).toBe(passwords.length);
  });

  it('makes every database role password long and URL-safe, because it is embedded in a connection string', () => {
    for (const name of [
      'POSTGRES_PASSWORD',
      'MIGRATOR_PASSWORD',
      'APP_RW_PASSWORD',
      'WORKER_RW_PASSWORD',
      'ANALYTICS_RO_PASSWORD',
    ]) {
      expect(env[name], name).toMatch(/^[A-Za-z0-9]{32}$/);
    }
  });

  it('meets the realm password policy for the logins that use it (12+, upper, lower, digit, special)', () => {
    for (const name of [
      'SEED_USER_PASSWORD',
      'KEYCLOAK_ADMIN_PASSWORD',
      'LANGFUSE_INIT_USER_PASSWORD',
    ]) {
      const value = env[name] ?? '';
      expect(value.length, name).toBeGreaterThanOrEqual(12);
      expect(value, name).toMatch(/[A-Z]/);
      expect(value, name).toMatch(/[a-z]/);
      expect(value, name).toMatch(/[0-9]/);
      expect(value, name).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it('connects the application as app_rw, never the migrator (rule 5)', () => {
    expect(env['DATABASE_URL']).toMatch(
      /^postgresql:\/\/app_rw:[A-Za-z0-9]+@postgres:5432\//,
    );
    expect(env['DIRECT_DATABASE_URL']).toBe(env['DATABASE_URL']);
    expect(env['DATABASE_URL']).not.toContain('migrator');
    expect(env['DATABASE_URL']).not.toContain(env['MIGRATOR_PASSWORD'] ?? 'x');
  });

  it('keeps the values that must agree in agreement', () => {
    expect(env['AUTH_KEYCLOAK_SECRET']).toBe(env['KEYCLOAK_WEB_CLIENT_SECRET']);
    expect(env['OBJECT_STORE_SECRET_KEY']).toBe(env['MINIO_ROOT_PASSWORD']);
    expect(env['AUTH_KEYCLOAK_ID']).toBe('infinite-ai-web');
  });

  it('produces keys in the format their consumers require', () => {
    expect(env['LANGFUSE_ENCRYPTION_KEY']).toMatch(/^[0-9a-f]{64}$/);
    expect(Buffer.from(env['DB_ENCRYPTION_KEY'] ?? '', 'base64')).toHaveLength(32);
    expect(Buffer.from(env['NEXTAUTH_SECRET'] ?? '', 'base64')).toHaveLength(32);
  });

  it('uses no guessable value for any credential', () => {
    const weak =
      /^(password|changeme|secret|admin|postgres|minioadmin|letmein|123456|test)$/i;
    for (const name of REQUIRED.filter(isCredential)) {
      expect(env[name], name).not.toMatch(weak);
    }
  });

  it('points only at example.invalid addresses — no real mailbox', () => {
    expect(env['LANGFUSE_INIT_USER_EMAIL']).toMatch(/@example\.invalid$/);
  });
});

describe('the generator', () => {
  it('refuses a variable it has no rule for, instead of leaving it blank or guessing', () => {
    const example = join(scratch, 'new.env.example');
    writeFileSync(
      example,
      `${read('infra/docker/.env.example')}\nBRAND_NEW_REQUIRED_VARIABLE=\n`,
    );
    const result = spawnSync('bash', [SCRIPT, 'env', '--out', join(scratch, 'x.env')], {
      env: { ...BASE_ENV, SANDBOX_ENV_EXAMPLE: example },
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('BRAND_NEW_REQUIRED_VARIABLE');
  });

  it('never overwrites an existing environment file — credentials in use stay valid', () => {
    const file = join(scratch, 'kept.env');
    writeFileSync(file, 'SENTINEL=kept\n');
    execFileSync('bash', [SCRIPT, 'env'], {
      env: { ...BASE_ENV, SANDBOX_ENV_FILE: file },
    });
    expect(readFileSync(file, 'utf8')).toBe('SENTINEL=kept\n');
  });

  it('is strict about errors and unset variables', () => {
    expect(read('scripts/sandbox.sh')).toMatch(/^set -euo pipefail$/m);
    for (const f of ['infra/sandbox/sandbox-entrypoint.sh']) {
      expect(read(f), f).toMatch(/^set -euo pipefail$/m);
    }
    expect(read('infra/sandbox/sandbox-verify.sh')).toMatch(/^set -uo pipefail$/m);
  });

  it('is told, in git, to ignore the file it writes (rule 7)', () => {
    const ignore = read('.gitignore').split('\n');
    expect(ignore).toContain('.env');
    expect(ignore).toContain('.env.*');
    expect(ignore).toContain('!.env.example');
  });

  it('commits no .env file for the sandbox', () => {
    expect(() => read('infra/sandbox/.env')).toThrow();
  });
});

describe('the compose overlay', () => {
  const overlay = read('infra/sandbox/compose.sandbox.yml');
  const code = overlay.replace(/^\s*#.*$/gm, '');

  it('uses its own project, so it never shares volumes with a developer’s dev stack', () => {
    expect(code).toMatch(/^name: infinite-ai-sandbox$/m);
    expect(code).not.toMatch(/^name: infinite-ai-dev$/m);
  });

  it('publishes every port on loopback only — a sandbox is not reachable from the LAN', () => {
    const published = [...code.matchAll(/^\s+- '([^']*:\d+:\d+)'/gm)].map(
      (m) => m[1] ?? '',
    );
    expect(published.length).toBeGreaterThanOrEqual(3);
    for (const port of published) {
      expect(port, port).toMatch(
        /^(127\.0\.0\.1|\$\{SANDBOX_KEYCLOAK_BIND:-127\.0\.0\.1\}):\d+:\d+$/,
      );
    }
  });

  it('replaces the dev file’s ports rather than adding to them', () => {
    expect(code.match(/ports: !override/g)).toHaveLength(3);
  });

  it('mounts the repository read-only, so nothing in the sandbox can change the checkout', () => {
    expect(code).toContain('- ../..:/repo:ro');
  });

  it('never gives a container the Docker daemon, host namespaces, or privilege', () => {
    for (const forbidden of [
      'docker.sock',
      'privileged',
      'network_mode',
      'pid: host',
      'cap_add',
      'devices:',
    ]) {
      expect(code, forbidden).not.toContain(forbidden);
    }
  });

  it('keeps the toolbox and the migrate step out of a plain `up`', () => {
    expect(code.match(/profiles: \[tools\]/g)).toHaveLength(2);
  });

  it('moves the heavy optional services behind a profile', () => {
    for (const service of [
      'minio',
      'minio-init',
      'langfuse-clickhouse',
      'langfuse-postgres',
      'langfuse-redis',
      'langfuse-worker',
      'langfuse-web',
    ]) {
      expect(code, service).toMatch(
        new RegExp(`^  ${service}:\\n    profiles: \\[observability\\]`, 'm'),
      );
    }
  });

  it('writes no credential literally: every secret is interpolated from the generated file', () => {
    for (const line of code.split('\n')) {
      if (!/(PASSWORD|SECRET|_KEY)\b.*:/.test(line)) continue;
      expect(line, line).toMatch(/\$\{/);
    }
  });

  it('applies the migrations as the migrator and runs the toolbox as app_rw', () => {
    const migrate = code.slice(code.indexOf('  migrate:'));
    expect(migrate).toMatch(/DATABASE_URL: postgresql:\/\/migrator:/);
    const tools = code.slice(code.indexOf('x-toolbox:'), code.indexOf('services:'));
    expect(tools).toMatch(/DATABASE_URL: postgresql:\/\/app_rw:/);
  });

  it('seeds the dev invitee after the identities, so its invitation finds the tenant and no account is made for it', () => {
    const migrate = code.slice(code.indexOf('  migrate:'));
    const steps = [
      ...migrate.matchAll(/db:(migrate:deploy|seed:identities|seed:invitations|seed)\b/g),
    ].map((m) => m[1]);
    expect(steps).toEqual([
      'migrate:deploy',
      'seed',
      'seed:identities',
      'seed:invitations',
    ]);
  });

  it('runs the data-plane services it shares with compose.dev.yml on the images that file pins', () => {
    const dev = read('infra/docker/compose.dev.yml');
    expect(dev).toContain('pgvector/pgvector:pg16');
    for (const service of ['postgres', 'redis', 'keycloak', 'keycloak-db-init']) {
      expect(dev, service).toMatch(new RegExp(`^  ${service}:`, 'm'));
    }
  });
});

describe('the toolbox image', () => {
  const dockerfile = read('infra/sandbox/Dockerfile');

  it('runs as an unprivileged user', () => {
    expect(dockerfile).toMatch(/^USER node$/m);
  });

  it('pins the same pnpm as the repository', () => {
    const pinned = /"packageManager": "pnpm@([\d.]+)"/.exec(read('package.json'))?.[1];
    expect(pinned).toBeTruthy();
    expect(dockerfile).toContain(`ARG PNPM_VERSION=${pinned}`);
  });

  it('is built from a Node image that satisfies the repository’s engines.node', () => {
    expect(read('package.json')).toContain('"node": ">=22.0.0"');
    expect(dockerfile).toMatch(/^FROM node:22-/m);
  });

  it('bakes in no secret and no source code', () => {
    expect(dockerfile).not.toMatch(/PASSWORD|SECRET|TOKEN|API_KEY/);
    expect(dockerfile).not.toMatch(/^COPY \.\.?\s/m);
  });

  it('installs from the lockfile only — never resolves anew', () => {
    expect(read('infra/sandbox/sandbox-entrypoint.sh')).toContain(
      'pnpm install --frozen-lockfile',
    );
  });

  it('keeps .env files out of the toolbox copy of the repository', () => {
    const entry = read('infra/sandbox/sandbox-entrypoint.sh');
    expect(entry).toMatch(
      /--include '\.env\.example' --exclude '\.env' --exclude '\.env\.\*'/,
    );
  });
});

describe('the smoke test', () => {
  const verify = read('infra/sandbox/sandbox-verify.sh');

  it('checks the invariants it claims to: roles, migrations, RLS failing closed, tenant isolation, identity provider, Redis', () => {
    for (const phrase of [
      'the four roles exist',
      'migrations applied',
      'RLS fails closed',
      'a tenant context sees exactly its own tenant',
      'Keycloak serves the infinite-ai realm',
      'Redis answers PING',
    ]) {
      expect(verify, phrase).toContain(phrase);
    }
  });

  it('fails the run when any check fails', () => {
    expect(verify).toMatch(/exit "\$failures"/);
  });

  it('reads its credentials from the environment, never from a file or the script', () => {
    expect(verify).not.toMatch(/postgresql:\/\/\w+:[^$\s]/);
  });
});

describe('the staging sandbox (a stand-in model, no credentials, no spend)', () => {
  const overlay = read('infra/sandbox/compose.sandbox.yml');
  const stub = overlay.slice(
    overlay.indexOf('  model-stub:'),
    overlay.indexOf('volumes:\n  sandbox-workspace:'),
  );
  const staging = read('infra/sandbox/compose.staging.yml');
  const script = read('scripts/sandbox.sh');
  const stagingFn = script.slice(
    script.indexOf('cmd_staging() {'),
    script.indexOf('cmd_staging_down() {'),
  );

  it('runs the stub behind the staging profile, so a plain `up` never starts it', () => {
    expect(stub).toMatch(/profiles: \[staging\]/);
  });

  it('publishes no port for the stub: only the gateway, over the network, can reach it', () => {
    expect(stub).not.toMatch(/^\s+ports:/m);
    expect(stub).not.toMatch(/network_mode|privileged|docker\.sock|pid:|ipc:/);
  });

  it('runs the stub unprivileged, read-only, with every capability dropped and a read-only source', () => {
    expect(stub).toMatch(/user: node/);
    expect(stub).toMatch(/read_only: true/);
    expect(stub).toMatch(/cap_drop: \[ALL\]/);
    expect(stub).toMatch(/no-new-privileges:true/);
    expect(stub).toMatch(/mem_limit:/);
    expect(stub).toMatch(/model-stub:\/stub:ro/);
  });

  it('publishes the staging UI on loopback only, replacing the base file’s all-interface port', () => {
    expect(staging).toMatch(/ports: !override/);
    expect(staging).toMatch(/- '127\.0\.0\.1:3000:3000'/);
    expect(staging).not.toMatch(/- '3000:3000'/);
  });

  it('removes every real provider credential from the apps’ environment before starting them', () => {
    for (const name of [
      'ANTHROPIC_API_KEYS',
      'OPENAI_API_KEYS',
      'GOOGLE_API_KEYS',
      'LOCAL_MODEL_API_KEYS',
    ]) {
      expect(stagingFn, name).toContain(`-u ${name}`);
    }
    // ...and never reads one back in: no assignment of a real provider key anywhere in the staging command.
    // (Checked before the closing message, which quotes the `apps` command for the person to copy.)
    const commands = stagingFn.slice(0, stagingFn.indexOf('cat <<MSG'));
    expect(commands).not.toMatch(/(ANTHROPIC|OPENAI|GOOGLE)_API_KEYS=/);
  });

  it('points the gateway at the stub alone: the stub’s address, a placeholder credential, the stub routing file', () => {
    expect(stagingFn).toContain('LOCAL_MODEL_BASE_URL=http://model-stub:11500/v1');
    expect(stagingFn).toContain(
      'GATEWAY_ROUTING_CONFIG=/repo/apps/gateway/routing.stub.json',
    );
    expect(stagingFn).toContain('LOCAL_MODEL_API_KEYS=sandbox-stub-credential');
    expect(stagingFn).toContain('compose.staging.yml');
  });

  it('starts the stub and waits for it before the apps that depend on it', () => {
    expect(stagingFn.indexOf('model-stub')).toBeGreaterThan(-1);
    expect(stagingFn.indexOf('--profile staging up -d --wait model-stub')).toBeLessThan(
      stagingFn.indexOf('compose.apps.yml'),
    );
  });

  it('tells the person plainly what staging is good for and what it is not', () => {
    expect(stagingFn).toContain('STAND-IN model');
    expect(stagingFn).toContain('Not good for: judging what an agent WRITES');
  });

  it('offers `staging`, `staging-down` and `build` as commands', () => {
    for (const command of ['staging', 'staging-down', 'build']) {
      expect(script).toMatch(new RegExp(`^  ${command}\\) `, 'm'));
    }
  });
});
