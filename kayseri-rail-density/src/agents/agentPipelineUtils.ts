import type { AgentName, AgentStatus, AgentStepResult } from './agentTypes';

export type AgentRunOutcome<T> = {
  output: T;
  summary: string;
  warnings: readonly string[];
};

export function runAgentStep<T>(
  agentName: AgentName,
  run: () => AgentRunOutcome<T>
): AgentStepResult {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  try {
    const { output, summary, warnings } = run();
    const finishedAt = new Date().toISOString();
    return {
      agentName,
      status: 'COMPLETED',
      startedAt,
      finishedAt,
      durationMs: Date.now() - startMs,
      summary,
      warnings: [...warnings],
      output: serializeOutput(output),
    };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);
    return {
      agentName,
      status: 'FAILED',
      startedAt,
      finishedAt,
      durationMs: Date.now() - startMs,
      summary: `Adım başarısız: ${message}`,
      warnings: [],
      output: null,
    };
  }
}

export function skippedAgentStep(agentName: AgentName, reason: string): AgentStepResult {
  const now = new Date().toISOString();
  return {
    agentName,
    status: 'SKIPPED',
    startedAt: now,
    finishedAt: now,
    durationMs: 0,
    summary: reason,
    warnings: [],
    output: null,
  };
}

export function resolvePipelineStatus(steps: readonly AgentStepResult[]): AgentStatus {
  if (steps.some((s) => s.status === 'FAILED')) return 'FAILED';
  if (steps.every((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED')) {
    return steps.some((s) => s.status === 'COMPLETED') ? 'COMPLETED' : 'SKIPPED';
  }
  return 'FAILED';
}

function serializeOutput<T>(output: T): unknown {
  return JSON.parse(JSON.stringify(output)) as unknown;
}
