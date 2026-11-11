variable "github_repository" {
  description = "owner/repo — scopes the OIDC trust policy so only this repository's Actions workflows can assume the deploy role. e.g. \"Sarah-JaneHarding/infinite-ai-ecosystem\"."
  type        = string
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
