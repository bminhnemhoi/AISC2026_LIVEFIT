-- Tài khoản người dùng (D-017, 19/10/2026).
--
-- Ba bảng và một cột:
--
--   * `tai_khoan`        — một người dùng. Ba vai: 'quan-tri' (đội vận hành),
--     'nguoi-ban' (người bán; chạy chế độ demo tới khi đội xác minh),
--     'chi-xem' (chỉ đọc). Tài khoản mới đăng ký luôn là 'nguoi-ban' chưa xác
--     minh; tài khoản giám khảo cũng vậy (D-023: phiên của họ mang nhãn
--     "DÀN DỰNG · CHƯA XÁC MINH" và không vào số nào).
--   * `dang_nhap`        — một lần đăng nhập. CHỈ lưu SHA-256 của token: kho bị
--     đọc trộm cũng không dùng lại được token nào. Có hạn (`het_han`) và thu hồi
--     được (`thu_hoi`, mốc thời gian, NULL = còn hiệu lực).
--   * `nhat_ky_quan_tri` — ai (tài khoản quản trị) làm gì với đối tượng nào, lúc
--     nào. `chi_tiet` KHÔNG chứa thông tin cá nhân: ràng buộc bên dưới chặn các
--     khoá hay gặp (mật khẩu, token, email, số điện thoại, địa chỉ IP).
--   * `live_session.owner_id` — phiên thuộc tài khoản nào; NULL cho mọi phiên cũ
--     và phiên do máy sinh.
--
-- KHÔNG có cột email hay số điện thoại, cố ý: đăng nhập bằng tên tự đặt là đủ
-- cho thí điểm, và cột không tồn tại thì không bao giờ rò được.
--
-- Mật khẩu băm bằng scrypt (hashlib.scrypt), chuỗi băm tự mang tham số:
-- 'scrypt$n=<N>,r=<r>,p=<p>$<muối base64>$<băm base64>' (livelift.api.tai_khoan).

CREATE TABLE tai_khoan (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ten_dang_nhap text NOT NULL UNIQUE
                  CHECK (ten_dang_nhap ~ '^[a-z0-9._-]{3,32}$'),
    mat_khau_bam  text NOT NULL CHECK (mat_khau_bam LIKE 'scrypt$%'),
    vai           text NOT NULL DEFAULT 'nguoi-ban'
                  CHECK (vai IN ('quan-tri','nguoi-ban','chi-xem')),
    da_xac_minh   boolean NOT NULL DEFAULT false,
    tao_luc       timestamptz NOT NULL DEFAULT now(),
    khoa          boolean NOT NULL DEFAULT false
);

COMMENT ON TABLE tai_khoan IS
    'Tài khoản người dùng (D-017). Không có email, không có số điện thoại.';
COMMENT ON COLUMN tai_khoan.da_xac_minh IS
    'false = chạy chế độ demo (phiên mang nhãn DÀN DỰNG · CHƯA XÁC MINH) tới khi đội xác minh.';

CREATE TABLE dang_nhap (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tai_khoan_id uuid NOT NULL REFERENCES tai_khoan(id) ON DELETE CASCADE,
    token_bam    text NOT NULL UNIQUE CHECK (token_bam ~ '^[0-9a-f]{64}$'),
    tao_luc      timestamptz NOT NULL DEFAULT now(),
    het_han      timestamptz NOT NULL,
    thu_hoi      timestamptz,
    CHECK (het_han > tao_luc)
);
CREATE INDEX idx_dang_nhap_tai_khoan ON dang_nhap (tai_khoan_id);

COMMENT ON COLUMN dang_nhap.token_bam IS
    'SHA-256 (hex) của token đăng nhập. Token gốc không bao giờ được lưu.';

CREATE TABLE nhat_ky_quan_tri (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ai        uuid REFERENCES tai_khoan(id) ON DELETE SET NULL,
    viec      text NOT NULL,
    doi_tuong text,
    luc       timestamptz NOT NULL DEFAULT now(),
    chi_tiet  jsonb NOT NULL DEFAULT '{}'::jsonb,
    CHECK (jsonb_typeof(chi_tiet) = 'object'),
    CHECK (NOT (chi_tiet ?| ARRAY[
        'mat_khau','mat_khau_bam','token','token_bam','email','so_dien_thoai','sdt',
        'ip','dia_chi','dia_chi_ip'
    ]))
);
CREATE INDEX idx_nhat_ky_quan_tri_luc ON nhat_ky_quan_tri (luc);

COMMENT ON COLUMN nhat_ky_quan_tri.ai IS
    'Tài khoản quản trị đã làm việc này; NULL = máy (lệnh gieo) hoặc tài khoản đã bị xoá.';

ALTER TABLE live_session
    ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES tai_khoan(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_live_session_owner_id
    ON live_session (owner_id)
    WHERE owner_id IS NOT NULL;

COMMENT ON COLUMN live_session.owner_id IS
    'Tài khoản tạo phiên (D-017). NULL cho phiên cũ, phiên do máy sinh và phiên tạo bằng token lõi.';
