'use client';

import { useState, useMemo, useEffect } from 'react';
import { Badge, Button } from '@infinite-ai/design-system';

export type FunctionalCategory =
  | 'Authentication'
  | 'Database'
  | 'API Keys'
  | 'Object Storage'
  | 'Observability'
  | 'Core & Security';

export interface EnvVariableDoc {
  readonly name: string;
  readonly category: FunctionalCategory;
  readonly scope: 'web' | 'gateway' | 'worker' | 'infra' | 'shared';
  readonly requiredForWeb: boolean;
  readonly isSecret?: boolean;
  readonly defaultValue?: string;
  readonly exampleValue: string;
  readonly description: string;
  readonly usage: string;
  readonly source: string;
}

export interface FunctionalGroupMeta {
  readonly id: string;
  readonly category: FunctionalCategory;
  readonly title: string;
  readonly icon: string;
  readonly description: string;
  readonly keyServices: string;
}

export const FUNCTIONAL_GROUPS: readonly FunctionalGroupMeta[] = [
  {
    id: 'auth-group',
    category: 'Authentication',
    title: 'Authentication & Identity',
    icon: '🔐',
    description:
      'User authentication, NextAuth session token signing, and Keycloak OpenID Connect (OIDC) client secrets.',
    keyServices: 'NextAuth, Keycloak, JWT & OIDC',
  },
  {
    id: 'database-group',
    category: 'Database',
    title: 'Database & Persistence',
    icon: '🗄️',
    description:
      'PostgreSQL connection strings, role-separated credentials (app_rw, migrator, analytics), and Redis caching.',
    keyServices: 'PostgreSQL, RLS Roles, Redis',
  },
  {
    id: 'api-keys-group',
    category: 'API Keys',
    title: 'API Keys & AI Providers',
    icon: '🤖',
    description:
      'External LLM provider API credentials, base endpoints, and local on-premise model inference adapters.',
    keyServices: 'Anthropic Claude, OpenAI, Local Models (vLLM/Ollama)',
  },
  {
    id: 'storage-group',
    category: 'Object Storage',
    title: 'Object Storage',
    icon: '📦',
    description:
      'S3-compatible MinIO endpoint settings, bucket names, and storage administrator access credentials.',
    keyServices: 'MinIO, S3 Assets, Lesson Files',
  },
  {
    id: 'observability-group',
    category: 'Observability',
    title: 'Observability & Monitoring',
    icon: '📊',
    description:
      'OpenTelemetry exporters, Langfuse tracing for prompt management, ClickHouse analytical telemetry, and audit logs.',
    keyServices: 'Langfuse, OpenTelemetry (OTLP), ClickHouse',
  },
  {
    id: 'core-security-group',
    category: 'Core & Security',
    title: 'Core System & Security',
    icon: '🛡️',
    description:
      'Cloud hosting region (POPIA data sovereignty), AES-256 PII column encryption, network ports, and logging levels.',
    keyServices: 'POPIA Compliance, AES-256 Keys, Ports & Logging',
  },
] as const;

export const ENV_VARIABLES: readonly EnvVariableDoc[] = [
  // Authentication (11 variables)
  {
    name: 'NEXTAUTH_SECRET',
    category: 'Authentication',
    scope: 'web',
    requiredForWeb: true,
    isSecret: true,
    exampleValue: 'w7s9K... (32+ character random string)',
    description:
      'Cryptographic secret used by NextAuth to encrypt and sign JWT session tokens and cookie hashes.',
    usage:
      'Required by apps/web. Without this, user authentication and protected session cookies fail.',
    source:
      'Generate locally via `openssl rand -base64 32` or any secure random generator.',
  },
  {
    name: 'NEXTAUTH_URL',
    category: 'Authentication',
    scope: 'web',
    requiredForWeb: false,
    defaultValue: 'http://localhost:3000',
    exampleValue:
      'https://ais-dev-avoydgqvoyd7js6ezspmir-86278674869.europe-west2.run.app',
    description:
      'Canonical base URL of the Next.js application used for OAuth redirect callbacks.',
    usage:
      'Configured in apps/web. If omitted in development, NextAuth automatically infers it from request headers.',
    source: 'The public preview URL provided by Google AI Studio or your custom domain.',
  },
  {
    name: 'AUTH_KEYCLOAK_ID',
    category: 'Authentication',
    scope: 'web',
    requiredForWeb: false,
    defaultValue: 'infinite-ai-web',
    exampleValue: 'infinite-ai-web',
    description:
      'Keycloak OpenID Connect (OIDC) client identifier configured for web login.',
    usage:
      'Used by NextAuth Keycloak provider in apps/web/src/auth.ts to identify the client application.',
    source:
      'Keycloak Admin Console → Clients → infinite-ai-web (pre-seeded by infra/keycloak/realm.json).',
  },
  {
    name: 'AUTH_KEYCLOAK_SECRET',
    category: 'Authentication',
    scope: 'web',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'c8f49b10-68be-4fc4-921c-32ec65b801a2',
    description:
      'OIDC client secret matching Keycloak’s infinite-ai-web client credentials.',
    usage:
      'Exchanged during the OAuth authorization code flow to obtain user session tokens and role claims.',
    source: 'Keycloak Admin Console → Clients → infinite-ai-web → Credentials tab.',
  },
  {
    name: 'AUTH_KEYCLOAK_ISSUER',
    category: 'Authentication',
    scope: 'web',
    requiredForWeb: false,
    defaultValue: 'http://localhost:8080/realms/infinite-ai',
    exampleValue: 'http://localhost:8180/realms/infinite-ai',
    description: 'OIDC discovery URL endpoint for the infinite-ai realm.',
    usage:
      'NextAuth queries this issuer URL to fetch JSON Web Key Sets (JWKS) and OpenID discovery configuration.',
    source: 'Keycloak server realm URL.',
  },
  {
    name: 'KEYCLOAK_ADMIN',
    category: 'Authentication',
    scope: 'infra',
    requiredForWeb: false,
    defaultValue: 'admin',
    exampleValue: 'admin',
    description:
      'Master realm administrative username for the Keycloak identity container.',
    usage:
      'Used to bootstrap Keycloak and access the management console (http://localhost:8180).',
    source: 'Set in infra/docker/.env or container startup parameters.',
  },
  {
    name: 'KEYCLOAK_ADMIN_PASSWORD',
    category: 'Authentication',
    scope: 'infra',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'super-secret-admin-pass',
    description:
      'Master realm administrative password for Keycloak container management.',
    usage:
      'Provides root administrative privileges to configure realms, federated identities, and user pools.',
    source: 'Defined in infra/docker/.env.',
  },
  {
    name: 'KEYCLOAK_CLIENT_ID',
    category: 'Authentication',
    scope: 'infra',
    requiredForWeb: false,
    defaultValue: 'infinite-ai-web',
    exampleValue: 'infinite-ai-web',
    description:
      'Default client identifier substituted into realm configuration templates.',
    usage: 'Referenced during realm provisioning scripts and integration test harnesses.',
    source: 'Defined in infra/docker/.env.',
  },
  {
    name: 'KEYCLOAK_ISSUER_URL',
    category: 'Authentication',
    scope: 'infra',
    requiredForWeb: false,
    exampleValue: 'http://localhost:8180/realms/infinite-ai',
    description: 'Base issuer URL injected into Keycloak container environment.',
    usage:
      'Used internally by Keycloak to construct identity tokens and redirect headers.',
    source: 'Configured in infra/docker/.env.',
  },
  {
    name: 'KEYCLOAK_WEB_CLIENT_SECRET',
    category: 'Authentication',
    scope: 'infra',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'web-secret-key-uuid',
    description:
      'Pre-shared client secret used to initialize the web client during Docker Compose realm import.',
    usage: 'Substituted into infra/keycloak/realm.json when the container starts.',
    source: 'Set in infra/docker/.env to match AUTH_KEYCLOAK_SECRET in apps/web.',
  },
  {
    name: 'KEYCLOAK_WORKER_CLIENT_SECRET',
    category: 'Authentication',
    scope: 'infra',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'worker-secret-key-uuid',
    description: 'Service account client secret for the background worker service.',
    usage:
      'Enables apps/worker to authenticate with Keycloak using Client Credentials Grant.',
    source: 'Defined in infra/docker/.env and referenced by worker container.',
  },

  // Database (9 variables)
  {
    name: 'DATABASE_URL',
    category: 'Database',
    scope: 'shared',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'postgresql://app_rw:password@localhost:5432/infinite_ai',
    description: 'PostgreSQL connection string for the application data layer.',
    usage:
      'Supplied to Prisma and packages/db. Must use the app_rw role with Row-Level Security (RLS) enforcement.',
    source:
      'Your PostgreSQL instance or docker-compose dev database (see docs/DEV_SETUP.md).',
  },
  {
    name: 'POSTGRES_DB',
    category: 'Database',
    scope: 'infra',
    requiredForWeb: false,
    defaultValue: 'infinite_ai',
    exampleValue: 'infinite_ai',
    description: 'Primary PostgreSQL database name for the school ecosystem.',
    usage:
      'Used by Docker Compose and database initialization scripts (01-init.sql, 02-roles.sh).',
    source: 'Defined in infra/docker/.env or Cloud SQL / PostgreSQL configuration.',
  },
  {
    name: 'POSTGRES_USER',
    category: 'Database',
    scope: 'infra',
    requiredForWeb: false,
    defaultValue: 'postgres',
    exampleValue: 'postgres',
    description:
      'PostgreSQL superuser username used for database bootstrap and schema provisioning.',
    usage: 'Only used by container startup scripts to create unprivileged tenant roles.',
    source: 'Configured during initial database cluster setup.',
  },
  {
    name: 'POSTGRES_PASSWORD',
    category: 'Database',
    scope: 'infra',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'db-superuser-master-password',
    description: 'Superuser password for PostgreSQL cluster bootstrapping.',
    usage:
      'Restricted to infrastructure provisioning; application code never connects as superuser.',
    source: 'Generated during PostgreSQL installation or set in infra/docker/.env.',
  },
  {
    name: 'APP_RW_PASSWORD',
    category: 'Database',
    scope: 'shared',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'app-rw-secure-token',
    description:
      'Password for the application least-privilege read-write database role (app_rw).',
    usage:
      'The runtime credential embedded in DATABASE_URL. Bound by PostgreSQL Row-Level Security policies.',
    source: 'Configured in infra/docker/initdb/02-roles.sh and infra/docker/.env.',
  },
  {
    name: 'MIGRATOR_PASSWORD',
    category: 'Database',
    scope: 'infra',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'migrator-secure-token',
    description: 'Password for the DDL migration database role (migrator).',
    usage:
      'The sole role authorized to alter database schemas and execute prisma migrate deploy.',
    source: 'Set in infra/docker/.env; used when running schema migration commands.',
  },
  {
    name: 'ANALYTICS_RO_PASSWORD',
    category: 'Database',
    scope: 'worker',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'analytics-ro-token',
    description:
      'Password for the read-only analytics database user role (analytics_ro).',
    usage:
      'Used by reporting workers and data warehouse extractors to guarantee read-only query isolation.',
    source: 'Configured in database role provisioning scripts.',
  },
  {
    name: 'WORKER_RW_PASSWORD',
    category: 'Database',
    scope: 'worker',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'worker-rw-token',
    description: 'Password for the background worker database role (worker_rw).',
    usage:
      'Used by apps/worker for asynchronous batch processing, curriculum ingestion, and audit event writes.',
    source: 'Defined in infra/docker/.env.',
  },
  {
    name: 'REDIS_URL',
    category: 'Database',
    scope: 'shared',
    requiredForWeb: false,
    defaultValue: 'redis://localhost:6379',
    exampleValue: 'redis://localhost:6379',
    description:
      'Redis connection URI for distributed caching, session tracking, and rate limits.',
    usage:
      'Powers the sliding-window rate limiter, session token caching, and background task queues.',
    source: 'Redis instance endpoint or Docker Compose service.',
  },

  // API Keys & AI Providers (6 variables)
  {
    name: 'ANTHROPIC_API_KEYS',
    category: 'API Keys',
    scope: 'gateway',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'sk-ant-api03-...,sk-ant-api03-...',
    description:
      'Comma-separated API keys for Anthropic Claude models (Claude 3.5 Sonnet, Claude 3 Haiku).',
    usage:
      'Loaded into the credential pool in apps/gateway to handle curriculum planning and lesson design.',
    source:
      'Anthropic Console (https://console.anthropic.com). Optional in local UI development.',
  },
  {
    name: 'ANTHROPIC_BASE_URL',
    category: 'API Keys',
    scope: 'gateway',
    requiredForWeb: false,
    defaultValue: 'https://api.anthropic.com',
    exampleValue: 'https://api.anthropic.com',
    description: 'Base URL for Anthropic API requests.',
    usage:
      'Overridden when routing through an enterprise egress proxy or local mock adapter.',
    source: 'Defaults to official Anthropic endpoint.',
  },
  {
    name: 'OPENAI_API_KEYS',
    category: 'API Keys',
    scope: 'gateway',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'sk-proj-...,sk-proj-...',
    description: 'Comma-separated API keys for OpenAI models (GPT-4o, GPT-4o-mini).',
    usage: 'Used by apps/gateway for fallback circuits and secondary evaluations.',
    source:
      'OpenAI API Dashboard (https://platform.openai.com/api-keys). Optional in local dev.',
  },
  {
    name: 'OPENAI_BASE_URL',
    category: 'API Keys',
    scope: 'gateway',
    requiredForWeb: false,
    defaultValue: 'https://api.openai.com/v1',
    exampleValue: 'https://api.openai.com/v1',
    description: 'Base URL for OpenAI API or Azure OpenAI compatible endpoints.',
    usage: 'Configurable for Azure OpenAI deployments or private AI gateway proxies.',
    source: 'Defaults to official OpenAI endpoint.',
  },
  {
    name: 'LOCAL_MODEL_API_KEYS',
    category: 'API Keys',
    scope: 'gateway',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'ollama-local-token',
    description:
      'Authorization tokens for self-hosted local model endpoints (e.g., vLLM, Ollama, TGI).',
    usage: 'Enables private on-premise model execution for zero external data egress.',
    source: 'Configured on your local inference server or cluster gateway.',
  },
  {
    name: 'LOCAL_MODEL_BASE_URL',
    category: 'API Keys',
    scope: 'gateway',
    requiredForWeb: false,
    defaultValue: 'http://localhost:11434/v1',
    exampleValue: 'http://localhost:11434/v1',
    description: 'Base URL for local OpenAI-compatible inference servers.',
    usage: 'Allows schools to route tasks through local school server GPUs.',
    source: 'Local inference server host and port.',
  },

  // Object Storage (4 variables)
  {
    name: 'OBJECT_STORE_ENDPOINT',
    category: 'Object Storage',
    scope: 'shared',
    requiredForWeb: false,
    defaultValue: 'http://localhost:9000',
    exampleValue: 'http://localhost:9000',
    description: 'S3-compatible API endpoint URL for object storage.',
    usage:
      'Used by S3 client adapters to upload and retrieve learner artifacts and curriculum files.',
    source:
      'Local MinIO server (http://localhost:9000) or AWS S3 endpoint in production.',
  },
  {
    name: 'OBJECT_STORE_BUCKET',
    category: 'Object Storage',
    scope: 'shared',
    requiredForWeb: false,
    defaultValue: 'infinite-ai-assets',
    exampleValue: 'infinite-ai-assets',
    description:
      'Name of the S3 bucket housing ecosystem documents and lesson resources.',
    usage:
      'Created automatically by minio-init on first boot; referenced by storage services.',
    source: 'Defined in infra/docker/.env.',
  },
  {
    name: 'MINIO_ROOT_USER',
    category: 'Object Storage',
    scope: 'infra',
    requiredForWeb: false,
    defaultValue: 'minioadmin',
    exampleValue: 'minioadmin',
    description: 'Root access key username for the local MinIO storage server.',
    usage:
      'Used to log into the MinIO administration web console (http://localhost:9001).',
    source: 'Set in infra/docker/.env.',
  },
  {
    name: 'MINIO_ROOT_PASSWORD',
    category: 'Object Storage',
    scope: 'infra',
    requiredForWeb: false,
    isSecret: true,
    defaultValue: 'minioadmin',
    exampleValue: 'minio-secure-password',
    description: 'Root secret key password for the local MinIO storage server.',
    usage: 'Used for MinIO bucket provisioning and storage administration.',
    source: 'Set in infra/docker/.env.',
  },

  // Observability & Monitoring (15 variables)
  {
    name: 'OTEL_EXPORTER_OTLP_ENDPOINT',
    category: 'Observability',
    scope: 'shared',
    requiredForWeb: false,
    defaultValue: 'http://localhost:3001/api/public/otel',
    exampleValue: 'http://localhost:3001/api/public/otel',
    description:
      'OpenTelemetry (OTLP) HTTP/gRPC endpoint for tracing and telemetry export.',
    usage:
      'Sends distributed trace spans, latency metrics, and audit entries to Langfuse or an OTel collector.',
    source: 'Local Langfuse service port 3001 or cloud APM endpoint.',
  },
  {
    name: 'OTEL_EXPORTER_OTLP_HEADERS',
    category: 'Observability',
    scope: 'shared',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'Authorization=Basic cGstbGYt...==',
    description:
      'Authorization header containing base64-encoded Langfuse project keys (pk:sk).',
    usage: 'Authenticates trace spans sent to the Langfuse OpenTelemetry ingestion API.',
    source:
      'Constructed via `echo -n "PUBLIC_KEY:SECRET_KEY" | base64` (see docs/DEV_SETUP.md step 4).',
  },
  {
    name: 'LANGFUSE_INIT_PROJECT_PUBLIC_KEY',
    category: 'Observability',
    scope: 'infra',
    requiredForWeb: false,
    defaultValue: 'pk-lf-dev-project',
    exampleValue: 'pk-lf-dev-project',
    description: 'Pre-seeded public API key for Langfuse LLM observability.',
    usage:
      'Bootstrapped on first boot so services can emit traces without manual project creation.',
    source: 'Set in infra/docker/.env.',
  },
  {
    name: 'LANGFUSE_INIT_PROJECT_SECRET_KEY',
    category: 'Observability',
    scope: 'infra',
    requiredForWeb: false,
    isSecret: true,
    defaultValue: 'sk-lf-dev-project',
    exampleValue: 'sk-lf-dev-project',
    description: 'Pre-seeded secret API key for Langfuse LLM observability.',
    usage: 'Paired with public key for OpenTelemetry HTTP exporter authentication.',
    source: 'Set in infra/docker/.env.',
  },
  {
    name: 'LANGFUSE_INIT_USER_EMAIL',
    category: 'Observability',
    scope: 'infra',
    requiredForWeb: false,
    defaultValue: 'admin@infinite-ai.local',
    exampleValue: 'admin@infinite-ai.local',
    description: 'Initial administrator user email for the Langfuse UI.',
    usage:
      'Used to sign in to the Langfuse observability dashboard at http://localhost:3001.',
    source: 'Defined in infra/docker/.env.',
  },
  {
    name: 'LANGFUSE_INIT_USER_PASSWORD',
    category: 'Observability',
    scope: 'infra',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'langfuse-admin-pass',
    description: 'Initial administrator password for the Langfuse UI.',
    usage: 'Authentication password for Langfuse web console.',
    source: 'Defined in infra/docker/.env.',
  },
  {
    name: 'LANGFUSE_NEXTAUTH_SECRET',
    category: 'Observability',
    scope: 'infra',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'langfuse-cookie-secret-32chars',
    description: 'Session encryption key for Langfuse’s own internal NextAuth instance.',
    usage: 'Signs web browser sessions on the Langfuse dashboard.',
    source: 'Generated in infra/docker/.env.',
  },
  {
    name: 'LANGFUSE_ENCRYPTION_KEY',
    category: 'Observability',
    scope: 'infra',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: '64-hex-character-encryption-key',
    description:
      '256-bit encryption key (64 hex characters) protecting credentials inside Langfuse.',
    usage: 'Encrypts provider keys stored within the Langfuse database.',
    source: 'Generated via `openssl rand -hex 32`.',
  },
  {
    name: 'LANGFUSE_SALT',
    category: 'Observability',
    scope: 'infra',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'salt-string-for-hashing',
    description: 'Cryptographic salt string used by Langfuse to hash API keys.',
    usage: 'Secures incoming API keys against rainbow table attacks.',
    source: 'Generated in infra/docker/.env.',
  },
  {
    name: 'LANGFUSE_POSTGRES_USER',
    category: 'Observability',
    scope: 'infra',
    requiredForWeb: false,
    defaultValue: 'postgres',
    exampleValue: 'postgres',
    description: 'Username for Langfuse’s dedicated metadata PostgreSQL instance.',
    usage:
      'Used by langfuse-web to store user accounts, projects, and prompt management records.',
    source: 'infra/docker/compose.dev.yml configuration.',
  },
  {
    name: 'LANGFUSE_POSTGRES_PASSWORD',
    category: 'Observability',
    scope: 'infra',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'langfuse-db-pass',
    description: 'Password for Langfuse’s dedicated PostgreSQL database.',
    usage: 'Secures Langfuse internal metadata storage.',
    source: 'Set in infra/docker/.env.',
  },
  {
    name: 'LANGFUSE_CLICKHOUSE_USER',
    category: 'Observability',
    scope: 'infra',
    requiredForWeb: false,
    defaultValue: 'default',
    exampleValue: 'default',
    description: 'User for Langfuse ClickHouse analytical database.',
    usage:
      'Used for high-volume ingest of model traces, token usages, and generation spans.',
    source: 'infra/docker/compose.dev.yml configuration.',
  },
  {
    name: 'LANGFUSE_CLICKHOUSE_PASSWORD',
    category: 'Observability',
    scope: 'infra',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'clickhouse-pass',
    description: 'Password for Langfuse ClickHouse analytical database.',
    usage: 'Secures the analytical data store for telemetry queries.',
    source: 'Set in infra/docker/.env.',
  },
  {
    name: 'LANGFUSE_REDIS_PASSWORD',
    category: 'Observability',
    scope: 'infra',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: 'langfuse-redis-pass',
    description: 'Password for Langfuse worker queue Redis cache.',
    usage: 'Secures asynchronous span ingestion queues in Langfuse.',
    source: 'Set in infra/docker/.env.',
  },

  // Core & Security (7 variables)
  {
    name: 'APP_REGION',
    category: 'Core & Security',
    scope: 'shared',
    requiredForWeb: false,
    defaultValue: 'af-south-1',
    exampleValue: 'af-south-1',
    description:
      'Geographic cloud region hosting the deployment (e.g., af-south-1 in Cape Town).',
    usage:
      'Enforces POPIA data sovereignty requirements ensuring learner and school data remains in South Africa.',
    source: 'Set to your hosting region or af-south-1 for South African compliance.',
  },
  {
    name: 'DB_ENCRYPTION_KEY',
    category: 'Core & Security',
    scope: 'shared',
    requiredForWeb: false,
    isSecret: true,
    exampleValue: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    description:
      '256-bit AES cryptographic key (64 hex characters) for application-level column encryption.',
    usage:
      'Encrypts sensitive learner PII (names, SIAS vulnerability notes) before persistence in PostgreSQL.',
    source:
      'Generated via `openssl rand -hex 32`. Leave empty in local dev if not testing PII encryption.',
  },
  {
    name: 'DB_ENCRYPTION_KEY_VERSION',
    category: 'Core & Security',
    scope: 'shared',
    requiredForWeb: false,
    defaultValue: 'v1',
    exampleValue: 'v1',
    description: 'Key version tag associated with DB_ENCRYPTION_KEY.',
    usage:
      'Facilitates zero-downtime cryptographic key rotation by identifying which key version encrypted a row.',
    source: 'Incremented when rotating database encryption keys.',
  },
  {
    name: 'GATEWAY_BASE_URL',
    category: 'Core & Security',
    scope: 'web',
    requiredForWeb: false,
    defaultValue: 'http://localhost:8080',
    exampleValue: 'http://localhost:8080',
    description:
      'Base HTTP endpoint of the centralized AI routing gateway service (apps/gateway).',
    usage:
      'Web and worker services query this URL to dispatch LLM agent runs and verify token budgets.',
    source: 'Gateway service URL or internal cluster DNS.',
  },
  {
    name: 'GATEWAY_PORT',
    category: 'Core & Security',
    scope: 'gateway',
    requiredForWeb: false,
    defaultValue: '8080',
    exampleValue: '8080',
    description: 'Network port on which apps/gateway HTTP server listens.',
    usage: 'Configured in gateway startup scripts and Docker container port mappings.',
    source: 'Standard port configuration.',
  },
  {
    name: 'WORKER_PORT',
    category: 'Core & Security',
    scope: 'worker',
    requiredForWeb: false,
    defaultValue: '8081',
    exampleValue: '8081',
    description:
      'Network port for the background worker health check and status HTTP server.',
    usage: 'Used by container orchestrators to probe worker liveness and readiness.',
    source: 'Standard worker port configuration.',
  },
  {
    name: 'LOG_LEVEL',
    category: 'Core & Security',
    scope: 'shared',
    requiredForWeb: false,
    defaultValue: 'info',
    exampleValue: 'info',
    description:
      'Application logging verbosity across all microservices (debug, info, warn, error).',
    usage:
      'Controls logger thresholds in packages/telemetry; use debug during development and info in production.',
    source: 'Set in .env or container environment.',
  },
  {
    name: 'ROUTING_CONFIG_PATH',
    category: 'Core & Security',
    scope: 'gateway',
    requiredForWeb: false,
    defaultValue: 'routing.json',
    exampleValue: 'apps/gateway/routing.json',
    description:
      'File path to the dynamic routing configuration file defining agent-to-model routes.',
    usage:
      'Loaded by apps/gateway to map agent IDs (CE-01, TB-01) to specific model families and providers.',
    source: 'Path to routing.json file within apps/gateway.',
  },
] as const;

function highlightMatch(text: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return text;
  }
  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const matchIdx = lowerText.indexOf(lowerQuery);

  if (matchIdx === -1) {
    return text;
  }

  const parts: { text: string; isMatch: boolean }[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    const idx = lowerText.indexOf(lowerQuery, currentIndex);
    if (idx === -1) {
      parts.push({ text: text.slice(currentIndex), isMatch: false });
      break;
    }
    if (idx > currentIndex) {
      parts.push({ text: text.slice(currentIndex, idx), isMatch: false });
    }
    parts.push({
      text: text.slice(idx, idx + lowerQuery.length),
      isMatch: true,
    });
    currentIndex = idx + lowerQuery.length;
  }

  return (
    <>
      {parts.map((part, i) =>
        part.isMatch ? (
          <mark
            key={i}
            className="bg-amber-300/40 text-[var(--iai-text)] font-extrabold px-0.5 rounded"
          >
            {part.text}
          </mark>
        ) : (
          part.text
        ),
      )}
    </>
  );
}

interface EnvRuntimeImpactTooltipProps {
  variableName: string;
  impact: string;
  scope: string;
  requiredForWeb: boolean;
  isSecret?: boolean;
  defaultValue?: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
}

function EnvRuntimeImpactTooltip({
  variableName,
  impact,
  scope,
  requiredForWeb,
  isSecret,
  defaultValue,
  isOpen,
  onOpen,
  onClose,
  onToggle,
}: EnvRuntimeImpactTooltipProps) {
  const safeId = variableName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const tooltipId = `tooltip-runtime-${safeId}`;
  const buttonId = `btn-impact-${safeId}`;

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        id={buttonId}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        aria-label={`Runtime behavior impact of ${variableName}`}
        onMouseEnter={onOpen}
        onMouseLeave={onClose}
        onFocus={onOpen}
        onBlur={onClose}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--iai-radius-sm)] text-[11px] font-medium border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--iai-primary)] ${
          isOpen
            ? 'border-[var(--iai-primary)] bg-[var(--iai-primary)] text-white shadow-xs'
            : 'border-[var(--iai-border)] bg-[var(--iai-bg)] text-[var(--iai-text-subtle)] hover:text-[var(--iai-text)] hover:border-[var(--iai-border-strong)] hover:bg-[var(--iai-bg-subtle)]'
        }`}
      >
        <svg
          className={`w-3.5 h-3.5 ${isOpen ? 'text-white' : 'text-[var(--iai-primary)]'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>Runtime Impact</span>
      </button>

      {isOpen && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute z-40 left-0 top-full mt-2 w-72 sm:w-88 max-w-[calc(100vw-3rem)] p-3 rounded-[var(--iai-radius-md)] border border-[var(--iai-border-strong)] bg-[var(--iai-bg)] shadow-xl text-left pointer-events-auto ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100"
          onMouseEnter={onOpen}
          onMouseLeave={onClose}
        >
          {/* Caret arrow */}
          <div className="absolute -top-1.5 left-4 w-3 h-3 bg-[var(--iai-bg)] border-t border-l border-[var(--iai-border-strong)] rotate-45" />

          <div className="relative space-y-2">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--iai-border)] pb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--iai-text)]">
                <svg
                  className="w-3.5 h-3.5 text-amber-500 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Runtime Impact</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--iai-bg-subtle)] text-[var(--iai-text-subtle)] border border-[var(--iai-border)]">
                {scope}
              </span>
            </div>

            <p className="text-xs text-[var(--iai-text)] leading-relaxed">{impact}</p>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--iai-border)]/60 text-[10px] text-[var(--iai-text-subtle)]">
              {requiredForWeb ? (
                <span className="text-emerald-700 font-medium">
                  ● Required for Web Runtime
                </span>
              ) : (
                <span>○ Optional for Web</span>
              )}
              {defaultValue && (
                <span className="font-mono bg-[var(--iai-bg-subtle)] px-1 rounded">
                  Default: {defaultValue}
                </span>
              )}
              {isSecret && (
                <span className="text-amber-700 font-medium ml-auto">● Secret</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function generateDotEnvContent(
  groups: readonly {
    readonly id: string;
    readonly category: FunctionalCategory;
    readonly title: string;
    readonly icon: string;
    readonly description: string;
    readonly keyServices: string;
    readonly variables: readonly EnvVariableDoc[];
  }[],
  filters: {
    searchQuery: string;
    category: string;
    scope: string;
  },
): string {
  const lines: string[] = [];
  const timestamp = new Date().toISOString();
  const totalVars = groups.reduce((acc, g) => acc + g.variables.length, 0);

  lines.push(
    '# ==============================================================================',
  );
  lines.push('# Infinite AI Ecosystem - Environment Configuration (.env)');
  lines.push(`# Exported: ${timestamp}`);
  lines.push(`# Total Variables: ${totalVars}`);
  lines.push('#');
  lines.push('# Active Filters:');
  lines.push(`#   - Functional Purpose: ${filters.category}`);
  lines.push(`#   - Scope Filter:       ${filters.scope}`);
  if (filters.searchQuery.trim()) {
    lines.push(`#   - Name Search:        "${filters.searchQuery.trim()}"`);
  }
  lines.push('#');
  lines.push('# Security Notice:');
  lines.push(
    '#   - Never commit populated production secrets or API keys to version control.',
  );
  lines.push(
    '#   - In Google AI Studio, configure values in Settings -> Environment Variables.',
  );
  lines.push(
    '#   - For local development with Docker, save this file as .env at project root.',
  );
  lines.push(
    '# ==============================================================================',
  );
  lines.push('');

  for (const group of groups) {
    if (group.variables.length === 0) continue;

    lines.push(
      '# ------------------------------------------------------------------------------',
    );
    lines.push(`# [${group.icon}] ${group.title} (${group.category})`);
    lines.push(`# Purpose: ${group.description}`);
    lines.push(`# Services: ${group.keyServices}`);
    lines.push(
      '# ------------------------------------------------------------------------------',
    );
    lines.push('');

    for (const item of group.variables) {
      lines.push(`# ${item.name}`);
      lines.push(`# Description:    ${item.description}`);
      lines.push(`# Runtime Impact: ${item.usage}`);
      lines.push(
        `# Scope:          [${item.scope}] | Web Required: ${item.requiredForWeb ? 'YES' : 'NO'} | Sensitive: ${item.isSecret ? 'YES' : 'NO'}`,
      );
      if (item.source) {
        lines.push(`# Source:         ${item.source}`);
      }
      lines.push(`# Example:        ${item.exampleValue}`);

      const val = item.defaultValue ?? '';
      lines.push(`${item.name}=${val}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function EnvDocs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedScope, setSelectedScope] = useState<string>('all');
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const [expandedVar, setExpandedVar] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [exportSuccess, setExportSuccess] = useState(false);

  // Close tooltips when user presses Escape or clicks outside
  useEffect(() => {
    if (!activeTooltip) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTooltip(null);
      }
    };

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        !target.closest('[role="tooltip"]') &&
        !target.closest('[id^="btn-impact-"]')
      ) {
        setActiveTooltip(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [activeTooltip]);

  const handleCopy = async (text: string, id: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API not available');
      }
      setCopiedVar(id);
      setTimeout(() => setCopiedVar(null), 2000);
    } catch {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopiedVar(id);
        setTimeout(() => setCopiedVar(null), 2000);
      } catch {
        // Fallback failed silently
      }
    }
  };

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Group and filter variables by name as the administrator types
  const groupedData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return FUNCTIONAL_GROUPS.map((group) => {
      // Check if group is selected in the category filter
      if (selectedCategory !== 'All' && selectedCategory !== group.category) {
        return {
          ...group,
          variables: [] as const,
          totalInGroup: ENV_VARIABLES.filter((v) => v.category === group.category).length,
        };
      }

      const matchingVars = ENV_VARIABLES.filter((item) => {
        if (item.category !== group.category) return false;

        const matchesScope =
          selectedScope === 'all' ||
          item.scope === selectedScope ||
          (selectedScope === 'web' && item.requiredForWeb);

        // Filter by variable name
        const matchesName = !q || item.name.toLowerCase().includes(q);

        return matchesScope && matchesName;
      });

      return {
        ...group,
        variables: matchingVars,
        totalInGroup: ENV_VARIABLES.filter((v) => v.category === group.category).length,
      };
    }).filter((g) => g.variables.length > 0);
  }, [searchQuery, selectedCategory, selectedScope]);

  const totalFilteredCount = useMemo(
    () => groupedData.reduce((acc, g) => acc + g.variables.length, 0),
    [groupedData],
  );

  const secretCount = useMemo(() => ENV_VARIABLES.filter((v) => v.isSecret).length, []);

  const handleExportDotEnv = () => {
    if (totalFilteredCount === 0) return;

    try {
      const content = generateDotEnvContent(groupedData, {
        searchQuery,
        category: selectedCategory,
        scope: selectedScope,
      });

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '.env';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 200);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2500);
    } catch {
      // Fallback silently if download fails
    }
  };

  return (
    <section aria-labelledby="env-docs-heading" className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1
            id="env-docs-heading"
            className="text-2xl font-bold text-[var(--iai-text)]"
            style={{ fontFamily: 'var(--iai-font-title)' }}
          >
            Environment Variables
          </h1>
          <p className="text-sm text-[var(--iai-text-subtle)] mt-1 max-w-2xl">
            Reference guide and specifications for all 52 configuration variables defined
            in{' '}
            <code className="px-1.5 py-0.5 rounded bg-[var(--iai-bg-subtle)] font-mono text-xs text-[var(--iai-text)]">
              .env.example
            </code>
            , organized by functional purpose.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="warning">Administrator Only</Badge>
          <Badge variant="info">52 Variables</Badge>
          <Button
            type="button"
            id="btn-export-env-header"
            size="sm"
            variant="secondary"
            onClick={handleExportDotEnv}
            disabled={totalFilteredCount === 0}
            title={
              totalFilteredCount === 0
                ? 'No variables matching filters'
                : `Download ${totalFilteredCount} filtered variables as .env file`
            }
            aria-label="Export filtered environment variables to .env format"
            className="cursor-pointer gap-1.5 text-xs font-semibold"
          >
            {exportSuccess ? (
              <>
                <svg
                  className="w-3.5 h-3.5 text-emerald-600 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-emerald-700">Exported .env!</span>
              </>
            ) : (
              <>
                <svg
                  className="w-3.5 h-3.5 text-[var(--iai-primary)] shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span>Export to .env format</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* AI Studio & Setup Guide Callout */}
      <div
        id="ai-studio-guidance-card"
        className="rounded-[var(--iai-radius-lg)] border border-[var(--iai-border)] bg-[var(--iai-bg-subtle)] p-5"
      >
        <div className="flex items-start gap-3.5">
          <div className="p-2 rounded-[var(--iai-radius-md)] bg-[var(--iai-bg)] border border-[var(--iai-border)] text-lg">
            ⚙️
          </div>
          <div className="space-y-1.5 text-sm">
            <h2 className="font-semibold text-[var(--iai-text)]">
              How to configure variables in Google AI Studio
            </h2>
            <p className="text-[var(--iai-text-subtle)] leading-relaxed">
              In Google AI Studio, sensitive credentials and keys are securely injected
              via the platform container. Click the{' '}
              <strong className="text-[var(--iai-text)]">Settings (gear icon)</strong> in
              the top navigation bar, then select{' '}
              <strong className="text-[var(--iai-text)]">Environment Variables</strong> to
              add or update key-value pairs. For local development with Docker, copy{' '}
              <code className="px-1 py-0.5 rounded bg-[var(--iai-bg)] font-mono text-xs">
                .env.example
              </code>{' '}
              to{' '}
              <code className="px-1 py-0.5 rounded bg-[var(--iai-bg)] font-mono text-xs">
                .env
              </code>{' '}
              as documented in{' '}
              <code className="px-1 py-0.5 rounded bg-[var(--iai-bg)] font-mono text-xs">
                docs/DEV_SETUP.md
              </code>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Quick Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-[var(--iai-radius-md)] border border-[var(--iai-border)] bg-[var(--iai-bg)]">
          <p className="text-xs text-[var(--iai-text-subtle)]">Total Defined</p>
          <p className="text-xl font-bold text-[var(--iai-text)] mt-0.5">
            {ENV_VARIABLES.length}
          </p>
          <p className="text-[11px] text-[var(--iai-text-subtle)] mt-1">
            From root .env.example
          </p>
        </div>
        <div className="p-3.5 rounded-[var(--iai-radius-md)] border border-[var(--iai-border)] bg-[var(--iai-bg)]">
          <p className="text-xs text-[var(--iai-text-subtle)]">Secrets & Credentials</p>
          <p className="text-xl font-bold text-amber-600 mt-0.5">{secretCount}</p>
          <p className="text-[11px] text-[var(--iai-text-subtle)] mt-1">
            Require secure storage
          </p>
        </div>
        <div className="p-3.5 rounded-[var(--iai-radius-md)] border border-[var(--iai-border)] bg-[var(--iai-bg)]">
          <p className="text-xs text-[var(--iai-text-subtle)]">Functional Groups</p>
          <p className="text-xl font-bold text-[var(--iai-primary)] mt-0.5">
            {FUNCTIONAL_GROUPS.length}
          </p>
          <p className="text-[11px] text-[var(--iai-text-subtle)] mt-1">
            Auth, Database, API Keys, etc.
          </p>
        </div>
        <div className="p-3.5 rounded-[var(--iai-radius-md)] border border-[var(--iai-border)] bg-[var(--iai-bg)]">
          <p className="text-xs text-[var(--iai-text-subtle)]">Web App Required</p>
          <p className="text-xl font-bold text-emerald-600 mt-0.5">NEXTAUTH_SECRET</p>
          <p className="text-[11px] text-[var(--iai-text-subtle)] mt-1">
            Minimum for web auth
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="relative flex-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="env-search-input"
                className="text-xs font-semibold text-[var(--iai-text)] flex items-center gap-1.5"
              >
                <span>Filter by Variable Name</span>
                {searchQuery.trim() && (
                  <span className="text-[11px] font-normal text-[var(--iai-text-subtle)]">
                    (matching &ldquo;{searchQuery.trim()}&rdquo;)
                  </span>
                )}
              </label>
              {searchQuery && (
                <button
                  type="button"
                  id="btn-clear-search-link"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-[var(--iai-primary)] hover:underline cursor-pointer"
                >
                  Clear search
                </button>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--iai-text-subtle)]">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                id="env-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter variables by name as you type (e.g., NEXTAUTH, DATABASE, KEYCLOAK, OTEL)..."
                aria-label="Filter environment variables by name"
                className="w-full pl-9 pr-14 py-2 text-sm rounded-[var(--iai-radius-md)] border border-[var(--iai-border)] bg-[var(--iai-bg)] text-[var(--iai-text)] placeholder-[var(--iai-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--iai-primary)] font-mono"
              />
              {searchQuery && (
                <button
                  type="button"
                  id="btn-clear-search"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear variable name search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-[var(--iai-radius-sm)] border border-[var(--iai-border)] bg-[var(--iai-bg-subtle)] text-[11px] font-medium text-[var(--iai-text-subtle)] hover:text-[var(--iai-text)] cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="space-y-1.5">
              <label
                htmlFor="scope-select"
                className="text-xs font-semibold text-[var(--iai-text)] block"
              >
                Scope
              </label>
              <select
                id="scope-select"
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value)}
                className="px-3 py-2 text-sm rounded-[var(--iai-radius-md)] border border-[var(--iai-border)] bg-[var(--iai-bg)] text-[var(--iai-text)] focus:outline-none focus:ring-2 focus:ring-[var(--iai-primary)]"
              >
                <option value="all">All Scopes</option>
                <option value="web">Web App Only</option>
                <option value="gateway">Gateway (AI)</option>
                <option value="worker">Worker Service</option>
                <option value="infra">Infrastructure (Docker / DB)</option>
                <option value="shared">Shared</option>
              </select>
            </div>
          </div>
        </div>

        {/* Functional Purpose Filter Pills */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="tablist"
          aria-label="Filter by functional purpose"
        >
          <span className="text-xs font-semibold text-[var(--iai-text-subtle)] mr-1">
            Purpose:
          </span>
          <button
            id="cat-filter-all"
            type="button"
            role="tab"
            aria-selected={selectedCategory === 'All'}
            onClick={() => setSelectedCategory('All')}
            className={[
              'px-3 py-1.5 rounded-[var(--iai-radius-md)] text-xs font-medium transition-colors cursor-pointer',
              selectedCategory === 'All'
                ? 'bg-[var(--iai-primary)] text-white'
                : 'bg-[var(--iai-bg)] text-[var(--iai-text-subtle)] border border-[var(--iai-border)] hover:bg-[var(--iai-bg-subtle)] hover:text-[var(--iai-text)]',
            ].join(' ')}
          >
            All Purposes ({ENV_VARIABLES.length})
          </button>
          {FUNCTIONAL_GROUPS.map((g) => {
            const count = ENV_VARIABLES.filter((v) => v.category === g.category).length;
            const isSelected = selectedCategory === g.category;
            return (
              <button
                key={g.id}
                id={`cat-filter-${g.id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedCategory(g.category)}
                className={[
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--iai-radius-md)] text-xs font-medium transition-colors cursor-pointer',
                  isSelected
                    ? 'bg-[var(--iai-primary)] text-white'
                    : 'bg-[var(--iai-bg)] text-[var(--iai-text-subtle)] border border-[var(--iai-border)] hover:bg-[var(--iai-bg-subtle)] hover:text-[var(--iai-text)]',
                ].join(' ')}
              >
                <span>{g.icon}</span>
                <span>{g.title}</span>
                <span
                  className={
                    isSelected
                      ? 'text-white/80 text-[11px]'
                      : 'text-[var(--iai-text-subtle)] text-[11px]'
                  }
                >
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Header and Quick Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--iai-text-subtle)] border-b border-[var(--iai-border)] pb-2.5">
        <p>
          Showing <strong className="text-[var(--iai-text)]">{totalFilteredCount}</strong>{' '}
          {totalFilteredCount === 1 ? 'variable' : 'variables'} across{' '}
          <strong className="text-[var(--iai-text)]">{groupedData.length}</strong>{' '}
          functional {groupedData.length === 1 ? 'group' : 'groups'}
          {searchQuery.trim() && (
            <span>
              {' '}
              matching name{' '}
              <strong className="text-[var(--iai-text)] font-mono">
                &ldquo;{searchQuery.trim()}&rdquo;
              </strong>
            </span>
          )}
          {selectedCategory !== 'All' && (
            <span>
              {' '}
              in <em>{selectedCategory}</em>
            </span>
          )}
          {selectedScope !== 'all' && (
            <span>
              {' '}
              scoped to <em>{selectedScope}</em>
            </span>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            id="btn-export-env"
            size="sm"
            variant="secondary"
            onClick={handleExportDotEnv}
            disabled={totalFilteredCount === 0}
            title={
              totalFilteredCount === 0
                ? 'No variables matching filters'
                : `Download ${totalFilteredCount} filtered variables as .env file`
            }
            aria-label="Export filtered environment variables to .env format"
            className="cursor-pointer gap-1.5 text-xs font-semibold"
          >
            {exportSuccess ? (
              <>
                <svg
                  className="w-3.5 h-3.5 text-emerald-600 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-emerald-700">Exported .env!</span>
              </>
            ) : (
              <>
                <svg
                  className="w-3.5 h-3.5 text-[var(--iai-primary)] shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span>Export to .env format</span>
              </>
            )}
          </Button>

          <span className="text-[var(--iai-border)] hidden sm:inline">|</span>

          <button
            type="button"
            onClick={() => {
              const anyCollapsed = Object.values(collapsedGroups).some(Boolean);
              if (anyCollapsed) {
                setCollapsedGroups({});
              } else {
                const allCollapsed: Record<string, boolean> = {};
                for (const g of FUNCTIONAL_GROUPS) {
                  allCollapsed[g.id] = true;
                }
                setCollapsedGroups(allCollapsed);
              }
            }}
            className="text-xs text-[var(--iai-primary)] hover:underline font-medium"
          >
            {Object.values(collapsedGroups).some(Boolean)
              ? 'Expand All Groups'
              : 'Collapse All Groups'}
          </button>

          <span className="text-[var(--iai-border)]">|</span>

          <button
            type="button"
            onClick={() => {
              const allExpanded = totalFilteredCount > 0 && expandedVar === 'ALL';
              setExpandedVar(allExpanded ? null : 'ALL');
            }}
            className="text-xs text-[var(--iai-primary)] hover:underline font-medium"
          >
            {expandedVar === 'ALL' ? 'Collapse All Details' : 'Expand All Details'}
          </button>
        </div>
      </div>

      {/* Grouped Environment Variables Content */}
      {groupedData.length === 0 ? (
        <div className="text-center py-12 rounded-[var(--iai-radius-lg)] border border-[var(--iai-border)] bg-[var(--iai-bg)] p-8">
          <p className="text-sm font-medium text-[var(--iai-text)]">
            {searchQuery.trim()
              ? `No environment variables found with name matching "${searchQuery.trim()}"`
              : 'No matching environment variables found'}
          </p>
          <p className="text-xs text-[var(--iai-text-subtle)] mt-1 mb-4">
            {searchQuery.trim()
              ? 'Check the variable name spelling or clear the search field to view all variables.'
              : 'Try adjusting your search query or reset category and scope filters.'}
          </p>
          <Button
            size="sm"
            variant="secondary"
            id="btn-reset-filters"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setSelectedScope('all');
            }}
          >
            {searchQuery.trim() ? 'Clear Search & Reset' : 'Reset All Filters'}
          </Button>
        </div>
      ) : (
        <div
          className="space-y-8"
          role="feed"
          aria-label="Environment variables by functional purpose"
        >
          {groupedData.map((group) => {
            const isGroupCollapsed = collapsedGroups[group.id] ?? false;
            const secretInGroupCount = group.variables.filter((v) => v.isSecret).length;

            return (
              <section
                key={group.id}
                id={group.id}
                aria-labelledby={`heading-${group.id}`}
                className="rounded-[var(--iai-radius-lg)] border border-[var(--iai-border)] bg-[var(--iai-bg)] overflow-hidden shadow-xs"
              >
                {/* Functional Purpose Section Header */}
                <header className="p-4 sm:p-5 bg-[var(--iai-bg-subtle)] border-b border-[var(--iai-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl" aria-hidden="true">
                        {group.icon}
                      </span>
                      <h2
                        id={`heading-${group.id}`}
                        className="text-base font-bold text-[var(--iai-text)]"
                      >
                        {group.title}
                      </h2>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-[var(--iai-bg)] border border-[var(--iai-border)] text-[var(--iai-text)]">
                        {group.variables.length}{' '}
                        {group.variables.length === 1 ? 'variable' : 'variables'}
                      </span>
                      {secretInGroupCount > 0 && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 border border-amber-500/20">
                          {secretInGroupCount}{' '}
                          {secretInGroupCount === 1 ? 'secret' : 'secrets'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--iai-text-subtle)] max-w-3xl">
                      {group.description}
                    </p>
                    <p className="text-[11px] text-[var(--iai-text-subtle)] font-medium">
                      Services:{' '}
                      <span className="text-[var(--iai-text)]">{group.keyServices}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      id={`btn-toggle-group-${group.id}`}
                      onClick={() => toggleGroupCollapse(group.id)}
                      aria-expanded={!isGroupCollapsed}
                      aria-controls={`group-vars-${group.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--iai-radius-sm)] border border-[var(--iai-border)] bg-[var(--iai-bg)] text-xs font-medium text-[var(--iai-text-subtle)] hover:text-[var(--iai-text)] hover:bg-[var(--iai-bg-subtle)] transition-colors cursor-pointer"
                    >
                      <span>{isGroupCollapsed ? 'Show Variables' : 'Hide Section'}</span>
                      <svg
                        className={[
                          'w-3.5 h-3.5 transition-transform duration-200',
                          isGroupCollapsed ? '' : 'rotate-180',
                        ].join(' ')}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                </header>

                {/* Variable Cards within this functional group */}
                {!isGroupCollapsed && (
                  <div
                    id={`group-vars-${group.id}`}
                    className="p-3 sm:p-4 space-y-3 bg-[var(--iai-bg)]"
                  >
                    {group.variables.map((item) => {
                      const isExpanded =
                        expandedVar === 'ALL' || expandedVar === item.name;
                      const isCopied = copiedVar === item.name;

                      return (
                        <article
                          key={item.name}
                          id={`env-var-${item.name.toLowerCase()}`}
                          className="rounded-[var(--iai-radius-md)] border border-[var(--iai-border)] bg-[var(--iai-bg)] transition-colors hover:border-[var(--iai-border-strong)]"
                        >
                          {/* Primary Card Row */}
                          <div className="p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="space-y-2 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="inline-flex items-center gap-1.5 bg-[var(--iai-bg-subtle)] p-1 rounded-[var(--iai-radius-sm)] border border-[var(--iai-border)]">
                                  <code
                                    title={`Runtime impact: ${item.usage}`}
                                    className="text-sm font-bold font-mono text-[var(--iai-text)] px-1 cursor-help"
                                  >
                                    {highlightMatch(item.name, searchQuery)}
                                  </code>

                                  <button
                                    type="button"
                                    id={`btn-copy-${item.name.toLowerCase()}`}
                                    onClick={() => handleCopy(item.name, item.name)}
                                    title={`Copy ${item.name} key to clipboard`}
                                    aria-label={`Copy ${item.name} key to clipboard`}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--iai-radius-sm)] border border-[var(--iai-border)] bg-[var(--iai-bg)] text-xs font-medium text-[var(--iai-text-subtle)] hover:text-[var(--iai-text)] hover:border-[var(--iai-border-strong)] transition-all cursor-pointer shadow-xs"
                                  >
                                    {isCopied ? (
                                      <>
                                        <svg
                                          className="w-3.5 h-3.5 text-emerald-600"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                          aria-hidden="true"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M5 13l4 4L19 7"
                                          />
                                        </svg>
                                        <span className="text-emerald-700 font-semibold text-[11px]">
                                          Copied!
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <svg
                                          className="w-3.5 h-3.5 text-[var(--iai-text-subtle)]"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                          aria-hidden="true"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                          />
                                        </svg>
                                        <span className="text-[11px] whitespace-nowrap">
                                          Copy Key
                                        </span>
                                      </>
                                    )}
                                  </button>
                                </div>

                                {/* Runtime Impact Tooltip */}
                                <EnvRuntimeImpactTooltip
                                  variableName={item.name}
                                  impact={item.usage}
                                  scope={item.scope}
                                  requiredForWeb={item.requiredForWeb}
                                  isSecret={item.isSecret ?? false}
                                  {...(item.defaultValue !== undefined
                                    ? { defaultValue: item.defaultValue }
                                    : {})}
                                  isOpen={activeTooltip === item.name}
                                  onOpen={() => setActiveTooltip(item.name)}
                                  onClose={() =>
                                    setActiveTooltip((curr) =>
                                      curr === item.name ? null : curr,
                                    )
                                  }
                                  onToggle={() =>
                                    setActiveTooltip((curr) =>
                                      curr === item.name ? null : item.name,
                                    )
                                  }
                                />

                                {item.isSecret && (
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 border border-amber-500/20">
                                    Secret
                                  </span>
                                )}

                                {item.requiredForWeb && (
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                                    Web Required
                                  </span>
                                )}

                                <span className="text-[11px] text-[var(--iai-text-subtle)] px-2 py-0.5 rounded bg-[var(--iai-bg-subtle)]">
                                  {item.category}
                                </span>

                                <span className="text-[11px] text-[var(--iai-text-subtle)] font-mono">
                                  [{item.scope}]
                                </span>
                              </div>

                              <p className="text-sm text-[var(--iai-text)] leading-relaxed">
                                {item.description}
                              </p>

                              {/* Environment Variable Value Row with Copy Button */}
                              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                <span className="text-[11px] font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide">
                                  {item.defaultValue
                                    ? 'Default Value:'
                                    : 'Example Value:'}
                                </span>
                                <div className="inline-flex items-center gap-1.5 bg-[var(--iai-bg-subtle)] px-2 py-0.5 rounded-[var(--iai-radius-sm)] border border-[var(--iai-border)] max-w-full">
                                  <code
                                    className="font-mono text-xs text-[var(--iai-text)] truncate max-w-[200px] sm:max-w-xs md:max-w-md"
                                    title={item.defaultValue ?? item.exampleValue}
                                  >
                                    {item.defaultValue ?? item.exampleValue}
                                  </code>
                                  <button
                                    type="button"
                                    id={`btn-copy-card-val-${item.name.toLowerCase()}`}
                                    onClick={() =>
                                      handleCopy(
                                        item.defaultValue ?? item.exampleValue,
                                        `card-val-${item.name}`,
                                      )
                                    }
                                    title={`Copy value of ${item.name} to clipboard`}
                                    aria-label={`Copy value of ${item.name} to clipboard`}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--iai-radius-sm)] border border-[var(--iai-border)] bg-[var(--iai-bg)] text-xs text-[var(--iai-text-subtle)] hover:text-[var(--iai-text)] hover:border-[var(--iai-border-strong)] transition-all cursor-pointer shadow-xs"
                                  >
                                    {copiedVar === `card-val-${item.name}` ? (
                                      <>
                                        <svg
                                          className="w-3.5 h-3.5 text-emerald-600 shrink-0"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                          aria-hidden="true"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M5 13l4 4L19 7"
                                          />
                                        </svg>
                                        <span className="text-emerald-700 font-semibold text-[10px]">
                                          Copied!
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <svg
                                          className="w-3.5 h-3.5 text-[var(--iai-text-subtle)] shrink-0"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                          aria-hidden="true"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                          />
                                        </svg>
                                        <span className="text-[10px] font-medium">
                                          Copy
                                        </span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                              <button
                                type="button"
                                id={`btn-toggle-${item.name.toLowerCase()}`}
                                onClick={() =>
                                  setExpandedVar(
                                    expandedVar === item.name ? null : item.name,
                                  )
                                }
                                aria-expanded={isExpanded}
                                aria-controls={`details-${item.name.toLowerCase()}`}
                                className="px-2.5 py-1.5 rounded-[var(--iai-radius-sm)] border border-[var(--iai-border)] bg-[var(--iai-bg)] text-xs font-medium text-[var(--iai-primary)] hover:bg-[var(--iai-bg-subtle)] transition-colors cursor-pointer"
                              >
                                {isExpanded ? 'Less' : 'Details'}
                              </button>
                            </div>
                          </div>

                          {/* Expanded Details Panel */}
                          {isExpanded && (
                            <div
                              id={`details-${item.name.toLowerCase()}`}
                              className="border-t border-[var(--iai-border)] bg-[var(--iai-bg-subtle)] p-4 space-y-3 text-xs"
                            >
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <span className="font-semibold text-[var(--iai-text)] block mb-1">
                                    System Usage & Impact:
                                  </span>
                                  <p className="text-[var(--iai-text-subtle)] leading-relaxed">
                                    {item.usage}
                                  </p>
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--iai-text)] block mb-1">
                                    Where to obtain or generate:
                                  </span>
                                  <p className="text-[var(--iai-text-subtle)] leading-relaxed font-mono">
                                    {item.source}
                                  </p>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-[var(--iai-border)]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[var(--iai-text-subtle)]">
                                    Example Value:{' '}
                                  </span>
                                  <code className="font-mono text-[var(--iai-text)] bg-[var(--iai-bg)] px-1.5 py-0.5 rounded border border-[var(--iai-border)]">
                                    {item.exampleValue}
                                  </code>
                                  <button
                                    type="button"
                                    id={`btn-copy-val-${item.name.toLowerCase()}`}
                                    onClick={() =>
                                      handleCopy(item.exampleValue, `val-${item.name}`)
                                    }
                                    title={`Copy example value of ${item.name}`}
                                    aria-label={`Copy example value of ${item.name}`}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--iai-bg)] border border-[var(--iai-border)] text-[10px] text-[var(--iai-text-subtle)] hover:text-[var(--iai-text)] transition-colors cursor-pointer"
                                  >
                                    {copiedVar === `val-${item.name}` ? (
                                      <span className="text-emerald-700 font-semibold">
                                        Copied!
                                      </span>
                                    ) : (
                                      <>
                                        <svg
                                          className="w-3 h-3"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                          aria-hidden="true"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                          />
                                        </svg>
                                        <span>Copy Value</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                {item.defaultValue && (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[var(--iai-text-subtle)]">
                                      Default:{' '}
                                    </span>
                                    <code className="font-mono text-[var(--iai-text)] bg-[var(--iai-bg)] px-1.5 py-0.5 rounded border border-[var(--iai-border)]">
                                      {item.defaultValue}
                                    </code>
                                    <button
                                      type="button"
                                      id={`btn-copy-def-${item.name.toLowerCase()}`}
                                      onClick={() =>
                                        handleCopy(item.defaultValue!, `def-${item.name}`)
                                      }
                                      title={`Copy default value of ${item.name}`}
                                      aria-label={`Copy default value of ${item.name}`}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--iai-bg)] border border-[var(--iai-border)] text-[10px] text-[var(--iai-text-subtle)] hover:text-[var(--iai-text)] transition-colors cursor-pointer"
                                    >
                                      {copiedVar === `def-${item.name}` ? (
                                        <span className="text-emerald-700 font-semibold">
                                          Copied!
                                        </span>
                                      ) : (
                                        <>
                                          <svg
                                            className="w-3 h-3"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            aria-hidden="true"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth="2"
                                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                            />
                                          </svg>
                                          <span>Copy Value</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
