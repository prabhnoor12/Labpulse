const startedAt = Date.now();
const counters = new Map<string, number>();

export function incrementMetric(name: string, value = 1): void {
  counters.set(name, (counters.get(name) || 0) + value);
}

export function recordHttpResponse(status: number): void {
  incrementMetric('http_requests_total');
  incrementMetric(`http_responses_${Math.floor(status / 100)}xx_total`);
}

export function metricsSnapshot(): Record<string, unknown> {
  const memory = process.memoryUsage();
  return {
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    counters: Object.fromEntries(counters.entries()),
    process: {
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
    },
  };
}
