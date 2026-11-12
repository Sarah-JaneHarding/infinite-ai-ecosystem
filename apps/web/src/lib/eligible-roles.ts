// Which roles a person may act as at this sign-in (OQ-032, docs/PROVISIONING_DESIGN.md §4.8).
//
// Two sources, and the school's own record is the stricter one:
//   * the identity provider's claim says what the person may *ask* to be;
//   * `role_assignment` says what the school has *granted* them (and not let lapse).
//
// A school staff role is eligible only when both agree. A role the school granted but the provider
// does not assert is not eligible (the provider is how a person proves it), and one the provider
// asserts but the school never granted is not eligible (a claim cannot widen what the school
// decided). Platform roles, guardians and learners are not school-granted, so for those the claim
// alone decides — exactly as it did before there was a chooser.
//
// The result is in the fixed order of the `Role` enum. No order here may read as a precedence.

import { isSchoolStaffRole, Role } from '@infinite-ai/policy';

export interface EligibleRoles {
  /** Roles the person may act as, in `Role` enum order. */
  readonly eligible: readonly Role[];
  /** Granted by the school, absent from the provider's claim — returned as data, not logged (§4.8). */
  readonly assignedNotClaimed: readonly Role[];
  /** Asserted by the provider, never granted by the school (school staff roles only). */
  readonly claimedNotAssigned: readonly Role[];
}

export function eligibleRoles(input: {
  readonly claimRoles: readonly Role[];
  readonly assignedRoles: readonly Role[];
}): EligibleRoles {
  const claimed = new Set<Role>(input.claimRoles);
  const assigned = new Set<Role>(input.assignedRoles);
  const eligible: Role[] = [];
  const assignedNotClaimed: Role[] = [];
  const claimedNotAssigned: Role[] = [];
  for (const role of Role.options) {
    if (!isSchoolStaffRole(role)) {
      if (claimed.has(role)) eligible.push(role);
      continue;
    }
    if (claimed.has(role) && assigned.has(role)) eligible.push(role);
    else if (assigned.has(role)) assignedNotClaimed.push(role);
    else if (claimed.has(role)) claimedNotAssigned.push(role);
  }
  return { eligible, assignedNotClaimed, claimedNotAssigned };
}
