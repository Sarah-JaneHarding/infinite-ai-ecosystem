import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Two production plan failures found when the PR "Terraform plan" job first ran against real state:
//  1. the Langfuse target group name is "<environment>-langfuse-web", which is 35 characters for
//     "infinite-ai-production" and AWS allows 32;
//  2. an unset GitHub variable reaches Terraform as "" (not null), so the stack built "langfuse." and an
//     empty hosted-zone id.
// These read the committed files and mirror the name formula; they do not run Terraform. The real proof is
// the plan job itself.

const ROOT = new URL('../../../', import.meta.url).pathname;
const TF = join(ROOT, 'infra', 'terraform', 'modules');
const read = (path: string): string => readFileSync(join(TF, path), 'utf8');
const code = (source: string): string =>
  source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

/** The same arithmetic as `local.web_target_group_name` in modules/langfuse/main.tf. */
function webTargetGroupName(name: string): string {
  const plain = `${name}-web`;
  if (plain.length <= 32) return plain;
  const prefix = name.slice(0, 20).replace(/^-+|-+$/g, '');
  const hash = createHash('sha256').update(name).digest('hex').slice(0, 7);
  return `${prefix}-${hash}-web`;
}

describe('Terraform: Langfuse target group name (32-character limit)', () => {
  const langfuse = read('langfuse/main.tf');

  it('is computed through the capped local, not built inline', () => {
    // Only the target group has the 32-character limit (the module's security group of the same suffix does not).
    const block =
      /resource "aws_lb_target_group" "web" \{[\s\S]*?\n\}/.exec(langfuse)?.[0] ?? '';
    expect(block, 'target group block not found').not.toBe('');
    expect(block).not.toMatch(/name\s*=\s*"\$\{var\.name\}-web"/);
    expect(block).toMatch(/name\s*=\s*local\.web_target_group_name/);
    expect(langfuse).toContain('length("${var.name}-web") <= 32');
    expect(langfuse).toContain('substr(var.name, 0, 20)');
    expect(langfuse).toContain('substr(sha256(var.name), 0, 7)');
  });

  it('fits for every environment name, and leaves a name that already fits unchanged', () => {
    for (const env of ['dev', 'staging', 'production']) {
      const name = `infinite-ai-${env}-langfuse`;
      const result = webTargetGroupName(name);
      expect(result.length, name).toBeLessThanOrEqual(32);
      if (`${name}-web`.length <= 32) expect(result).toBe(`${name}-web`);
    }
    // The case that failed: 35 characters before the fix.
    expect('infinite-ai-production-langfuse-web'.length).toBe(35);
    expect(webTargetGroupName('infinite-ai-production-langfuse').length).toBe(32);
  });

  it('stays distinct for different long names, so two environments cannot collide', () => {
    expect(webTargetGroupName('infinite-ai-production-langfuse')).not.toBe(
      webTargetGroupName('infinite-ai-productionx-langfuse'),
    );
  });
});

describe('Terraform: an empty domain or zone id means "unset" (modules/stack)', () => {
  const main = read('stack/main.tf');
  const outputs = read('stack/outputs.tf');

  it('normalises "" to null in one place', () => {
    expect(main).toMatch(
      /domain_name\s*=\s*var\.domain_name == "" \? null : var\.domain_name/,
    );
    expect(main).toMatch(
      /dns_zone_id\s*=\s*var\.dns_zone_id == "" \? null : var\.dns_zone_id/,
    );
  });

  it('reads only the normalised locals everywhere else', () => {
    const uses = (source: string): string[] =>
      code(source)
        .split('\n')
        .filter((line) => /var\.(domain_name|dns_zone_id)\b/.test(line));
    // The two normalising lines are the only code that may read the raw variables.
    expect(uses(main)).toHaveLength(2);
    expect(uses(outputs)).toEqual([]);
  });
});
