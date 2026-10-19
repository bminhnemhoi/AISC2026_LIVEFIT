"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import {
  DienThoaiLive,
  DUONG_DONG_THOI_GIAN,
  DUONG_VIDEO_NGUOI_DAN,
  maNhanNguonTu,
  useDongThoiGian,
  type BinhLuanDienThoai,
} from "@/components/dien-thoai";
import { HinhMon, Icons } from "@/components/minh-hoa";
import { Hop, NganKeo, NhanNguon, NutBam } from "@/components/nen";
import type { MaNhanNguon } from "@/lib/tu-ngu";
import "./xem.css";

/**
 * The staged viewer room on a phone. Public, anonymous, play money.
 *
 * Talks ONLY to the public JSON API under `/xem-api/` (same origin: Caddy behind the tunnel, or the Next rewrite in
 * development). It never sees arms or blocks: the server does not send them (tests/test_api_xem.py).
 *
 * The right to withdraw outlives the room: when the room is switched off (trang-thai 404) a phone that still holds its
 * random id keeps a minimal "Rút lui và xoá dữ liệu của tôi" button (19/10/2026). Nothing new is stored for that.
 *
 * Giao diện 2.0 (U7, kế hoạch 3.1, 19/10/2026): chỉ đổi phần trình bày. Phòng là một live dọc kiểu TikTok
 * (DienThoaiLive toàn màn trên điện thoại, khung máy ở giữa trên máy tính). Mọi sự kiện gửi đi giữ nguyên: cùng nút,
 * cùng loại, cùng thời điểm. Danh sách sản phẩm nằm sau nút giỏ hàng (ngăn kéo), không gửi sự kiện nào khi mở.
 *
 * Làm mù (soát đợt 2): ngoài thẻ ghim do máy chủ gửi, khung không khác nhau giữa khối BẬT và khối TẮT. Người dẫn vẽ
 * tay không cầm món nào (monCam={null}); lời dặn bên cạnh không nhắc tới thẻ ghim.
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
    /** Phòng của buổi chạy thử (THỬ NỘI BỘ). Máy chủ gửi từ 19/10/2026; máy chủ cũ không gửi thì đọc tên phòng. */
    dry_run: z.boolean().nullish(),
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

function vnd(n: number): string {
  return `${n.toLocaleString("vi-VN")} đ`;
}

/**
 * Nhãn nguồn của phòng (mã canon): chữ máy chủ gửi nếu khớp canon, không thì DÀN DỰNG (mọi phòng xem đều dàn dựng);
 * thêm THỬ NỘI BỘ khi phòng là buổi chạy thử. Có cờ dry_run thì chỉ theo cờ; chỉ khi máy chủ cũ không gửi cờ mới
 * đọc tên phòng ("Thử nội bộ · ...").
 */
export function nhanPhong(room: { title: string; source_label: string; dry_run?: boolean | null }): MaNhanNguon[] {
  const thu = room.dry_run ?? /th[ửu] n[ộo]i b[ộo]/i.test(room.title.normalize("NFC"));
  const ma = maNhanNguonTu(room.source_label).filter(m => m !== "THU_NOI_BO");
  const ds: MaNhanNguon[] = ma.length > 0 ? ma : ["DAN_DUNG"];
  return thu ? [...ds, "THU_NOI_BO"] : ds;
}

/**
 * Video là người dẫn AI khi và chỉ khi đường dẫn (bỏ chuỗi truy vấn) trỏ tới tệp người dẫn AI chuẩn. Video khác
 * (YouTube, mp4 người thật quay) không mang nhãn "NGƯỜI DẪN AI" (D-015).
 */
export function laVideoNguoiDanAI(videoUrl: string | null | undefined): boolean {
  if (!videoUrl) return false;
  const duong = videoUrl.split(/[?#]/)[0];
  return duong === DUONG_VIDEO_NGUOI_DAN || duong.endsWith(DUONG_VIDEO_NGUOI_DAN);
}

/** Câu ghi chú cạnh khung live trên máy tính (giữ nguyên chữ của kế hoạch 3.1). */
export const GHI_CHU_PHONG = "Đây là phòng xem dàn dựng: tiền ảo, không lưu thông tin cá nhân";

/**
 * The withdrawal control, in the open room and on a room that is gone. It asks once INSIDE the page, not with
 * window.confirm: an iOS in-app browser (Zalo, Messenger) that does not implement the confirm panel answers "Cancel"
 * without showing anything, and the right to withdraw would silently do nothing. A failure is reported here, in the
 * page, never through window.alert. On success the parent swaps to the "Bạn đã rút lui" screen.
 *
 * Hỏi bằng Hop của nền (hộp trong trang). Bấm "Xác nhận rút lui" thì hộp đóng ngay và nút hiện "Đang gửi…".
 */
function RutLui({
  label,
  nhanNgan,
  onSend,
  className,
}: {
  label: string;
  /** chữ ngắn trên nút (ví dụ "Rút lui" trên lớp phủ live); tên đọc của nút vẫn là `label` */
  nhanNgan?: string;
  onSend: () => Promise<PostOutcome>;
  className?: string;
}) {
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

  const ngan = nhanNgan && step !== "gui";
  return (
    <div className={["xem2-rut-lui", className].filter(Boolean).join(" ")} data-testid="xem-leave">
      <NutBam
        bien="vien"
        cao={44}
        className="xem2-nut-rut-lui"
        data-chup-bam="rut-lui"
        aria-label={ngan ? label : undefined}
        disabled={step === "gui"}
        onClick={() => {
          setNote(null);
          setStep("hoi");
        }}
      >
        {step === "gui" ? "Đang gửi…" : ngan ? nhanNgan : label}
      </NutBam>
      {note && (
        <p
          className={note.kind === "loi" ? "xem2-bao xem2-bao--loi" : "xem2-bao"}
          role={note.kind === "loi" ? "alert" : "status"}
        >
          {note.text}
        </p>
      )}
      <Hop
        mo={step === "hoi"}
        onDong={() => setStep("nut")}
        tieuDe="Rút lui khỏi nghiên cứu?"
        moTa="Mọi thao tác của bạn trong phòng sẽ bị xoá khỏi nghiên cứu. Bạn chắc chứ?"
        nutXacNhan="Xác nhận rút lui"
        nutHuy="Huỷ"
        nguyHiem
        thuocTinhXacNhan={{ "data-chup-bam": "xac-nhan-rut-lui" }}
        onXacNhan={() => {
          void go();
        }}
        className="xem2-hop"
      />
    </div>
  );
}

/** Khung trang chung của mọi màn phòng xem: nền kem, chân trang có nhãn và đường tới mã nguồn. */
function TrangXem({ children, nguon, laPhong = false }: { children: ReactNode; nguon?: string; laPhong?: boolean }) {
  return (
    <div className={laPhong ? "xem2 xem2--phong" : "xem2"}>
      {children}
      <footer className="xem2-chan">
        <span>PHÒNG DÀN DỰNG · TIỀN ẢO</span>
        {nguon && (
          <a href={nguon} target="_blank" rel="noreferrer">
            Mã nguồn (AGPL)
          </a>
        )}
      </footer>
    </div>
  );
}

const BA_Y: ReadonlyArray<{ tieuDe: string; cau: string }> = [
  {
    tieuDe: "Phòng xem dàn dựng",
    cau: "Phục vụ đề tài nghiên cứu của sinh viên, không phải buổi bán hàng thật. Cách sản phẩm hiển thị có thể đổi theo thời gian.",
  },
  {
    tieuDe: "Mua bằng tiền ảo",
    cau: "Không mất tiền thật. Chỉ ghi thao tác trong phòng cùng một mã ngẫu nhiên, không thu tên, số điện thoại, email hay địa chỉ IP.",
  },
  {
    tieuDe: "Rút lui bất cứ lúc nào",
    cau: "Bấm “Rút lui” ở góc trên là mọi dữ liệu của bạn được xoá.",
  },
  {
    tieuDe: "Chỉ dùng cho đề tài",
    cau: "Dữ liệu chỉ dùng cho LiveLift (AISC'26), xoá chậm nhất 31/12/2026, không liên quan điểm số.",
  },
];

/** Lời chào đầu dòng bình luận: lời của phòng, không giả làm người xem. */
const LOI_CHAO: BinhLuanDienThoai = { id: "chao", noiDung: "Chào bạn! Gõ câu hỏi cho người dẫn ở ô bên dưới." };

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
  /** Trình bày: số món đã thêm giỏ hoặc đã mua (tiền ảo) mà máy chủ nhận; chỉ sống trong trang này. */
  const [gio, setGio] = useState(0);
  /** Trình bày: bình luận chính người này đã gửi được, chỉ hiện trên máy này, không lưu. */
  const [binhLuan, setBinhLuan] = useState<BinhLuanDienThoai[]>([]);
  const [moGio, setMoGio] = useState(false);

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

  // Dòng "Người dẫn đang nói về" chỉ có nghĩa với video người dẫn AI mặc định; null thì không tải gì.
  const videoUrl = state?.room.video_url ?? null;
  const videoAI = laVideoNguoiDanAI(videoUrl);
  const dongThoiGian = useDongThoiGian(consented && videoAI ? DUONG_DONG_THOI_GIAN : null);

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
    if (ok && (kind === "them_gio" || kind === "mua")) setGio(n => n + 1);
    say(ok ? okMsg : "Chưa gửi được, thử lại nhé.");
  };

  const postComment = async (): Promise<void> => {
    const text = comment.trim().slice(0, 200);
    if (!text) return;
    const ok = await send("binh_luan", { text });
    if (ok) {
      setComment("");
      setBinhLuan(ds => [...ds.slice(-5), { id: newEventId("binh_luan"), ten: "Bạn", noiDung: text }]);
    }
    say(ok ? "Đã gửi bình luận." : "Chưa gửi được, thử lại nhé.");
  };

  if (withdrawn) {
    return (
      <TrangXem nguon={state?.source_code_url}>
        <main id="main-content" className="xem2-giua" data-testid="xem-withdrawn">
          <section className="xem2-the xem2-the--hep" data-vung-chinh="">
            <span className="xem2-dau-xong" aria-hidden="true"><Icons.IconCheck size={28} /></span>
            <h1 className="xem2-tieu-de">Bạn đã rút lui</h1>
            <p className="xem2-cau">Mọi thao tác của bạn đã được xoá khỏi nghiên cứu. Cảm ơn bạn đã ghé.</p>
            {cleared && <p className="xem2-nho">Mã ngẫu nhiên lưu trên máy này cũng đã được xoá.</p>}
          </section>
        </main>
      </TrangXem>
    );
  }

  if (gone) {
    return (
      <TrangXem>
        <main id="main-content" className="xem2-giua" data-testid="xem-gone">
          <section className="xem2-the xem2-the--hep" data-vung-chinh="">
            <h1 className="xem2-tieu-de">Phòng không tồn tại hoặc đã tắt.</h1>
            {leftover && (
              <>
                <p className="xem2-cau">Nếu bạn đã tham gia phòng này, bạn vẫn rút lui được: mọi thao tác của bạn trong phòng sẽ bị xoá khỏi nghiên cứu.</p>
                <RutLui label="Rút lui và xoá dữ liệu của tôi" onSend={withdraw} className="xem2-rut-lui--rong" />
              </>
            )}
          </section>
        </main>
      </TrangXem>
    );
  }

  if (!state) {
    return (
      <TrangXem>
        <main id="main-content" className="xem2-giua">
          <section className="xem2-the xem2-the--hep" data-vung-chinh="">
            <p className="xem2-cau" role="status">{error ?? "Đang mở phòng…"}</p>
          </section>
        </main>
      </TrangXem>
    );
  }

  const nhan = nhanPhong(state.room);

  if (!consented) {
    return (
      <TrangXem nguon={state.source_code_url}>
        <main id="main-content" className="xem2-giua" data-testid="xem-consent">
          <section className="xem2-the xem2-dong-y" data-vung-chinh="" data-chup="xem-dong-y" aria-labelledby="xem2-ten-phong">
            <div className="xem2-the-dau">
              <NhanNguon ma={nhan} />
            </div>
            <h1 id="xem2-ten-phong" className="xem2-tieu-de">{state.room.title}</h1>
            {declined ? (
              <p className="xem2-cau">Cảm ơn bạn. Bạn có thể đóng trang này.</p>
            ) : (
              <>
                <p className="xem2-cau">Trước khi vào phòng, bạn đọc nhanh {BA_Y.length} điều này nhé.</p>
                <ol className="xem2-ba-y">
                  {BA_Y.map((y, i) => (
                    <li key={y.tieuDe}>
                      <span className="xem2-so" aria-hidden="true">{i + 1}</span>
                      <span>
                        <b>{y.tieuDe}</b>
                        <span className="xem2-ba-y-cau">{y.cau}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <details className="xem2-chi-tiet">
                  <summary>Đọc đủ lời đồng ý</summary>
                  <ul>
                    <li>Đây là phòng xem <strong>dàn dựng</strong> phục vụ nghiên cứu sinh viên, không phải buổi bán hàng thật. Mọi giao dịch dùng <strong>tiền ảo</strong>.</li>
                    <li>Chúng tôi ghi các thao tác trong phòng (xem, bấm, thêm giỏ, &quot;mua&quot;, bình luận) cùng một mã ngẫu nhiên do máy bạn tạo. Không thu tên, số điện thoại, email hay địa chỉ IP. Bình luận được tự động che thông tin cá nhân.</li>
                    <li>Cách sản phẩm hiển thị có thể thay đổi theo thời gian. Đây là một phần của nghiên cứu.</li>
                    <li>Bạn có thể bấm &quot;Rút lui&quot; bất cứ lúc nào. Khi đó toàn bộ dữ liệu của bạn bị xoá.</li>
                    <li>Dữ liệu chỉ dùng cho đề tài LiveLift (AISC&apos;26), xoá chậm nhất ngày 31/12/2026, không liên quan đến điểm số.</li>
                  </ul>
                </details>
                <p className="xem2-nho xem2-phien-ban">Phiên bản lời đồng ý: {state.room.consent_version}. Căn cứ Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15.</p>
                <div className="xem2-hang-nut">
                  <NutBam
                    bien="chinh"
                    cao={48}
                    rong
                    data-chup-bam="dong-y"
                    data-nut-chinh=""
                    onClick={() => void agree()}
                    disabled={state.room.status !== "dang_mo"}
                  >
                    Tôi đồng ý và vào phòng
                  </NutBam>
                  <NutBam bien="vien" cao={48} rong onClick={() => setDeclined(true)}>
                    Không, cảm ơn
                  </NutBam>
                </div>
                {state.room.status === "chua_mo" && <p className="xem2-nho">Phòng chưa mở. Trang sẽ tự cập nhật.</p>}
                {state.room.status === "da_dong" && <p className="xem2-nho">Phòng đã đóng. Cảm ơn bạn đã quan tâm.</p>}
              </>
            )}
          </section>
        </main>
        {toast && <div className="xem2-toast" role="status">{toast}</div>}
      </TrangXem>
    );
  }

  const pinned = state.pinned ?? null;
  const formBinhLuan = (
    <form
      className="xem2-binh-luan"
      onSubmit={e => {
        e.preventDefault();
        void postComment();
      }}
    >
      <label htmlFor="xem-cmt" className="sr-only">Bình luận</label>
      <input
        id="xem-cmt"
        value={comment}
        maxLength={200}
        placeholder="Hỏi người dẫn…"
        autoComplete="off"
        onChange={e => setComment(e.target.value)}
      />
      <button type="submit" className="xem2-nut-gui">Gửi</button>
    </form>
  );

  return (
    <TrangXem nguon={state.source_code_url} laPhong>
      <main id="main-content" className="xem2-phong" data-testid="xem-room">
        <h1 className="sr-only">{state.room.title}</h1>
        <div className="xem2-khung" data-vung-chinh="" data-testid={pinned ? "xem-pinned" : undefined}>
          <DienThoaiLive
            toanMan
            src={videoUrl ?? undefined}
            dongThoiGian={dongThoiGian}
            ghim={pinned ? { ten: pinned.name, gia: pinned.price_vnd } : null}
            binhLuan={[LOI_CHAO, ...binhLuan]}
            monCam={null}
            dangLive={state.room.status === "dang_mo"}
            chuNgoaiLive={state.room.status === "chua_mo" ? "CHƯA MỞ" : "ĐÃ KẾT THÚC"}
            laNguoiDanAI={videoAI}
            nhanNguon={nhan}
            soTrongGio={gio}
            onXemNgay={() => {
              if (pinned) void act("bam", pinned, "Đã mở sản phẩm.");
            }}
            onMua={() => {
              if (pinned) void act("mua", pinned, "Đã đặt mua (tiền ảo).");
            }}
            onGioHang={() => setMoGio(true)}
            nhanAria={`Phòng live ${state.room.title}`}
            data-chup="xem-dien-thoai"
            thanhPhanTren={<RutLui label="Rút lui khỏi nghiên cứu" nhanNgan="Rút lui" onSend={withdraw} className="xem2-rut-lui--phu" />}
            thanhPhanDuoi={formBinhLuan}
          />
          {state.room.status !== "dang_mo" && (
            <p className="xem2-trang-thai">{state.room.status === "da_dong" ? "Phòng đã đóng. Cảm ơn bạn!" : "Phòng chưa mở."}</p>
          )}
          {toast && <div className="xem2-toast" role="status">{toast}</div>}
        </div>

        <aside className="xem2-ben" aria-label="Ghi chú về phòng">
          <NhanNguon ma={nhan} />
          <p className="xem2-ghi-chu">{GHI_CHU_PHONG}.</p>
          <ul className="xem2-meo">
            <li>Bấm giỏ hàng để xem mọi sản phẩm của phòng.</li>
            <li>Muốn dừng tham gia: bấm &quot;Rút lui&quot; ở góc trên khung.</li>
          </ul>
        </aside>

        <NganKeo
          mo={moGio}
          onDong={() => setMoGio(false)}
          tieuDe="Sản phẩm trong phòng"
          moTa="Giá dàn dựng, mua bằng tiền ảo."
          phia="duoi"
          className="xem2-ngan-gio"
        >
          <ul className="xem2-ds-mon">
            {state.products.map(p => (
              <li key={p.product_id}>
                <span className="xem2-mon-anh" aria-hidden="true">
                  <HinhMon ten={p.name} />
                </span>
                <span className="xem2-mon-chu">
                  <b>{p.name}</b>
                  <span>{vnd(p.price_vnd)}</span>
                </span>
                <span className="xem2-mon-nut">
                  <NutBam cao={44} onClick={() => void act("bam", p, "Đã mở sản phẩm.")}>Xem</NutBam>
                  <NutBam cao={44} onClick={() => void act("them_gio", p, "Đã thêm vào giỏ.")}>Thêm giỏ</NutBam>
                  <NutBam bien="vien" cao={44} onClick={() => void act("mua", p, "Đã đặt mua (tiền ảo).")}>Mua</NutBam>
                </span>
              </li>
            ))}
          </ul>
        </NganKeo>
      </main>
    </TrangXem>
  );
}
