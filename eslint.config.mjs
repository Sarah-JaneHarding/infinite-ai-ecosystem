// ESLint flat config.
//
// These rules mechanically enforce PART 0 of the build manual. Where a rule below
// cites a numbered rule, that is the rule from Part 0 §0.2 it exists to enforce.
// Do not relax a rule here to make a file pass — fix the file.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/** Provider SDKs may only be imported by the Model Gateway's own adapters (rule 3). */
const PROVIDER_SDK_PATTERNS = [
  '@anthropic-ai/*',
  'openai',
  'openai/*',
  '@google/generative-ai',
  '@google/genai',
  '@mistralai/*',
  'cohere-ai',
  'ollama',
  'langchain',
  'langchain/*',
  '@langchain/*',
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/*.generated.ts',
      // The Prisma client is generated code: rebuilt by `prisma generate`, never
      // hand-edited, and never reviewed. Linting it produces thousands of errors about
      // code nobody wrote.
      'packages/db/generated/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ---------------------------------------------------------------------------
  // Baseline: applies to every TypeScript file in the monorepo.
  // ---------------------------------------------------------------------------
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'module',
      },
    },
    rules: {
      // Rule 8 — TypeScript is strict. `unknown` + a Zod parse is the correct pattern.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 20,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // Forbidden patterns (Part 6 §6.1).
      'no-console': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message:
            'Rule 7/§6.1: read configuration through @infinite-ai/config, never process.env directly.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              message:
                'Rule 5: every read and write goes through the tenant-scoped client in @infinite-ai/db.',
            },
          ],
          patterns: [
            {
              group: PROVIDER_SDK_PATTERNS,
              message:
                'Rule 3: no model call may bypass the Model Gateway. Provider SDKs live only in apps/gateway adapters.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='PrismaClient']",
          message: 'Rule 5: construct Prisma only inside packages/db.',
        },
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            'Rule 7: environment access belongs in @infinite-ai/config, which validates it with Zod.',
        },
        {
          selector:
            'Identifier[name=/^(SKIP_APPROVAL|BYPASS_[A-Z_]+|DISABLE_GUARDRAILS)$/]',
          message:
            'Rule 6: human-in-the-loop gates and guardrails have no bypass switch.',
        },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // ---------------------------------------------------------------------------
  // Tests: no skipped, focused or todo tests may be committed (rule 2, §4.2).
  // ---------------------------------------------------------------------------
  {
    files: ['**/*.{spec,test}.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'MemberExpression[object.name=/^(describe|it|test|suite|bench)$/][property.name=/^(only|skip|todo|failing|concurrent)$/]',
          message:
            'Rule 2: never skip, focus or weaken a test to make CI green. Fix the root cause.',
        },
        {
          selector: 'CallExpression[callee.name=/^(xit|xdescribe|xtest)$/]',
          message: 'Rule 2: xit/xdescribe/xtest are forbidden in committed tests.',
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Plain JavaScript tooling (hook installer, config files). These run on Node
  // directly, so declare the Node globals rather than leaving no-undef to guess.
  // ---------------------------------------------------------------------------
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Exemptions, each narrow and justified.
  // ---------------------------------------------------------------------------
  {
    // The gateway's own provider adapters are the single exception to rule 3.
    files: ['apps/gateway/src/adapters/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // packages/config is the one place environment variables are read (rule 7).
    files: ['packages/config/src/**/*.ts'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-syntax': 'off' },
  },
  {
    // The gateway's own env loader (Stage 04) is the second and only other exception to
    // rule 7: provider credentials never enter the shared EnvSchema, precisely so no
    // other service's environment can leak them (see apps/gateway/.env.example).
    files: ['apps/gateway/src/config/**/*.ts'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-syntax': 'off' },
  },
  {
    // The one sanctioned way to emit a log line (§6.1: "console.log in committed code —
    // use the logger"). It writes to stdout directly rather than through console, which
    // is also forbidden — every other file in the repo calls into this module instead of
    // reaching for process or console itself.
    files: ['packages/telemetry/src/logger.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    // packages/db owns the raw Prisma client and re-exports only the scoped one (rule 5).
    // Rule 5 says "no code *outside* packages/db" — so the whole package is in scope, not
    // just src/. The export-surface test is what actually enforces that nothing escapes.
    files: ['packages/db/src/**/*.ts'],
    rules: { 'no-restricted-imports': 'off', 'no-restricted-syntax': 'off' },
  },
  {
    // The RLS suite must construct clients as `app_rw`, `migrator` and so on to prove
    // isolation binds each role. Going through withTenant() would test only the role the
    // application happens to use, which is exactly the gap FORCE ROW LEVEL SECURITY
    // exists to close. Confined to packages/db's own tests.
    files: ['packages/db/test/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
      'no-restricted-globals': 'off',
    },
  },
  {
    // The seed script runs as a standalone CLI against a fresh database, before any
    // application boots. It legitimately constructs its own client, reads the encryption
    // key from the environment, and prints progress.
    files: ['packages/db/prisma/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
      'no-restricted-globals': 'off',
      'no-console': 'off',
    },
  },
  {
    // Build and verification scripts run outside the app runtime.
    files: ['scripts/**/*.ts', '**/*.config.{ts,mts,mjs}', 'eslint.config.mjs'],
    rules: {
      'no-console': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-syntax': 'off',
    },
  },

  prettier,
);
