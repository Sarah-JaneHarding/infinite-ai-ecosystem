# Native `terraform test` for the IAM surface of this module. Plan-only against a mocked
# AWS provider: nothing here contacts AWS. Run from the module directory:
#   terraform init -backend=false && terraform test

mock_provider "aws" {
  # The module's assume-role policy still comes from a data source. A bare mock returns a
  # random string for its `json`, which the AWS provider rejects as an invalid policy, so
  # hand it a valid empty document. The policies under test are built with jsonencode and
  # are unaffected.
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

variables {
  name               = "t-gw"
  cluster_id         = "arn:aws:ecs:af-south-1:111111111111:cluster/t"
  cluster_name       = "t"
  vpc_id             = "vpc-1"
  security_group_id  = "sg-1"
  private_subnet_ids = ["subnet-1"]
  container_port     = 8080
}

run "sm_only_matches_existing_policy" {
  command = plan

  variables {
    secrets = {
      DATABASE_URL = "arn:aws:secretsmanager:af-south-1:111111111111:secret:db-AbCdEf:url::"
    }
  }

  assert {
    condition     = length(jsondecode(aws_iam_role_policy.execution_secrets[0].policy).Statement) == 1
    error_message = "A Secrets-Manager-only map must produce exactly one statement."
  }

  assert {
    condition     = jsondecode(aws_iam_role_policy.execution_secrets[0].policy).Statement[0].Resource == ["arn:aws:secretsmanager:af-south-1:111111111111:secret:db-AbCdEf"]
    error_message = "The JSON-key suffix must be stripped to the base secret ARN."
  }

  assert {
    condition     = jsondecode(aws_iam_role_policy.execution_secrets[0].policy).Statement[0].Action == "secretsmanager:GetSecretValue"
    error_message = "Secrets Manager statement must grant only GetSecretValue."
  }

  assert {
    condition     = length(aws_iam_role_policy.task_inline) == 0
    error_message = "No inline task policy without task_policy_statements."
  }
}

run "slash_named_secret_keeps_base_arn" {
  command = plan

  variables {
    secrets = {
      ANTHROPIC_API_KEYS = "arn:aws:secretsmanager:af-south-1:111111111111:secret:/infinite-ai/staging/ANTHROPIC_API_KEYS-AbCdEf"
    }
  }

  assert {
    condition     = jsondecode(aws_iam_role_policy.execution_secrets[0].policy).Statement[0].Resource == ["arn:aws:secretsmanager:af-south-1:111111111111:secret:/infinite-ai/staging/ANTHROPIC_API_KEYS-AbCdEf"]
    error_message = "A slash-named secret ARN must pass through unchanged."
  }
}

run "ssm_gets_its_own_statement" {
  command = plan

  variables {
    secrets = {
      NEXTAUTH_SECRET  = "arn:aws:secretsmanager:af-south-1:111111111111:secret:/infinite-ai/staging/NEXTAUTH_SECRET-AbCdEf"
      AUTH_KEYCLOAK_ID = "arn:aws:ssm:af-south-1:111111111111:parameter/infinite-ai/staging/config/AUTH_KEYCLOAK_ID"
    }
  }

  assert {
    condition     = length(jsondecode(aws_iam_role_policy.execution_secrets[0].policy).Statement) == 2
    error_message = "A mixed map must produce one Secrets Manager and one SSM statement."
  }

  assert {
    condition     = jsondecode(aws_iam_role_policy.execution_secrets[0].policy).Statement[1].Action == "ssm:GetParameters"
    error_message = "SSM statement must grant only ssm:GetParameters."
  }

  assert {
    condition     = jsondecode(aws_iam_role_policy.execution_secrets[0].policy).Statement[1].Resource == ["arn:aws:ssm:af-south-1:111111111111:parameter/infinite-ai/staging/config/AUTH_KEYCLOAK_ID"]
    error_message = "SSM statement must list exactly the parameter ARN, not a path wildcard."
  }
}

run "no_secrets_no_policy" {
  command = plan

  variables {
    secrets = {}
  }

  assert {
    condition     = length(aws_iam_role_policy.execution_secrets) == 0
    error_message = "An empty secrets map must not create an execution secrets policy."
  }
}

run "inline_task_policy_created" {
  command = plan

  variables {
    task_policy_statements = [
      {
        sid       = "ReadBrainSnapshots"
        actions   = ["s3:GetObject"]
        resources = ["arn:aws:s3:::bucket/*"]
      }
    ]
  }

  assert {
    condition     = length(aws_iam_role_policy.task_inline) == 1
    error_message = "One valid statement must create the inline task policy."
  }
}

run "rejects_wildcard_action" {
  command = plan

  variables {
    task_policy_statements = [
      { sid = "Bad", actions = ["*"], resources = ["arn:aws:s3:::bucket/*"] }
    ]
  }

  expect_failures = [var.task_policy_statements]
}

run "rejects_service_wildcard_action" {
  command = plan

  variables {
    task_policy_statements = [
      { sid = "Bad", actions = ["s3:*"], resources = ["arn:aws:s3:::bucket/*"] }
    ]
  }

  expect_failures = [var.task_policy_statements]
}

run "rejects_wildcard_resource" {
  command = plan

  variables {
    task_policy_statements = [
      { sid = "Bad", actions = ["s3:GetObject"], resources = ["*"] }
    ]
  }

  expect_failures = [var.task_policy_statements]
}

run "rejects_bad_sid" {
  command = plan

  variables {
    task_policy_statements = [
      { sid = "has space", actions = ["s3:GetObject"], resources = ["arn:aws:s3:::bucket/*"] }
    ]
  }

  expect_failures = [var.task_policy_statements]
}
