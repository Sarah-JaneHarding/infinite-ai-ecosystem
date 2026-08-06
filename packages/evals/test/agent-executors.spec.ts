import { afterEach, describe, expect, it } from 'vitest';

import {
  AgentExecutorRegistryError,
  _clearAgentExecutorRegistry,
  getAgentExecutor,
  registerAgentExecutor,
  registeredAgentIds,
} from '../src/agent-executors.js';
import type { AgentExecutor } from '../src/runner.js';

afterEach(() => {
  _clearAgentExecutorRegistry();
});

const noop: AgentExecutor = async () => ({ output: {} });

describe('agent executor registry', () => {
  it('returns undefined for an agent with no registered executor', () => {
    expect(getAgentExecutor('CE-05')).toBeUndefined();
  });

  it('registers and retrieves an executor by agent id', () => {
    registerAgentExecutor('CE-05', noop);
    expect(getAgentExecutor('CE-05')).toBe(noop);
  });

  it('refuses a second registration for the same agent id', () => {
    registerAgentExecutor('CE-05', noop);
    expect(() => registerAgentExecutor('CE-05', noop)).toThrow(
      AgentExecutorRegistryError,
    );
  });

  it('lists registered agent ids sorted', () => {
    registerAgentExecutor('CE-06', noop);
    registerAgentExecutor('CE-05', noop);
    expect(registeredAgentIds()).toEqual(['CE-05', 'CE-06']);
  });

  it('clearing the registry removes all registrations', () => {
    registerAgentExecutor('CE-05', noop);
    _clearAgentExecutorRegistry();
    expect(registeredAgentIds()).toEqual([]);
  });
});
