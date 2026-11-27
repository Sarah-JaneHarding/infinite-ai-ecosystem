import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The bootstrap's two GitHub roles trust an OIDC token by its `sub` claim. This repository's tokens carry
// immutable IDs ("owner@id/repo@id"), so a subject written from github_repository alone is refused by AWS
// ("Not authorized to perform sts:AssumeRoleWithWebIdentity"). Every subject must therefore be built from
// the one local that honours github_oidc_repository, or the plan role and the deploy role drift apart.
//
// This reads the committed files; it does not run Terraform.

const ROOT = new URL('../../../', import.meta.url).pathname;
const dir = join(ROOT, 'infra', 'terraform', 'bootstrap');
const main = readFileSync(join(dir, 'main.tf'), 'utf8');
const variables = readFileSync(join(dir, 'variables.tf'), 'utf8');

describe('Terraform bootstrap: OIDC subject format', () => {
  it('builds every subject from the single oidc_repository local', () => {
    const subjects = main.match(/"repo:\$\{[^}]+\}/g) ?? [];
    expect(subjects.length).toBeGreaterThanOrEqual(3); // deploy: branches and environments; plan: pull_request
    for (const subject of subjects)
      expect(subject).toBe('"repo:${local.oidc_repository}');
  });

  it('defaults the local to github_repository, so a plain-format repository is unchanged', () => {
    expect(main).toMatch(
      /oidc_repository\s*=\s*coalesce\(var\.github_oidc_repository,\s*var\.github_repository\)/,
    );
    expect(variables).toMatch(
      /variable "github_oidc_repository"[\s\S]*?default\s*=\s*null/,
    );
  });

  it('still keeps pull requests off the deploy role', () => {
    const deploy = main.slice(
      main.indexOf('data "aws_iam_policy_document" "github_assume"'),
      main.indexOf('resource "aws_iam_role" "github_deploy"'),
    );
    expect(deploy).not.toContain('pull_request');
  });
});
