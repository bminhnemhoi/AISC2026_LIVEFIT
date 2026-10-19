/**
 * Bảng từ của giao diện LiveLift 2.0 (D-022), chép nguyên từ docs/canon/thuat-ngu.yaml.
 *
 * Luật: muốn đổi chữ thì sửa yaml trước rồi chép lại vào đây. Test
 * components/nen/__tests__/tu-ngu.test.ts đọc yaml và so từng trường; lệch một ký tự là đỏ.
 *
 * Tệp này cố ý chứa các mẫu chữ cấm (TU_CAM) để giao diện và test tự kiểm; công cụ quét chữ công khai
 * nên bỏ qua đúng tệp này. Dấu gạch dài viết bằng mã \u2014 để tệp nguồn không chứa ký tự đó.
 */

export const PHIEN_BAN_CANON = "2026-10-19b";

export interface ThuatNgu {
  /** Cách viết đúng (canon). */
  readonly dung: string;
  /** Cách viết không được dùng. */
  readonly cam: readonly string[];
  readonly ghi_chu?: string;
  /** Phụ đề lời thường, hiện ngay dưới hoặc cạnh thuật ngữ. */
  readonly phu_de?: string;
  /** Dạng ngắn được phép trên giao diện; luôn kèm dạng đầy đủ làm phụ đề. */
  readonly ngan?: string;
  /** Nghĩa hoặc nơi dùng. */
  readonly nghia?: string;
}

export const THUAT_NGU: readonly ThuatNgu[] = [
  { dung: "LiveLift", cam: ["LIVEFIT"], ghi_chu: "LIVEFIT chỉ là tên kho mã trên GitHub; bị hỏi thì giải thích." },
  {
    dung: "thí nghiệm bật/tắt theo khối thời gian (switchback)",
    cam: ["luân phiên", "A/B"],
    ghi_chu: "A/B chỉ dùng khi nói về chia người xem, thứ người bán không làm được.",
  },
  {
    dung: "khối, khối BẬT, khối TẮT",
    cam: ["lát", "bucket", "khúc"],
    phu_de: "mỗi khối 5 phút, máy tung đồng xu chọn khối nào ghim; BẬT: LiveLift ghim · TẮT: đội làm như thường",
  },
  { dung: "bốc thăm", cam: ["random"] },
  {
    dung: "niêm phong lịch (dấu vân tay SHA-256)",
    cam: ["khoá lịch"],
    phu_de: "khoá bằng mã băm trước giờ live, không ai sửa lén được",
  },
  { dung: "bỏ 60 giây đầu khối", cam: ["burn-in"], ghi_chu: "burn-in chỉ được đứng trong ngoặc sau chữ tiếng Việt." },
  { dung: "dư âm", cam: ["hiệu ứng lưu"], ghi_chu: "hiệu ứng lưu (carryover) chỉ được đứng trong ngoặc." },
  { dung: "báo nhầm", cam: ["dương tính giả"] },
  { dung: "lực phát hiện", cam: [] },
  {
    dung: "khoảng tin cậy 95% (KTC 95%)",
    cam: [],
    ghi_chu: "Trên giao diện viết đủ chữ; KTC chỉ dùng trong slide phương pháp và tài liệu.",
    phu_de: "đo lại nhiều lần thì khoảng 95/100 dải như vậy chứa hiệu quả thật",
  },
  { dung: "kiểm định ngẫu nhiên hoá", cam: ["kiểm định hoán vị"] },
  {
    dung: "lượt nhấp hợp lệ / 1.000 giây·người xem",
    ngan: "Tỷ lệ nhấp",
    cam: ["click / 1.000 giây", "lượt nhấp trên 1.000 giây xem", "lượt bấm trên 1.000 giây"],
    ghi_chu: "Dạng ngắn 'Tỷ lệ nhấp' được dùng trên giao diện, luôn kèm phụ đề đầy đủ.",
  },
  {
    dung: "bàn thí nghiệm",
    nghia: "màn /phien/{id} của next/: theo lịch khối, ghim, xem kết quả",
    cam: ["bàn trợ live", "bàn điều hành"],
  },
  {
    dung: "màn người dẫn",
    nghia: "/nguoi-dan; làm mù MỘT PHẦN (người dẫn vẫn thấy món đang ghim)",
    cam: ["người dẫn bị làm mù hoàn toàn"],
  },
  {
    dung: "phòng xem",
    nghia: "/xem/{code}, nhãn DÀN DỰNG; tiền ảo, không lưu thông tin cá nhân",
    cam: ["phòng live dàn dựng"],
  },
  {
    dung: "thử nội bộ",
    nghia: "buổi phòng xem chỉ có người trong nhóm (tối 20/10/2026); người ngoài nhóm từ Vòng 3",
    cam: [],
  },
  {
    dung: "tổng kết ĐỔI / GIỮ / ĐO THÊM",
    cam: ["DƯƠNG/NULL", "DƯƠNG, NULL, CHƯA ĐỦ"],
    ghi_chu: "Phiên quá ngắn hiện ĐO THÊM; tên phiên mẫu dùng ĐỔI / ĐO THÊM / CHƯA ĐỦ KHỐI.",
  },
  {
    dung: "Live Desk minh hoạ",
    nghia: "/minh-hoa (vẫn giữ /start → /desk/{id}); lớp minh hoạ chạy trong trình duyệt, không phải bàn thí nghiệm (D-018)",
    cam: [],
  },
  { dung: "Chế độ Thí nghiệm", cam: [] },
  {
    dung: "chế độ ghim: Tự ghim / Chỉ gợi ý / Quan sát",
    cam: ["Đề xuất (trọng tâm)"],
    phu_de: "Tự ghim (autopilot): máy tự ghim ở khối BẬT",
  },
  { dung: "Các phiên live đang đo hiệu quả ghim", nghia: "tiêu đề danh sách phiên /phien", cam: ["Thí nghiệm có bốc thăm"] },
  {
    dung: "Ghim món của khối này",
    nghia: "nút ghim ở khối BẬT; máy chọn trong nhóm gợi ý, món có thể khác thẻ gợi ý",
    cam: ["Ghim theo gợi ý"],
  },
  {
    dung: "người dẫn AI",
    nghia: "video người dẫn do AI tạo (khuôn mặt và giọng tổng hợp), luôn kèm nhãn NGƯỜI DẪN AI (D-015)",
    cam: ["người dẫn ảo thật", "MC thật"],
  },
  { dung: "radar ý định (tín hiệu phụ)", cam: [] },
  { dung: "người bán, người trợ live, người dẫn", cam: ["nhà bán", "người vận hành"] },
  { dung: "người đi thuê sân", nghia: "người bán không sở hữu nền tảng, không chia được người xem", cam: [] },
  { dung: "MÔ PHỎNG", cam: ["SIMULATED"], ghi_chu: "SIMULATED chỉ dùng trên bản tiếng Anh." },
];

export const CAU_GHIM =
  "LiveLift bốc thăm. Ở khối BẬT, Shopee ghim qua API (chưa nối); TikTok và Facebook ghim tay theo thẻ lịch; trong demo và phòng xem, máy tự ghim (autopilot).";

/* ---------- nhãn nguồn của số ---------- */

export const MA_NHAN_NGUON = [
  "THAT",
  "DAN_DUNG",
  "THU_NOI_BO",
  "MO_PHONG",
  "GIA_THUYET",
  "THU_CAP",
  "NHAN_AI",
  "QUAN_SAT",
  "MINH_HOA",
  "MAN_MAU",
] as const;
export type MaNhanNguon = (typeof MA_NHAN_NGUON)[number];

export interface NhanCanon<M extends string> {
  readonly id: M;
  readonly hien_thi: string;
  readonly nghia: string;
}

export const NHAN_NGUON: readonly NhanCanon<MaNhanNguon>[] = [
  { id: "THAT", hien_thi: "THẬT", nghia: "đo trên dữ liệu hoặc sự kiện có thật, chạy lại được" },
  {
    id: "DAN_DUNG",
    hien_thi: "DÀN DỰNG",
    nghia:
      "phòng xem: người thật bấm, tiền ảo; video người dẫn quay sẵn hoặc do AI tạo (khi đó kèm nhãn công bố NGƯỜI DẪN AI)",
  },
  { id: "THU_NOI_BO", hien_thi: "THỬ NỘI BỘ", nghia: "buổi dàn dựng chỉ có người trong nhóm" },
  { id: "MO_PHONG", hien_thi: "MÔ PHỎNG", nghia: "sinh từ LiveRoomSim hoặc bộ mô phỏng gốc, biết trước đáp án" },
  { id: "GIA_THUYET", hien_thi: "GIẢ THUYẾT", nghia: "chưa kiểm chứng (giá, mức sẵn lòng trả)" },
  { id: "THU_CAP", hien_thi: "THỨ CẤP", nghia: "số của đơn vị khác, ghi tên nguồn và năm" },
  { id: "NHAN_AI", hien_thi: "NHÃN AI", nghia: "đo so với nhãn tham chiếu do tác tử AI gán, chưa có nhãn người" },
  { id: "QUAN_SAT", hien_thi: "QUAN SÁT", nghia: "dữ liệu có thật nhưng không có bốc thăm hay can thiệp" },
  { id: "MINH_HOA", hien_thi: "MINH HOẠ", nghia: "hình hoặc số để giải thích, không phải kết quả" },
  { id: "MAN_MAU", hien_thi: "MÀN MẪU", nghia: "ảnh giao diện chạy bằng dữ liệu mẫu" },
];

/* ---------- nhãn công bố (lời báo cho người xem, không phải nguồn của số) ---------- */

export const MA_NHAN_CONG_BO = ["NGUOI_DAN_AI", "MAY_CHEP_LOI", "CHUA_XAC_MINH"] as const;
export type MaNhanCongBo = (typeof MA_NHAN_CONG_BO)[number];

export const NHAN_CONG_BO: readonly NhanCanon<MaNhanCongBo>[] = [
  {
    id: "NGUOI_DAN_AI",
    hien_thi: "NGƯỜI DẪN AI · GIỌNG TỔNG HỢP",
    nghia: "khuôn mặt và giọng người dẫn do AI tạo; hiện liên tục trên video và khung điện thoại",
  },
  {
    id: "MAY_CHEP_LOI",
    hien_thi: "MÁY CHÉP LỜI",
    nghia: "lời người dẫn do máy chép (faster-whisper), có thể sai; chỉ để hiển thị",
  },
  {
    id: "CHUA_XAC_MINH",
    hien_thi: "DÀN DỰNG · CHƯA XÁC MINH",
    nghia: "phiên do giám khảo hoặc tài khoản chưa xác minh tạo; không vào số nào",
  },
];

/* ---------- chữ cấm ---------- */

export interface TuCam {
  /** Biểu thức chính quy theo cú pháp Python của yaml; dùng veMauCam() để đổi sang RegExp của JS. */
  readonly mau: string;
  readonly ly_do: string;
}

export const TU_CAM: readonly TuCam[] = [
  { mau: "2,5 triệu (phiên|buổi)", ly_do: "ước tính năm 2024 của AccessTrade, chưa truy được gốc" },
  { mau: ">\\s*50\\.000 nhà bán", ly_do: "cùng nguồn với dòng trên" },
  { mau: "4,5\\s*%", ly_do: "A/A ngày 30/08, không tái lập được" },
  { mau: "0,271", ly_do: "macro-F1 ngày 08/09, không tái lập được" },
  { mau: "tăng doanh số", ly_do: "LiveLift đo, không hứa tăng" },
  { mau: "Mall/Preferred", ly_do: "không thấy điều kiện này trong tài liệu Shopee Open Platform" },
  { mau: "không bao giờ tự ghim", ly_do: "trái với chế độ Tự ghim và autopilot của phòng xem" },
  { mau: "estimated GMV", ly_do: "chưa thấy trang chính thức nào của TikTok mô tả" },
  {
    mau: "(là|đội|công cụ|sản phẩm) đầu tiên",
    ly_do: "không chứng minh được; kết luận 'chưa thấy' chỉ dựa trên tìm kiếm có phạm vi",
  },
  { mau: "18 khối", ly_do: "phiên 90 phút có 16 khối" },
  { mau: "khúc 5 phút", ly_do: "canon dùng 'khối 5 phút' (D-022)" },
  { mau: "\u2014", ly_do: "không dùng dấu gạch dài trong chữ công khai" },
  { mau: "đột phá|toàn diện|nâng tầm|hệ sinh thái|then chốt|cốt lõi", ly_do: "từ nghe giống văn máy" },
  { mau: "không chỉ\\b.{0,80}\\bmà còn", ly_do: "cấu trúc nghe giống văn máy" },
];

export const CHINH_TA: { readonly dung: readonly string[]; readonly cam: readonly string[] } = {
  dung: ["khoá", "hoá", "xoá", "minh hoạ", "tuỳ"],
  cam: ["khóa", "hóa", "xóa", "minh họa", "tùy"],
};

export const QUY_TAC_KHAC: readonly string[] = [
  "Không nhắc bài báo của giảng viên hướng dẫn trong bất kỳ tài liệu công khai nào.",
  "Đội khác chỉ gọi bằng mã đội (ví dụ AISC26-0027), không nêu tên người.",
];

/* ---------- tra cứu ---------- */

function bangTheoMa<M extends string>(ds: readonly NhanCanon<M>[]): Readonly<Record<M, NhanCanon<M>>> {
  return Object.freeze(Object.fromEntries(ds.map((n) => [n.id, n])) as Record<M, NhanCanon<M>>);
}

export const NHAN_NGUON_THEO_MA = bangTheoMa(NHAN_NGUON);
export const NHAN_CONG_BO_THEO_MA = bangTheoMa(NHAN_CONG_BO);

/** Cụm trong ngoặc ở cuối thuật ngữ là chú thích ("niêm phong lịch (dấu vân tay SHA-256)" → "niêm phong lịch"). */
export function boNgoac(dung: string): string {
  return dung.replace(/\s*\([^()]*\)\s*$/u, "").trim();
}

/** Viết hoa chữ cái đầu, giữ nguyên phần còn lại (dùng cho tiêu đề, nhãn nút). */
export function hoaChuDau(chu: string): string {
  return chu ? chu.charAt(0).toLocaleUpperCase("vi-VN") + chu.slice(1) : chu;
}

export interface TuMuc extends ThuatNgu {
  /** Thuật ngữ bỏ phần chú thích trong ngoặc. */
  readonly chu: string;
  /** Chữ hiện trên giao diện: dạng ngắn nếu canon cho phép, không thì `chu`. */
  readonly hien: string;
}

/** Tìm một dòng canon theo đúng chữ `dung`; ném lỗi khi canon đã đổi để test bắt được ngay. */
export function theoCanon(dung: string): TuMuc {
  const tu = THUAT_NGU.find((t) => t.dung === dung);
  if (!tu) throw new Error(`tu-ngu: không thấy "${dung}" trong thuat-ngu.yaml`);
  const chu = boNgoac(tu.dung);
  return Object.freeze({ ...tu, chu, hien: tu.ngan ?? chu });
}

/**
 * Lối tắt cho các màn. Mỗi mục trỏ về đúng một dòng canon, không viết lại chữ.
 * Ví dụ: TU.tyLeNhap.hien === "Tỷ lệ nhấp", TU.tyLeNhap.dung === "lượt nhấp hợp lệ / 1.000 giây·người xem".
 */
export const TU = Object.freeze({
  liveLift: theoCanon("LiveLift"),
  switchback: theoCanon("thí nghiệm bật/tắt theo khối thời gian (switchback)"),
  khoi: theoCanon("khối, khối BẬT, khối TẮT"),
  bocTham: theoCanon("bốc thăm"),
  niemPhongLich: theoCanon("niêm phong lịch (dấu vân tay SHA-256)"),
  boDauKhoi: theoCanon("bỏ 60 giây đầu khối"),
  duAm: theoCanon("dư âm"),
  baoNham: theoCanon("báo nhầm"),
  lucPhatHien: theoCanon("lực phát hiện"),
  khoangTinCay: theoCanon("khoảng tin cậy 95% (KTC 95%)"),
  kiemDinh: theoCanon("kiểm định ngẫu nhiên hoá"),
  tyLeNhap: theoCanon("lượt nhấp hợp lệ / 1.000 giây·người xem"),
  banThiNghiem: theoCanon("bàn thí nghiệm"),
  manNguoiDan: theoCanon("màn người dẫn"),
  phongXem: theoCanon("phòng xem"),
  thuNoiBo: theoCanon("thử nội bộ"),
  tongKet: theoCanon("tổng kết ĐỔI / GIỮ / ĐO THÊM"),
  liveDeskMinhHoa: theoCanon("Live Desk minh hoạ"),
  cheDoThiNghiem: theoCanon("Chế độ Thí nghiệm"),
  cheDoGhim: theoCanon("chế độ ghim: Tự ghim / Chỉ gợi ý / Quan sát"),
  danhSachPhien: theoCanon("Các phiên live đang đo hiệu quả ghim"),
  ghimMonKhoiNay: theoCanon("Ghim món của khối này"),
  nguoiDanAi: theoCanon("người dẫn AI"),
  radarYDinh: theoCanon("radar ý định (tín hiệu phụ)"),
  vaiTro: theoCanon("người bán, người trợ live, người dẫn"),
  nguoiDiThueSan: theoCanon("người đi thuê sân"),
  moPhong: theoCanon("MÔ PHỎNG"),
});

/** Nhãn ngắn và phụ đề cho một ô số hay tiêu đề: dạng ngắn kèm dạng đầy đủ, hoặc thuật ngữ kèm phụ đề lời thường. */
export function nhanVaPhuDe(tu: TuMuc): { nhan: string; phuDe?: string } {
  if (tu.ngan) return { nhan: tu.ngan, phuDe: tu.dung };
  return tu.phu_de ? { nhan: hoaChuDau(tu.chu), phuDe: tu.phu_de } : { nhan: hoaChuDau(tu.chu) };
}

/** Phụ đề của khối tách thành ba câu: chung, BẬT, TẮT (từ phu_de của dòng "khối, khối BẬT, khối TẮT"). */
export const PHU_DE_KHOI = ((): { chung: string; bat: string; tat: string } => {
  const phuDe = TU.khoi.phu_de ?? "";
  const [chung, phan] = phuDe.split("; ");
  const [bat, tat] = (phan ?? "").split(" · ");
  if (!chung || !bat?.startsWith("BẬT: ") || !tat?.startsWith("TẮT: ")) {
    throw new Error("tu-ngu: phu_de của khối không còn dạng 'chung; BẬT: … · TẮT: …'");
  }
  return Object.freeze({ chung, bat: bat.slice("BẬT: ".length), tat: tat.slice("TẮT: ".length) });
})();

/**
 * Lời thường kế hoạch bản 3.1 (mục 3) đã chốt nhưng CHƯA có trong thuat-ngu.yaml.
 * Đợt ghép phải chép các dòng này vào yaml; khi đó test sẽ đòi chuyển sang TU.
 */
export const CHO_CANON = Object.freeze({
  danhSachPhienPhuDe: "Mỗi phiên chia khối 5 phút, máy tung đồng xu chọn khối nào ghim",
  tuongQuan: "đoán theo số liệu cũ",
  lamMuMotPhan: "người dẫn không thấy lịch",
  pheu: "Từ xem đến mua",
  chiTietNguoiKiem: "Chi tiết cho người kiểm",
});

/* ---------- kiểm chữ ---------- */

const CHU = "[\\p{L}\\p{N}_]";
/** `\b` của Python hiểu chữ có dấu; `\b` của JS thì không. Đổi sang ranh giới Unicode tương đương. */
const RANH_GIOI = `(?:(?<=${CHU})(?!${CHU})|(?<!${CHU})(?=${CHU}))`;

/** Đổi một mẫu trong TU_CAM sang RegExp của JS: không phân biệt hoa thường, ranh giới từ hiểu tiếng Việt. */
export function veMauCam(mau: string): RegExp {
  return new RegExp(mau.replace(/\\b/g, RANH_GIOI), "giu");
}

function thoatRegExp(chu: string): string {
  return chu.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

export interface LoiChu {
  readonly loai: "tu_cam" | "chinh_ta" | "thuat_ngu";
  readonly mau: string;
  readonly khop: string;
  readonly ly_do: string;
}

/**
 * Tìm chữ cấm trong một đoạn chữ công khai. Mặc định kiểm TU_CAM và chính tả;
 * `thuatNgu: true` kiểm thêm cột `cam` của từng thuật ngữ (có thể báo nhầm, ví dụ "lát nữa").
 */
export function timLoiChu(van: string, tuyChon: { thuatNgu?: boolean } = {}): LoiChu[] {
  const chu = van.normalize("NFC");
  const loi: LoiChu[] = [];
  for (const t of TU_CAM) {
    for (const m of chu.matchAll(veMauCam(t.mau))) loi.push({ loai: "tu_cam", mau: t.mau, khop: m[0], ly_do: t.ly_do });
  }
  CHINH_TA.cam.forEach((sai, i) => {
    for (const m of chu.matchAll(new RegExp(thoatRegExp(sai), "giu"))) {
      loi.push({ loai: "chinh_ta", mau: sai, khop: m[0], ly_do: `viết "${CHINH_TA.dung[i]}"` });
    }
  });
  if (tuyChon.thuatNgu) {
    for (const t of THUAT_NGU) {
      for (const sai of t.cam) {
        const re = new RegExp(`(?<!${CHU})${thoatRegExp(sai)}(?!${CHU})`, "giu");
        for (const m of chu.matchAll(re)) loi.push({ loai: "thuat_ngu", mau: sai, khop: m[0], ly_do: `viết "${t.dung}"` });
      }
    }
  }
  return loi;
}
