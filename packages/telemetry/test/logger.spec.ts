import { describe, expect, it } from 'vitest';

import { createLogger, secret, type LogLine } from '../src/logger.js';

function collector(): { lines: LogLine[]; sink: (line: LogLine) => void } {
  const lines: LogLine[] = [];
  return { lines, sink: (line) => lines.push(line) };
}

describe('createLogger — happy path', () => {
  it('emits a structured line with level, message, timestamp and fields', () => {
    const { lines, sink } = collector();
    const logger = createLogger({ sink });
    logger.info('gateway.boot', { port: 8080 });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: 'info',
      message: 'gateway.boot',
      port: 8080,
    });
    expect(typeof lines[0]!.at).toBe('string');
  });

  it('filters lines below the configured level', () => {
    const { lines, sink } = collector();
    const logger = createLogger({ sink, level: 'warn' });
    logger.info('should not appear');
    logger.warn('should appear');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.message).toBe('should appear');
  });

  it('child() attaches its fields to every subsequent line', () => {
    const { lines, sink } = collector();
    const logger = createLogger({ sink }).child({ tenantId: 'tenant-1' });
    logger.info('gateway.request');
    expect(lines[0]).toMatchObject({ tenantId: 'tenant-1' });
  });
});

describe('createLogger — zero credentials in logs', () => {
  it('redacts a secret registered at construction, in the message and in a field', () => {
    const { lines, sink } = collector();
    const logger = createLogger({ sink, secrets: [secret('sk-super-secret-key')] });

    logger.error('provider call failed: sk-super-secret-key', {
      detail: 'auth header was Bearer sk-super-secret-key',
    });

    const serialised = JSON.stringify(lines[0]);
    expect(serialised).not.toContain('sk-super-secret-key');
    expect(serialised).toContain('[REDACTED]');
  });

  it('redacts a secret registered later, via redact()', () => {
    const { lines, sink } = collector();
    const logger = createLogger({ sink });
    logger.redact(secret('key-added-after-boot'));

    logger.warn('pool exhausted', { lastKeyTried: 'key-added-after-boot' });
    expect(JSON.stringify(lines[0])).not.toContain('key-added-after-boot');
  });

  it('redacts a secret nested inside an Error message', () => {
    const { lines, sink } = collector();
    const logger = createLogger({ sink, secrets: [secret('sk-nested')] });
    logger.error('unhandled', { error: new Error('failed with key sk-nested') });
    expect(JSON.stringify(lines[0])).not.toContain('sk-nested');
  });

  it('does not throw and does not leak a secret when the level filters the line out entirely', () => {
    const { lines, sink } = collector();
    const logger = createLogger({ sink, level: 'error', secrets: [secret('sk-hidden')] });
    logger.debug('noisy', { key: 'sk-hidden' });
    expect(lines).toHaveLength(0);
  });
});
