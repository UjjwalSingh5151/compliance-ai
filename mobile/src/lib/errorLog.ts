/**
 * Simple in-app error logger.
 * Stores the last 30 errors in memory so teachers can copy them for debugging.
 */

interface LogEntry {
  ts: string;
  msg: string;
  ctx?: string;
}

const logs: LogEntry[] = [];
const MAX = 30;

export function logError(msg: string, ctx?: string) {
  logs.unshift({ ts: new Date().toISOString(), msg, ctx });
  if (logs.length > MAX) logs.pop();
  console.error(`[Kelzo${ctx ? `:${ctx}` : ""}]`, msg);
}

export function getLogs(): LogEntry[] {
  return [...logs];
}

export function clearLogs() {
  logs.length = 0;
}

export function errorCount(): number {
  return logs.length;
}

export function lastErrorSummary(): string {
  return logs
    .slice(0, 5)
    .map((l) => `[${l.ctx || "App"}] ${l.msg}`)
    .join("\n\n");
}
