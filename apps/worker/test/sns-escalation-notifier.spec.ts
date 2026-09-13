// Unit tests for the SNS-backed escalation notifier.
//
// The SNSClient is mocked via vi.fn() — no real AWS credentials or network required.
// Covers: happy-path publish, correct message attributes, SNS error propagation,
// and the subject truncation for long category strings.

import { describe, expect, it, vi } from 'vitest';

import type { SNSClient } from '@aws-sdk/client-sns';
import type { EscalationRoute, Refusal } from '@infinite-ai/guardrails';

import {
  SnsEscalationError,
  createSnsEscalationNotifier,
} from '../src/sns-escalation-notifier.js';

function makeMockClient(sendImpl?: () => Promise<unknown>): SNSClient {
  return {
    send: vi.fn(sendImpl ?? (() => Promise.resolve({ MessageId: 'msg-001' }))),
  } as unknown as SNSClient;
}

const TOPIC_ARN = 'arn:aws:sns:af-south-1:123456789012:safeguarding-escalation';

const ROUTE: EscalationRoute = {
  category: 'safeguarding_concern',
  notifyRole: 'school_principal',
};

const REFUSAL: Refusal = {
  code: 'diagnostic_language_detected',
  explanation: 'Output contained clinical diagnostic framing.',
  escalation: ROUTE,
};

describe('createSnsEscalationNotifier', () => {
  it('calls SNSClient.send once on a successful escalation', async () => {
    const client = makeMockClient();
    const notify = createSnsEscalationNotifier(client, TOPIC_ARN);

    await notify(ROUTE, REFUSAL);

    expect(client.send).toHaveBeenCalledOnce();
  });

  it('publishes to the configured TopicArn', async () => {
    const client = makeMockClient();
    const notify = createSnsEscalationNotifier(client, TOPIC_ARN);
    await notify(ROUTE, REFUSAL);

    const [cmd] = (client.send as ReturnType<typeof vi.fn>).mock.calls[0] as [
      { input: Record<string, unknown> },
    ];
    expect(cmd.input['TopicArn']).toBe(TOPIC_ARN);
  });

  it('includes category, notifyRole, refusalCode and explanation in the JSON body', async () => {
    const client = makeMockClient();
    const notify = createSnsEscalationNotifier(client, TOPIC_ARN);
    await notify(ROUTE, REFUSAL);

    const [cmd] = (client.send as ReturnType<typeof vi.fn>).mock.calls[0] as [
      { input: Record<string, unknown> },
    ];
    const body = JSON.parse(cmd.input['Message'] as string) as Record<string, unknown>;

    expect(body['category']).toBe(ROUTE.category);
    expect(body['notifyRole']).toBe(ROUTE.notifyRole);
    expect(body['refusalCode']).toBe(REFUSAL.code);
    expect(body['explanation']).toBe(REFUSAL.explanation);
    expect(typeof body['timestamp']).toBe('string');
  });

  it('sets SNS MessageAttributes for category, notifyRole and refusalCode', async () => {
    const client = makeMockClient();
    const notify = createSnsEscalationNotifier(client, TOPIC_ARN);
    await notify(ROUTE, REFUSAL);

    const [cmd] = (client.send as ReturnType<typeof vi.fn>).mock.calls[0] as [
      { input: Record<string, unknown> },
    ];
    const attrs = cmd.input['MessageAttributes'] as Record<
      string,
      { DataType: string; StringValue: string }
    >;

    expect(attrs['category']?.StringValue).toBe(ROUTE.category);
    expect(attrs['notifyRole']?.StringValue).toBe(ROUTE.notifyRole);
    expect(attrs['refusalCode']?.StringValue).toBe(REFUSAL.code);
  });

  it('truncates the Subject to 100 characters for long category strings', async () => {
    const client = makeMockClient();
    const longRoute: EscalationRoute = {
      category: 'a'.repeat(200),
      notifyRole: 'school_principal',
    };
    const notify = createSnsEscalationNotifier(client, TOPIC_ARN);
    await notify(longRoute, REFUSAL);

    const [cmd] = (client.send as ReturnType<typeof vi.fn>).mock.calls[0] as [
      { input: Record<string, unknown> },
    ];
    expect((cmd.input['Subject'] as string).length).toBeLessThanOrEqual(100);
  });

  it('throws SnsEscalationError — not a silent no-op — when SNS.send rejects', async () => {
    const snsError = new Error('RequestThrottled');
    const client = makeMockClient(() => Promise.reject(snsError));
    const notify = createSnsEscalationNotifier(client, TOPIC_ARN);

    await expect(notify(ROUTE, REFUSAL)).rejects.toBeInstanceOf(SnsEscalationError);
  });

  it('SnsEscalationError message names the category and role', async () => {
    const client = makeMockClient(() => Promise.reject(new Error('NetworkError')));
    const notify = createSnsEscalationNotifier(client, TOPIC_ARN);

    await expect(notify(ROUTE, REFUSAL)).rejects.toThrow(
      /category "safeguarding_concern".*role "school_principal"/,
    );
  });

  it('does not swallow the original cause on SNS failure', async () => {
    const snsError = new Error('AccessDenied: not authorised');
    const client = makeMockClient(() => Promise.reject(snsError));
    const notify = createSnsEscalationNotifier(client, TOPIC_ARN);

    let thrown: unknown;
    try {
      await notify(ROUTE, REFUSAL);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(SnsEscalationError);
    expect((thrown as SnsEscalationError).cause).toBe(snsError);
  });

  it('publishes to different topic ARNs for different notifier instances', async () => {
    const arn1 = 'arn:aws:sns:af-south-1:111111111111:topic-a';
    const arn2 = 'arn:aws:sns:af-south-1:222222222222:topic-b';
    const client1 = makeMockClient();
    const client2 = makeMockClient();

    await createSnsEscalationNotifier(client1, arn1)(ROUTE, REFUSAL);
    await createSnsEscalationNotifier(client2, arn2)(ROUTE, REFUSAL);

    const [cmd1] = (client1.send as ReturnType<typeof vi.fn>).mock.calls[0] as [
      { input: Record<string, unknown> },
    ];
    const [cmd2] = (client2.send as ReturnType<typeof vi.fn>).mock.calls[0] as [
      { input: Record<string, unknown> },
    ];
    expect(cmd1.input['TopicArn']).toBe(arn1);
    expect(cmd2.input['TopicArn']).toBe(arn2);
  });

  it('propagates a non-Error rejection as an SnsEscalationError', async () => {
    const client = makeMockClient(() => Promise.reject('string error'));
    const notify = createSnsEscalationNotifier(client, TOPIC_ARN);

    await expect(notify(ROUTE, REFUSAL)).rejects.toBeInstanceOf(SnsEscalationError);
  });
});
