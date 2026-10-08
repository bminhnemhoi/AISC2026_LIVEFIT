# LiveLift V3 Standardized 15-Minute Test Scenarios & Catalogs

**Document ID:** `VAL-V3-SCEN-04`  
**Version:** `1.0.0-PROD`  
**Effective Date:** 2026-10-05  
**Worktree:** `/home/towfienes/Projects/v3-validation`  
**Branch:** `orca/v3-validation`  
**Target Milestone:** Milestone 2 (Baseline Specs & Test Scenario)  
**Classification:** Experimental Scenario Specification & Commercial Catalogs  
**Authoritative Sources:** `docs/roadmap/LIVELIFT_V3_MASTER_ROADMAP.md` §2, §21; `docs/validation/v3/00_VALIDATION_PROTOCOL.md` §3, §6, §7

---

## 1. Executive Summary & Design Rationale

This document specifies the two standardized, counterbalanced test scenarios and mock product catalogs used in the LiveLift V3 Product Validation Program:
1. **Scenario 1:** Cosmetics & Skincare Catalog (`CAT-COSMETICS-01`, "AuraSkin Vietnam").
2. **Scenario 2:** Fashion & Tech Accessories Catalog (`CAT-TECHFASH-02`, "UrbanPulse Studio").

### 1.1 The 1:5 Time Compression Model
To enable high-fidelity evaluation without imposing the physical and mental exhaustion of a 90-minute live broadcast, the validation protocol compresses a full live broadcast into a **standardized 15-minute operational rundown** (a 1:5 scaling ratio).

```
+----------------------------------------------------------------------------------------------------+
|                         1:5 TIME COMPRESSION ARCHITECTURAL EQUIVALENCE                             |
+------------------------------------+----------------------------------+----------------------------+
| Full 90-Minute Production Broadcast| 15-Minute Compressed Test Session| Mathematical Scaling Ratio |
+------------------------------------+----------------------------------+----------------------------+
| Total Show Runtime: 90 minutes     | Total Show Runtime: 15 minutes   | 1 : 6.0 (Nominal 1:5 scale)|
| Average Segment: 12 to 18 minutes  | Compressed Segment: 2 to 4 min   | 1 : 4.5 to 1 : 5.0         |
| Total Buffer Pool: 25 to 30 minutes| Total Buffer Pool: 5.0 minutes   | 1 : 5.0 to 1 : 6.0         |
| Hard Promotion Windows: 2 to 3     | Hard Promotion Anchors: 2        | Parity (2 Hard Anchors)    |
| Catalog Depth: 12 to 25 SKUs       | Representative Catalog: 4 SKUs   | High Pacing Density        |
| Disturbance Injections: 4 to 6     | Disturbance Injections: 5        | Maximum Stress Density     |
+------------------------------------+----------------------------------+----------------------------+
```

### 1.2 Cognitive Equivalence & Anti-Anticipation Parity
* **Difficulty Parity:** Both scenarios maintain identical cognitive workload parameters: exactly **6 segments**, exactly **2 hard promotional anchors**, exactly **5.0 minutes of reclaimable buffer**, and exactly **5 state-relative disturbances**.
* **Temporal Permutation:** To eliminate memory transfer and rehearsal bias when participants cross over between Trial 1 and Trial 2 (A→B or B→A), **Scenario 2 permutes segment sequencing, buffer distribution, and disturbance trigger placements**. An operator cannot predict disturbance timestamps in Trial 2 based on their Trial 1 experience.

---

## 2. Scenario 1: Cosmetics & Skincare Catalog (`CAT-COSMETICS-01`)

### 2.1 Narrative Context & Campaign Profile
* **Brand Name:** AuraSkin Vietnam (DNVB Skincare Brand).
* **Campaign Title:** *Mega Live: Đẹp Không Tỳ Vết — Săn Deal Giờ Vàng*.
* **Broadcast Window:** 15 minutes (00:00 to 15:00).
* **Primary ICP Focus:** Beauty & Personal Care merchant team (1 Operator behind desk, 1 On-camera Beauty Host).
* **Promotional Core:** Hero serum deep-pitch, balancing toner cross-sell buffer, platform co-funded 50% Flash Sale on Retinol Night Cream, sunscreen upsell, and scheduled golden hour close.

---

### 2.2 Scenario 1 Master Rundown Table

```
00:00       02:00                 06:00          09:00             12:00        14:00   15:00
  |-----------|---------------------|--------------|-----------------|------------|-------|
  [ 1. INTRO ]      [ 2. SERUM ]      [ 3. TONER ] [ 4. FLASH DEAL ] [ 5. NẮNG ]  [ CLOSE ]
                    ^               ^              ^                 ^            ^
                 04:30:          06:30:         09:00:00:         S4+1m15s:    14:00:00:
                 [CHAT STIMULUS] [EVAL D1]      [EVAL D2]         [INJECT D3]  [EVAL CLOSE]
                 Host stimulated 90s deficit    Did Flash start   Stockout!    End adherence
                 to pitch deep   vs Anchor 1    at 09:00:00?      Pull S5?     at 14:00:00
```

| Seq | Segment Name | SKU ID | Planned Dur | Floor Dur | Compressible | Hard Anchor | Scheduled Window | Available Buffer | Operational Role & Disturbance Site |
|:---:|---|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **1** | Mở màn & Công bố Deal | `SYS-INTRO` | **2.0m** | 1.0m | `FALSE` | `FALSE` | `00:00 - 02:00` | 0.0m | Stream kickoff; welcome viewers; announce voucher drop. |
| **2** | Hero 1: Serum Niacinamide | `SKU-SERUM` | **4.0m** | 2.0m | `TRUE` | `FALSE` | `02:00 - 06:00` | 2.0m | Deep product demo; ingredient safety; **Site for D1 Overrun**. |
| **3** | Đệm: Toner BHA Cân Bằng | `SKU-TONER` | **3.0m** | 1.0m | `TRUE` | `FALSE` | `06:00 - 09:00` | 2.0m | Intermediary cross-sell; absorbs overrun to protect Anchor 1. |
| **4** | **FLASH SALE: Kem Dưỡng Retinol**| `SKU-KEMD` | **3.0m** | 2.0m | `FALSE` | **`TRUE (09:00)`**| `09:00 - 12:00` | 0.0m | **Hard Anchor 1: 50% Flash Sale locked to 09:00:00**. (D3 site). |
| **5** | Upsell: Kem Chống Nắng | `SKU-NANG` | **2.0m** | 1.0m | `TRUE` | `FALSE` | `12:00 - 14:00` | 1.0m | Routine catalog item; **Site for D4 Pin Lag & D5 Under-run**. |
| **6** | **KẾT SHOW: Đóng Giỏ Hàng** | `SYS-CLOSE` | **1.0m** | 1.0m | `FALSE` | **`TRUE (14:00)`**| `14:00 - 15:00` | 0.0m | **Hard Anchor 2: Final broadcast cutoff & tomorrow teaser.** |

* **Total Planned Duration:** Exactly **15.0 minutes** (900 seconds).
* **Buffer Pool Calculation:**
  $$\text{Buffer}_{\text{Total}} = (4.0 - 2.0) + (3.0 - 1.0) + (2.0 - 1.0) = 2.0\text{m} + 2.0\text{m} + 1.0\text{m} = \mathbf{5.0\text{ minutes}}.$$

---

### 2.3 Scenario 1 SKU Catalog & Commercial Specifications

#### Segment 1: Opening & Voucher Reveal (`SYS-INTRO`)
* **Category:** Operational Kickoff / Broadcast Header.
* **Talking Points (VN):**
  - Chào mừng khán giả đến phiên Mega Live AuraSkin; thông báo mục tiêu phiên live.
  - Kêu gọi thả tim đạt mốc 20k tim để tung voucher 50k đầu phiên.
  - Nhắc lịch săn Deal Giờ Vàng: *Đúng 09:00 sẽ mở bán Kem Dưỡng Retinol giảm 50%*.
* **Talking Points (EN):**
  - Welcome viewers to AuraSkin Mega Live; state session roadmap.
  - Tap-to-like goal: 20k likes unlocks 50k store voucher.
  - Anchor tease: *At exactly 09:00, Retinol Night Cream drops at 50% off*.

#### Segment 2: Hero 1 — Serum Sáng Da Mờ Thâm Niacinamide 10% + HA (`SKU-SERUM`)
* **Product Code:** `SKU-SERUM-01`
* **Retail Price:** 450,000 ₫
* **Live Stream Deal Price:** **289,000 ₫** (Giảm 36%)
* **Voucher Stack:** Voucher độc quyền 30,000 ₫ (Áp dụng giỏ hàng $\ge 250,000$ ₫).
* **Initial Allocated Stock:** 120 chai.
* **Seller Center Promo ID:** `PROMO-AURA-SERUM-30K`
* **Talking Points (VN):**
  - Kết cấu lỏng nhẹ, thấm nhanh trong 10 giây, không nhờn rít.
  - Thành phần 10% Niacinamide tinh khiết kết hợp Hyaluronic Acid đa tầng; mờ thâm mụn sau 14 ngày.
  - Thử trực tiếp lên mu bàn tay; hướng dẫn kết hợp cho da dầu mụn.
* **Disturbance D1 Injection Site:** At $T = 04:30$, facilitator triggers audience question: *"Shop ơi da treatment bong tróc có xài được không, test lên da ngăm xem có vón không ạ?"* Host engages and overruns past the scheduled 06:00 mark. At $T = 06:30$ ($T_{\text{start}}(S2) + 4\text{m}30\text{s}$), host requests 1 additional minute to finish pitching (projected end $07:30$, total duration $5.5\text{m}$, overrun $+1.5\text{m}$). With S3 planned at $3.0\text{m}$, Anchor 1 (09:00:00) faces a **90-second ($1.5\text{m}$) deficit** ($07:30 + 3.0\text{m} = 10:30$). Operator recovers by compressing S3 (Toner) by $1.5\text{m}$ (down to $1.5\text{m} \ge 1.0\text{m}$ floor), pulling Anchor 1 back to exactly 09:00:00.

#### Segment 3: Pacing Buffer — Toner Cân Bằng Dịu Da BHA 1% & Centella (`SKU-TONER`)
* **Product Code:** `SKU-TONER-02`
* **Retail Price:** 320,000 ₫
* **Live Stream Deal Price:** **199,000 ₫** (Giảm 38%)
* **Combo Mechanic:** Mua kèm Serum Niacinamide giảm thêm 20,000 ₫.
* **Initial Allocated Stock:** 80 chai.
* **Seller Center Promo ID:** `PROMO-AURA-TONER-199`
* **Talking Points (VN):**
  - Làm sạch sâu lỗ chân lông nhẹ nhàng với 1% BHA dịu nhẹ và 80% chiết xuất rau má Centella.
  - Cân bằng pH ngay sau khi rửa mặt; chuẩn bị lớp nền lý tưởng để hấp thụ Serum.
  - Dung tích lớn 200ml dùng được 3 tháng.
* **Operational Buffer Flexibility:** Scheduled for 3.0m; floor is 1.0m. Can be compressed to 1.5m to absorb Serum overrun without breaching contractual floor limits.

#### Segment 4: Hard Anchor 1 — Kem Dưỡng Phục Hồi Retinol 0.5% Vi Nang (`SKU-KEMD`)
* **Product Code:** `SKU-KEMD-03`
* **Retail Price:** 590,000 ₫
* **Flash Sale Deal Price:** **295,000 ₫** (**Giảm 50% — Flash Deal Sàn Trợ Giá**)
* **Flash Window:** **09:00:00 đến 12:00:00 (Đúng 180 giây)**.
* **Initial Allocated Stock:** **50 hộp** (Hạn ngạch giới hạn).
* **Seller Center Promo ID:** `FLASH-TIKTOK-KEMD-50PCT`
* **Talking Points (VN):**
  - Công nghệ Retinol bọc vi nang giảm thiểu tối đa kích ứng; chống lão hóa, phục hồi màng ẩm ban đêm.
  - Giá sốc nhất năm: 590k giảm còn 295k, sàn TikTok trợ giá chỉ đúng 50 suất trong 3 phút.
  - Đếm ngược 5-4-3-2-1 cùng host để bấm mua; chốt đơn là giữ giá.
* **Disturbance D3 Stockout Site:** At $T_{\text{start}}(S4) + 1\text{m}15\text{s}$ ($T = 10:15$), mock console alerts stock drops to 0 units ("HẾT HÀNG"). Operator cuts S4 early (transitioning by $10:30$, actual duration $1.5\text{m}$). **Authorized Floor Exemption:** Although $1.5\text{m}$ is below S4's $2.0\text{m}$ contractual floor, abrupt inventory depletion constitutes an authorized operational exemption where pitching must cease immediately.

#### Segment 5: Upsell Item — Kem Chống Nắng Quang Phổ Rộng SPF50+ PA++++ (`SKU-NANG`)
* **Product Code:** `SKU-NANG-04`
* **Retail Price:** 380,000 ₫
* **Live Stream Deal Price:** **249,000 ₫** (Giảm 34%)
* **Gift Mechanic:** Tặng kèm túi cói du lịch AuraSkin trị giá 80,000 ₫.
* **Initial Allocated Stock:** 100 tuýp.
* **Seller Center Promo ID:** `PROMO-AURA-NANG-GIFT`
* **Talking Points (VN):**
  - Màng lọc chống nắng thế hệ mới Tinosorb M & S; nâng tone tự nhiên không để lại vệt trắng.
  - Kháng nước 80 phút; kiềm dầu cả ngày không xuống tone.
* **Disturbance Sites:** D4 (Console pin spinner freeze on S5 entry at $10:30$); D5 (Host completes talking points early at $T_{\text{start}}(S5) + 1\text{m}30\text{s}$ at $T = 12:00$, requiring host airwave hold until 14:00:00 Closing Anchor).
* **D4 Separation of Platform vs Operator Latency:** Operator dispatches pin action on time ($\le 5\text{s}$) and issues hold cue to host; the 40-second network spinner is an unavoidable native platform delay and does not penalize operator timing scores.

#### Segment 6: Hard Anchor 2 — Tổng Kết & Đóng Giỏ Hàng (`SYS-CLOSE`)
* **Category:** Operational Sign-Off / Outro.
* **Committed Wall-Clock Time:** **14:00:00**.
* **Talking Points (VN):**
  - Thông báo còn đúng 60 giây trước khi hệ thống đóng giỏ hàng và khôi phục giá gốc.
  - Hướng dẫn kiểm tra trạng thái đơn hàng; chính sách đổi trả trong 7 ngày.
  - Thông báo lịch phát sóng phiên ngày mai: *20:00 ngày mai săn voucher 100k*.

---

## 3. Scenario 2: Fashion & Tech Accessories Catalog (`CAT-TECHFASH-02`)

### 3.1 Narrative Context & Design Rationale
* **Brand Name:** UrbanPulse Studio (Gen-Z Tech & Streetwear Hub).
* **Campaign Title:** *UrbanPulse Night Drop: Công Nghệ & Thời Trang Phố*.
* **Broadcast Window:** 15 minutes (00:00 to 15:00).
* **Anti-Anticipation Permutation:** In Scenario 2, the buffer placement and disturbance order are deliberately permuted:
  - **Stockout (D3)** occurs early on **Segment 2** at $T = 03:15$ ($T_{\text{start}}(S2) + 1\text{m}45\text{s}$), with transition executing at $03:30$ ($2.0\text{m}$ actual duration, meeting floor).
  - **Overrun (D1)** occurs on **Segment 3** (which starts early at $03:30$). Audience question injected at $T = 06:00$ ($T_{\text{start}}(S3) + 2\text{m}30\text{s}$); at $T = 09:30$ ($T_{\text{start}}(S3) + 6\text{m}00\text{s}$), host signals $1\text{m}45\text{s}$ remaining time (projected end $11:15$). This surfaces an **anchor deficit of exactly 45 seconds** against Hard Anchor 1 (10:30:00). Operator recovers by wrapping S3 by 10:30:00 ($7.0\text{m}$ actual, $\ge 3.0\text{m}$ floor).
  - **Hard Anchor 1 (D2)** is locked at **10:30:00** on **Segment 4** (verbal announcement and pin dispatch scheduled for 10:30:00).
  - **Console Lag (D4)** hits Seller Center upon **Segment 4 entry** (40s network spinner; operator cues size minigame; platform delay separated from operator performance).
  - **Host Under-run (D5)** occurs on **Segment 5** at $T_{\text{start}}(S5) + 45\text{s}$ ($T = 13:15$); operator cues hold until 14:00:00 closing anchor.
  - **Closing Anchor 2** is locked at **14:00:00**.

---

### 3.2 Scenario 2 Master Permuted Rundown Table

```
00:00    01:30                03:30 (Early Pivot)             10:30:00          12:30        14:00   15:00
  |--------|--------------------|-------------------------------|-----------------|------------|-------|
  [ INTRO ][ 2. POWERBANK MAG ] [ 3. TAI NGHE ANC PRO ]         [ 4. FLASH TEE ]  [ 5. CARGO ] [ CLOSE ]
           ^                    ^                               ^                 ^            ^
        03:15:               06:00 / 09:30:                  10:30:00:         13:15:       14:00:00:
        [INJECT D3]          [INJECT D1 & EVAL DEFICIT]      [EVAL D2 & D4]    [INJECT D5]  [EVAL CLOSE]
        Stockout!            Overrun extends to 11:15        Flash Sale Anchor Under-run!   End adherence
        Pivot to S3 at 03:30 45s deficit vs 10:30 Anchor     Pin lag 40s       Hold to 14m  at 14:00:00
```

| Seq | Segment Name | SKU ID | Planned Dur | Floor Dur | Compressible | Hard Anchor | Scheduled Window | Available Buffer | Operational Role & Disturbance Site |
|:---:|---|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **1** | Mở màn & Voucher Phố | `SYS-INTRO2`| **1.5m** | 1.0m | `FALSE` | `FALSE` | `00:00 - 01:30` | 0.0m | Stream kickoff; welcome tech/streetwear audience; reveal drop roadmap. |
| **2** | Tech Hero 1: Pin Sạc MagSafe| `SKU-TECH1` | **3.5m** | 2.0m | `TRUE` | `FALSE` | `01:30 - 05:00` | 1.5m | Hero pitch; magnetic charging demo; **Site for D3 Early Stockout**. |
| **3** | Tech Hero 2: Tai Nghe ANC Pro| `SKU-TECH2` | **5.5m** | 3.0m | `TRUE` | `FALSE` | `05:00 - 10:30` | 2.5m | Extended demo; sound quality test; **Site for D1 Overrun** (absorbs early S3 start; overrun evaluated at 09:30). |
| **4** | **FLASH SALE: Áo Thun Acid Wash**| `SKU-FASH1` | **2.0m** | 2.0m | `FALSE` | **`TRUE (10:30)`**| `10:30 - 12:30` | 0.0m | **Hard Anchor 1: 50% Flash Sale locked to 10:30:00**. (D4 Pin Lag site). |
| **5** | Thời Trang: Quần Cargo Pants| `SKU-FASH2` | **1.5m** | 0.5m | `TRUE` | `FALSE` | `12:30 - 14:00` | 1.0m | Streetwear styling upsell; **Site for D5 Host Under-run**. |
| **6** | **KẾT SHOW: Đóng Giỏ & Hẹn Giờ**| `SYS-CLOSE2`| **1.0m** | 1.0m | `FALSE` | **`TRUE (14:00)`**| `14:00 - 15:00` | 0.0m | **Hard Anchor 2: Final broadcast cutoff & tomorrow teaser.** |

* **Total Planned Duration:** Exactly **15.0 minutes** ($1.5 + 3.5 + 5.5 + 2.0 + 1.5 + 1.0 = 15.0\text{m}$).
* **Buffer Pool Calculation:**
  $$\text{Buffer}_{\text{Total}} = (3.5 - 2.0) + (5.5 - 3.0) + (1.5 - 0.5) = 1.5\text{m} + 2.5\text{m} + 1.0\text{m} = \mathbf{5.0\text{ minutes}}.$$
* **Mathematical Parity Proof:** Scenario 2 provides exactly identical total buffer flexibility ($5.0\text{m}$) across 6 segments with 2 hard promotional anchors, perfectly matching Scenario 1 difficulty while completely scrambling temporal predictability.

---

### 3.3 Scenario 2 SKU Catalog & Commercial Specifications

#### Segment 1: Opening & Tech Drop Reveal (`SYS-INTRO2`)
* **Category:** Operational Kickoff / Broadcast Header.
* **Talking Points (VN):**
  - Chào mừng cộng đồng UrbanPulse; thông báo drop đồ công nghệ & streetwear hot nhất tuần.
  - Công bố mã voucher `URBAN30K` cho đơn hàng từ 300k.
  - Nhắc lịch Giờ Vàng: *Đúng 10:30:00 thả deal Áo Thun Heavyweight Acid-Wash giảm 50%*.

#### Segment 2: Tech Hero 1 — Pin Sạc Dự Phòng Không Dây MagSafe 10,000mAh (`SKU-TECH1`)
* **Product Code:** `SKU-TECH1-01`
* **Retail Price:** 650,000 ₫
* **Live Stream Deal Price:** **399,000 ₫** (Giảm 38%)
* **Initial Allocated Stock:** **40 chiếc** (Stock thấp; kích hoạt D3 sớm).
* **Seller Center Promo ID:** `PROMO-URBAN-MAGSAFE-399`
* **Talking Points (VN):**
  - Lực hút nam châm chuẩn Qi2 15W dính chặt lưng máy, không sợ rơi khi lắc mạnh.
  - Dung tích thực 10,000mAh sạc đầy 2.2 lần iPhone 15 Pro; hỗ trợ sạc có dây PD 20W.
  - Vỏ kim loại tản nhiệt cao cấp, kích thước bỏ túi nhỏ gọn.
* **Disturbance D3 Stockout Site:** At $T_{\text{start}}(S2) + 1\text{m}45\text{s}$ ($T = 03:15$), mock console indicates stock drops abruptly to 0 ("HẾT HÀNG"). Operator cues host to cut MagSafe; transition executes cleanly at $03:30$ ($2.0\text{m}$ actual duration, meeting contractual floor). Operator pulls S3 forward cleanly.

#### Segment 3: Tech Hero 2 — Tai Nghe Chống Ồn Chủ Động ANC PulsePods Pro (`SKU-TECH2`)
* **Product Code:** `SKU-TECH2-02`
* **Retail Price:** 890,000 ₫
* **Live Stream Deal Price:** **549,000 ₫** (Giảm 38%)
* **Initial Allocated Stock:** 90 chiếc.
* **Seller Center Promo ID:** `PROMO-URBAN-EARBUD-549`
* **Talking Points (VN):**
  - Chống ồn chủ động 42dB triệt tiêu tiếng còi xe, âm thanh quán cà phê; chế độ xuyên âm tự nhiên.
  - Màng loa mạ titan 12mm cho dải bass uy lực, phù hợp nhạc EDM, Hiphop.
  - Pin trâu 32 giờ kèm hộp sạc; chống nước IPX5 tập gym thoải mái.
* **Disturbance D1 Overrun Site:** S3 starts at $03:30$ following early S2 transition. At $T = 06:00$ ($T_{\text{start}}(S3) + 2\text{m}30\text{s}$), facilitator prompts host with technical queries about microphone call clarity in windy conditions. Host engages in deep demonstration. At $T = 09:30$ ($T_{\text{start}}(S3) + 6\text{m}00\text{s}$), host signals $1\text{m}45\text{s}$ remaining time (projected end $11:15$). Because Flash Sale is locked to $10:30:00$, a **45-second deficit** escalates against Anchor 1 ($11:15 - 10:30 = 0.75\text{m}$). Operator recovers by directing host to conclude S3 by $10:30:00$ (total S3 actual duration = $7.0\text{m} \ge 3.0\text{m}$ floor).

#### Segment 4: Hard Anchor 1 — Áo Thun Oversized Heavyweight 260GSM Acid Wash (`SKU-FASH1`)
* **Product Code:** `SKU-FASH1-03`
* **Retail Price:** 360,000 ₫
* **Flash Sale Deal Price:** **180,000 ₫** (**Giảm 50% — Flash Deal Sàn Trợ Giá**)
* **Flash Window:** **10:30:00 đến 12:30:00 (Đúng 120 giây)**.
* **Initial Allocated Stock:** **50 áo** (Size M / L / XL).
* **Seller Center Promo ID:** `FLASH-TIKTOK-FASH-180K`
* **Talking Points (VN):**
  - Chất vải 100% cotton định lượng 260GSM dày dặn, xử lý hiệu ứng loang Acid Wash thủ công độc bản.
  - Bo cổ dệt dày không giãn sau 50 lần giặt; form boxy rộng rãi chuẩn street style.
  - Deal trợ giá sàn đúng 180k; chỉ mở đúng 120 giây lúc 10:30:00.
* **Disturbance D4 Console Lag Site:** Injected immediately upon transition into Segment 4 at $10:30:00$. Host delivers verbal announcement on time at $10:30:00$, and operator dispatches pin in Seller Center on time. A 40-second network spinner halts the console until $11:10$. Operator mitigates with backchannel hold cue (`[HOLD: Minigame chọn size 40s trong lúc ghim]`). The 40s platform lag is recorded as an unavoidable native platform delay, distinct from operator reaction and verbal announcement adherence.

#### Segment 5: Streetwear Upsell — Quần Dài Túi Hộp Utility Cargo Pants (`SKU-FASH2`)
* **Product Code:** `SKU-FASH2-04`
* **Retail Price:** 480,000 ₫
* **Live Stream Deal Price:** **329,000 ₫** (Giảm 31%)
* **Initial Allocated Stock:** 70 chiếc.
* **Seller Center Promo ID:** `PROMO-URBAN-CARGO-329`
* **Talking Points (VN):**
  - Vải dù dệt chéo chống bám nước nhẹ, 6 túi hộp đa năng thời thượng.
  - Dây rút gấu quần tùy chỉnh ống suông hoặc jogger cá tính.
* **Disturbance D5 Under-run Site:** Injected at $T_{\text{start}}(S5) + 45\text{s}$ ($T = 13:15$). Host quickly covers points and signals readiness to conclude, opening a schedule void before the 14:00:00 closing anchor. Operator cues host to hold airwaves via voucher recap until 14:00:00 closing anchor.

#### Segment 6: Hard Anchor 2 — Tổng Kết & Đóng Giỏ Hàng (`SYS-CLOSE2`)
* **Category:** Operational Sign-Off / Outro.
* **Committed Wall-Clock Time:** **14:00:00**.
* **Talking Points (VN):**
  - Đếm ngược đóng giỏ hàng; nhắc kiểm tra địa chỉ giao hàng và áp voucher sàn.
  - Giới thiệu bộ sưu tập mùa đông sẽ lên sóng vào 20:00 tối thứ Sáu tuần này.

---

## 4. Host Cue Cheat-Sheet & On-Screen Prompt Cards (Bilingual)

To prepare participating hosts without overwhelming them with operational theory, a **1-page physical or tablet prompt card** is provided 15 minutes prior to the trial:

```
+----------------------------------------------------------------------------------------------------+
|                       AURA SKIN MEGA LIVE — BẢNG TÓM TẮT SẢN PHẨM CHO HOST                         |
+----------------------------------------------------------------------------------------------------+
| 1. MỞ MÀN (00:00 - 02:00) | Kêu gọi 20k tim mở voucher 50k | Hẹn 09:00 săn Retinol giảm 50%       |
| 2. SERUM (02:00 - 06:00)  | 289k (Gốc 450k) - Voucher 30k | Mờ thâm 14 ngày, 10% Niacinamide tinh khiết|
| 3. TONER (06:00 - 09:00)  | 199k (Gốc 320k) | Đệm làm dịu BHA 1% & Rau má, mua kèm Serum giảm 20k  |
| 4. RETINOL FLASH (09:00!) | 295k (Gốc 590k) GIẢM 50% GIỜ VÀNG | 50 suất duy nhất | Đúng 09:00 ghim |
| 5. KEM NẮNG (12:00 - 14:00)| 249k (Gốc 380k) | Tặng túi cói 80k | SPF50+ PA++++, nâng tone kiềm dầu|
| 6. KẾT SHOW (14:00!)      | Đếm ngược 60s đóng giỏ hàng | Hẹn 20:00 tối mai săn deal khủng        |
+----------------------------------------------------------------------------------------------------+
| NGUYÊN TẮC: Chú ý tín hiệu từ Vận hành:                                                            |
| - Thấy tín hiệu "CÒN 1 PHÚT" -> Tóm tắt chốt đơn.                                                  |
| - Thấy tín hiệu "CẮT CHUYỂN" -> Dừng ngay sản phẩm hiện tại, chuyển sang sản phẩm tiếp theo.      |
| - Thấy tín hiệu "GIỜ VÀNG ĐẾM NGƯỢC" -> Đếm ngược 5-4-3-2-1 cùng khán giả mở Flash Deal.           |
+----------------------------------------------------------------------------------------------------+
```

---

## 5. Experimental Catalog Setup & Initialization Runbook

### 5.1 Google Sheets Baseline Setup
1. Open template copy `LiveLift_Val_Baseline_[SubjectID]`.
2. Ensure Sheet `00_Config` parameters are initialized: `Stream_Start_Time = 20:00:00`, `Planned_Duration_Min = 15.0`.
3. Paste the assigned scenario rows (Scenario 1 or Scenario 2) into `01_Live_Rundown`.
4. Verify that formula columns (`K`, `L`, `O`, `P`, `Q`, `R`) calculate correctly and are protected (View-Only).
5. Open Zalo chat channel `#live-ops-[SubjectID]`.

### 5.2 LiveLift Console Setup
1. Launch LiveLift web application at `http://localhost:3000/live/new`.
2. Enter session metadata: Title, Brand Name, Scheduled Start Time.
3. Advance to `/prepare` view. Verify pre-loaded product pack (`CAT-COSMETICS-01` or `CAT-TECHFASH-02`).
4. Confirm segment sequence and durations match the test specification.
5. Advance to `/operate` view. Confirm NOW panel renders Segment 1 in `PENDING` state ready for start.
6. Verify fullscreen kiosk mode (`F11`) and browser `beforeunload` lock.

---

## 6. Governance Sign-Off

| Role | Name | Title | Date | Signature |
|---|---|---|---|---|
| **Lead Technical Author** | Worker 2 | Lead Technical Author (M2) | 2026-10-05 | *[Signed]* |
| **Orchestrator** | Orchestrator 1 | Lead Systems Architect | 2026-10-05 | *[Signed]* |
| **Independent Auditor** | Auditor | Quality & Forensic Gatekeeper | 2026-10-05 | *[Pending Verification]* |
