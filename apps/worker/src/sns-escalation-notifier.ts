// SNS-backed EscalationNotifier — OQ-014 close.
//
// Publishes to a single SNS topic whose subscriptions (SMS, email, PagerDuty endpoint,
// Lambda, etc.) are configured in the AWS console / IaC, not in this codebase. This keeps
// the "who exactly receives the notification" decision outside application code and lets
// school operators update routing without a deployment.
//
// The topic ARN and AWS credentials are picked up from the environment via the standard
// AWS SDK chain (AWS_REGION / instance metadata / ECS task role / etc.) — nothing is
// hardcoded here. `SAFEGUARDING_SNS_TOPIC_ARN` in `packages/config/src/env.ts` must be
// set for this notifier to be wired; when it is absent the worker falls back to
// `defaultEscalationNotifier` which throws loudly rather than silently no-oping.
//
// Message attributes (`category`, `notifyRole`, `refusalCode`) let SNS filter policies
// route different escalation categories to different subscriptions without needing
// separate topics.

import { PublishCommand } from '@aws-sdk/client-sns';
import type { SNSClient } from '@aws-sdk/client-sns';
import type { EscalationNotifier } from '@infinite-ai/guardrails';

export class SnsEscalationError extends Error {
  public override readonly name = 'SnsEscalationError';
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
  }
}

/**
 * Returns an `EscalationNotifier` that publishes a structured JSON message to an SNS
 * topic. The topic's own subscriptions control delivery — SMS, email, Lambda, or a
 * PagerDuty endpoint URL. SNS errors propagate as `SnsEscalationError` rather than being
 * swallowed: a failed publish must never be mistaken for a successful escalation.
 */
export function createSnsEscalationNotifier(
  client: SNSClient,
  topicArn: string,
): EscalationNotifier {
  return async (route, refusal) => {
    const body = JSON.stringify({
      category: route.category,
      notifyRole: route.notifyRole,
      refusalCode: refusal.code,
      explanation: refusal.explanation,
      timestamp: new Date().toISOString(),
    });

    // Subject is capped at 100 ASCII characters for SNS (email subscriptions).
    const subject = `[INFINITE-AI] Safeguarding: ${route.category}`.slice(0, 100);

    try {
      await client.send(
        new PublishCommand({
          TopicArn: topicArn,
          Subject: subject,
          Message: body,
          MessageAttributes: {
            category: {
              DataType: 'String',
              StringValue: route.category,
            },
            notifyRole: {
              DataType: 'String',
              StringValue: route.notifyRole,
            },
            refusalCode: {
              DataType: 'String',
              StringValue: refusal.code,
            },
          },
        }),
      );
    } catch (err) {
      throw new SnsEscalationError(
        `SNS publish failed for escalation (category "${route.category}", role "${route.notifyRole}"): ${err instanceof Error ? err.message : String(err)}`,
        err,
      );
    }
  };
}
