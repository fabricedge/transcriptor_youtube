import { Database } from "bun:sqlite"
import { listOrdersByStatus, setOrderStatus } from "./db"
import { config } from "./config"
import type { Order } from "./types"

export type ProcessResult = { ok: true; count: number } | { ok: false; error: string }

export type WorkerDeps = {
  db: Database
  processOrder: (order: Order) => Promise<ProcessResult>
  refund: (paymentIntent: string) => Promise<void>
  onRefundFailed?: (order: Order, err: unknown) => void
  onCycleError?: (err: unknown) => void
}

export function recoverStuckOrders(db: Database): number {
  const stuck = listOrdersByStatus(db, "processing")
  for (const order of stuck) {
    setOrderStatus(db, order.id, "paid", { error: null })
  }
  return stuck.length
}

export async function tick(deps: WorkerDeps): Promise<void> {
  const paid = listOrdersByStatus(deps.db, "paid")
  for (const order of paid) {
    const res = await deps.processOrder(order)
    if (res.ok) {
      setOrderStatus(deps.db, order.id, "ready", { error: null })
      continue
    }
    setOrderStatus(deps.db, order.id, "failed", { error: res.error })
    if (order.paymentIntent) {
      try {
        await deps.refund(order.paymentIntent)
      } catch (err) {
        deps.onRefundFailed?.(order, err)
      }
    }
  }
}

export function startWorker(deps: WorkerDeps, intervalMs: number = config.workerIntervalMs): { stop: () => void } {
  recoverStuckOrders(deps.db)
  const handle = setInterval(() => {
    tick(deps).catch((err) => deps.onCycleError?.(err))
  }, intervalMs)
  return {
    stop: () => clearInterval(handle),
  }
}