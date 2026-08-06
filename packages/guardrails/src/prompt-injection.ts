// Prompt-injection detection — Stage 06 step 6.
//
// "prompt-injection detection on any retrieved or user-supplied text." A rules-based
// detector, not a classifier: every pattern here names a real, documented injection
// technique (an override instruction, a fake role marker, an exfiltration request, an
// invisible-character smuggling attempt), matched against plain, deterministic rules a
// reviewer can read and audit — the same reasoning the PII guard's own `RAW_IDENTIFIER_
// PATTERNS` already gives for a pattern list over an opaque model: a rule that misses a
// case is at least a rule someone can add to, not a black box someone has to retrain.
//
// Detection refuses the call outright rather than attempting to "sanitise" the offending
// span in place. Stripping a detected injection and continuing would mean guessing which
// part of a retrieved document is safe to keep — exactly the kind of silent, best-effort
// recovery rule 4's own reasoning (in `pii-guard.ts`) already rejects for PII. A refusal is
// loud and reviewable; a silent edit is not.

import { refuse, type GuardrailVerdict } from './refusal.js';

interface InjectionPattern {
  readonly name: string;
  readonly pattern: RegExp;
}

/**
 * Each pattern is deliberately narrow rather than a single catch-all regex, so a false
 * match traces back to one named technique instead of an unreadable alternation, and a new
 * technique is one more entry rather than a rewrite of an existing one.
 */
const INJECTION_PATTERNS: readonly InjectionPattern[] = [
  // Direct instruction override.
  {
    name: 'ignore_prior_instructions',
    pattern:
      /ignore\s+(all\s+|any\s+)?(the\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i,
  },
  {
    name: 'disregard_prior_instructions',
    pattern:
      /disregard\s+(all\s+|any\s+)?(the\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i,
  },
  {
    name: 'forget_prior_instructions',
    pattern: /forget\s+(everything|all)\s+(you were told|above|before this)/i,
  },
  { name: 'new_instructions_follow', pattern: /(new|updated|real)\s+instructions?\s*:/i },
  { name: 'from_now_on', pattern: /from\s+now\s+on,?\s+you\s+(will|must|shall)/i },

  // Role or system impersonation.
  { name: 'developer_mode', pattern: /(developer|debug|admin|god|jailbreak)\s+mode/i },
  {
    name: 'act_as_unrestricted',
    pattern: /act\s+as\s+(an?\s+)?(unrestricted|unfiltered|uncensored)/i,
  },
  {
    name: 'you_are_now',
    pattern:
      /you\s+are\s+now\s+(a|an|in)\b.{0,40}\b(unrestricted|unfiltered|no\s+rules|without\s+(rules|restrictions))/i,
  },
  { name: 'fake_system_marker', pattern: /^\s*(system|assistant)\s*:/im },
  {
    name: 'end_of_prompt_marker',
    pattern: /\[?\/?(end|close)\s+of\s+(system\s+)?prompt\]?/i,
  },

  // Exfiltration of the hidden context.
  {
    name: 'reveal_system_prompt',
    pattern:
      /(reveal|show|print|repeat)\s+(your|the)\s+(hidden\s+)?(system\s+)?(prompt|instructions)/i,
  },
  {
    name: 'reveal_configuration',
    pattern:
      /what\s+(are\s+your|is\s+your)\s+(system\s+)?(prompt|instructions|configuration)/i,
  },

  // Encoding tricks that smuggle instructions past a naive text scan. Escaped rather than
  // typed literally: zero-width space (U+200B), zero-width non-joiner (U+200C), zero-width
  // joiner (U+200D), and BOM / zero-width no-break space (U+FEFF) are themselves invisible
  // in a source file, which is exactly why hiding an instruction inside them works.
  // The joiner characters this rule warns about are exactly what this pattern exists to
  // detect, not a mistake.
  // eslint-disable-next-line no-misleading-character-class
  { name: 'zero_width_characters', pattern: /[\u200B\u200C\u200D\uFEFF]/ },
  {
    name: 'decode_and_execute',
    pattern:
      /(decode|base64[- ]decode)\s+(this|the following)\s+and\s+(run|execute|follow)/i,
  },

  // Asking the model to disobey its own guardrails directly.
  {
    name: 'disable_safety',
    pattern:
      /(disable|turn off|bypass)\s+(your\s+)?(safety|content)\s+(filters?|guardrails?|policy)/i,
  },
];

/**
 * Scans every piece of text a call would send to a model — retrieved documents and
 * user-supplied text alike, since the manual names both — and refuses on the first pattern
 * that matches. `texts` is checked in order, so `refusal.explanation` can name which one
 * and, in a multi-document call, which document index triggered it.
 */
export function checkPromptInjection(texts: readonly string[]): GuardrailVerdict {
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i]!;
    for (const { name, pattern } of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        return refuse(
          'prompt_injection_detected',
          `Text at index ${i} matched the "${name}" injection pattern.`,
        );
      }
    }
  }
  return { passed: true };
}
