variable "environment" {
  type = string
}

variable "service_names" {
  type    = list(string)
  default = ["gateway", "web", "worker"]
}

resource "aws_ecr_repository" "this" {
  for_each             = toset(var.service_names)
  name                 = "infinite-ai/${each.key}"
  image_tag_mutability = "MUTABLE" # test env re-pushes the same :test tag on each build

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Environment = var.environment
    Project     = "infinite-ai"
    Service     = each.key
  }
}

# Limit stored images: untagged images after 7 days, keep only the last 15 :test images
resource "aws_ecr_lifecycle_policy" "this" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep last 15 test images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["test"]
          countType     = "imageCountMoreThan"
          countNumber   = 15
        }
        action = { type = "expire" }
      }
    ]
  })
}

output "repository_urls" {
  value = { for k, v in aws_ecr_repository.this : k => v.repository_url }
}
