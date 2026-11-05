/**
 * Minimal scoped logger for server code. Gives every module a consistent
 * `[scope]` prefix so logs are greppable (`[b2b-lead]`, `[crm-sync]`, …)
 * without pulling in a logging framework.
 */
export interface Logger {
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
}

export function createLogger(scope: string): Logger {
  const prefix = `[${scope}]`;
  return {
    error: (...args: unknown[]) => console.error(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    info: (...args: unknown[]) => console.log(prefix, ...args),
  };
}
