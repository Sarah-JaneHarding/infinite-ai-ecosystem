variable "github_repository" {
  description = "owner/repo — scopes the OIDC trust policy so only this repository's Actions workflows can assume the deploy role. e.g. \"Sarah-JaneHarding/infinite-ai-ecosystem\"."
  type        = string
}

variable "github_branches" {
  description = "Branches allowed to assume the deploy role via OIDC, e.g. [\"main\"]. A PR branch never gets deploy credentials — only a merge to one of these does; this is the actual enforcement of \"CD only runs from main,\" not a convention CI happens to follow."
  type        = list(string)
  default     = ["main"]
}

variable "tags" {
  type    = map(string)
  default = {}
}
