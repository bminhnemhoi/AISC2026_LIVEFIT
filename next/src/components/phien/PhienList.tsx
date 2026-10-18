"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/livelift-api/client";
import { sourceLabel } from "@/lib/livelift-api/desk";
import type { Session } from "@/lib/livelift-api/types";
import { SourceBadge } from "./parts";
import "../livedesk/calm.css";
import "./phien.css";

/**
 * Entry point of the experiment mode: every session the LiveLift server holds, grouped by status, each with its
 * data-source label (THẬT / DÀN DỰNG / MÔ PHỎNG / CHẠY THỬ) so a sample can never pass for a real result.
 */

const NHOM: Array<{ status: string; title: string }> = [
  { status: "live", title: "Đang phát" },
  { status: "planned", title: "Đã lên lịch" },
  { status: "ended", title: "Đã kết thúc" },
];

export function groupSessions(sessions: Session[]): Array<{ title: string; items: Session[] }> {
  const byStart = (a: Session, b: Session): number => (b.start_ts ?? "").localeCompare(a.start_ts ?? "");
  return NHOM.map(g => ({ title: g.title, items: sessions.filter(s => s.status === g.status).sort(byStart) })).filter(
    g => g.items.length > 0,
  );
}

function when(ts: string | null | undefined): string {
  if (!ts) return "chưa phát";
  const d = new Date(ts);
  return `${d.toLocaleDateString("vi-VN")} ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

export function PhienList() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .sessions()
      .then(s => {
        setSessions(s);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Không tải được danh sách phiên."));
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 5000);
    return () => window.clearInterval(id);
  }, [load]);

  const seed = async (kind: "demo" | "vang"): Promise<void> => {
    setBusy(true);
    try {
      await (kind === "demo" ? api.seedDemo() : api.seedVang());
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không gieo được dữ liệu mẫu.");
    } finally {
      setBusy(false);
    }
  };

  const groups = groupSessions(sessions ?? []);
  return (
    <div className="ld ph" data-testid="phien-list">
      <div className="ph-wrap">
        <div className="ph-top">
          <div>
            <h1 className="ph-title">Thí nghiệm có bốc thăm</h1>
            <p className="ph-sub">Mọi phiên trên máy chủ LiveLift. Nhãn nguồn cho biết số đến từ đâu: thật, phòng dàn dựng hay mô phỏng.</p>
          </div>
          <div className="xem-actions">
            <button type="button" className="ph-btn" disabled={busy} onClick={() => void seed("vang")}>Bộ demo vàng</button>
            <button type="button" className="ph-btn" disabled={busy} onClick={() => void seed("demo")}>Gieo phiên mẫu đang phát</button>
          </div>
        </div>
        {error && <div className="ph-err" role="alert">{error}</div>}
        {sessions && sessions.length === 0 && <p className="ph-muted">Chưa có phiên nào. Gieo dữ liệu mẫu để xem thử, hoặc tạo phiên từ API.</p>}
        {groups.map(g => (
          <section key={g.title} className="ph-card">
            <h2>{g.title}</h2>
            <table className="ph-table">
              <tbody>
                {g.items.map(s => (
                  <tr key={s.session_id}>
                    <td style={{ width: "40%" }}>{s.title || "Phiên không tên"}</td>
                    <td><SourceBadge label={sourceLabel(s)} /></td>
                    <td className="ph-muted">{when(s.start_ts)} · {s.planned_duration_min} phút</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link href={`/phien/${s.session_id}`}>Bàn thí nghiệm</Link>
                      {" · "}
                      <Link href={`/phien/${s.session_id}/nguoi-dan`}>Người dẫn</Link>
                      {s.status === "ended" && (
                        <>
                          {" · "}
                          <Link href={`/phien/${s.session_id}/tong-ket`}>Tổng kết</Link>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}
