-- Hoàn tác 0010. Phiên 'lab' không thể tồn tại dưới ràng buộc cũ, nên bị xoá
-- trước (CASCADE xoá theo khối, bình luận, tick, nhật ký phòng xem của chúng).
DROP TABLE IF EXISTS lab_event;
DROP INDEX IF EXISTS idx_live_session_phong_xem_code;
DELETE FROM live_session WHERE platform = 'lab';
ALTER TABLE live_session DROP COLUMN IF EXISTS phong_xem;
ALTER TABLE live_session DROP CONSTRAINT IF EXISTS live_session_platform_check;
ALTER TABLE live_session
    ADD CONSTRAINT live_session_platform_check
    CHECK (platform IN ('youtube','facebook','tiktok','replay','sim'));
