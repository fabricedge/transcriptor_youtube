export type RateLimiter = {
  check: (key: string) => boolean
  reset: () => void
}

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const hits = new Map<string, number[]>()
  return {
    check(key: string): boolean {
      const now = Date.now()
      const cutoff = now - windowMs
      const list = (hits.get(key) ?? []).filter((t) => t > cutoff)
      if (list.length >= limit) {
        hits.set(key, list)
        return false
      }
      list.push(now)
      hits.set(key, list)
      return true
    },
    reset(): void {
      hits.clear()
    },
  }
}