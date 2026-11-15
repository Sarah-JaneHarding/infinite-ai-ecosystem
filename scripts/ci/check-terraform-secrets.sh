#!/usr/bin/env bash
# Guards two Terraform rules that are easy to break by accident (CLAUDE.md rule 7):
#
#   1. A *.tfvars file must not carry a credential. tfvars files are committed and hold
#      non-secret, per-environment values only. A line fails if, before any "#" comment,
#      it mentions secret / password / token / api key / private key, or contains an AWS
#      access key id or an "sk-" style API key.
#   2. modules/app-secrets must declare no aws_secretsmanager_secret_version: its secrets
#      are empty shells whose values are set out-of-band, so a value never reaches state.
#
# Usage: scripts/ci/check-terraform-secrets.sh <terraform-root>   (e.g. infra/terraform)
# Exit 0 when clean, 1 when a rule is broken. Run in CI by .github/workflows/terraform.yml.

set -euo pipefail

root="${1:?usage: check-terraform-secrets.sh <terraform-root>}"
status=0

if grep -rEni --include='*.tfvars' --include='*.tfvars.json' \
  '^[^#]*(secret|password|token|api_?key|private_key|AKIA[0-9A-Z]{16}|(^|[^[:alnum:]])sk-[[:alnum:]])' "$root"; then
  echo "::error::A tfvars file looks like it contains a credential (matches above). tfvars hold non-secret config only; set secret values with 'aws secretsmanager put-secret-value'." >&2
  status=1
fi

if [ -d "$root/modules/app-secrets" ] &&
  grep -En '^[^#]*aws_secretsmanager_secret_version' "$root"/modules/app-secrets/*.tf; then
  echo "::error::modules/app-secrets must not declare aws_secretsmanager_secret_version: secret values are set out-of-band so they never reach Terraform state." >&2
  status=1
fi

exit "$status"
