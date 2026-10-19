// Màn giải thích ghim (U3). Bản tương tác: CoChe (trang, ngan, buoc). Bản SVG tĩnh: CoCheSvg.
// Xuất chuỗi SVG: nhập thẳng `@/components/co-che/xuat` (dùng react-dom/server, không đưa vào gói trình duyệt).
export { CoChe, HinhBuoc, DanhSachKetLuan, type CoCheProps, type BienTheCoChe } from "./CoChe";
export { CoCheSvg, boCucCoChe, type CoCheSvgProps, type HuongCoChe } from "./CoCheSvg";
export {
  BUOC_CO_CHE,
  KET_LUAN_CO_CHE,
  TIEU_DE_CO_CHE,
  CAU_DAN_CO_CHE,
  GHI_CHU_GHIM,
  toanBoChuCoChe,
  ngatDong,
  type BuocCoChe,
  type MaBuoc,
  type KetLuanCoChe,
  type MaKetLuan,
} from "./noi-dung";
