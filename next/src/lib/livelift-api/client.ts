"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { z } from "zod";
import {
  AnyObjectSchema,
  BaoCaoSchema,
  BlockSchema,
  CommentSchema,
  HostStateSchema,
  OperatorStateSchema,
  OrderSummarySchema,
  SessionSchema,
  TickSchema,
  type BaoCao,
  type Block,
  type Comment,
  type HostState,
  type OperatorState,
  type OrderSummary,
  type Session,
  type Tick,
} from "./types";

/** Browser-side calls to the LiveLift API through the Next proxy (`/api/ll/...`). */

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(method: "GET" | "POST", path: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, body?: unknown): Promise<T> {
  const res = await fetch(`/api/ll/${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const detail = json && typeof json === "object" && "detail" in json ? String((json as { detail: unknown }).detail) : `Lỗi ${res.status}`;
    throw new ApiError(res.status, detail);
  }
  return schema.parse(json);
}

export const api = {
  session: (id: string) => call("GET", `sessions/${id}`, SessionSchema),
  schedule: (id: string) => call("GET", `sessions/${id}/schedule`, BlockSchema.array()),
  operatorState: (id: string) => call("GET", `sessions/${id}/state`, OperatorStateSchema),
  hostState: (id: string) => call("GET", `sessions/${id}/state?role=host`, HostStateSchema),
  ticks: (id: string) => call("GET", `sessions/${id}/ticks`, TickSchema.array()),
  comments: (id: string) => call("GET", `sessions/${id}/comments`, CommentSchema.array()),
  orders: (id: string) => call("GET", `sessions/${id}/orders`, OrderSummarySchema),
  baoCao: (id: string) => call("GET", `sessions/${id}/bao-cao`, BaoCaoSchema),
  pin: (id: string, productId?: string) =>
    call("POST", `sessions/${id}/actions/execute`, AnyObjectSchema, productId ? { product_id: productId } : {}),
  end: (id: string) => call("POST", `sessions/${id}/end`, SessionSchema),
};

export interface DeskData {
  session: Session | null;
  blocks: Block[];
  state: OperatorState | null;
  ticks: Tick[];
  comments: Comment[];
  orders: OrderSummary | null;
  report: BaoCao | null;
  error: string | null;
  updatedAt: number | null;
}

const EMPTY: DeskData = { session: null, blocks: [], state: null, ticks: [], comments: [], orders: null, report: null, error: null, updatedAt: null };

async function settle<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

/** Polls the operator view of one session. The report (heavier) refreshes every 5th tick. */
export function useExperimentDesk(sessionId: string, intervalMs = 2000): { data: DeskData; refresh: () => void } {
  const [data, setData] = useState<DeskData>(EMPTY);
  const tick = useRef(0);
  const load = useCallback(async () => {
    const n = tick.current++;
    try {
      const [session, blocks, state, ticks, comments, orders] = await Promise.all([
        api.session(sessionId),
        api.schedule(sessionId),
        api.operatorState(sessionId),
        settle(api.ticks(sessionId)),
        settle(api.comments(sessionId)),
        settle(api.orders(sessionId)),
      ]);
      const report = n % 5 === 0 ? await settle(api.baoCao(sessionId)) : undefined;
      setData(prev => ({
        session,
        blocks,
        state,
        ticks: ticks ?? prev.ticks,
        comments: comments ?? prev.comments,
        orders: orders ?? prev.orders,
        report: report === undefined ? prev.report : report,
        error: null,
        updatedAt: Date.now(),
      }));
    } catch (e) {
      setData(prev => ({ ...prev, error: e instanceof Error ? e.message : "Không đọc được dữ liệu phiên." }));
    }
  }, [sessionId]);
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), intervalMs);
    return () => window.clearInterval(id);
  }, [load, intervalMs]);
  return { data, refresh: () => void load() };
}

/** The host's blinded view: only what is pinned now. */
export function useHostView(sessionId: string, intervalMs = 2000): { state: HostState | null; error: string | null } {
  const [state, setState] = useState<HostState | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async (): Promise<void> => {
      try {
        const s = await api.hostState(sessionId);
        if (alive) {
          setState(s);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Không đọc được.");
      }
    };
    void load();
    const id = window.setInterval(() => void load(), intervalMs);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [sessionId, intervalMs]);
  return { state, error };
}
