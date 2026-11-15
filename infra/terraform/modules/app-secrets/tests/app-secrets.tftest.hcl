# Native `terraform test` for app-secrets. Plan-only against a mocked AWS provider:
# nothing here contacts AWS. Run from the module directory:
#   terraform init -backend=false && terraform test

mock_provider "aws" {}

variables {
  name_prefix = "/infinite-ai/staging"
}

run "creates_named_shells" {
  command = plan

  variables {
    secret_names = ["ANTHROPIC_API_KEYS", "NEXTAUTH_SECRET"]
  }

  assert {
    condition     = length(aws_secretsmanager_secret.this) == 2
    error_message = "One secret shell per name."
  }

  assert {
    condition     = aws_secretsmanager_secret.this["ANTHROPIC_API_KEYS"].name == "/infinite-ai/staging/ANTHROPIC_API_KEYS"
    error_message = "Secret names must follow /infinite-ai/<env>/<NAME>."
  }

  assert {
    condition     = aws_secretsmanager_secret.this["NEXTAUTH_SECRET"].name == "/infinite-ai/staging/NEXTAUTH_SECRET"
    error_message = "Secret names must follow /infinite-ai/<env>/<NAME>."
  }

  assert {
    condition     = length(keys(output.secret_arns)) == 2
    error_message = "secret_arns must expose one ARN per name."
  }
}

run "creates_config_parameter" {
  command = plan

  variables {
    ssm_config = { AUTH_KEYCLOAK_ID = "infinite-ai-web" }
  }

  assert {
    condition     = aws_ssm_parameter.config["AUTH_KEYCLOAK_ID"].name == "/infinite-ai/staging/config/AUTH_KEYCLOAK_ID"
    error_message = "Config parameters must follow /infinite-ai/<env>/config/<NAME>."
  }

  assert {
    condition     = aws_ssm_parameter.config["AUTH_KEYCLOAK_ID"].type == "String"
    error_message = "Plain config must be a String parameter, never SecureString."
  }

  assert {
    condition     = length(keys(output.ssm_parameter_arns)) == 1
    error_message = "ssm_parameter_arns must expose one ARN per config name."
  }
}

run "empty_inputs_create_nothing" {
  command = plan

  assert {
    condition     = length(aws_secretsmanager_secret.this) == 0 && length(aws_ssm_parameter.config) == 0
    error_message = "With no names and no config the module must create nothing."
  }
}

run "uses_requested_recovery_window" {
  command = plan

  variables {
    secret_names            = ["NEXTAUTH_SECRET"]
    recovery_window_in_days = 7
  }

  assert {
    condition     = aws_secretsmanager_secret.this["NEXTAUTH_SECRET"].recovery_window_in_days == 7
    error_message = "recovery_window_in_days must be passed through to the secret."
  }
}

run "rejects_lowercase_secret_name" {
  command = plan

  variables {
    secret_names = ["anthropic-keys"]
  }

  expect_failures = [var.secret_names]
}

run "rejects_credential_shaped_config_key" {
  command = plan

  variables {
    ssm_config = { AUTH_KEYCLOAK_SECRET = "oops" }
  }

  expect_failures = [var.ssm_config]
}

run "rejects_prefix_without_leading_slash" {
  command = plan

  variables {
    name_prefix = "infinite-ai/staging"
  }

  expect_failures = [var.name_prefix]
}

run "rejects_recovery_window_of_3" {
  command = plan

  variables {
    recovery_window_in_days = 3
  }

  expect_failures = [var.recovery_window_in_days]
}
