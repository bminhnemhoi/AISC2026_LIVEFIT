-- Phòng xem dàn dựng (15/10/2026).
--
-- Nền tảng mới 'lab': một phòng live DÀN DỰNG có người thật tham gia ẩn danh,
-- mua bằng tiền ảo. Khác 'sim' (máy sinh, không có người) và khác mọi nền tảng
-- thật. Giữ riêng một giá trị để không bao giờ lẫn với dữ liệu nền tảng thật.
ALTER TABLE live_session DROP CONSTRAINT IF EXISTS live_session_platform_check;
ALTER TABLE live_session
    ADD CONSTRAINT live_session_platform_check
    CHECK (platform IN ('youtube','facebook','tiktok','replay','sim','lab'));

-- Cấu hình phòng: {enabled, code, consent_version, video_url, title, opened_at}.
-- Mã công khai `code` là ngẫu nhiên; UUID phiên không bao giờ ra ngoài.
ALTER TABLE live_session ADD COLUMN IF NOT EXISTS phong_xem jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_session_phong_xem_code
    ON live_session ((phong_xem->>'code'))
    WHERE phong_xem IS NOT NULL;

-- Nhật ký thao tác của người xem phòng dàn dựng — để kiểm toán, tính phơi
-- nhiễm từ nhịp tim, và thực thi quyền rút lui. viewer_hash là băm của mã
-- ngẫu nhiên do trình duyệt tự sinh: không tên, không SĐT, không địa chỉ IP.
CREATE TABLE lab_event (
    session_id  uuid NOT NULL REFERENCES live_session(session_id) ON DELETE CASCADE,
    viewer_hash text NOT NULL,
    event_id    text NOT NULL,
    kind        text NOT NULL CHECK (kind IN
                    ('dong_y','nhip','xem_san_pham','bam','them_gio','mua','binh_luan','rut_lui')),
    product_id  text,
    ts          timestamptz NOT NULL DEFAULT now(),
    client_ts   timestamptz,
    PRIMARY KEY (session_id, viewer_hash, event_id)
);
CREATE INDEX IF NOT EXISTS idx_lab_event_session_ts ON lab_event (session_id, ts);
