-- Hoàn tác 0011, theo thứ tự ngược với lúc tạo. Mọi tài khoản, lần đăng nhập
-- và nhật ký quản trị bị xoá; phiên giữ nguyên, chỉ mất cột chủ sở hữu.
DROP INDEX IF EXISTS idx_live_session_owner_id;
ALTER TABLE live_session DROP COLUMN IF EXISTS owner_id;
DROP INDEX IF EXISTS idx_nhat_ky_quan_tri_luc;
DROP TABLE IF EXISTS nhat_ky_quan_tri;
DROP INDEX IF EXISTS idx_dang_nhap_tai_khoan;
DROP TABLE IF EXISTS dang_nhap;
DROP TABLE IF EXISTS tai_khoan;
