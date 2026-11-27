import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// OQ-048 (a) guard, infrastructure side. The Keycloak provisioner client can create users and map any
// realm role, so its secret is an administrator-equivalent credential. What must hold in Terraform:
//   - only the WEB task is given it (never the worker, which is the model-facing process, or the gateway);
//   - the secret is a Secrets Manager shell created empty, never given a value in HCL (rule 7);
//   - no .tfvars file names it, and no credential-shaped key goes into plain SSM config.
//
// This reads the committed files; it does not run `terraform plan`. A person must still run
// `terraform fmt -check`, `validate` and `plan` before any `apply` (docs/RUNBOOKS/aws-setup.md).

const ROOT = new URL('../../../', import.meta.url).pathname;
const TF = join(ROOT, 'infra', 'terraform');
const SECRET = 'KEYCLOAK_PROVISIONER_CLIENT_SECRET';
const stack = readFileSync(join(TF, 'modules', 'stack', 'main.tf'), 'utf8');

/** The text of `module "<name>" { ... }`, found by brace matching (strings here contain no braces). */
function moduleBlock(source: string, name: string): string {
  const start = source.indexOf(`module "${name}" {`);
  expect(start, `module "${name}" not found in the stack`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`module "${name}" is not closed`);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '.terraform') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

describe('Terraform: the Keycloak provisioner secret (OQ-048 (a))', () => {
  it('is mapped into the web task, both the client id and the secret', () => {
    const web = moduleBlock(stack, 'ecs_service_web');
    expect(web).toContain(`${SECRET} =`);
    expect(web).toContain('KEYCLOAK_PROVISIONER_CLIENT_ID');
  });

  it('is never mapped into the worker or the gateway', () => {
    for (const name of ['ecs_service_worker', 'ecs_service_gateway']) {
      const block = moduleBlock(stack, name);
      expect(block, `${name} must not receive the provisioner credential`).not.toContain(
        'KEYCLOAK_PROVISIONER',
      );
    }
  });

  it('is created only when the environment turns the provisioner on', () => {
    const secrets = moduleBlock(stack, 'app_secrets');
    expect(secrets).toMatch(
      /var\.keycloak_provisioner_enabled\s*\?\s*\["KEYCLOAK_PROVISIONER_CLIENT_SECRET"\]/,
    );
    const variable = readFileSync(join(TF, 'modules', 'stack', 'variables.tf'), 'utf8');
    expect(variable).toMatch(
      /variable "keycloak_provisioner_enabled"[\s\S]*?default\s*=\s*false/,
    );
  });

  it('is never given a value in Terraform, and never named in a tfvars file', () => {
    // Other modules derive credentials with a secret version (database, cache, Langfuse). The modules that
    // own this one must not: the value is set by an operator after apply.
    for (const file of ['modules/app-secrets/main.tf', 'modules/stack/main.tf']) {
      expect(readFileSync(join(TF, file), 'utf8'), file).not.toMatch(
        /resource\s+"aws_secretsmanager_secret_version"/,
      );
    }
    for (const file of walk(TF).filter((f) => /\.tfvars(\.example)?$/.test(f))) {
      expect(readFileSync(file, 'utf8'), file).not.toContain(SECRET);
    }
  });

  it('keeps the secret out of plain SSM config: only the client id is published there', () => {
    const secrets = moduleBlock(stack, 'app_secrets');
    const ssm = secrets.slice(secrets.indexOf('ssm_config'));
    expect(ssm).toContain('KEYCLOAK_PROVISIONER_CLIENT_ID');
    expect(ssm).not.toContain(SECRET);
  });

  it('warns at plan time when enabled without an issuer', () => {
    expect(stack).toContain('check "keycloak_provisioner_needs_issuer"');
  });
});
