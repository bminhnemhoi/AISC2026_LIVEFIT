# Kiểm định thiết kế trên LiveRoomSim (MÔ PHỎNG) — lưới R200, phiên 120 phút

*Đo 15/10/2026 trên nhánh `vong2/hop-nhat`, sau bản sửa lỗi hoà số p-value (sổ sự cố hàng 15/10/2026). Mọi số trong tài liệu này là **mô phỏng**: chúng trả lời "phương pháp có báo nhầm hay lệch không nếu thế giới có những cơ chế này", không trả lời "LiveLift có làm tăng doanh số không".*

## Sinh lại

```powershell
.venv\Scripts\python -m livelift.sim.liveroom_grid --reps 200 --workers 3      # khoảng 90 phút trên máy 12 luồng
.venv\Scripts\python -m livelift.sim.liveroom_grid --summarise --reps 200      # bảng + 2 hình
```

- Dữ liệu từng ô: `docs/benchmarks/data/liveroom-grid/R200-P120/*.json` (kèm vector thô).
- Bảng đầy đủ: `docs/benchmarks/data/liveroom-grid/R200-P120/TONG-HOP.md`.
- Hình: `docs/benchmarks/img/liveroom-co-va-luc.png`, `docs/benchmarks/img/liveroom-lech-du-am.png`.

## Thiết kế lưới

- **Mô hình thế giới:** `src/livelift/sim/liveroom.py`. Các cơ chế:
  - người xem lướt qua / ở lại;
  - phản hồi lưu lượng β (nền tảng đẩy thêm người khi phòng nóng, cài bằng thinning nên giữ số ngẫu nhiên chung);
  - dư âm sau khi gỡ ghim (nửa đời h);
  - đơn đến trễ sau cú nhấp (Gamma, trung vị 90 giây);
  - nhiều sản phẩm.
  
  Mỗi cơ chế tắt thì cho kết quả trùng từng bit bộ mô phỏng gốc (`tests/test_sim_liveroom.py`).
- **Đáp án đúng:** mỗi phiên được chạy ba lần trên cùng số ngẫu nhiên — nhánh thật, bật hết, tắt hết. "Thật" là chênh lệch tỷ lệ theo khối giữa bật hết và tắt hết, trên cùng những khối đo được.
- **Phân tích:** đúng đường phân tích tiền đăng ký — `analyze_outer`: kiểm định ngẫu nhiên hoá với thống kê chuẩn hoá, 200 lần vẽ lại, KTC 95% bằng đảo kiểm định. Burn-in 0/60/120/180 giây được phân tích lại trên **cùng** các phiên, nên so sánh giữa các burn-in là so cặp.
- **Ô:**
  - Lượt nhấp (24 ô): τ ∈ {0; 0,3} × h ∈ {0; 120; 300 giây} × khối {5; 10 phút} × β ∈ {0; 0,5}.
  - Đơn hàng (16 ô): phòng đông ×4,9, tỷ lệ nhấp ra đơn 0,08 (**giả định**), τ × trễ đơn {0; 90 giây} × khối × h ∈ {0; 120 giây}.
- **Mỗi lần lặp:** 3 phiên × 120 phút; R = 200 lần lặp mỗi ô. Sai số Monte-Carlo của một tỷ lệ quanh 5% là khoảng ±1,5 điểm phần trăm.
- **Độ giàu thiết kế** (`design_richness`, ghi trong từng tệp JSON):
  - khối 5 phút: hàng nghìn chuỗi gán mỗi phiên;
  - khối 10 phút ở phiên 120 phút: chỉ **4** chuỗi gán mỗi phiên, tức 64 phép gán cho 3 phiên, sàn p chính xác 0,031.

## Kết quả (burn-in 60 giây là mức tiền đăng ký)

| Câu hỏi | Kết quả | Ô |
|---|---|---|
| Báo nhầm khi không có tác động | 0,5–7,5% trên 12 ô lượt nhấp, trung bình 4,3%. Khối 5 phút: 4,5–6%. Khối 10 phút: trung bình 3,4%, dao động rộng hơn (0,5–7,5%) vì thiết kế chỉ có 64 phép gán, p nhỏ nhất là 0,031. Sai số Monte-Carlo ±1,5 điểm nên một ô 7,5% nằm trong dao động | `clicks_tau0_*` |
| Lực khi tác động thật +30% | **95%** với khối 5 phút; **63%** với khối 10 phút | `clicks_tau0.3_h0_b5_beta0`, `…_b10_beta0` |
| Độ phủ KTC 95% khi có tác động, không dư âm | 95,5% (khối 5 phút) | `clicks_tau0.3_h0_b5_beta0` |
| Dư âm nửa đời 2 phút | Lệch −26% (không bỏ đầu khối) → −15% (bỏ 3 phút); độ phủ 82% → 94,5% | `clicks_tau0.3_h120_b5_beta0` |
| Dư âm nửa đời 5 phút | Lệch **−46%** → −35%; độ phủ 53% → 84,5%; lực 54% → 38%. Khối 10 phút đỡ hơn: −21% → −15% | `clicks_tau0.3_h300_*` |
| Nền tảng đẩy khách (β = 0,5) | Tổng lượt nhấp tăng khoảng **+52%**, trong khi tác động theo tỷ lệ là +30%; ước lượng của LiveLift bám đúng +30% (lệch dưới 1%) | `clicks_tau0.3_h0_b5_beta0.5` |
| Đơn đến trễ, trung vị 90 giây | Lệch −35% nếu không bỏ đầu khối; −21% (60 giây), −10% (120 giây), −7% (180 giây); độ phủ 83,5% → 94% (120 giây). Lực đơn hàng chỉ 32–45% ở phòng đông, nên đơn là chỉ số phụ, lượt nhấp là chỉ số chính | `orders_tau0.3_h0_b5_d90` |

## Đọc kết quả

1. **Vùng an toàn:** khối 5 phút, phiên ≥ 90 phút (để có đủ chuỗi gán theo `design_richness`; lưới chạy ở 120 phút), dư âm ngắn hơn khoảng 1 phút. Ở đó phép thử báo nhầm đúng mức cho phép, độ phủ đúng 95%, và bắt được tác động +30% gần như mọi lần với 3 phiên.
2. **Vùng hỏng là dư âm dài.** Khi tác động còn lưu vài phút sau khi gỡ ghim, khối TẮT ngay sau khối BẬT bị "nhiễm", ước lượng **lệch về phía 0** và KTC phủ thiếu. Sai số theo hướng **bảo thủ**: LiveLift có thể bỏ sót một tác động thật, nhưng không thổi phồng. Bỏ đầu khối giúp một phần; khối dài hơn giúp nhiều hơn nhưng mất lực (và cần phiên dài hơn để có đủ chuỗi gán). Đây là lý do kế hoạch có kiểm định dư âm (Liu & Zhong 2026) trước khi chốt độ dài khối với một người bán thật.
3. **Đơn hàng cần bỏ đầu khối dài hơn lượt nhấp:** burn-in nên ≥ phân vị 80–90 của độ trễ đặt đơn (với Gamma trung vị 90 giây, hình dạng 2: P80 khoảng 160 giây, P90 khoảng 210 giây). Với 60 giây, lượt nhấp đã sạch nhưng đơn vẫn lệch −21%.
4. **Ước lượng đo tỷ lệ trên mỗi giây người xem, không đo tổng.** Khi nền tảng đẩy khách theo đà, tổng lượt nhấp tăng nhiều hơn (+52% so với +30%). Con số của LiveLift là tác động lên người đang xem, không gồm phần lưu lượng nền tảng đẩy thêm — bảo thủ so với doanh thu tổng.
5. **Khối 10 phút ở phiên 2 giờ là thiết kế yếu:** chỉ 4 chuỗi gán mỗi phiên, lực 63% và nhiều lần KTC không khép (độ phủ tính cả các lần đó là không phủ). Khối 10 phút chỉ hợp với phiên từ 180 phút.

## Giới hạn của chính mô phỏng

- Tham số thế giới (tỷ lệ nhấp, dạng đường người xem, tỷ lệ ra đơn 0,08) là **giả định** có ghi rõ, hiệu chỉnh hình dạng theo KuaiLive, không phải theo một phòng Việt Nam thật.
- Mô phỏng do chính nhóm viết, nên nó chỉ kiểm được những cơ chế nhóm đã nghĩ tới. Văn liệu cảnh báo mô phỏng người dùng bằng mô hình ngôn ngữ chỉ trùng chiều với A/B thật khoảng 77% (SimGym, tổng quan 15/10 §3.4); vì vậy bằng chứng cuối cùng phải đến từ phòng có người thật.
- Giao thoa giữa các phòng (ví dụ lưu lượng chuyển qua lại giữa nhiều phòng của cùng shop, loại giao thoa mà Farias và cộng sự 2023 đo ở Douyin, và thiết kế nhiều đơn vị của Missault và cộng sự 2025 xử lý) chưa có trong lưới này.

## Lỗi tìm ra nhờ lưới này

Bản đầu của lưới (phiên 60 phút) cho tỷ lệ báo nhầm 7–14% ở khối 10 phút. Nguyên nhân gốc nằm ở **bộ kiểm định**, không ở mô phỏng: phép gán quan sát không được đếm là hoà với chính nó do sai số làm tròn. Lỗi đã sửa, có 3 test chặn, chạy lại A/A vẫn 3,50% (7/200). Chi tiết: `docs/incident-log.md` dòng 15/10/2026. Kết quả lưới 60 phút trước bản sửa không được dùng.
