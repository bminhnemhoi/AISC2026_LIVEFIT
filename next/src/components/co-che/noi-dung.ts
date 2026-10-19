/**
 * Chữ của màn giải thích ghim (CoChe, mục 3 kế hoạch 3.1). Thuật ngữ và phụ đề lấy từ bảng từ `@/lib/tu-ngu`
 * (chép từ docs/canon/thuat-ngu.yaml); câu nối do U3 viết bằng lời thường, không dùng chữ cấm của canon.
 *
 * Bốn bước:
 * 1. tung đồng xu trước giờ live, niêm phong lịch;
 * 2. khối BẬT: máy ghim món đầu nhóm gợi ý (vài món sát điểm thì bốc thăm giữa chúng; có thể khác thẻ gợi ý);
 * 3. khối TẮT: LiveLift để yên, món cũ có thể vẫn hiện (D-012);
 * 4. đếm lượt nhấp theo khối; hết phiên mới so BẬT với TẮT, ra ĐỔI / GIỮ / ĐO THÊM.
 */
import { CAU_GHIM, PHU_DE_KHOI, TU } from "@/lib/tu-ngu";

export type MaBuoc = "tung-xu" | "khoi-bat" | "khoi-tat" | "so-sanh";

export interface BuocCoChe {
  /** số thứ tự 1..4 */
  so: number;
  ma: MaBuoc;
  /** tiêu đề ngắn của bước */
  tieuDe: string;
  /** một hai câu lời thường */
  cau: string;
  /** dòng phụ: thuật ngữ canon kèm phụ đề */
  phuDe: string;
}

/** Tiêu đề mặc định của khối giải thích. */
export const TIEU_DE_CO_CHE = "Ghim được đo thế nào: 4 bước";

/** Câu dẫn dưới tiêu đề (câu hỏi của landing, kế hoạch mục 4). */
export const CAU_DAN_CO_CHE = "Ghim món này, khách có bấm mua nhiều hơn không? LiveLift trả lời bằng bốc thăm, không đoán theo số liệu cũ.";

const viet = (s: string) => s.charAt(0).toLocaleUpperCase("vi-VN") + s.slice(1);

export const BUOC_CO_CHE: readonly BuocCoChe[] = Object.freeze([
  {
    so: 1,
    ma: "tung-xu",
    tieuDe: "Tung đồng xu, niêm phong lịch",
    cau: `Trước giờ live, phiên được chia thành khối: ${PHU_DE_KHOI.chung}. Xong thì niêm phong lịch.`,
    phuDe: `${viet(TU.niemPhongLich.chu)}: ${TU.niemPhongLich.phu_de ?? ""}.`,
  },
  {
    so: 2,
    ma: "khoi-bat",
    tieuDe: "Khối BẬT: máy ghim một món",
    cau: "Máy ghim món đứng đầu nhóm gợi ý. Khi vài món sát điểm nhau, máy bốc thăm giữa chúng, nên món được ghim có thể khác thẻ gợi ý.",
    phuDe: `BẬT: ${PHU_DE_KHOI.bat}.`,
  },
  {
    so: 3,
    ma: "khoi-tat",
    tieuDe: "Khối TẮT: LiveLift để yên",
    cau: "LiveLift không ghim gì thêm. Món đã ghim từ trước có thể vẫn hiện.",
    phuDe: `TẮT: ${PHU_DE_KHOI.tat}.`,
  },
  {
    so: 4,
    ma: "so-sanh",
    tieuDe: "Đếm lượt nhấp, hết phiên mới so",
    cau: "Máy đếm lượt nhấp theo từng khối. Hết phiên mới so khối BẬT với khối TẮT, để không ai nhìn trộm giữa chừng.",
    phuDe: `${TU.tyLeNhap.hien}: ${TU.tyLeNhap.dung}.`,
  },
]);

export type MaKetLuan = "doi" | "giu" | "do_them";

export interface KetLuanCoChe {
  ma: MaKetLuan;
  /** chữ in hoa canon */
  chu: string;
  /** câu thường đi kèm (bảng từ mục 3: mỗi chữ kèm một câu thường) */
  cau: string;
}

/** Ba kết luận của tổng kết, mỗi chữ kèm một câu thường. Thứ tự đọc: ĐỔI, GIỮ, ĐO THÊM. */
export const KET_LUAN_CO_CHE: readonly KetLuanCoChe[] = Object.freeze([
  { ma: "doi", chu: "ĐỔI", cau: "khối BẬT hơn hẳn: đổi sang cách ghim của LiveLift" },
  { ma: "giu", chu: "GIỮ", cau: "khối BẬT kém hẳn: giữ cách làm cũ" },
  { ma: "do_them", chu: "ĐO THÊM", cau: "chưa rõ hơn hay kém: đo thêm phiên rồi gộp" },
]);

/** Ghim ở đâu (canon `cau_ghim`): LiveLift bốc thăm; nơi nào máy ghim, nơi nào ghim tay. */
export const GHI_CHU_GHIM = CAU_GHIM;

/** Mọi chữ công khai của CoChe nối lại (dùng cho test chữ cấm và công cụ kiểm đồng bộ). */
export function toanBoChuCoChe(): string {
  return [
    TIEU_DE_CO_CHE,
    CAU_DAN_CO_CHE,
    ...BUOC_CO_CHE.flatMap((b) => [b.tieuDe, b.cau, b.phuDe]),
    ...KET_LUAN_CO_CHE.flatMap((k) => [k.chu, k.cau]),
    GHI_CHU_GHIM,
  ].join("\n");
}

/**
 * Ngắt một câu thành các dòng dài tối đa `toiDa` ký tự, theo khoảng trắng (cho chữ trong SVG tĩnh, nơi không có
 * xuống dòng tự động). Từ dài hơn `toiDa` đứng riêng một dòng, không bị cắt.
 */
export function ngatDong(chu: string, toiDa: number): string[] {
  const tu = chu.split(/\s+/).filter(Boolean);
  const dong: string[] = [];
  let hienTai = "";
  for (const t of tu) {
    if (!hienTai) hienTai = t;
    else if (hienTai.length + 1 + t.length <= toiDa) hienTai += ` ${t}`;
    else {
      dong.push(hienTai);
      hienTai = t;
    }
  }
  if (hienTai) dong.push(hienTai);
  return dong;
}
