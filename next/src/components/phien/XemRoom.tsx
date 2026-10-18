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
 *
 * The right to withdraw outlives the room: when the room is switched off (trang-thai 404) a phone that still holds its
 * random id keeps a minimal "Rút lui và xoá dữ liệu của tôi" button (19/10/2026). Nothing new is stored for that.
 */

export const XEM_API = `${process.env.NEXT_PUBLIC_XEM_API_BASE ?? ""}/xem-api`;
export const HEARTBEAT_MS = 15_000;
/** Attempts per event (1 + retries) when the connection drops or a proxy answers 5xx. */
export const SEND_ATTEMPTS = 3;

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
const VIEWER_ID = /^[A-Za-z0-9_-]{16,64}$/;

/** The id this phone already holds, or null. Never creates one: a room that is gone must not leave a new id behind. */
export function storedViewerId(storage: Pick<Storage, "getItem">): string | null {
  const existing = storage.getItem(VIEWER_KEY);
  return existing && VIEWER_ID.test(existing) ? existing : null;
}

/** A random id made on this phone: never a name, never sent anywhere but this room. */
export function getViewerId(storage: Pick<Storage, "getItem" | "setItem">): string {
  const existing = storedViewerId(storage);
  if (existing) return existing;
  const id = crypto.randomUUID().replace(/-/g, "");
  storage.setItem(VIEWER_KEY, id);
  return id;
}

export function consentKey(code: string, version: string): string {
  return `livelift.xem.${code}.dong-y.${version}`;
}

/** A consent mark written by consentKey, for any room code and any version. */
const CONSENT_MARK = /^livelift\.xem\..+\.dong-y\./;

/**
 * After a withdrawal the server confirmed: drop the random id AND the consent marks of every room on this phone.
 * The id is one for all rooms (VIEWER_KEY), so once it is gone no mark can point at it any more. A mark left behind,
 * in this room or in any other, would reopen that room on the next visit under a NEW id that never agreed: every
 * action would answer 403, and a withdrawal there would wrongly read "nothing to delete" (G3-xem-ui, 19/10/2026).
 * Keys that are not the viewer id or a consent mark are not touched.
 */
export function forgetViewerEverywhere(storage: Pick<Storage, "length" | "key" | "removeItem">): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k !== null && (k === VIEWER_KEY || CONSENT_MARK.test(k))) keys.push(k);
  }
  for (const k of keys) storage.removeItem(k);
}

export type LeaveNote = { kind: "loi" | "tin"; text: string };

/**
 * What the phone says when a withdrawal was not confirmed. It never claims a deletion the server did not confirm.
 * 403 (consent gate) and 404 (a switched-off room answers a phone that never took part like an unknown code,
 * xem.py) both mean the server holds nothing from this phone in this room: information, not an error.
 */
export function withdrawNote(status: number | null): LeaveNote {
  if (status === 403 || status === 404) {
    return { kind: "tin", text: "Máy chủ không có dữ liệu nào của máy này trong phòng này, nên không có gì để xoá." };
  }
  if (status === 429) {
    return { kind: "loi", text: "Bạn bấm hơi nhanh. Chờ khoảng một phút rồi bấm lại. Dữ liệu của bạn chưa bị xoá." };
  }
  if (status === null || status >= 500) {
    return {
      kind: "loi",
      text: "Chưa gửi được yêu cầu rút lui (mất mạng hoặc máy chủ đang bận). Dữ liệu của bạn chưa bị xoá. Kiểm tra mạng rồi bấm lại.",
    };
  }
  return { kind: "loi", text: `Chưa rút lui được (mã ${status}). Dữ liệu của bạn chưa bị xoá. Thử lại sau ít phút.` };
}

function readStoredViewer(): string | null {
  try {
    return storedViewerId(window.localStorage);
  } catch {
    return null; // private mode or blocked storage: nothing was kept, so there is nothing to withdraw from here
  }
}

let seq = 0;
export function newEventId(kind: XemKind): string {
  seq += 1;
  return `${kind}-${Date.now().toString(36)}-${seq}-${Math.random().toString(36).slice(2, 8)}`;
}

export type PostOutcome = { ok: boolean; status: number | null };

/**
 * POST one room event, retrying a dropped connection or a proxy 5xx with the SAME body (hence the same event id):
 * the server dedups on it, so a retry can never record a click twice. 4xx answers are final (consent missing,
 * withdrawn, rate limit) and are never retried.
 */
export async function postEvent(
  url: string,
  body: string,
  fetchImpl: typeof fetch = fetch,
  attempts: number = SEND_ATTEMPTS,
  backoffMs: number = 400,
): Promise<PostOutcome> {
  let status: number | null = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0 && backoffMs > 0) await new Promise(r => setTimeout(r, backoffMs * attempt));
    try {
      const res = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      status = res.status;
      if (res.status < 500) return { ok: res.ok, status };
    } catch {
      status = null;
    }
  }
  return { ok: false, status };
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

/**
 * The withdrawal control, in the open room and on a room that is gone. It asks once INSIDE the page, not with
 * window.confirm: an iOS in-app browser (Zalo, Messenger) that does not implement the confirm panel answers "Cancel"
 * without showing anything, and the right to withdraw would silently do nothing. A failure is reported here, in the
 * page, never through window.alert. On success the parent swaps to the "Bạn đã rút lui" screen.
 */
function RutLui({ label, onSend }: { label: string; onSend: () => Promise<PostOutcome> }) {
  const [step, setStep] = useState<"nut" | "hoi" | "gui">("nut");
  const [note, setNote] = useState<LeaveNote | null>(null);

  const go = async (): Promise<void> => {
    setStep("gui");
    setNote(null);
    const out = await onSend();
    if (!out.ok) {
      setNote(withdrawNote(out.status));
      setStep("nut");
    }
  };

  return (
    <div className="xem-leave" data-testid="xem-leave">
      {step === "hoi" ? (
        <>
          <p>Mọi thao tác của bạn trong phòng sẽ bị xoá khỏi nghiên cứu. Bạn chắc chứ?</p>
          <div className="xem-actions">
            <button type="button" className="ph-btn ph-btn-primary" onClick={() => void go()}>Xác nhận rút lui</button>
            <button type="button" className="ph-btn" onClick={() => setStep("nut")}>Huỷ</button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="ph-btn"
          disabled={step === "gui"}
          onClick={() => {
            setNote(null);
            setStep("hoi");
          }}
        >
          {step === "gui" ? "Đang gửi…" : label}
        </button>
      )}
      {note && (
        <p className={note.kind === "loi" ? "ph-err" : "ph-muted"} role={note.kind === "loi" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
    </div>
  );
}

export function XemRoom({ code }: { code: string }) {
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** trang-thai answered 404: the room was switched off or never existed. */
  const [gone, setGone] = useState(false);
  /** The id this phone still holds when the room is gone (read only, never created). */
  const [leftover, setLeftover] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);
  /** The local id and every room's consent marks were removed after a confirmed withdrawal. */
  const [cleared, setCleared] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const viewerId = useRef<string | null>(null);

  const say = (msg: string): void => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const post = useCallback(
    async (kind: XemKind, extra: { product_id?: string; text?: string } = {}): Promise<PostOutcome> => {
      if (!viewerId.current) return { ok: false, status: null };
      const body = JSON.stringify({ viewer_id: viewerId.current, event_id: newEventId(kind), kind, client_time_ms: Date.now(), ...extra });
      const out = await postEvent(`${XEM_API}/${encodeURIComponent(code)}/su-kien`, body);
      if (out.status === 410) setWithdrawn(true);
      return out;
    },
    [code],
  );

  const send = useCallback(
    async (kind: XemKind, extra: { product_id?: string; text?: string } = {}): Promise<boolean> => (await post(kind, extra)).ok,
    [post],
  );

  // Poll the room.
  useEffect(() => {
    let alive = true;
    let timer = 0;
    const load = async (): Promise<void> => {
      let wait = 3000;
      try {
        const res = await fetch(`${XEM_API}/${encodeURIComponent(code)}/trang-thai`, { cache: "no-store" });
        if (res.status === 404) {
          // Phòng đã tắt (hoặc mã sai). Quyền rút lui sống lâu hơn phòng (xem.py nhận rut_lui cả khi phòng đã tắt),
          // nên máy nào còn giữ mã ngẫu nhiên vẫn thấy nút rút lui. Chỉ ĐỌC mã cũ, không tạo mã mới.
          // Máy chặn bộ nhớ (chế độ riêng tư) không giữ được mã: dùng mã của chính trang này nếu đã có.
          if (alive) {
            setGone(true);
            setLeftover(readStoredViewer() ?? viewerId.current);
          }
          throw new Error("Phòng không tồn tại hoặc đã tắt.");
        }
        if (!res.ok) throw new Error("Không tải được phòng, đang thử lại…");
        const s = StateSchema.parse(await res.json());
        if (alive) {
          setState(s);
          setError(null);
          setGone(false);
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

  // Restore consent for this room and version. Not after a withdrawal: that would mint a fresh id on this phone.
  useEffect(() => {
    if (!state || withdrawn) return;
    try {
      viewerId.current = getViewerId(window.localStorage);
      setConsented(window.localStorage.getItem(consentKey(code, state.room.consent_version)) === "1");
    } catch {
      viewerId.current = crypto.randomUUID().replace(/-/g, "");
    }
  }, [code, state?.room.consent_version, withdrawn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Heartbeat while the page is visible and the room is open (a room switched off mid-session stops it too).
  const open = state?.room.status === "dang_mo";
  useEffect(() => {
    if (!consented || !open || withdrawn || gone) return;
    const beat = (): void => {
      if (document.visibilityState === "visible") void send("nhip");
    };
    beat();
    const id = window.setInterval(beat, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [consented, open, withdrawn, gone, send]);

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

  /**
   * Withdraw from the open room, or from a room that is gone with the id this phone still holds. Only a 2xx (deleted
   * now, or already deleted by an earlier withdrawal) clears the phone; any other answer leaves it as it was so the
   * viewer can press again, and RutLui says why in the page.
   */
  const withdraw = async (): Promise<PostOutcome> => {
    viewerId.current = viewerId.current ?? leftover;
    const out = await post("rut_lui");
    if (out.ok) {
      try {
        forgetViewerEverywhere(window.localStorage);
        setCleared(true);
      } catch {
        /* storage blocked: nothing was kept on this phone */
      }
      viewerId.current = null;
      setLeftover(null);
      setWithdrawn(true);
    }
    return out;
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

  if (withdrawn) {
    return (
      <div className="ld ph">
        <main className="xem" data-testid="xem-withdrawn">
          <h1 className="ph-title">Bạn đã rút lui</h1>
          <p>Mọi thao tác của bạn đã được xoá khỏi nghiên cứu. Cảm ơn bạn đã ghé.</p>
          {cleared && <p className="ph-small">Mã ngẫu nhiên lưu trên máy này cũng đã được xoá.</p>}
        </main>
        {footer}
      </div>
    );
  }

  if (gone) {
    return (
      <div className="ld ph">
        <main className="xem" data-testid="xem-gone">
          <p className="ph-muted">Phòng không tồn tại hoặc đã tắt.</p>
          {leftover && (
            <>
              <p>Nếu bạn đã tham gia phòng này, bạn vẫn rút lui được: mọi thao tác của bạn trong phòng sẽ bị xoá khỏi nghiên cứu.</p>
              <RutLui label="Rút lui và xoá dữ liệu của tôi" onSend={withdraw} />
            </>
          )}
        </main>
        {footer}
      </div>
    );
  }

  if (!state) {
    return (
      <div className="ld ph"><main className="xem"><p className="ph-muted">{error ?? "Đang mở phòng…"}</p></main>{footer}</div>
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
              <ul className="xem-consent-list">
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
        <header className="xem-head">
          <h1>{state.room.title}</h1>
          <span className="ph-small">{state.room.source_label}</span>
        </header>
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

        <RutLui label="Rút lui khỏi nghiên cứu" onSend={withdraw} />
        {toast && <div className="xem-toast" role="status">{toast}</div>}
      </main>
      {footer}
    </div>
  );
}
