// Guard for infra/docker/initdb/02-roles.sh.
//
// The script feeds its SQL through an UNQUOTED heredoc so the four role passwords
// interpolate. An unquoted heredoc also performs command substitution on backticks and
// dollar-parenthesis anywhere in its body, comments included. A backticked word in an SQL
// comment therefore runs as a command during database initialisation, as the entrypoint's
// superuser; today the words happen not to be commands, so it only prints noise and hides
// real errors, but the first backticked word that is on PATH would execute.
//
// The fix is structural (explanations live in shell comments above the psql call) and this
// test keeps it that way. Quoting the delimiter would also silence the problem but stop
// the passwords interpolating, so that is asserted against too.
//
// The integration tier mounts this directory (test/support/database.ts), but it cannot see
// this class of defect: the script still exits 0 and the roles are still created.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const scriptPath = fileURLToPath(
  new URL('../../../infra/docker/initdb/02-roles.sh', import.meta.url),
);

const PASSWORD_VARIABLES = [
  'MIGRATOR_PASSWORD',
  'APP_RW_PASSWORD',
  'WORKER_RW_PASSWORD',
  'ANALYTICS_RO_PASSWORD',
] as const;

interface Heredoc {
  readonly delimiterToken: string;
  readonly delimiter: string;
  readonly quoted: boolean;
  readonly body: string;
}

/** Every heredoc in a shell script: `<<EOF`, `<<-EOF`, `<<'EOF'`, `<<"EOF"`. */
function parseHeredocs(script: string): Heredoc[] {
  const lines = script.split('\n');
  const found: Heredoc[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const opener = /<<-?\s*(?<token>'[^']+'|"[^"]+"|\\?[A-Za-z_][A-Za-z0-9_]*)/.exec(
      line,
    );
    const token = opener?.groups?.['token'];
    if (token === undefined) continue;
    const quoted = /^['"\\]/.test(token);
    const delimiter = token.replace(/^['"\\]|['"]$/g, '');
    const bodyLines: string[] = [];
    let closed = false;
    for (let j = i + 1; j < lines.length; j += 1) {
      const candidate = lines[j] ?? '';
      if (candidate.replace(/^\t+/, '') === delimiter) {
        closed = true;
        i = j;
        break;
      }
      bodyLines.push(candidate);
    }
    if (!closed) throw new Error(`heredoc ${delimiter} is never closed`);
    found.push({ delimiterToken: token, delimiter, quoted, body: bodyLines.join('\n') });
  }
  return found;
}

/** What would be executed or expanded in an unquoted heredoc body, other than ${NAME}. */
function substitutionHazards(body: string): string[] {
  const hazards: string[] = [];
  for (const match of body.matchAll(/`|\$\(/g)) {
    const at = match.index ?? 0;
    const lineNumber = body.slice(0, at).split('\n').length;
    hazards.push(`line ${String(lineNumber)} of the heredoc body contains ${match[0]}`);
  }
  return hazards;
}

describe('infra/docker/initdb/02-roles.sh heredoc', () => {
  const script = readFileSync(scriptPath, 'utf8');
  const heredocs = parseHeredocs(script);

  it('has exactly one heredoc, the psql SQL', () => {
    expect(heredocs).toHaveLength(1);
    expect(heredocs[0]?.delimiter).toBe('EOSQL');
  });

  it('leaves the delimiter unquoted, so the password variables interpolate', () => {
    const [heredoc] = heredocs;
    expect(heredoc?.quoted).toBe(false);
    for (const variable of PASSWORD_VARIABLES) {
      expect(heredoc?.body).toContain(`\${${variable}}`);
    }
  });

  it('has no backtick or dollar-parenthesis in the heredoc body, comments included', () => {
    for (const heredoc of heredocs) {
      expect(substitutionHazards(heredoc.body)).toEqual([]);
    }
  });

  it('explains the rule in the script header, where the next editor will read it', () => {
    const header = script.slice(0, script.indexOf('psql -v'));
    expect(header).toMatch(/HEREDOC RULE/);
    expect(header).toMatch(/unquoted heredoc/i);
  });
});

describe('the heredoc guard itself (failure paths)', () => {
  it('flags a backticked word in an SQL comment', () => {
    const bad = [
      'psql <<-EOSQL',
      '    -- the schema is `public`, not `app`',
      "    CREATE ROLE a LOGIN PASSWORD '${APP_RW_PASSWORD}';",
      'EOSQL',
    ].join('\n');
    const [heredoc] = parseHeredocs(bad);
    expect(substitutionHazards(heredoc?.body ?? '')).toEqual([
      'line 1 of the heredoc body contains `',
      'line 1 of the heredoc body contains `',
      'line 1 of the heredoc body contains `',
      'line 1 of the heredoc body contains `',
    ]);
  });

  it('flags dollar-parenthesis command substitution in the body', () => {
    const bad = ['psql <<-EOSQL', '    SELECT $(id -u);', 'EOSQL'].join('\n');
    const [heredoc] = parseHeredocs(bad);
    expect(substitutionHazards(heredoc?.body ?? '')).toEqual([
      'line 1 of the heredoc body contains $(',
    ]);
  });

  it('recognises a quoted delimiter, which would stop the passwords interpolating', () => {
    const quotedScript = [
      "psql <<-'EOSQL'",
      "    SELECT '${APP_RW_PASSWORD}';",
      'EOSQL',
    ].join('\n');
    expect(parseHeredocs(quotedScript)[0]?.quoted).toBe(true);
  });

  it('accepts a body that uses only ${NAME} interpolation', () => {
    const good = [
      'psql <<-EOSQL',
      "    SELECT '${APP_RW_PASSWORD}'; -- fine",
      'EOSQL',
    ].join('\n');
    expect(substitutionHazards(parseHeredocs(good)[0]?.body ?? '')).toEqual([]);
  });

  it('refuses a heredoc that is never closed rather than guessing', () => {
    expect(() => parseHeredocs('psql <<-EOSQL\nSELECT 1;')).toThrow(/never closed/);
  });
});
