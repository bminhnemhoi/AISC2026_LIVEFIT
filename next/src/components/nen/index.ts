// Cửa vào của nền giao diện 2.0 (U1, kế hoạch bản 3.1). Mọi màn mới lấy khung, nút, chip, nhãn, thẻ, ô số,
// ngăn kéo và hộp thoại từ đây; chữ lấy từ "@/lib/tu-ngu".
export { AppShell, type AppShellProps } from "./AppShell";
export { ThanhTrai, useDieuHuong, type ThanhTraiProps, type ThanhDieuHuongProps } from "./ThanhTrai";
export { ThanhDuoi } from "./ThanhDuoi";
export { ThanhTren, type ThanhTrenProps } from "./ThanhTren";
export {
  DIEU_HUONG,
  TOI_DA_THANH_DUOI,
  mucHien,
  laMucHienTai,
  mucDangMo,
  type MaMuc,
  type MucDieuHuong,
  type TuyChonMuc,
  type VaiTro,
} from "./dieu-huong";
export { NutBam, NutLienKet, caoNut, type NutBamProps, type NutLienKetProps, type BienNut, type CaoNut } from "./NutBam";
export { Chip, type ChipProps } from "./Chip";
export { NhanNguon, type NhanNguonProps } from "./NhanNguon";
export { chuNhanNguon, nghiaNhanNguon, dsMaNhan, chonCanh, rongBongNghia, type MaNhan } from "./nhan";
export { NhanCongBo, chuNhanCongBo, type NhanCongBoProps } from "./NhanCongBo";
export { Th, type ThProps } from "./Th";
export { OSo, type OSoProps, type ThayDoi } from "./OSo";
export { NganKeo, type NganKeoProps } from "./NganKeo";
export { Hop, useXacNhan, type HopProps, type CauHoi } from "./Hop";
export { useLopPhu, useDaGan, type TuyChonLopPhu } from "./lop-phu";
export {
  MAU_NEN,
  CAP_TONE,
  TONE_NHAN_NGUON,
  TONE_NHAN_CONG_BO,
  bienCss,
  tuongPhan,
  type TenMauNen,
  type ToneChip,
} from "./token";
