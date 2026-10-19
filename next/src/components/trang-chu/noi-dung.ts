// Chữ và số của trang giới thiệu (U8, kế hoạch bản 3.1 mục 4). Số chép từ docs/canon/so.yaml (trường hien_thi và
// nhan) và docs/competition/FACT-SHEET.md; test trang-chu.test.tsx đọc lại hai tệp đó để bắt chỗ lệch.
import { LOI_THUONG, TU, hoaChuDau, type MaNhanNguon } from "@/lib/tu-ngu";

/** Câu định vị, dùng nguyên văn (CLAUDE.md). */
export const CAU_DINH_VI =
  "LiveLift giúp người bán livestream tự đo xem việc ghim một sản phẩm có thật sự làm khách bấm mua nhiều hơn, bằng cách bốc thăm bật/tắt theo từng khối 5 phút thay vì đoán theo tương quan.";

export const CAU_HOI_LON = "Ghim món này, khách có bấm mua nhiều hơn không?";

export const DONG_NHO_HERO = "Cho người bán livestream";

/** Nút chính của trang: vào bản demo. */
export const NUT_CHINH = { chu: "Dùng thử bản demo", href: "/phien" } as const;

/**
 * Nút phụ ở hero. Hôm nay cuộn tới phần cách đo; ngày 20/10, khi /dang-nhap ra đời (U8b), đổi thành
 * { chu: "Đăng nhập", href: "/dang-nhap" }.
 */
export const NUT_PHU = { chu: "Xem cách đo", href: "#cach-do" } as const;

/** id của phần CoChe, đích của nút "Xem cách đo". */
export const ID_CACH_DO = "cach-do";

export const DIEU_HUONG_TRANG = [
  { chu: "Vì sao cần đo", href: "#van-de" },
  { chu: "Cách đo", href: `#${ID_CACH_DO}` },
  { chu: "Kết quả mô phỏng", href: "#ket-qua" },
  { chu: "Sự thật hôm nay", href: "#su-that" },
] as const;

/* ---------- dải 16 khối ---------- */

/**
 * so.yaml id phien_90_khoi: "phiên 90 phút = 16 khối (8 BẬT / 8 TẮT)"; duoc_noi kèm điều kiện "khối đầu và cuối dài
 * gấp đôi" (16 × 5 = 80, hai khối đầu cuối 10 phút mới đủ 90).
 */
export const TIEU_DE_DAI_KHOI = "Phiên 90 phút = 16 khối (khối đầu và cuối 10 phút)";

/* ---------- vấn đề ---------- */

export const VAN_DE = {
  tieuDe: "Người bán đang phải đoán",
  cau: [
    "Phút 30 ghim áo. Phút 35 đơn tăng.",
    "Vì ghim, hay vì lúc đó đông khách hơn?",
    "Nhìn số cũ thì không tách được hai lý do này.",
  ],
} as const;

/* ---------- đặt cạnh nhau ---------- */

export const SO_SANH = {
  tieuDe: "Hai cách trả lời cùng một câu hỏi",
  trai: {
    ten: hoaChuDau(LOI_THUONG.tuongQuan),
    chip: "Dễ nhầm",
    y: [
      "Người bán hay ghim đúng lúc đông khách.",
      "Số đẹp lên có thể nhờ giờ đông, không nhờ ghim.",
      "Không biết phần nào thật sự do ghim.",
    ],
  },
  phai: {
    ten: "Bốc thăm theo khối",
    chip: "Công bằng",
    y: [
      "Trước giờ live, đồng xu chọn khối nào BẬT, khối nào TẮT.",
      "Giờ đông và giờ vắng rơi đều vào cả hai bên.",
      "Hết phiên, so BẬT với TẮT là thấy phần do ghim.",
    ],
  },
} as const;

/* ---------- kết quả mô phỏng ---------- */

export interface SoKetQua {
  /** id trong docs/canon/so.yaml */
  id: "bao_nham_tb" | "luc_khoi_5p" | "du_am_h300";
  /** trường hien_thi của so.yaml, chép nguyên */
  hienThi: string;
  /** trường nhan của so.yaml */
  nhan: "MÔ PHỎNG";
  maNhan: MaNhanNguon;
  ten: string;
  phuDe?: string;
  /** điều kiện đi kèm số (không được bỏ, theo duoc_noi của so.yaml) */
  dieuKien: string;
  /** ý nghĩa bằng lời thường */
  yNghia: string;
}

export const KET_QUA_MO_PHONG: readonly SoKetQua[] = [
  {
    id: "bao_nham_tb",
    hienThi: "4,3%",
    nhan: "MÔ PHỎNG",
    maNhan: "MO_PHONG",
    ten: hoaChuDau(TU.baoNham.chu),
    dieuKien: "Trung bình 12 kịch bản ghim không có tác dụng; riêng khối 5 phút 4,5–6%. Mức cho phép là 5%.",
    yNghia: "Ghim không tạo khác biệt thì phép đo hiếm khi báo nhầm là có.",
  },
  {
    id: "luc_khoi_5p",
    hienThi: "95%",
    nhan: "MÔ PHỎNG",
    maNhan: "MO_PHONG",
    ten: hoaChuDau(TU.lucPhatHien.chu),
    dieuKien: "Với tác động +30% và khối 5 phút, 3 phiên × 120 phút.",
    yNghia: "Ghim thật sự kéo thêm 30% lượt nhấp thì 95 lần trên 100 phép đo bắt được.",
  },
  {
    id: "du_am_h300",
    hienThi: "−46% → −35%",
    nhan: "MÔ PHỎNG",
    maNhan: "MO_PHONG",
    ten: hoaChuDau(TU.duAm.chu),
    dieuKien: "Dư âm kéo dài (sau 300 giây còn một nửa); bỏ 180 giây đầu khối thì độ lệch giảm từ −46% còn −35%.",
    yNghia: "Nếu đo sai thì đo ra nhỏ hơn thật, không thổi phồng tác dụng của ghim.",
  },
];

/** FACT-SHEET.md (dòng lưới R200-P120): báo nhầm riêng khối 5 phút. */
export const BAO_NHAM_KHOI_5P = "4,5–6%";

export const GHI_CHU_MO_PHONG =
  "Đo trên bộ mô phỏng phòng live của nhóm ngày 15/10/2026, biết trước đáp án. Chưa phải kết quả với người bán thật.";

/* ---------- ba màn ---------- */

export interface ManGioiThieu {
  ma: "ban" | "phong" | "tong-ket";
  ten: string;
  cau: string;
  lienKet: { chu: string; href: string };
}

export const BA_MAN: readonly ManGioiThieu[] = [
  {
    ma: "ban",
    ten: hoaChuDau(TU.banThiNghiem.chu),
    cau: "Lịch khối, món đang ghim, người xem và lượt nhấp trên một màn.",
    lienKet: { chu: "Mở danh sách phiên", href: "/phien" },
  },
  {
    ma: "phong",
    ten: hoaChuDau(TU.phongXem.chu),
    cau: "Người xem bấm “Xem ngay” hoặc “Mua (tiền ảo)”. Không lưu thông tin cá nhân. Mã phòng do nhóm gửi riêng cho từng buổi thử.",
    lienKet: { chu: "Xem danh sách phiên", href: "/phien" },
  },
  {
    ma: "tong-ket",
    ten: "Tổng kết",
    cau: "Hết phiên, LiveLift đưa ra một trong ba kết luận: ĐỔI, GIỮ hoặc ĐO THÊM, kèm lý do bằng lời thường.",
    lienKet: { chu: "Chọn một phiên đã xong", href: "/phien" },
  },
];

/* ---------- sự thật hôm nay ---------- */

export interface SuThat {
  /** id trong so.yaml khi có */
  id?: "phien_nguoi_ban_that" | "phong_van";
  so?: string;
  chu: string;
  maNhan: MaNhanNguon;
}

export const SU_THAT: readonly SuThat[] = [
  { id: "phien_nguoi_ban_that", so: "0", chu: "phiên với người bán thật", maNhan: "THAT" },
  { id: "phong_van", so: "0", chu: "phỏng vấn người bán", maNhan: "THAT" },
  { chu: "Giá bán: chưa hỏi người bán, mới là giả thuyết.", maNhan: "GIA_THUYET" },
  {
    chu: `Phòng xem: tối 20/10/2026 ${TU.thuNoiBo.chu}, chỉ người trong nhóm. Người ngoài nhóm vào từ Vòng 3 của cuộc thi.`,
    maNhan: "THU_NOI_BO",
  },
];

/* ---------- chân trang ---------- */

export const DOI = "Đội AISC26-0039 · TDTU · hạng mục Data Driven Business";
/** README.md của repo: git clone https://github.com/bminhnemhoi/AISC2026_LIVEFIT.git */
export const MA_NGUON = { chu: "Mã nguồn", href: "https://github.com/bminhnemhoi/AISC2026_LIVEFIT" } as const;

export const MO_TA_TRANG =
  "Ghim một món khi livestream có làm khách bấm mua nhiều hơn không? LiveLift bốc thăm bật/tắt theo từng khối 5 phút để người bán tự đo.";
