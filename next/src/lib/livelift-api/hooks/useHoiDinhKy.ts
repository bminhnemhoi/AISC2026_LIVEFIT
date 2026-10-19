"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loiTiengViet } from "../gop";

/**
 * Hỏi máy chủ định kỳ, dùng chung cho mọi hook dữ liệu của biểu đồ.
 *
 * - **Không chồng lượt:** lượt sau chỉ được hẹn khi lượt trước xong (setTimeout nối đuôi, không setInterval). Bấm
 *   "làm mới" giữa lúc đang hỏi thì không mở lượt thứ hai, chỉ đánh dấu chạy lại ngay khi lượt đang chạy xong.
 * - **Dừng khi tab ẩn:** `visibilitychange` sang ẩn thì huỷ hẹn; hiện lại thì hỏi ngay một lượt rồi nối tiếp.
 * - **Dừng hẳn** khi `dungKhi(duLieu)` trả true (phiên đã kết thúc và đã có báo cáo: số không còn đổi).
 * - **Giữ khung khi tải lại:** dữ liệu cũ ở nguyên tới khi có dữ liệu mới; lỗi không xoá dữ liệu cũ.
 * - Đổi `khoa` (mã phiên) thì bỏ dữ liệu cũ, huỷ lượt đang chạy, bắt đầu lại. `khoa` null: không hỏi gì.
 */

export const CHU_KY_MAC_DINH_MS = 3000;

export interface NgCanh<T> {
  signal: AbortSignal;
  /** Số thứ tự lượt hỏi, từ 0, đếm lại khi đổi khoá. */
  lan: number;
  /** Dữ liệu của lượt thành công gần nhất (null ở lượt đầu). */
  truoc: T | null;
}

export interface TuyChonHoi<T> {
  chuKyMs?: number;
  dungKhi?: (duLieu: T) => boolean;
  /** Câu báo lỗi khi lỗi không phải lỗi API có lời sẵn. */
  loiMacDinh?: string;
}

export interface KetQuaHoi<T> {
  duLieu: T | null;
  loi: string | null;
  /** True tới khi có dữ liệu đầu tiên của khoá hiện tại (và chưa có lỗi). */
  dangTai: boolean;
  /** Mốc Date.now() của lần thành công gần nhất. */
  capNhatLuc: number | null;
  /** Đã ngừng hỏi vì `dungKhi`. */
  daDung: boolean;
  lamMoi: () => void;
}

interface TrangThai<T> {
  khoa: string | null;
  duLieu: T | null;
  loi: string | null;
  capNhatLuc: number | null;
  daDung: boolean;
}

function tabAn(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

export function useHoiDinhKy<T>(khoa: string | null, tai: (ng: NgCanh<T>) => Promise<T>, tuyChon: TuyChonHoi<T> = {}): KetQuaHoi<T> {
  const { chuKyMs = CHU_KY_MAC_DINH_MS, dungKhi, loiMacDinh = "Không đọc được dữ liệu từ máy chủ." } = tuyChon;
  const [tt, setTt] = useState<TrangThai<T>>({ khoa: null, duLieu: null, loi: null, capNhatLuc: null, daDung: false });
  const taiRef = useRef(tai);
  const dungRef = useRef(dungKhi);
  const loiRef = useRef(loiMacDinh);
  const lamMoiRef = useRef<() => void>(() => {});

  useEffect(() => {
    taiRef.current = tai;
    dungRef.current = dungKhi;
    loiRef.current = loiMacDinh;
  });

  useEffect(() => {
    if (khoa == null) return;
    let song = true;
    let dangChay = false;
    let chayLai = false;
    let dung = false;
    let hen: ReturnType<typeof setTimeout> | undefined;
    let lan = 0;
    let truoc: T | null = null;
    const ac = new AbortController();

    const huyHen = (): void => {
      if (hen !== undefined) clearTimeout(hen);
      hen = undefined;
    };
    const henLuotSau = (): void => {
      if (!song || dung || tabAn() || hen !== undefined) return;
      hen = setTimeout(() => {
        hen = undefined;
        void chay();
      }, chuKyMs);
    };
    const chay = async (): Promise<void> => {
      if (!song) return;
      if (dangChay) {
        chayLai = true;
        return;
      }
      dangChay = true;
      try {
        const d = await taiRef.current({ signal: ac.signal, lan: lan++, truoc });
        if (!song) return;
        truoc = d;
        dung = dungRef.current?.(d) ?? false;
        setTt({ khoa, duLieu: d, loi: null, capNhatLuc: Date.now(), daDung: dung });
      } catch (e) {
        if (!song || ac.signal.aborted) return;
        const loi = loiTiengViet(e, loiRef.current);
        setTt((p) => (p.khoa === khoa ? { ...p, loi } : { khoa, duLieu: null, loi, capNhatLuc: null, daDung: false }));
      } finally {
        dangChay = false;
        if (song) {
          if (chayLai && !dung) {
            chayLai = false;
            void chay();
          } else {
            chayLai = false;
            henLuotSau();
          }
        }
      }
    };
    const doiHien = (): void => {
      if (tabAn()) huyHen();
      else if (!dangChay && hen === undefined && !dung) void chay();
    };

    lamMoiRef.current = () => {
      huyHen();
      dung = false;
      void chay();
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", doiHien);
    void chay();
    return () => {
      song = false;
      ac.abort();
      huyHen();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", doiHien);
      lamMoiRef.current = () => {};
    };
  }, [khoa, chuKyMs]);

  const lamMoi = useCallback(() => lamMoiRef.current(), []);
  const cung = tt.khoa === khoa && khoa != null;
  return {
    duLieu: cung ? tt.duLieu : null,
    loi: cung ? tt.loi : null,
    dangTai: khoa != null && (!cung || (tt.duLieu == null && tt.loi == null)),
    capNhatLuc: cung ? tt.capNhatLuc : null,
    daDung: cung ? tt.daDung : false,
    lamMoi,
  };
}
