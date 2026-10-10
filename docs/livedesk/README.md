# Live Desk (SIMULATED)

Kết nối → Sản phẩm → Bắt đầu live → Live Desk → Tổng kết. The screens are Vietnamese by default (EN in the
bottom bar), Calm Studio light by default (warm dark with `T`), and run on **SIMULATED Shopee Live** in the
browser: nothing talks to Shopee. Design decisions: [`DESIGN-NOTES.md`](DESIGN-NOTES.md). Logic:
[`ARCHITECTURE.md`](ARCHITECTURE.md). Screens of every key state, both themes, 2560×1440: [`screens/`](screens/).

## Run it

From the repository root, with Node 22 and `cd next && npm ci` done once:

```sh
./start-livelift-demo        # starts the app on :3130, checks it, prints PASS and opens the Home
./stop-livelift-demo         # stops it
```

Or for development, from `next/`: `npm ci && npm run dev`, then open <http://localhost:3130/>.

The live is kept in this browser (`localStorage`, key `livelift.livedesk.SIMULATED`). To start over, end the
live and press “Chuẩn bị buổi mới”, or use “Đặt lại” on the desk to go back to second 0 of the same live.

## Keys

| Key | Does |
|---|---|
| `Space` | Run or pause the simulation clock (Live Desk) |
| `1` `2` `3` | Bắt đầu, Live Desk, Tổng kết (when they exist) |
| `J` | Data journey: six numbered badges on the desk and the side panel; `↑` `↓` step; `Esc` closes |
| `T` | Light or warm-dark theme (remembered) |
| `P` | Presenter mode: larger type, no bottom bar (remembered) |
| `?` | Key list |

## Kịch bản trình bày 90 giây

Mở Home ở 1920×1080, `F11` toàn màn hình, `P` để vào chế độ trình chiếu. Mỗi dòng là một thao tác; câu “Nói” chỉ là gợi ý.

| Giây | Làm | Nói |
|---|---|---|
| 0–10 | Home | “LiveLift đọc bình luận và giỏ hàng trong buổi live, rồi gợi ý nên ghim gì, và vì sao. Nền tảng ở đây là SIMULATED Shopee Live; không có gì gửi tới Shopee.” |
| 10–20 | `1` → **Kết nối SIMULATED Shopee Live** → **Dùng bộ sản phẩm mẫu** | “Một chạm để kết nối, rồi nạp sản phẩm. Túi vải tote chưa có giá: LiveLift ghi ‘Chưa nhập’, không coi là 0.” |
| 20–25 | **Bắt đầu live** | “Bắt đầu live. Một màn hình, một câu trả lời lớn ở giữa.” |
| 25–40 | `Space` (Chạy), chờ vài giây, rồi **+1 phút** | “Bình luận đổ về, số điện thoại bị che. Bốn ô bên phải đếm ý định trong 2 phút: hỏi giá, hỏi cỡ, chốt đơn.” |
| 40–55 | Đọc câu trả lời; bấm **Ghim …** | “Trợ lý nói tín hiệu cho thấy gì, kèm cỡ mẫu và độ tin cậy, chỉ tính từ cỡ mẫu. Người vận hành quyết định, một chạm: sản phẩm thành tấm thẻ dán băng keo, biểu đồ đánh dấu lúc ghim.” |
| 55–65 | **+5 phút** | “Flash sale: chưa đủ tín hiệu thì nó nói chưa đủ và vì sao. Vạch trên biểu đồ chỉ nói khi nào, không nói vì sao.” |
| 65–75 | `J`, `↓` vài lần, `Esc` | “Sáu việc của Data Driven Business, đặt đúng chỗ trên sản phẩm: thu thập, làm sạch, phân tích, insight, đề xuất, đánh giá.” |
| 75–90 | **Kết thúc live** → **Kết thúc và xem tổng kết** | “Tổng kết: gợi ý nào được nhận, bỏ qua, tự làm. Và điều chưa biết: ghim có làm tăng thêm giỏ không? Chưa biết, quan sát không phải nhân quả. Số đơn thật: chưa biết.” |

Nếu giám khảo hỏi “cái gì là thật”: thoát `P`, mở **Về dữ liệu này** ở thanh dưới. Ở đó có các giả định của bộ sinh
dữ liệu, luật của trợ lý, việc lệnh bỏ ghim là suy đoán, vân tay lượt chạy, và nút diễn tập sự cố nền tảng
(“Hết hạn quyền truy cập”) để cho thấy banner và cách LiveLift dừng gọi nền tảng.

Kế hoạch B: ảnh trong `screens/` (sáng và tối) theo thứ tự `01-home-empty`, `02-start-products`,
`03-desk-low-confidence`, `03-desk-suggestion`, `03-desk-pinned`, `03-desk-platform-condition`,
`03-desk-end-confirm`, `04-recap`, `05-data-journey`, `05-data-journey-stage-4`.

## Verify

From `next/` with Node 22.23.3:

```sh
npm run typecheck && npm run lint && npm test && npm run build
NODE_PATH=/path/to/playwright/node_modules AXE_PATH=/path/to/axe-core-4.13.0/axe.min.js \
  node acceptance/livedesk-browser.mjs
```

The browser harness reuses the Lab's disposable production runtime (local HTTPS). It runs the whole flow twice
at 1920×1080, 1440×900, 1280×720 and 390×844 (the second run with reduced motion): Vietnamese default, EN switch
and persistence, connect, sample pack, start, run/pause, pin/unpin/pin without confirmation, a suggestion
accepted, the data journey (six badges, panel never over the desk), dark theme, presenter mode, the end-live
confirmation, the recap (orders unknown, the accepted suggestion listed) and the ended desk. Every state is
audited with axe-core **4.13.0** (zero violations), element-level horizontal overflow, 44 px targets, SIMULATED
labels and forbidden claims in both languages; the fingerprints of the two runs must be equal. Evidence goes to
`LIVEDESK_EVIDENCE_DIR` (or a temporary directory). `--self-test` checks the assertions without a browser.

## What is real, and what is not

Everything on the desk is **SIMULATED**: viewers, comments, add-to-carts and purchases come from a seeded
generator whose assumptions are listed on screen; they never become real learning. The Copilot's rules, PII
masking, intent classification and every button are real code running on that simulated data. Only
`update_show_item` copies Shopee's published reference; unpin (`unpin_show_item`) is a guessed call and every
other call is shape inferred. Confidence comes from sample size alone. Signals suggest; they never establish a
cause. Nothing is stored outside this browser.

## WP7 verification, 2026-10-09 (Node 22.23.3)

- `npm run typecheck`, `npm run lint`: exit 0. `npm test`: **88 files passed; 1,409 passed, 57 skipped**
  (baseline 87 files, 1,381 passed, 57 skipped). `npm run build`: compiled successfully.
- `acceptance/livedesk-browser.mjs`: **PASS; 8 runs; 104 axe states; 0 failures**, axe-core 4.13.0, fingerprint
  `886c9499` in every run at 1920×1080, 1440×900, 1280×720 and 390×844. axe left `color-contrast` incomplete on
  tilted and SVG text; those pairs were checked by hand (lowest 5.28:1).
- `acceptance/lab-browser.mjs`: **PASS; 357 passed, 0 failed; 84 axe states; 0 aborted**, `9d723008` in all six
  journeys. Run from an execution copy whose only differences are an absolute import of `final-runtime.mjs` and a
  short evidence directory: inside this worktree Chromium's singleton socket path is too long to start.
- `./start-livelift-demo`: Rehearsal startup **PASS**, browser open request accepted, Home served in Vietnamese with
  `home-flow`, `truth-panel` and `loop-guide`.
- Not checked: a physical projector, a manual screen-reader pass, a low-end laptop at 60× speed.
