variable "github_repository" {
  description = "owner/repo — scopes the OIDC trust policy so only this repository's Actions workflows can assume the deploy role. e.g. \"Sarah-JaneHarding/infinite-ai-ecosystem\"."
  type        = string
}

variable "github_oidc_repository" {
  description = <<-EOT
    The repository exactly as GitHub writes it into the OIDC token's `sub` claim, when that differs from
    github_repository. Newer repositories use immutable numeric IDs in the subject, e.g.
    "Sarah-JaneHarding@188106373/infinite-ai-ecosystem@1315427849" (owner@ownerId/repo@repoId), so a trust
    policy written as "owner/repo" never matches and AWS answers "Not authorized to perform
    sts:AssumeRoleWithWebIdentity". The IDs are the safer form: they survive neither a rename nor a transfer to
    another account, so a re-created repository under the old name cannot assume the role. Read the real value
    from a failed run (the `sub` claim) or from the GitHub API (repository id and owner id). Null means use
    github_repository unchanged.
  EOT
  type        = string
  default     = null

  validation {
    condition     = var.github_oidc_repository == null || can(regex("^[A-Za-z0-9_.-]+(@[0-9]+)?/[A-Za-z0-9_.-]+(@[0-9]+)?$", var.github_oidc_repository))
    error_message = "github_oidc_repository must look like owner/repo or owner@ownerId/repo@repoId."
  }
}

variable "github_branches" {
  description = "Branches allowed to assume the deploy role via OIDC, e.g. [\"main\"]. A PR branch never gets deploy credentials — only a merge to one of these does; this is the actual enforcement of \"CD only runs from main,\" not a convention CI happens to follow."
  type        = list(string)
  default     = ["main"]
}

variable "github_environments" {
  description = "GitHub Actions environments allowed to assume the deploy role via OIDC, e.g. [\"staging\"]. A job with `environment: X` presents the subject `repo:<repo>:environment:X`, which carries no branch, so each environment must be listed here to be trusted. Restrict each listed environment to the main branch in its GitHub settings (Deployment branches), otherwise any branch that can target it can deploy. Add \"production\" only as a separate, deliberate decision."
  type        = list(string)
  default     = ["staging"]
}

variable "tags" {
  type    = map(string)
  default = {}
}
