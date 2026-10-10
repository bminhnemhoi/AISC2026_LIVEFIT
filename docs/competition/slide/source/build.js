// Builds AISC26-0039-LiveLift_Slide.pptx. Run: node build.js
const pptxgen = require("pptxgenjs");
const path = require("path");

const BG = "F6F3EE", INK = "2A2522", SOFT = "5A5047", RUST = "9E3B2B", RULE = "D8D0C4", CHIP = "EAE3D8", VIOLET = "4F3D86", AMBER = "8A5A00", CARD = "FBF7EF", KRAFT = "C9B48A";
const FONT = "Calibri";
const img = (n) => path.join(__dirname, "img", n);

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.title = "LiveLift - AISC26-0039";
pres.author = "Nhóm LiveLift";
pres.theme = { headFontFace: FONT, bodyFontFace: FONT };

pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: BG },
  objects: [
    { text: { text: "LiveLift · AISC26-0039 · dữ liệu và ảnh minh họa là SIMULATED", options: { x: 0.7, y: 7.0, w: 9, h: 0.3, fontFace: FONT, fontSize: 10, color: SOFT, margin: 0 } } },
  ],
  slideNumber: { x: 12.1, y: 7.0, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 10, color: SOFT, align: "right" },
});
pres.defineSlideMaster({ title: "DARK", background: { color: INK } });

const T = (s, text) => s.addText(text, { x: 0.7, y: 0.5, w: 11.9, h: 1.1, fontFace: FONT, fontSize: 34, color: INK, bold: false, margin: 0, valign: "top", isTextBox: true, objectName: "Title" });
const txt = (s, text, o) => s.addText(text, Object.assign({ fontFace: FONT, color: INK, fontSize: 16, margin: 0, isTextBox: true, valign: "top" }, o));
const rule = (s, x, y, w, color) => s.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color: color || INK, width: 1 } });
const shot = (s, file, x, y, w, alt) => {
  const h = (w * 9) / 16;
  s.addShape(pres.shapes.RECTANGLE, { x: x - 0.04, y: y - 0.04, w: w + 0.08, h: h + 0.08, fill: { color: "FFFFFF" }, line: { color: RULE, width: 1 }, shadow: { type: "outer", blur: 8, offset: 2, angle: 90, color: "2A2522", opacity: 0.12 } });
  s.addImage({ path: img(file), x, y, w, h, altText: alt });
};
const tag = (s, text, x, y, w, color) => txt(s, text, { x, y, w, h: 0.3, fontSize: 12, bold: true, color: color || RUST, charSpacing: 2 });
const bullets = (s, items, o) => {
  const runs = items.map((t, i) => ({ text: t, options: { bullet: { indent: 16 }, breakLine: i < items.length - 1, paraSpaceAfter: 9 } }));
  txt(s, runs, Object.assign({ fontSize: 16 }, o));
};

// ---------- 1. Title ----------
{
  const s = pres.addSlide({ masterName: "DARK" });
  txt(s, "AISC'26 · DATA DRIVEN BUSINESS · MÃ HỒ SƠ AISC26-0039", { x: 0.8, y: 0.7, w: 9, h: 0.3, fontSize: 12, color: KRAFT, charSpacing: 3, bold: true });
  txt(s, [{ text: "Live", options: { color: "F6F3EE" } }, { text: "Lift", options: { color: "E3917A" } }], { x: 0.8, y: 1.7, w: 7, h: 1.6, fontSize: 88, fontFace: FONT, bold: false });
  txt(s, "Trợ lý quyết định cho người bán hàng livestream: biến bình luận và lượt thêm giỏ thành quyết định ghim tiếp theo, kèm lý do.", { x: 0.8, y: 3.5, w: 6.4, h: 1.4, fontSize: 22, color: "EFE6D3" });
  txt(s, "Nhóm LiveLift\nNgô Bình Minh (đội trưởng) · Lê Xuân Khánh · Ngô Lâm Tiến", { x: 0.8, y: 5.9, w: 7, h: 0.8, fontSize: 14, color: "B9B6AD" });
  // tilted paper card with tape (the signature motif)
  s.addShape(pres.shapes.RECTANGLE, { x: 8.1, y: 1.55, w: 4.5, h: 3.3, fill: { color: "FBF7EF" }, line: { color: "FBF7EF" }, rotate: -4, shadow: { type: "outer", blur: 14, offset: 4, angle: 90, color: "000000", opacity: 0.4 } });
  s.addShape(pres.shapes.RECTANGLE, { x: 9.55, y: 1.3, w: 1.5, h: 0.42, fill: { color: KRAFT, transparency: 12 }, line: { color: KRAFT, transparency: 12 }, rotate: -7 });
  txt(s, "ĐANG GHIM", { x: 8.5, y: 2.25, w: 3, h: 0.3, fontSize: 12, bold: true, color: RUST, charSpacing: 3, rotate: -4 });
  txt(s, "Nên ghim tiếp:\nQuần cargo", { x: 8.45, y: 2.65, w: 3.9, h: 1.4, fontSize: 32, color: INK, rotate: -4 });
  txt(s, "7 người hỏi giá · 8 lượt thêm giỏ · còn 9", { x: 8.35, y: 4.1, w: 4, h: 0.4, fontSize: 14, color: SOFT, rotate: -4 });
  s.addNotes("(30 giây) Chào hội đồng. Nhóm LiveLift, mã AISC26-0039. Một câu: LiveLift là trợ lý cạnh người dẫn livestream, đọc bình luận và lượt thêm giỏ để gợi ý nên ghim sản phẩm nào tiếp theo, và nói rõ vì sao.");
}

// ---------- 2. Problem ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  T(s, "Người bán livestream ghim sản phẩm bằng cảm tính");
  tag(s, "TÌNH HUỐNG MINH HỌA", 0.7, 1.9, 5);
  txt(s, "Phút 30, ghim sản phẩm B.\nPhút 35, lượt bấm vào B tăng.", { x: 0.7, y: 2.3, w: 5.4, h: 1.2, fontSize: 24 });
  txt(s, "Do lệnh ghim? Do nền tảng vừa đẩy thêm người vào phòng? Hay do người dẫn vừa kể một câu chuyện hay? Tối đó tổng kết, không ai trả lời được.", { x: 0.7, y: 3.8, w: 5.4, h: 1.6, fontSize: 16, color: SOFT });
  rule(s, 6.9, 1.9, 5.7);
  const rows = [["Bảng điều khiển của nền tảng", "cho biết phiên vừa rồi bán được bao nhiêu"], ["Bảng tính, ghi chú, chat nhóm", "ghi lại thao tác, không giải thích vì sao"], ["Cảm tính của người trợ live", "quyết định ghim gì, lúc nào, khó lặp lại"]];
  rows.forEach((r, i) => {
    const y = 2.0 + i * 1.3;
    txt(s, r[0], { x: 6.9, y, w: 5.7, h: 0.5, fontSize: 20, bold: true });
    txt(s, r[1], { x: 6.9, y: y + 0.5, w: 5.7, h: 0.6, fontSize: 16, color: SOFT });
    rule(s, 6.9, y + 1.1, 5.7, RULE);
  });
  txt(s, "Chưa có công cụ nào trả lời câu hỏi: bây giờ nên ghim gì?", { x: 0.7, y: 6.0, w: 11.9, h: 0.6, fontSize: 20, color: RUST, bold: true });
  s.addNotes("(1 phút) Đây là tình huống minh họa, không phải số liệu đo. Người bán có rất nhiều con số về phiên đã qua, nhưng không có gì giúp họ quyết định ngay lúc đang live. Đó là khoảng trống LiveLift nhắm vào.");
}

// ---------- 3. Solution & modes ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  T(s, "LiveLift: một trợ lý, ba chế độ, mỗi chế độ trả lời một câu hỏi");
  const cols = [
    ["QUAN SÁT", "Buổi live diễn ra thế nào?", "Mô tả điều đã xảy ra, gắn nhãn \"chưa kết luận nhân quả\".", "Chạy trong bản mô phỏng", VIOLET],
    ["ĐỀ XUẤT", "Bây giờ nên ghim gì?", "Xếp hạng sản phẩm và thời điểm flash sale, kèm lý do, cỡ mẫu, độ tin cậy. Người vận hành quyết định.", "Trọng tâm của buổi trình bày", RUST],
    ["THÍ NGHIỆM", "Ghim theo hệ thống có làm tăng thêm giỏ không?", "Ghim luân phiên theo khối thời gian bốc thăm trước giờ phát (switchback).", "Đang khóa: cần phiên từ 90 phút và đủ người xem", AMBER],
  ];
  cols.forEach((c, i) => {
    const x = 0.7 + i * 4.05;
    rule(s, x, 1.95, 3.75);
    tag(s, c[0], x, 2.1, 3.7, c[4]);
    txt(s, c[1], { x, y: 2.5, w: 3.7, h: 1.2, fontSize: 22 });
    txt(s, c[2], { x, y: 3.85, w: 3.7, h: 1.5, fontSize: 15, color: SOFT });
    txt(s, c[3], { x, y: 5.55, w: 3.7, h: 0.6, fontSize: 13, bold: true, color: c[4] });
  });
  txt(s, "Ghim và bỏ ghim luôn tự do: không lịch, không giới hạn, không hộp xác nhận.", { x: 0.7, y: 6.3, w: 11.9, h: 0.4, fontSize: 16, color: INK });
  s.addNotes("(1 phút) Ba chế độ đã có trong hồ sơ vòng 1. Hôm nay trọng tâm là chế độ Đề xuất, vì nó chạy được ngay và hữu ích ngay. Chế độ Thí nghiệm là nền khoa học bên dưới, đang khóa cho đến khi có phiên đủ dài và đủ người xem. Chúng em không giả vờ nó đang chạy.");
}

// ---------- 4. Live Desk suggestion ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  T(s, "Một câu trả lời lớn, kèm lý do để kiểm chứng");
  shot(s, "02-live-desk-suggestion-light.jpg", 5.15, 1.85, 7.5, "Màn Live Desk: gợi ý Nên ghim tiếp Áo hoodie zip, 7 bình luận hỏi giá, 8 lượt thêm giỏ, còn 24");
  bullets(s, ["7 người hỏi giá trong 2 phút gần nhất", "8 lượt thêm giỏ, trước đó là 3", "Còn 24 trong kho", "Độ tin cậy trung bình, dựa trên 12 sự kiện"], { x: 0.7, y: 2.0, w: 4.1, h: 2.6, fontSize: 17 });
  txt(s, "Trợ lý nói \"tín hiệu cho thấy\", không nói \"sẽ tăng doanh số\". Mức tin cậy chỉ tính từ cỡ mẫu.", { x: 0.7, y: 4.9, w: 4.1, h: 1.3, fontSize: 15, color: SOFT });
  s.addNotes("(1 phút 30) Đây là Live Desk trong bản mockup. Giữa màn hình là câu trả lời lớn nhất. Bên dưới là ba con số làm cơ sở và độ tin cậy. Người vận hành bấm Ghim hoặc Bỏ qua. Trợ lý không bao giờ tự ghim.");
}

// ---------- 5. Free pin + log ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  T(s, "Ghim, bỏ ghim tự do; mọi thao tác được ghi lại trung thực");
  shot(s, "02-live-desk-two-pins-light.jpg", 5.15, 1.85, 7.5, "Live Desk sau hai lần ghim, biểu đồ có hai vạch đánh dấu và vùng không có dữ liệu vẽ bằng sọc chéo");
  bullets(s, ["Sản phẩm đang ghim là một tấm thẻ dán băng dính, luôn ở đầu danh sách", "Biểu đồ đánh dấu lúc bạn ghim: cho biết khi nào, không chứng minh vì sao", "Khoảng không có dữ liệu vẽ bằng sọc chéo, không bao giờ là số 0"], { x: 0.7, y: 2.0, w: 4.1, h: 3.8, fontSize: 16 });
  s.addNotes("(1 phút) Người vận hành ghim bất cứ lúc nào. Mỗi lần ghim là một vạch trên biểu đồ. Quan trọng: vạch chỉ cho biết thời điểm, chúng em không nói ghim là nguyên nhân. Chỗ nào mất dữ liệu, chúng em vẽ sọc chéo thay vì điền số 0.");
}

// ---------- 6. Data journey ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  T(s, "Sáu việc của chủ đề, trên một màn hình");
  shot(s, "04-data-journey-light.jpg", 0.7, 1.75, 7.9, "Màn Hành trình dữ liệu: sáu huy hiệu đánh số trên màn Live Desk và bảng sáu bước");
  const steps = [["1", "Thu thập", "bình luận, người xem, thêm giỏ"], ["2", "Làm sạch", "che số điện thoại trước khi hiển thị và lưu"], ["3", "Phân tích", "đếm ý định trong 2 phút"], ["4", "Khai thác insight", "con số và cỡ mẫu làm lý do"], ["5", "Đề xuất giải pháp", "nên ghim gì"], ["6", "Đánh giá hiệu quả", "tổng kết: nhận, bỏ qua, điều chưa biết"]];
  steps.forEach((st, i) => {
    const y = 1.8 + i * 0.77;
    txt(s, st[0], { x: 9.0, y, w: 0.4, h: 0.5, fontSize: 24, color: RUST, bold: true });
    txt(s, [{ text: st[1], options: { bold: true, breakLine: true, fontSize: 16 } }, { text: st[2], options: { fontSize: 13, color: SOFT } }], { x: 9.5, y: y - 0.03, w: 3.2, h: 0.7 });
  });
  s.addNotes("(1 phút 30) Chủ đề yêu cầu sáu việc. Trong sản phẩm, mỗi việc có một chỗ trên màn hình. Nút Hành trình dữ liệu hiện sáu huy hiệu đánh số lên đúng phần tử thật. Em chỉ nhanh từ 1 đến 6.");
}

// ---------- 7. Data sources ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  T(s, "Dữ liệu: dùng nguồn chính thức và nói rõ cái gì là mô phỏng");
  const head = (t) => ({ text: t, options: { bold: true, color: SOFT, fontSize: 12, fontFace: FONT, border: [{ type: "none" }, { type: "none" }, { pt: 1, color: INK }, { type: "none" }] } });
  const cell = (t, o) => ({ text: t, options: Object.assign({ fontSize: 14, fontFace: FONT, color: INK, border: [{ type: "none" }, { type: "none" }, { pt: 0.75, color: RULE }, { type: "none" }], valign: "middle" }, o || {}) });
  const rows = [
    [head("NGUỒN"), head("HÔM NAY"), head("ĐIỀU KIỆN")],
    [cell("Bản demo (mô phỏng có seed)", { bold: true }), cell("Chạy được, gắn nhãn SIMULATED"), cell("Không cần tài khoản")],
    [cell("YouTube Data API (chính thức)", { bold: true }), cell("Bộ nối đã viết, chờ khóa API"), cell("Khóa API miễn phí")],
    [cell("Shopee Open Platform", { bold: true }), cell("Bộ nối và kiểm thử đã có, chưa gọi thật"), cell("Cần shop Mall hoặc Preferred, hoặc pháp nhân đối tác")],
    [cell("TikTok", { bold: true }), cell("Không có API công khai để mở live hay ghim"), cell("Người vận hành làm tay rồi báo lại")],
  ];
  s.addTable(rows, { x: 0.7, y: 1.85, w: 11.9, colW: [3.9, 4.2, 3.8], rowH: [0.4, 0.62, 0.62, 0.78, 0.78], margin: [0.05, 0.1, 0.05, 0], fill: { color: BG } });
  bullets(s, ["Bình luận qua bộ lọc thông tin cá nhân tiếng Việt trước khi hiển thị và lưu", "Chỉ dùng API chính thức cho dữ liệu đưa vào hồ sơ; không lấy dữ liệu trái điều khoản"], { x: 0.7, y: 5.3, w: 11.9, h: 1.3, fontSize: 16 });
  s.addNotes("(1 phút) Nói thẳng: bản demo dùng dữ liệu mô phỏng. Đường dữ liệu thật phụ thuộc quyền truy cập của người bán. Shopee có API nhưng cần shop hạng Mall hoặc Preferred. TikTok không có API công khai cho việc ghim, nên người vận hành làm tay rồi báo lại. Chúng em chỉ dùng nguồn chính thức.");
}

// ---------- 8. Evidence model ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  T(s, "Sáu cặp khái niệm mà hệ thống không bao giờ gộp");
  const pairs = [["Thiếu số liệu", "bằng 0"], ["Kế hoạch", "thực tế"], ["Khuyến nghị", "đã nhận, đã thực hiện"], ["Người vận hành báo", "nền tảng xác nhận"], ["Mô phỏng", "dữ liệu thật"], ["Quan sát", "nhân quả"]];
  pairs.forEach((p, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.7 + col * 6.1, y = 1.95 + row * 1.5;
    rule(s, x, y, 5.8);
    txt(s, p[0], { x, y: y + 0.2, w: 2.5, h: 0.9, fontSize: 20, bold: true, valign: "middle" });
    txt(s, "≠", { x: x + 2.55, y: y + 0.15, w: 0.6, h: 0.9, fontSize: 36, color: RUST, align: "center", valign: "middle" });
    txt(s, p[1], { x: x + 3.2, y: y + 0.2, w: 2.6, h: 0.9, fontSize: 20, valign: "middle" });
  });
  txt(s, "Mỗi cặp là một quy tắc được kiểm tra trong mã và test, không phải khẩu hiệu.", { x: 0.7, y: 6.4, w: 11.9, h: 0.4, fontSize: 15, color: SOFT });
  s.addNotes("(1 phút) Đây là điểm khác biệt. Trong livestream, rất dễ nhầm giữa không có dữ liệu và bằng không, giữa gợi ý và đã làm, giữa quan sát và nhân quả. Hệ thống tách bạch từng cặp và tự báo khi thiếu.");
}

// ---------- 9. Recap ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  T(s, "Tổng kết nói thẳng điều chưa biết");
  shot(s, "03-recap-light.jpg", 5.15, 1.85, 7.5, "Màn Tổng kết: số liệu, biểu đồ diễn biến, bảng gợi ý và bạn đã làm gì, ô Điều chưa biết");
  bullets(s, ["Bảng \"Gợi ý của trợ lý và bạn đã làm gì\": nhận, bỏ qua, tự làm", "Đơn hàng: Chưa biết, vì thêm giỏ không phải mua và bản mô phỏng không trả số đơn", "\"Ghim có làm tăng thêm giỏ không?\" Chưa biết. Cần chế độ Thí nghiệm"], { x: 0.7, y: 2.0, w: 4.1, h: 4.2, fontSize: 16 });
  s.addNotes("(1 phút) Đây là phần đánh giá hiệu quả của phiên. Chúng em liệt kê gợi ý nào được nhận, bỏ qua, hay người vận hành tự làm. Và quan trọng hơn, ô Điều chưa biết: chưa kết luận được ghim có làm tăng thêm giỏ hay không, vì người xem cũng tăng cùng lúc.");
}

// ---------- 10. Science ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  T(s, "Nền khoa học: bộ ước lượng đã kiểm chứng trên mô phỏng");
  const stats = [["3,50%", "bác bỏ giả thuyết khi không có tác động", "7/200 lần lặp, mức danh nghĩa 5%, p = 0,4168"], ["−0,84%", "lệch khi thu hồi tác động biết trước", "khoảng tin cậy phủ 37/40 lần"], ["16,4%", "tác động nhỏ nhất phát hiện được (MDE)", "ở khoảng 59 người xem đồng thời, mô phỏng"]];
  stats.forEach((st, i) => {
    const x = 0.7 + i * 4.05;
    rule(s, x, 2.0, 3.75);
    txt(s, st[0], { x, y: 2.2, w: 3.75, h: 1.2, fontSize: 60, color: INK });
    txt(s, st[1], { x, y: 3.5, w: 3.75, h: 0.8, fontSize: 16, bold: true });
    txt(s, st[2], { x, y: 4.4, w: 3.75, h: 0.8, fontSize: 14, color: SOFT });
  });
  txt(s, "Mô phỏng hiệu chỉnh theo bộ dữ liệu KuaiLive (hình dạng phân phối, không dùng mức). Kết quả chạy lại bằng một lệnh trong kho mã. Đây chưa phải kết quả trên buổi live thật.", { x: 0.7, y: 5.7, w: 11.9, h: 0.9, fontSize: 15, color: SOFT });
  s.addNotes("(1 phút 30) Phần này nhanh thôi. Bộ ước lượng của chế độ Thí nghiệm được kiểm tra bằng 200 lần mô phỏng không có tác động: bác bỏ 3,5%, gần mức 5% danh nghĩa. Thu hồi tác động biết trước lệch dưới 1%. Con số MDE 16,4% cho biết cỡ tác động nhỏ nhất phát hiện được ở khoảng 59 người xem. Tất cả là mô phỏng.");
}

// ---------- 11. Corrections ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  T(s, "Đính chính: chúng em tự sửa các số của hồ sơ vòng 1");
  const head = (t) => ({ text: t, options: { bold: true, color: SOFT, fontSize: 12, fontFace: FONT, border: [{ type: "none" }, { type: "none" }, { pt: 1, color: INK }, { type: "none" }] } });
  const cell = (t, o) => ({ text: t, options: Object.assign({ fontSize: 14, fontFace: FONT, color: INK, border: [{ type: "none" }, { type: "none" }, { pt: 0.75, color: RULE }, { type: "none" }], valign: "middle" }, o || {}) });
  const rows = [
    [head("HẠNG MỤC"), head("HỒ SƠ VÒNG 1"), head("HIỆN HÀNH")],
    [cell("Bác bỏ khi không có tác động (A/A)"), cell("4,5%; p = 0,872"), cell("3,50%; p = 0,4168", { bold: true })],
    [cell("Lệch khi thu hồi tác động biết trước"), cell("−0,3%"), cell("−0,84%", { bold: true })],
    [cell("MDE theo lượt nhấp"), cell("20,1%"), cell("16,4% (số cũ không tái lập được)", { bold: true })],
    [cell("Bộ phân loại ý định, trên chat bán hàng thật"), cell("macro-F1 0,271 (\"gán nhãn tay\")"), cell("0,211; nhãn do tác tử AI gán", { bold: true })],
    [cell("Người xem đồng thời"), cell("\"thực đo 5–15 người\""), cell("ước tính từ CPM, chưa đo", { bold: true })],
  ];
  s.addTable(rows, { x: 0.7, y: 1.85, w: 11.9, colW: [4.6, 3.3, 4.0], rowH: [0.4, 0.62, 0.62, 0.62, 0.7, 0.62], margin: [0.05, 0.1, 0.05, 0], fill: { color: BG } });
  txt(s, "Thà nói \"chưa kết luận được\" còn hơn nói một con số sai bằng giọng chắc chắn.", { x: 0.7, y: 6.0, w: 11.9, h: 0.5, fontSize: 18, color: RUST });
  s.addNotes("(1 phút) Từ hồ sơ vòng 1 đến nay, chúng em kiểm toán lại và phát hiện một số con số không tái lập được. Chúng em chủ động đính chính ngay tại đây thay vì để hội đồng phát hiện. Số mới đều chạy lại được bằng một lệnh.");
}

// ---------- 12. Limits & evaluation ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  T(s, "Chưa chứng minh được gì, và sẽ chứng minh thế nào");
  tag(s, "CHƯA CÓ", 0.7, 1.95, 5, AMBER);
  bullets(s, ["Chưa có phiên thí nghiệm switchback thật nào", "Chưa phỏng vấn người bán nào", "Nhãn ý định do AI gán, chưa có nhãn của người", "Chưa có dữ liệu thêm giỏ và đơn hàng thật nối với bình luận"], { x: 0.7, y: 2.35, w: 5.5, h: 3.4, fontSize: 16 });
  tag(s, "CÁCH ĐÁNH GIÁ SẮP TỚI", 6.9, 1.95, 5.5, RUST);
  bullets(s, ["Thử với 2 đến 3 người bán qua mentor doanh nghiệp (vòng 3)", "Đo tỷ lệ gợi ý được nhận, bỏ qua, người dùng tự làm", "Đối chiếu thêm giỏ trước và sau ghim, có khoảng tin cậy, ghi \"quan sát\"", "Đánh giá ngoại tuyến trên dữ liệu có sự đồng ý, nói rõ giới hạn"], { x: 6.9, y: 2.35, w: 5.7, h: 3.4, fontSize: 16 });
  s.addNotes("(1 phút 30) Chúng em nói rõ chưa làm được gì. Đây là phần dễ bị hỏi nhất. Chúng em chưa có buổi live thật nào và chưa phỏng vấn người bán. Kế hoạch là dùng vòng 3 có mentor doanh nghiệp để tìm 2 đến 3 người bán, và đo bằng chỉ số rõ ràng, ghi nhãn quan sát khi chưa đủ bằng chứng nhân quả.");
}

// ---------- 13. Roadmap ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  T(s, "Lộ trình đến chung kết: sản phẩm có cơ sở dữ liệu thật");
  const steps = [["14 – 25/10", "Hoàn tất vòng 2", "Slide 19/10, trình bày 22/10, poster 25/10"], ["01 – 10/11", "Vòng 3", "Poster bình chọn, mentor doanh nghiệp tư vấn, tìm người bán thử nghiệm"], ["Tháng 11", "Dựng lại sản phẩm", "Giao diện mới theo mockup, lưu vào cơ sở dữ liệu, nguồn dữ liệu chính thức"], ["Đầu tháng 12", "Chung kết", "Demo kết nối cơ sở dữ liệu, trả lời phản biện"]];
  steps.forEach((st, i) => {
    const x = 0.7 + i * 3.05;
    rule(s, x, 2.2, 2.85);
    s.addShape(pres.shapes.OVAL, { x, y: 2.05, w: 0.3, h: 0.3, fill: { color: i === 3 ? RUST : INK }, line: { color: BG, width: 2 } });
    txt(s, st[0], { x, y: 2.55, w: 2.85, h: 0.4, fontSize: 14, bold: true, color: RUST });
    txt(s, st[1], { x, y: 3.0, w: 2.85, h: 0.9, fontSize: 22 });
    txt(s, st[2], { x, y: 4.0, w: 2.85, h: 1.8, fontSize: 14, color: SOFT });
  });
  txt(s, "Chung kết chiếm 80% điểm và yêu cầu demo kết nối cơ sở dữ liệu, nên đó là việc ưu tiên số một sau hôm nay.", { x: 0.7, y: 6.1, w: 11.9, h: 0.6, fontSize: 16, color: INK });
  s.addNotes("(1 phút) Mọi thứ trong bản demo hôm nay là mockup và mô phỏng. Từ giờ đến chung kết, ưu tiên là sản phẩm thật có cơ sở dữ liệu, giao diện dựng lại theo mockup, và thử với người bán thật.");
}

// ---------- 14. Close ----------
{
  const s = pres.addSlide({ masterName: "DARK" });
  txt(s, "Cảm ơn hội đồng", { x: 0.8, y: 1.9, w: 8, h: 1.2, fontSize: 54, color: "F6F3EE" });
  txt(s, "LiveLift giúp người bán biết nên ghim gì tiếp theo, và luôn nói rõ điều gì đã biết, điều gì chưa.", { x: 0.8, y: 3.4, w: 8.2, h: 1.4, fontSize: 22, color: "EFE6D3" });
  txt(s, "Nhóm LiveLift · AISC26-0039\nNgô Bình Minh · Lê Xuân Khánh · Ngô Lâm Tiến", { x: 0.8, y: 5.6, w: 8, h: 0.9, fontSize: 14, color: "B9B6AD" });
  s.addShape(pres.shapes.RECTANGLE, { x: 9.4, y: 2.0, w: 3.2, h: 2.6, fill: { color: "FBF7EF" }, line: { color: "FBF7EF" }, rotate: 3, shadow: { type: "outer", blur: 14, offset: 4, angle: 90, color: "000000", opacity: 0.4 } });
  txt(s, "Hỏi đáp", { x: 9.7, y: 2.75, w: 2.6, h: 0.9, fontSize: 36, color: INK, rotate: 3 });
  txt(s, "5 phút", { x: 9.7, y: 3.55, w: 2.6, h: 0.5, fontSize: 16, color: SOFT, rotate: 3 });
  s.addNotes("(30 giây) Cảm ơn hội đồng. Chúng em sẵn sàng trả lời. Nếu được hỏi về dữ liệu thật: chúng em chưa có và nói thẳng điều đó; kế hoạch ở slide 12 và 13.");
}

pres.writeFile({ fileName: path.join(__dirname, "..", "AISC26-0039-LiveLift_Slide.pptx") }).then((f) => console.log("wrote", f));
