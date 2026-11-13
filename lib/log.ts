/** One structured log line for Workers Logs (observability is on for both Workers, vite.config.ts). Events are
 * searchable by name. Never pass tokens, keys, IP addresses or Discord IDs; a RuneScape name is the most a line holds. */
export function logEvent(event: string, fields: Record<string, string | number | boolean | null | undefined> = {}, level: 'log' | 'warn' | 'error' = 'log') {
  try {console[level](JSON.stringify({event, ...fields}));} catch { /* Logging never breaks a request. */ }
}
