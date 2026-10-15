"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import "../livedesk/calm.css";
import "./phien.css";

/**
 * The staged viewer room on a phone. Public, anonymous, play money.
 *
 * Talks ONLY to the public JSON API under `/xem-api/` (same origin: Caddy behind the tunnel, or the Next rewrite in
 * development). It never sees arms or blocks — the server does not send them (tests/test_api_xem.py).
 */

export const XEM_API = `${process.env.NEXT_PUBLIC_XEM_API_BASE ?? ""}/xem-api`;
export const HEARTBEAT_MS = 15_000;

const ProductSchema = z.object({ product_id: z.string(), name: z.string(), price_vnd: z.number(), image_url: z.string().nullish() });
const StateSchema = z.object({
  room: z.object({
    title: z.string(),
    status: z.enum(["chua_mo", "dang_mo", "da_dong"]),
    video_url: z.string().nullish(),
    consent_version: z.string(),
    source_label: z.string(),
  }),
  pinned: ProductSchema.nullish(),
  products: z.array(ProductSchema),
  server_time_ms: z.number(),
  poll_after_ms: z.number(),
  source_code_url: z.string(),
});
type RoomState = z.infer<typeof StateSchema>;
type Product = z.infer<typeof ProductSchema>;
export type XemKind = "dong_y" | "nhip" | "xem_san_pham" | "bam" | "them_gio" | "mua" | "binh_luan" | "rut_lui";

const VIEWER_KEY = "livelift.xem.viewer";

/** A random id made on this phone: never a name, never sent anywhere but this room. */
export function getViewerId(storage: Pick<Storage, "getItem" | "setItem">): string {
  const existing = storage.getItem(VIEWER_KEY);
  if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
  const id = crypto.randomUUID().replace(/-/g, "");
  storage.setItem(VIEWER_KEY, id);
  return id;
}

export function consentKey(code: string, version: string): string {
  return `livelift.xem.${code}.dong-y.${version}`;
}

let seq = 0;
export function newEventId(kind: XemKind): string {
  seq += 1;
  return `${kind}-${Date.now().toString(36)}-${seq}-${Math.random().toString(36).slice(2, 8)}`;
}

function embedUrl(url: string): { kind: "video" | "iframe"; src: string } {
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/);
  if (yt) {
    const id = yt[1];
    return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&playsinline=1&controls=0` };
  }
  return { kind: "video", src: url };
}

function vnd(n: number): string {
  return `${n.toLocaleString("vi-VN")} đ`;
}

export function XemRoom({ code }: { code: string }) {
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const viewerId = useRef<string | null>(null);

  const say = (msg: string): void => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const send = useCallback(
    async (kind: XemKind, extra: { product_id?: string; text?: string } = {}): Promise<boolean> => {
      if (!viewerId.current) return false;
      try {
        const res = await fetch(`${XEM_API}/${encodeURIComponent(code)}/su-kien`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ viewer_id: viewerId.current, event_id: newEventId(kind), kind, client_time_ms: Date.now(), ...extra }),
        });
        if (res.status === 410) setWithdrawn(true);
        return res.ok;
      } catch {
        return false;
      }
    },
    [code],
  );

  // Poll the room.
  useEffect(() => {
    let alive = true;
    let timer = 0;
    const load = async (): Promise<void> => {
      let wait = 3000;
      try {
        const res = await fetch(`${XEM_API}/${encodeURIComponent(code)}/trang-thai`, { cache: "no-store" });
        if (res.status === 404) throw new Error("Phòng không tồn tại hoặc đã tắt.");
        if (!res.ok) throw new Error("Không tải được phòng, đang thử lại…");
        const s = StateSchema.parse(await res.json());
        if (alive) {
          setState(s);
          setError(null);
        }
        wait = Math.max(1500, s.poll_after_ms);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Không tải được phòng.");
      }
      if (alive) timer = window.setTimeout(() => void load(), wait);
    };
    void load();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [code]);

  // Restore consent for this room and version.
  useEffect(() => {
    if (!state) return;
    try {
      viewerId.current = getViewerId(window.localStorage);
      setConsented(window.localStorage.getItem(consentKey(code, state.room.consent_version)) === "1");
    } catch {
      viewerId.current = crypto.randomUUID().replace(/-/g, "");
    }
  }, [code, state?.room.consent_version]); // eslint-disable-line react-hooks/exhaustive-deps

  // Heartbeat while the page is visible and the room is open.
  const open = state?.room.status === "dang_mo";
  useEffect(() => {
    if (!consented || !open || withdrawn) return;
    const beat = (): void => {
      if (document.visibilityState === "visible") void send("nhip");
    };
    beat();
    const id = window.setInterval(beat, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [consented, open, withdrawn, send]);

  const agree = async (): Promise<void> => {
    if (!state) return;
    viewerId.current = viewerId.current ?? getViewerId(window.localStorage);
    const ok = await send("dong_y");
    if (ok) {
      try {
        window.localStorage.setItem(consentKey(code, state.room.consent_version), "1");
      } catch {
        /* private mode: consent lives for this page only */
      }
      setConsented(true);
    } else {
      say("Chưa gửi được, thử lại nhé.");
    }
  };

  const withdraw = async (): Promise<void> => {
    if (!window.confirm("Rút lui khỏi nghiên cứu? Mọi thao tác của bạn trong phòng sẽ bị xoá.")) return;
    const ok = await send("rut_lui");
    if (ok) {
      setWithdrawn(true);
      try {
        window.localStorage.removeItem(VIEWER_KEY);
      } catch {
        /* ignore */
      }
    }
  };

  const act = async (kind: XemKind, p: Product, okMsg: string): Promise<void> => {
    const ok = await send(kind, { product_id: p.product_id });
    say(ok ? okMsg : "Chưa gửi được, thử lại nhé.");
  };

  const postComment = async (): Promise<void> => {
    const text = comment.trim().slice(0, 200);
    if (!text) return;
    const ok = await send("binh_luan", { text });
    if (ok) setComment("");
    say(ok ? "Đã gửi bình luận." : "Chưa gửi được, thử lại nhé.");
  };

  const footer = (
    <footer className="xem-foot">
      <span>PHÒNG DÀN DỰNG · TIỀN ẢO</span>
      {state && <a href={state.source_code_url} target="_blank" rel="noreferrer">Mã nguồn (AGPL)</a>}
    </footer>
  );

  if (!state) {
    return (
      <div className="ld ph"><main className="xem"><p className="ph-muted">{error ?? "Đang mở phòng…"}</p></main>{footer}</div>
    );
  }

  if (withdrawn) {
    return (
      <div className="ld ph"><main className="xem" data-testid="xem-withdrawn"><h1 className="ph-title">Bạn đã rút lui</h1><p>Mọi thao tác của bạn đã được xoá khỏi nghiên cứu. Cảm ơn bạn đã ghé.</p></main>{footer}</div>
    );
  }

  if (!consented) {
    return (
      <div className="ld ph">
        <main className="xem" data-testid="xem-consent">
          <h1 className="ph-title">{state.room.title}</h1>
          {declined ? (
            <p>Cảm ơn bạn. Bạn có thể đóng trang này.</p>
          ) : (
            <section className="ph-card ph-paper">
              <h2>Trước khi vào phòng</h2>
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                <li>Đây là phòng live <strong>dàn dựng</strong> phục vụ nghiên cứu sinh viên, không phải buổi bán hàng thật. Mọi giao dịch dùng <strong>tiền ảo</strong>.</li>
                <li>Chúng tôi ghi các thao tác trong phòng (xem, bấm, thêm giỏ, "mua", bình luận) cùng một mã ngẫu nhiên do máy bạn tạo. Không thu tên, số điện thoại, email hay địa chỉ IP. Bình luận được tự động che thông tin cá nhân.</li>
                <li>Cách sản phẩm hiển thị có thể thay đổi theo thời gian. Đây là một phần của nghiên cứu.</li>
                <li>Bạn có thể bấm "Rút lui" bất cứ lúc nào. Khi đó toàn bộ dữ liệu của bạn bị xoá.</li>
                <li>Dữ liệu chỉ dùng cho đề tài LiveLift (AISC&apos;26), xoá chậm nhất ngày 31/12/2026, không liên quan đến điểm số.</li>
              </ul>
              <p className="ph-small">Phiên bản lời đồng ý: {state.room.consent_version}. Căn cứ Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15.</p>
              <div className="xem-actions">
                <button type="button" className="ph-btn ph-btn-primary" onClick={() => void agree()} disabled={state.room.status !== "dang_mo"}>Tôi đồng ý và vào phòng</button>
                <button type="button" className="ph-btn" onClick={() => setDeclined(true)}>Không, cảm ơn</button>
              </div>
              {state.room.status === "chua_mo" && <p className="ph-small">Phòng chưa mở. Trang sẽ tự cập nhật.</p>}
              {state.room.status === "da_dong" && <p className="ph-small">Phòng đã đóng. Cảm ơn bạn đã quan tâm.</p>}
            </section>
          )}
        </main>
        {footer}
      </div>
    );
  }

  const media = state.room.video_url ? embedUrl(state.room.video_url) : null;
  return (
    <div className="ld ph">
      <main className="xem" data-testid="xem-room">
        {media?.kind === "video" && <video className="xem-video" src={media.src} autoPlay muted loop playsInline aria-label="Video người dẫn" />}
        {media?.kind === "iframe" && <iframe className="xem-video" src={media.src} title="Video người dẫn" allow="autoplay; encrypted-media" />}
        {!media && <div className="xem-placeholder">Người dẫn đang giới thiệu sản phẩm</div>}

        {state.room.status !== "dang_mo" && <p className="ph-err">{state.room.status === "da_dong" ? "Phòng đã đóng. Cảm ơn bạn!" : "Phòng chưa mở."}</p>}

        {state.pinned && (
          <section className="xem-pin" data-testid="xem-pinned" aria-label="Sản phẩm đang ghim">
            <div className="xem-pin-kicker">Đang ghim</div>
            <div style={{ fontSize: "var(--fs-20)" }}>{state.pinned.name}</div>
            <div className="ph-muted">{vnd(state.pinned.price_vnd)}</div>
            <div className="xem-actions" style={{ marginTop: 8 }}>
              <button type="button" className="ph-btn ph-btn-primary" onClick={() => void act("bam", state.pinned as Product, "Đã mở sản phẩm.")}>Xem ngay</button>
              <button type="button" className="ph-btn" onClick={() => void act("mua", state.pinned as Product, "Đã đặt mua (tiền ảo).")}>Mua (tiền ảo)</button>
            </div>
          </section>
        )}

        <h2 className="ph-small" style={{ marginTop: 16 }}>TẤT CẢ SẢN PHẨM</h2>
        <ul className="xem-products">
          {state.products.map(p => (
            <li key={p.product_id}>
              <div>
                <div>{p.name}</div>
                <div className="ph-small">{vnd(p.price_vnd)}</div>
              </div>
              <div className="xem-actions">
                <button type="button" className="ph-btn" onClick={() => void act("bam", p, "Đã mở sản phẩm.")}>Xem</button>
                <button type="button" className="ph-btn" onClick={() => void act("them_gio", p, "Đã thêm vào giỏ.")}>Thêm giỏ</button>
                <button type="button" className="ph-btn" onClick={() => void act("mua", p, "Đã đặt mua (tiền ảo).")}>Mua</button>
              </div>
            </li>
          ))}
        </ul>

        <div className="xem-comment">
          <label htmlFor="xem-cmt" className="sr-only">Bình luận</label>
          <input id="xem-cmt" value={comment} maxLength={200} placeholder="Hỏi người dẫn…" onChange={e => setComment(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void postComment(); }} />
          <button type="button" className="ph-btn" onClick={() => void postComment()}>Gửi</button>
        </div>

        <p style={{ marginTop: 24 }}>
          <button type="button" className="ph-btn" onClick={() => void withdraw()}>Rút lui khỏi nghiên cứu</button>
        </p>
        {toast && <div className="xem-toast" role="status">{toast}</div>}
      </main>
      {footer}
    </div>
  );
}
