import type { HostAppBagItem, HostAppComment, HostAppViewModel } from "./types";

export const FIXTURE_ITEMS: HostAppBagItem[] = [
  {
    itemId: 101,
    name: "Áo Thun Oversize Cotton 100% Streetwear Basic Unisex",
    priceLabel: "189.000 ₫",
    initials: "AT",
    pinned: true,
  },
  {
    itemId: 102,
    name: "Kem Dưỡng Phục Hồi B5 Soothing Cream Intensive 50ml",
    priceLabel: "320.000 ₫",
    initials: "B5",
    pinned: false,
  },
  {
    itemId: 103,
    name: "Tai Nghe Không Dây Bluetooth 5.3 Hybrid ANC Bass Boost",
    priceLabel: null, // Unknown price: must display "Price not set", NEVER 0
    initials: "TN",
    pinned: false,
  },
  {
    itemId: 104,
    name: "Bình Giữ Nhiệt Inox 316 Dung Tích 800ml Giữ Nhiệt 24h",
    priceLabel: "245.000 ₫",
    initials: "BN",
    pinned: false,
  },
  {
    itemId: 105,
    name: "Son Kem Lì Velvet Lip Tint Màu Đỏ Nâu Đất Thời Thượng",
    priceLabel: "159.000 ₫",
    initials: "SK",
    pinned: false,
  },
  {
    itemId: 106,
    name: "Củ Sạc Nhanh GaN 65W 3 Cổng Type-C & USB-A Siêu Nhỏ Gọn",
    priceLabel: "389.000 ₫",
    initials: "CS",
    pinned: false,
  },
  {
    itemId: 107,
    name: "Quần Jeans Ống Suông Denim Vintage Wash Dáng Rộng Nam Nữ",
    priceLabel: "299.000 ₫",
    initials: "QJ",
    pinned: false,
  },
  {
    itemId: 108,
    name: "Sữa Rửa Mặt Tạo Bọt Dịu Nhẹ Cân Bằng Độ Ẩm pH 5.5 Chai 150ml",
    priceLabel: null, // Unknown price
    initials: "SR",
    pinned: false,
  },
  {
    itemId: 109,
    name: "Bộ Cọ Trang Điểm Chuyên Nghiệp 12 Cây Lông Mềm Kèm Túi Da",
    priceLabel: "215.000 ₫",
    initials: "BC",
    pinned: false,
  },
  {
    itemId: 110,
    name: "Bàn Phím Cơ Không Dây 3 Mode RGB Hot Swap Switch Linear",
    priceLabel: "890.000 ₫",
    initials: "BP",
    pinned: false,
  },
];

export const FIXTURE_EDGE_ITEMS: HostAppBagItem[] = [
  {
    itemId: 201,
    name: "Combo Siêu Tiết Kiệm: Bộ Dưỡng Trắng Toàn Diện Niacinamide 10% + Serum Phục Hồi Peptide Chuyên Sâu Tái Tạo Hàng Rào Bảo Vệ Da Ban Đêm Phiên Bản Giới Hạn AISC Edition",
    priceLabel: null, // Long name + unknown price: "Price not set"
    initials: "CB",
    pinned: true,
  },
  {
    itemId: 202,
    name: "Bộ Quần Áo Thể Thao Phối Viền Phản Quang Chống Nước Chuẩn Thi Đấu Ngoài Trời Kèm Băng Đô Co Giãn Kháng Khuẩn",
    priceLabel: "450.000 ₫",
    initials: "QA",
    pinned: false,
  },
  {
    itemId: 203,
    name: "Mẫu Thử Đặc Biệt (Chưa Định Giá)",
    priceLabel: null,
    initials: "MT",
    pinned: false,
  },
];

export const FIXTURE_STANDARD_COMMENTS: HostAppComment[] = [
  { id: "c1", user: "minh_thu92", text: "Chào shop nha! Có voucher giảm 50k không ạ?" },
  { id: "c2", user: "duc_nguyen", text: "Áo mã 1 chất vải gì vậy bạn?" },
  { id: "c3", user: "lan_anh_beauty", text: "Vừa chốt 1 kem B5 rồi nhé, gói kỹ giúp mình" },
  { id: "c4", user: "hoang_nam_k", text: "Deal tai nghe mấy giờ bắt đầu vậy shop?" },
  { id: "c5", user: "tram_anh", text: "Màu đỏ đất tôn da lắm nha mọi người ơi" },
];

export function generateSyntheticComments(count: number): HostAppComment[] {
  const users = [
    "ha_linh_official", "khanh_vy_99", "tung_son_review", "thanh_hang_vn",
    "quoc_bao_live", "mai_huong_cosmetic", "tuan_anh_tech", "ngoc_bich_shop",
    "le_hoang_store", "phuong_thao_94", "viet_anh_street", "thu_trang_fashion",
    "hong_gam_beauty", "tien_dat_gadgets", "quynh_nga_live", "minh_tam_ootd",
  ];
  const templates = [
    "Săn được voucher giảm 50k rồi nè!",
    "Chất vải cotton mặc có mát không bạn?",
    "Vừa ấn mua xong shop check đơn giùm nha",
    "Ghim lại sản phẩm trước đi shop ơi",
    "Có size XL cho người 75kg không ạ?",
    "Màu sắc bên ngoài giống live 100% không?",
    "Ship về Hà Nội mấy ngày tới vậy?",
    "Giá deal này hời quá, chốt luôn 2 cái!",
    "Đã theo dõi shop, chờ flash sale tiếp theo",
    "Kem B5 này da dầu mụn dùng được không?",
    "Bình giữ nhiệt dùng inox 316 an toàn lắm",
    "Shop tặng kèm quà gì không ạ?",
    "Đã share live lên nhóm săn sale nha",
    "Chốt đơn mã 101 màu đen size L",
    "Tư vấn size giúp mình với shop",
  ];

  const comments: HostAppComment[] = [];
  for (let i = 1; i <= count; i++) {
    const user = users[(i - 1) % users.length] + (i > users.length ? `_${Math.floor(i / users.length)}` : "");
    const text = templates[(i - 1) % templates.length];
    comments.push({
      id: `syn-${i}`,
      user,
      text: `${text} (#${i})`,
    });
  }
  return comments;
}

export const fixtureIdle: HostAppViewModel = {
  mode: "idle",
  title: "Đại Tiệc Săn Deal Công Nghệ & Thời Trang",
  sessionId: 884210,
  viewers: null,
  elapsedLabel: null,
  bag: FIXTURE_ITEMS.slice(0, 5),
  promotion: null,
  comments: [],
  banner: null,
};

export const fixtureLiveStandard: HostAppViewModel = {
  mode: "live",
  title: "Đại Tiệc Săn Deal Công Nghệ & Thời Trang",
  sessionId: 884210,
  viewers: 1420,
  elapsedLabel: "00:14:32",
  bag: FIXTURE_ITEMS,
  promotion: {
    name: "Flash Sale 20:12",
    status: "active",
    countdownLabel: "ends in 04:30",
  },
  comments: FIXTURE_STANDARD_COMMENTS,
  banner: {
    tone: "info",
    text: "LiveLift SIMULATED desk connected",
  },
};

export const fixtureLiveEdgeCases: HostAppViewModel = {
  mode: "live",
  title: "AISC 2026 Special Live Demonstration Showcase Test Session",
  sessionId: 991204,
  viewers: 28540,
  elapsedLabel: "01:05:40",
  bag: FIXTURE_EDGE_ITEMS,
  promotion: {
    name: "Mega Flash Voucher 50%",
    status: "scheduled",
    countdownLabel: "in 02:10",
  },
  comments: FIXTURE_STANDARD_COMMENTS.slice(0, 3),
  banner: {
    tone: "danger",
    text: "SIMULATED Live: Authorisation token expired. LiveLift degraded to manual.",
  },
};

export const fixtureLiveEmptyBag: HostAppViewModel = {
  mode: "live",
  title: "Phòng Live Thử Nghiệm Giỏ Trống",
  sessionId: 772019,
  viewers: 45,
  elapsedLabel: "00:02:15",
  bag: [],
  promotion: {
    name: "Voucher Chào Bạn Mới",
    status: "scheduled",
    countdownLabel: "in 15:00",
  },
  comments: [
    { id: "c-empty-1", user: "user_test", text: "Shop ơi giỏ hàng chưa có sản phẩm nào ạ?" },
  ],
  banner: {
    tone: "warn",
    text: "No active products pinned in current live room.",
  },
};

export const fixtureLiveHeavyComments: HostAppViewModel = {
  mode: "live",
  title: "Mega Livestream Săn Sale 100+ Bình Luận Giả Lập",
  sessionId: 884210,
  viewers: 9540,
  elapsedLabel: "00:45:10",
  bag: FIXTURE_ITEMS,
  promotion: {
    name: "Flash Sale 20:12",
    status: "active",
    countdownLabel: "ends in 01:15",
  },
  comments: generateSyntheticComments(115),
  banner: null,
};

export const fixtureEnded: HostAppViewModel = {
  mode: "ended",
  title: "Đại Tiệc Săn Deal Công Nghệ & Thời Trang",
  sessionId: 884210,
  viewers: 3200,
  elapsedLabel: "01:32:45",
  bag: FIXTURE_ITEMS,
  promotion: {
    name: "Flash Sale 20:12",
    status: "ended",
    countdownLabel: null,
  },
  comments: FIXTURE_STANDARD_COMMENTS,
  banner: null,
};

export const FIXTURE_LONG_VIETNAMESE_ITEMS: HostAppBagItem[] = [
  {
    itemId: 301,
    name: "Bộ Combo Chăm Sóc Da Toàn Diện Niacinamide 10% và Serum Phục Hồi Chuyên Sâu Tái Tạo Hàng Rào Bảo Vệ Ban Đêm Dung Tích 100ml Phiên Bản Giới Hạn",
    priceLabel: "485.000 ₫",
    initials: "BC",
    pinned: true,
  },
  {
    itemId: 302,
    name: "Áo Sơ Mi Lụa Cổ Vest Phối Viền Ren Nữ Phong Cách Hàn Quốc Công Sở Trẻ Trung Dáng Rộng Thoáng Mát",
    priceLabel: null, // "Price not set"
    initials: "SM",
    pinned: false,
  },
  {
    itemId: 303,
    name: "Nồi Chiên Không Dầu Điện Tử Cảm Ứng Đa Năng Dung Tích Cực Đại 12 Lít Công Nghệ Rapid Air Giảm 90% Dầu Mỡ",
    priceLabel: "1.890.000 ₫",
    initials: "NC",
    pinned: false,
  },
];

export const FIXTURE_LONG_ENGLISH_ITEMS: HostAppBagItem[] = [
  {
    itemId: 401,
    name: "Ultra-Responsive Noise-Cancelling Bluetooth 5.4 Wireless Studio Over-Ear Headphones with Spatial Sound Architecture & High-Resolution Audio Driver",
    priceLabel: "$129.99",
    initials: "UR",
    pinned: true,
  },
  {
    itemId: 402,
    name: "Ergonomic Multi-Angle Adjustable Aluminum Laptop Stand with Integrated Dual Silent Cooling Turbines and Cable Management Organizer",
    priceLabel: null, // "Price not set"
    initials: "ER",
    pinned: false,
  },
  {
    itemId: 403,
    name: "Comprehensive Professional Hydroponic Indoor Herb Garden Starter Kit with Automated Full-Spectrum LED Lighting and Smart Water Reservoir Sensor",
    priceLabel: "$89.50",
    initials: "CP",
    pinned: false,
  },
];

export const FIXTURE_LONG_VIETNAMESE_COMMENTS: HostAppComment[] = [
  {
    id: "vn-1",
    user: "nguyen_thi_bich_ngoc_official",
    text: "Dạ shop ơi sản phẩm combo kem dưỡng B5 này da nhạy cảm dễ kích ứng có dùng chung với retinol được không ạ?",
  },
  {
    id: "vn-2",
    user: "le_hoang_phuong_thao_saigon",
    text: "Mình vừa đặt đơn hàng số 889240 ship hoả tốc về quận 1 Bình Thạnh nhờ shop đóng gói cẩn thận giúp mình nhé!",
  },
  {
    id: "vn-3",
    user: "tran_dinh_quang_vinh_review",
    text: "Voucher giảm 50k áp dụng cho tất cả sản phẩm trong giỏ hàng hay chỉ áp dụng cho sản phẩm đang ghim trên live vậy shop?",
  },
];

export const FIXTURE_LONG_ENGLISH_COMMENTS: HostAppComment[] = [
  {
    id: "en-1",
    user: "alexander_montgomery_tech",
    text: "Does this wireless headphone pair support simultaneous dual-device Bluetooth multipoint connection and lossless AAC codec?",
  },
  {
    id: "en-2",
    user: "elizabeth_harrison_design",
    text: "Is international priority shipping available to Singapore or Malaysia during this live broadcast with the current promo voucher?",
  },
  {
    id: "en-3",
    user: "christopher_vanderbilt_ca",
    text: "Can you demonstrate the hinge stability and height adjustment mechanism on camera before I complete the checkout?",
  },
];

export const fixtureLiveLongVietnamese: HostAppViewModel = {
  mode: "live",
  title: "Đại Tiệc Siêu Khuyến Mãi Săn Deal Chớp Nhoáng Công Nghệ Và Làm Đẹp Trực Tiếp 2026",
  sessionId: 991201,
  viewers: 18450,
  elapsedLabel: "01:12:45",
  bag: FIXTURE_LONG_VIETNAMESE_ITEMS,
  promotion: {
    name: "Flash Sale Đại Tiệc Mua Sắm Siêu Rẻ 20:30",
    status: "active",
    countdownLabel: "kết thúc sau 03:45",
  },
  comments: FIXTURE_LONG_VIETNAMESE_COMMENTS,
  banner: {
    tone: "info",
    text: "Đã kết nối bàn điều khiển SIMULATED LiveLift. Tín hiệu phát sóng ổn định.",
  },
};

export const fixtureLiveLongEnglish: HostAppViewModel = {
  mode: "live",
  title: "Global Flagship Technology & Lifestyle Exclusive Live Stream Showcase Demonstration 2026",
  sessionId: 991202,
  viewers: 24680,
  elapsedLabel: "00:48:30",
  bag: FIXTURE_LONG_ENGLISH_ITEMS,
  promotion: {
    name: "Worldwide Tech Prime Deal Showcase 21:00",
    status: "active",
    countdownLabel: "ends in 05:22",
  },
  comments: FIXTURE_LONG_ENGLISH_COMMENTS,
  banner: {
    tone: "info",
    text: "Connected to SIMULATED Live broadcast environment. All controls responsive.",
  },
};

