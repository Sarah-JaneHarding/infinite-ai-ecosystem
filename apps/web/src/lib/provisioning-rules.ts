// Binds the policy package's provisioning rules to the shape the data layer asks for.
//
// OQ-033 step 3: `@infinite-ai/db` runs the provisioning transactions (invite, confirm, accept,
// revoke, suspend) but may not import `@infinite-ai/policy` — policy is the higher layer — so each
// db function takes a `ProvisioningRules`. This is the one place the real rules are handed in.
//
// The annotation below is the conformance check: if policy's input or decision types drift away
// from the interface the db layer mirrors, this file stops compiling instead of the two quietly
// disagreeing about what is allowed.

import type { ProvisioningRules } from '@infinite-ai/db';
import {
  evaluateAccountStatusChange,
  evaluateRoleConferral,
  evaluateRoleRevocation,
} from '@infinite-ai/policy';

export const provisioningRules: ProvisioningRules = {
  conferral: evaluateRoleConferral,
  revocation: evaluateRoleRevocation,
  statusChange: evaluateAccountStatusChange,
};
