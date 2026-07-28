# Terraform

Production infrastructure, region `af-south-1` — data residency is a POPIA requirement,
not a preference (§1.3).

Environments land in Stage 15 (`observability`, backups, DR) and Stage 17 (tenant
provisioning). Nothing is written here before then, because infrastructure that exists
without the observability to see it and the runbooks to recover it is a liability.

## Planned layout

```
terraform/
  modules/       network · database · cache · object-store · ecs-service · observability
  environments/  dev · staging · production
```

## Standing constraints

- No long-lived cloud credentials. CI authenticates via GitHub Actions OIDC.
- All learner data at rest in `af-south-1`.
- Encrypted off-region backup copies only where residency rules allow it.
- State is remote, locked, and versioned. A destructive plan needs explicit approval.
