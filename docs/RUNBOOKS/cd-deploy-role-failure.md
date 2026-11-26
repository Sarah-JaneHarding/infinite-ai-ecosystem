# CD cannot assume the AWS deploy role

**Audit task:** T17 (deploy isolated staging), risk R07. **Status: written 2026-11-26, not yet run.** Nobody with AWS access
has followed it, so every "expected" below is from reading the Terraform, not from observing your environment.

**Owner:** whoever holds the AWS project (today, the single operator). **Needs:** AWS access in the project the stack lives in, and
admin on the GitHub repository (Settings → Environments, Variables).

## What the alert means

The `CD` workflow's first job, **Build and push images**, fails at the `configure-aws-credentials` step. Nothing is built, pushed or
deployed, and the two later jobs are skipped. Every merge to `main` produces a red CD run.

**What the log says** (read 2026-11-26 from run `45483184887`, job `138761499102`, 24 November): the workflow got **past** its own
`AWS_DEPLOY_ROLE_ARN is set` check, then AWS answered `Not authorized to perform sts:AssumeRoleWithWebIdentity` on all 12 attempts, and the
action gave up. Runs `503` and `507` also ended in `failure`; I did not read their logs. Other recent CD runs are `skipped`, which means the
workflow's `if` condition was false for them; I did not establish why.

**What that proves and does not.** It proves the variable is set and AWS refused the token. It does **not** say why. AWS returns this same
message for several different causes, including a role that does not exist. Work the causes in the order below; do not guess.

## The first action

Change nothing yet. Do **not** add long-lived access keys as a workaround (the design is "no long-lived cloud credentials"), and do
**not** widen the trust policy to a wildcard subject to "get it working". Both turn a configuration slip into a standing security hole.

## How to confirm the diagnosis (all read-only)

Use the AWS project the stack was bootstrapped in. If you sign in with the new AWS experience, first confirm the Region at
**AWS Settings → View all projects → Overview → Additional info → Region** (see `aws-setup.md` §2; this repository assumes `af-south-1`).
IAM is global, so the Region does not cause this error, but a wrong Region will fail the deploy that follows it.

```bash
export AWS_PROFILE=infinite-ai AWS_REGION=af-south-1
aws sts get-caller-identity          # which project am I looking at? Does it match where bootstrap was applied?
```

Work down; stop at the first row that is true.

| #   | Possible cause                                                         | How to check                                                                                                                                                                                                 | If true                                                                                                                                  |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Bootstrap was never applied in this project** (no role, no provider) | `aws iam get-role --role-name infinite-ai-github-deploy` fails with `NoSuchEntity`; `aws iam list-open-id-connect-providers` shows no `token.actions.githubusercontent.com`                                  | Apply `infra/terraform/bootstrap` per `infra/terraform/README.md` (a human step; this workflow never runs Terraform). Re-check.          |
| 2   | **The repository variable points at the wrong role**                   | GitHub → Settings → Secrets and variables → Actions → `AWS_DEPLOY_ROLE_ARN`. Compare with `terraform output github_deploy_role_arn`. The **plan** role (`infinite-ai-github-plan`) trusts only pull requests | Set the variable to the deploy role's ARN. (Note a secret of the same name is only used if the variable is empty.)                       |
| 3   | **The trust policy does not allow `environment:staging`**              | `aws iam get-role --role-name infinite-ai-github-deploy --query 'Role.AssumeRolePolicyDocument'`. Look for `repo:<owner>/<repo>:environment:staging` in the `...:sub` condition                              | Re-apply bootstrap with `github_environments = ["staging"]` (the default). The CD job declares `environment: staging`, so it needs this. |
| 4   | **The repository name in the trust policy is not the one running CD**  | In that same `sub` condition, compare `<owner>/<repo>` letter for letter with `Sarah-JaneHarding/infinite-ai-ecosystem` (the subject match is case-sensitive). The audit notes a similarly named repo exists | Re-apply bootstrap with the correct `github_repository`.                                                                                 |
| 5   | **The OIDC provider is wrong**                                         | `aws iam get-open-id-connect-provider --open-id-connect-provider-arn <arn>`: `Url` must be `https://token.actions.githubusercontent.com` and `ClientIDList` must contain `sts.amazonaws.com`                 | Fix or recreate the provider through Terraform.                                                                                          |
| 6   | **The GitHub environment `staging` is missing or set up differently**  | GitHub → Settings → Environments. The job runs `environment: staging`; the subject is only `...:environment:staging` if that environment exists                                                              | Create it, and set **Deployment branches: main only**. The trust policy relies on that rule to keep other branches out.                  |

If the role's policy lists the right subject and the ARN matches, check whether an organisation-level policy in the project (the managed
service control policies of the new AWS experience) restricts `sts:AssumeRoleWithWebIdentity`; see
https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html . Do not assume that is the cause before rows 1–6 are clear.

## The fix

Whichever row was true, the fix is a **human change in AWS or GitHub settings**, not a code change: apply or re-apply
`infra/terraform/bootstrap`, correct the variable, or create the environment. Record exactly what you changed. If the cause was a
mistake in the repository's Terraform (rows 3 or 4 point at it), fix the Terraform in a normal pull request.

## How to verify recovery

1. In GitHub → Actions, open the failed CD run and choose **Re-run failed jobs**. Do not push an empty commit to trigger it.
2. **Build and push images** passes, three images appear in ECR tagged with the commit SHA, then **Deploy to staging** runs.
3. Check the rollout as in `canary-deploy.md`: the service's task definition moves to the new revision and the gateway/web alarms stay quiet.
4. Confirm a branch other than `main` **cannot** deploy: open a throwaway pull request and check it gets no deploy credentials.
5. Capture the run URL and the output of the checks above.

## What to record afterwards

Which row was true · what you changed and where · the run URL that went green · the date and who did it. Add it to `docs/STAGE_LOG.md`
under a new heading, and update OQ-057 in `docs/OPEN_QUESTIONS.md`. Audit task T17 also asks for health checks, secrets and rollback to be
tested: this runbook covers getting CD to authenticate and deploy once; rollback is `canary-deploy.md`.

## Which test would have caught this earlier

None can: this is a mismatch between what Terraform applied in AWS and what the workflow presents, and it only shows when CD runs. A cheap
guard is a **scheduled** workflow that only tries to assume the role and runs `sts get-caller-identity`, so a broken trust policy is found
the day it breaks and not on the next merge. (Not built; a suggestion.)
