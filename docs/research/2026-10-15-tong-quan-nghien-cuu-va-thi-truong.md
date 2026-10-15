# Tổng quan nghiên cứu và thị trường cho LiveLift (bản chốt trước vòng 2)

Ngày lập: 15/10/2026. Người lập: nhóm nghiên cứu LiveLift (bản do Claude soạn, cần thành viên rà lại trước khi đưa vào slide).
Phạm vi: văn liệu học thuật về thử nghiệm switchback, giao thoa và thử nghiệm trong thương mại livestream; thị trường Trung Quốc, Việt Nam và Đông Nam Á; các đội vòng 2 AISC'26.
Tài liệu này xây tiếp trên các bản 24/08, 07/09, 11/09, 17/09 và bộ codex-gap-study, không lặp lại phần đã có.

Quy ước mức xác minh: ĐĐ là đã đọc bản gốc (toàn văn hoặc trang chính thức), TT là chỉ đọc tóm tắt hoặc trang giới thiệu, CKC là chưa kiểm chứng được.

Trạng thái soạn (15/10/2026): đủ mọi mục. Mục 4.6, 5.4 đến 5.6, 6.1 và 9.2 đến 9.4 hoàn thiện từ kết quả kiểm chứng ngày 15/10. Mục 2.7 sửa sàn p-value theo sổ sự cố cùng ngày.

## 0. Tóm tắt một trang

Năm thông điệp cho hội đồng:

1. **Câu hỏi có thật và chưa ai trả lời từ phía người bán.** Công cụ của nền tảng mô tả hành động trong phòng live bằng tương quan: 罗盘 của 抖音 ghi rõ dòng thời gian hành động dùng để *"识别动作与指标及流量变化趋势的相关性"*; TikTok báo người dùng gợi ý AI "tăng GMV lên tới 7,38%" từ dữ liệu nội bộ, không có nhóm đối chứng. Trong phạm vi tìm kiếm đến 15/10/2026, chưa thấy công bố nào dùng switchback trong một phiên livestream để đo hành động của người bán (mục 3).
2. **Phương pháp không mới, cách dùng thì mới.** Switchback đã chín (Bojinov và cộng sự 2023; Missault và cộng sự 2025 tại Amazon; 快手 dùng 时间片轮转 trong phòng live từ 2021). LiveLift đưa nó tới người không sở hữu nền tảng, ở quy mô 12 đến 24 khối mỗi phiên, với kiểm định chính xác theo Liu và Zhong (2026, v2 29/09/2026), đúng thiết kế "mỗi khối là một đoạn, bỏ m kỳ đầu" mà bài phân tích ở mục 5.
3. **Văn liệu mới nhất chỉ ra rủi ro và LiveLift đã có lớp phòng vệ.** Ở Douyin, ước lượng ngây thơ trong mô phỏng hiệu chỉnh sai dấu, khoảng −800% (Farias và cộng sự 2023); tồn kho và cạnh tranh giữa sản phẩm làm switchback lệch có dấu dự đoán được (Chen và cộng sự, EC 2026); phần thưởng của một sản phẩm sụt sau mỗi lần quảng bá (Simchi-Levi và cộng sự 2024). Đáp lại: kết quả tổng cả khối theo viewer-giây, burn-in, cân bằng, kiểm định carryover và không tiên liệu, ghi tồn kho và thời gian nghỉ của sản phẩm.
4. **Mô phỏng không thay thí nghiệm, và LiveLift dùng mô phỏng đúng chỗ.** Mô phỏng A/B tốt nhất 2026 chỉ đạt khoảng 70% đến 78% trùng chiều với thí nghiệm thật (SimGym 77%; Hut và Masoero 0,70, thấp hơn một dự báo không thông tin). LiveRoomSim chỉ dùng để kiểm hiệu chỉnh (A/A 200 lần: bác bỏ 3,50%, độ phủ 96,50%, độ lệch −0,84%) và tính lực.
5. **Nói thật về bằng chứng.** Số phiên ngẫu nhiên với người bán thật là 0; phòng xem dàn dựng là nguồn người thật đầu tiên và có lực thấp (chỉ thấy hiệu ứng cỡ một độ lệch chuẩn giữa khối với 36 khối). Radar ý định đạt macro-F1 0,542 trên chat thật với nhãn do AI gán. Thị trường Việt Nam nửa đầu 2026 khoảng 264,8 đến 291,6 nghìn tỷ đồng tùy đơn vị đo; con số "2,5 triệu phiên mỗi tháng" là ước tính năm 2024 của AccessTrade, không dùng làm sự thật và cần gỡ khỏi phần giới thiệu công khai của đội.

## 1. Câu hỏi nghiên cứu

Bốn câu hỏi dưới đây viết lại cho khớp với thiết kế trong `PREREGISTRATION.md` (switchback hai tầng, ITT cấp khối, burn-in ở tầng phân tích) và với điều kiện thật của đội tính đến 15/10/2026: chưa có phiên ngẫu nhiên nào với người bán thật; nguồn người thật đầu tiên là phòng xem dàn dựng (người xem ẩn danh, tiền ảo, khối 5 phút). Ký hiệu: phiên s, khối b = 1..B_s dài L phút, gán Z_b ∈ {0, 1} (1 là BẬT chính sách ghim), m là bậc carryover tính theo số khối.

**RQ1. Hiệu ứng của việc bật chính sách ghim trong một khối (tầng ngoài).**
Câu hỏi: trong cùng một phiên, khối được bật chính sách ghim có tạo nhiều lượt nhấp hợp lệ trên 1.000 viewer-giây hơn khối tắt không.
Đơn vị ngẫu nhiên hóa: khối thời gian trong phiên (L = 5 phút ở phòng dàn dựng; L chốt theo quy trình mục 3 của PREREGISTRATION cho phiên thật), khối đầu và cuối dài gấp đôi theo quy tắc 2m của Bojinov, Simchi-Levi và Zhao (2023).
Estimand chính: hiệu ứng trễ bậc m, τ_m = trung bình theo khối b > m của [Y_b(BẬT liên tục m+1 khối) − Y_b(TẮT liên tục m+1 khối)], với m = 0 là giả định chính (carryover ngắn hơn một khối, được xử lý bằng burn-in b = 1 phút trong mỗi khối) và m = 1 là phân tích độ nhạy. Đây là dạng estimand τ_ℓ của Missault và cộng sự (2025, mục 3.3) và "total effect" của Liu và Zhong (2026, mục 2), chỉ khác ở đơn vị là phút trong phiên.
Biến kết quả: y_b = 1.000 × lượt nhấp hợp lệ sau burn-in / viewer-giây sau burn-in (PREREGISTRATION mục 4.1); đơn hàng là biến phụ khi có nguồn đơn chính thức.
Thiết kế và suy luận: switchback cân bằng (số khối BẬT bằng số khối TẮT), ràng buộc chuyển trạng thái, xác suất gán ước lượng bằng rút lại qua chính hàm gán; kiểm định ngẫu nhiên hóa là kết luận chính, khoảng tin cậy Fisher đảo kiểm định, CUPED chỉ với hiệp biến tất định.

**RQ2. Chọn sản phẩm nào để ghim trong khối BẬT (tầng trong).**
Câu hỏi: khi đã bật, ghim sản phẩm A thay vì sản phẩm khác làm thay đổi lượt nhấp của chính sản phẩm đó và của cả khối bao nhiêu.
Đơn vị: lượt chọn sản phẩm trong khối BẬT, gán ngẫu nhiên hoặc theo chính sách π có ghi xác suất chọn.
Estimand: (a) hiệu ứng riêng sản phẩm, trung bình có trọng số nghịch đảo xác suất chọn; (b) hiệu ứng lên tổng nhấp cả khối, để phân biệt "tạo thêm" với "chuyển dịch" giữa sản phẩm (Xie, Sharma và Mehra 2025 cho thấy giữ một sản phẩm lâu hơn tăng doanh thu sản phẩm đó nhưng có thể giảm doanh thu cả phiên).
Điều kiện cần ghi trước: chính sách π đóng băng suốt đợt khẳng định; thời gian nghỉ kể từ lần ghim trước của mỗi sản phẩm được ghi làm hiệp biến, vì phần thưởng có thể "sụt rồi hồi" sau mỗi lần quảng bá (Simchi-Levi, Zheng và Zhu 2024).

**RQ3. Carryover và giao thoa từ thuật toán nền tảng.**
Câu hỏi: hiệu ứng của một lần ghim kéo dài bao lâu, và việc nền tảng đẩy thêm người xem vào phòng sau một khối tốt có làm lệch ước lượng khối kế tiếp không.
Kiểm định: thủ tục kiểm định carryover tuần tự của Liu và Zhong (2026, Procedure 4.1), chỉ cho ra cận dưới của độ dài carryover, không phải ước lượng m; kiểm định không tiên liệu (non-anticipation) làm phép thử giả dược; so τ̂ với m = 0 và m = 1 làm cờ, không làm cổng.
Mô phỏng: LiveRoomSim với cơ chế phản hồi lưu lượng (thinning) để đo độ lệch của ước lượng ngây thơ khi giao thoa có thật, theo tinh thần thí nghiệm mô phỏng hiệu chỉnh tại Douyin của Farias và cộng sự (2023).

**RQ4. Tín hiệu ý định mua từ bình luận tiếng Việt có dùng được làm biến phụ không.**
Câu hỏi: bộ phân loại ý định mua 11 lớp, chạy sau bộ lọc dữ liệu cá nhân, có đủ chính xác trên chat thật để làm biến kết quả phụ hoặc hiệp biến cho RQ1 không.
Đơn vị đánh giá: câu bình luận, chia tập theo phiên.
Thước đo: macro-F1 trên nhãn người gán độc lập (hiện mới có nhãn do tác tử AI gán: 0,870 trên mẫu do AI viết; 0,211 lên 0,542 trên chat thật). Ngưỡng dùng làm biến phụ phải đặt trước, và tỷ lệ ý định theo khối chỉ được báo cáo kèm tỷ lệ nền của phiên.

Ba câu hỏi đầu là câu hỏi nhân quả, trả lời bằng thiết kế. Câu thứ tư là câu hỏi đo lường, trả lời bằng nhãn người. Không câu nào được trả lời bằng mô phỏng đơn thuần: mô phỏng chỉ dùng để kiểm hiệu chỉnh ước lượng viên (A/A 200 lần: bác bỏ 3,50%, độ phủ khoảng tin cậy 96,50%, độ lệch −0,84%) và để tính lực kiểm định trước khi chạy.

## 2. Văn liệu lõi

Mỗi mục gồm: đóng góp, phương pháp, số liệu chính (có mục/trang), giới hạn, và hàm ý thiết kế cụ thể cho LiveLift. Thư mục của mọi bài arXiv được đối chiếu qua arXiv API, của mọi DOI qua Crossref API, ngày 15/10/2026. Toàn văn đọc qua arXiv HTML hoặc PDF (trích văn bản bằng pdftotext).

### 2.1 Missault, Masoero, Delbé, Richardson, Imbens (2025): thiết kế switchback cân bằng đều nhiều đơn vị

Thư mục: *Robust and efficient multiple-unit switchback experimentation*, arXiv 2506.12654v1, 14/06/2025. Lưu ý tên bài: "Regular Balanced Switchback Designs" (RBSD) là tên lớp thiết kế trong bài, không phải tiêu đề. Bản HTML gắn nhóm tác giả với Amazon; vai trò cụ thể của từng người chưa kiểm, và bài không nêu tên công ty trong phần ứng dụng. Mức: ĐĐ (đọc HTML, khoảng 100.000 ký tự đầu, gồm mục 1 đến 6).

Đóng góp: khi không chia được người dùng, có thể chia theo sản phẩm và theo thời gian cùng lúc. RBSD là thiết kế "đều" (mỗi đoạn thời gian một đồng xu cho mỗi sản phẩm) và "cân bằng" (mỗi sản phẩm được bật đúng pS lần, mỗi ngày bật đúng pN sản phẩm), lấy mẫu bằng loại bỏ (mục 4.2, Định nghĩa 4 đến 6).

Phương pháp: estimand trễ τ_ℓ bỏ ℓ ngày đầu làm burn-in; ước lượng Horvitz–Thompson chỉ dùng các ô mà ℓ+1 lần gán gần nhất đều bật hoặc đều tắt (mục 3.3, phương trình 4 và 5). Suy luận bằng kiểm định z, dựa vào cỡ mẫu lớn (mục 6).

Số liệu: mô phỏng bán tổng hợp (mục 5.2, Bảng 1), khi không có hiệu ứng, MSE của τ̂₁ là 0,318 với chia theo sản phẩm, 0,062 với switchback đều và 0,011 với RBSD. Khi có carryover 0,2, ước lượng không trễ τ̂ lệch khoảng −0,20 dưới switchback, bài gọi là "completely blind" với carryover. Ứng dụng thật (mục 6.1, Bảng 2): 40.581 sản phẩm, RBSD 14 ngày cho khoảng tin cậy hẹp hơn nhánh chia người dùng chạy 8 tuần (doanh thu +2,49% [0,80; 4,19] so với +0,70% [−1,34; 2,74]). Mục 6.2: 17.000 họ sản phẩm chạy RBSD cho khoảng hẹp hơn nhánh chia sản phẩm có gấp năm lần số sản phẩm và chạy gấp đôi thời gian.

Giới hạn: cần giả định không lan tỏa giữa sản phẩm (Giả định 1, bài viết "All our results rely on" giả định này); chọn sai m làm ước lượng lệch (mục 5.2); không có quy tắc chọn độ dài kỳ (mọi ứng dụng dùng kỳ một ngày với ℓ = 1).

Hàm ý cho LiveLift:
1. Cân bằng là đòn bẩy phương sai lớn nhất khi mẫu nhỏ. Bộ sinh lịch của LiveLift đã ép số khối BẬT bằng số khối TẮT và ràng buộc chuyển trạng thái; bài này là căn cứ học thuật mới nhất cho lựa chọn đó, cả về lý thuyết lẫn dữ liệu thật của một sàn lớn.
2. Ước lượng chính phải là dạng trễ (τ_ℓ), không phải hiệu đơn giản BẬT trừ TẮT. Với khối 5 phút, burn-in 1 phút trong khối tương đương ℓ = 0 khối cộng một cửa sổ bỏ trong khối; phân tích độ nhạy ℓ = 1 khối phải có sẵn trong mã.
3. Tầng trong (chọn sản phẩm) chính là bài toán "nhiều đơn vị" của RBSD: nếu sau này có nhiều sản phẩm luân phiên, có thể cân bằng theo cả hai chiều (mỗi sản phẩm được ghim số lần bằng nhau, mỗi khối BẬT ghim đúng một sản phẩm). Giả định không lan tỏa giữa sản phẩm gần như chắc chắn sai trong một phòng live (cùng một nhóm người xem), nên phải báo cáo thêm tổng nhấp cả khối (xem 2.2).

### 2.2 Chen, Bai, Zheng, Si (2025, EC 2026): thiết kế thí nghiệm cho tồn kho nhiều sản phẩm nhiều kỳ

Thư mục: *Experimental Designs for Multi-Item Multi-Period Inventory Control*, arXiv 2501.11996v4 (cập nhật 15/07/2026), ghi chú "Accepted by the 27th ACM Conference on Economics and Computation (EC '26)". Mức: ĐĐ (đọc HTML toàn bộ mục 1 đến 6).

Đóng góp: chứng minh rằng trong hệ tồn kho, cả switchback lẫn chia theo sản phẩm đều lệch, vì hai kênh giao thoa: tồn kho còn lại chuyển sang kỳ sau (carryover) và các sản phẩm tranh nhau sức chứa kho chung (mục 2.2, mục 4). Đề xuất thiết kế chia theo cặp sản phẩm và kỳ, mỗi ô sản phẩm–kỳ là một đồng xu độc lập (mục 3).

Phương pháp và số liệu: estimand là hiệu ứng toàn cục (GTE), so tất cả bật với tất cả tắt; ước lượng Horvitz–Thompson. Kết quả dấu (Bảng 1): khi can thiệp thay đổi trung bình dự báo, switchback ước lượng thấp và chia sản phẩm ước lượng cao; khi can thiệp chỉ thay đổi độ phân tán dự báo, switchback ước lượng cao còn chia sản phẩm gần không lệch. Mô phỏng dựa trên FreshRetailNet-50K, 50.000 chuỗi theo giờ của 898 cửa hàng ở 18 thành phố, có ghi nhận hết hàng (mục 5.2). Kết luận (mục 6) khuyên thận trọng với switchback trong hệ tồn kho nhiều kỳ vì carryover gây lệch hệ thống và phương sai mẫu cao.

Giới hạn: giả định thời gian giao hàng bằng 0 và mất doanh số khi hết hàng; nhu cầu phân phối đều; chân trời dữ liệu thật 7 ngày; không bàn độ dài kỳ.

Hàm ý cho LiveLift:
1. Hết hàng giữa phiên là một kênh carryover thật: nếu khối BẬT bán hết sản phẩm được ghim, khối sau (dù TẮT) bị ảnh hưởng. Giao thức phiên cần ghi tồn kho đầu phiên của từng sản phẩm trong rổ, đánh dấu khối có sản phẩm hết hàng, và báo cáo độ nhạy bỏ các khối sau thời điểm hết hàng. Đây là "liên kết với tồn kho" của LiveLift.
2. Tầng trong là phiên bản thu nhỏ của "chia theo sản phẩm": các sản phẩm tranh nhau sự chú ý của cùng người xem, tương tự tranh sức chứa kho. Vì thế ước lượng riêng sản phẩm của RQ2 có xu hướng thổi phồng; số chính phải là tổng nhấp cả khối (RQ1).
3. Bài này cũng cho câu trả lời trung thực khi hội đồng hỏi "switchback có luôn đúng không": không, và lệch có dấu dự đoán được theo cơ chế. LiveLift chọn switchback vì người bán không chia được người xem, không phải vì switchback không lệch.

### 2.3 Farias, Li, Peng, Ren, Zhang, Zheng (RecSys 2023): giao thoa trong thí nghiệm tại Douyin

Thư mục: *Correcting for Interference in Experiments: A Case Study at Douyin*, RecSys '23, trang 455–466, DOI 10.1145/3604915.3608808 (Crossref xác nhận); bản arXiv 2305.02542v1. Mức: ĐĐ (đọc toàn văn bản arXiv).

Đóng góp: ở Douyin, nhiều tính năng chỉ thử được ở phía người sáng tạo, trong khi chỉ số đo ở phía người xem. Ví dụ chính trong bài là tính năng cho người sáng tạo phát livestream độ nét cao (mục 1, mục 7.1). Người sáng tạo nhóm thí nghiệm và nhóm đối chứng tranh nhau thời gian và sự chú ý có hạn của người xem, nên ước lượng "ngây thơ" lệch cùng bậc với chính hiệu ứng (mục 4.1). Bài đề xuất ước lượng Differences-in-Qs (DQ): thay vì so phần thưởng tức thời, so giá trị dài hạn Q của hành động, nhờ đó độ lệch chỉ còn bậc hai theo độ lớn hiệu ứng (Định lý 1).

Số liệu: tóm tắt ghi DQ giảm MSE 99% so với phương án tốt nhất hiện có. Trong mô phỏng hiệu chỉnh theo dữ liệu người xem Douyin (mục 7.3): "the sign of the Naive estimator is always wrong", và sai số khoảng −800% hiệu ứng thật. Biến thể doubly robust giảm phương sai 95% so với DQ Monte Carlo (mục 6.3). Lưu ý: các số này đến từ mô phỏng, không phải thí nghiệm thực địa; bài nói đã thử DQ trên môi trường thật nhưng không công bố số.

Giới hạn: cần mô hình Markov về trạng thái người xem; số liệu công bố là mô phỏng; bối cảnh là nền tảng sở hữu toàn bộ dữ liệu người xem.

Hàm ý cho LiveLift:
1. Đây là bằng chứng mạnh nhất rằng trong livestream, "hiệu ứng tức thời dương" có thể đi cùng "hiệu ứng tổng âm" do ăn bớt sự chú ý (cannibalization). Với LiveLift, ghim sản phẩm A có thể kéo nhấp khỏi sản phẩm khác hoặc làm người xem rời phòng sớm hơn. Biến kết quả chính đã là tổng nhấp cả khối trên viewer-giây, đúng tinh thần này; cần thêm biến phụ là viewer-giây của khối kế tiếp để bắt ảnh hưởng lên "trạng thái" phòng.
2. Ý tưởng DQ cho một hướng ước lượng phụ: cộng dồn kết quả của khối b và một phần khối b+1 (cửa sổ kết quả kéo dài) để gán công cho hành động ở khối b. Hướng này chỉ nên là phân tích thăm dò cho vòng sau, vì cần mô hình trạng thái.
3. Trong LiveRoomSim, thêm kịch bản đối kháng "ghim tăng nhấp tức thời nhưng làm người xem rời sớm" để kiểm tra ước lượng viên chính có phát hiện được hiệu ứng tổng âm không.

### 2.4 Ham, Lindon, Tingley, Bojinov (Management Science 2026): dãy tin cậy dựa trên thiết kế

Thư mục: *Design-Based Confidence Sequences: A General Approach to Risk Mitigation in Panel Experiments*, Management Science, công bố trực tuyến 10/08/2026, DOI 10.1287/mnsc.2024.08235 (Crossref); bản arXiv 2210.08639v4 (20/08/2026). Mức: ĐĐ (đọc toàn văn arXiv v4).

Đóng góp: mở rộng suy luận "hợp lệ ở mọi thời điểm" (anytime-valid, cho phép xem kết quả liên tục và dừng sớm) sang thí nghiệm chuỗi thời gian, switchback và bảng (mục 1). Estimand là hiệu ứng đồng thời (contemporaneous causal effect, CTE) của Bojinov và Shephard: hiệu ứng của việc bật thêm ở kỳ t, có điều kiện trên lịch sử gán thực tế, không cần giả định gì về carryover (mục 2.2, Định nghĩa 2.1).

Phương pháp: dãy tin cậy chính xác không tiệm cận (mục 3.2, Định lý 3.2) cần biết trước cận dưới xác suất gán và cận trên của kết quả; dãy tiệm cận (mục 4.2, Định lý 4.1) bỏ được giả định cận nhưng chỉ đúng khi số kỳ lớn. Có kỹ thuật giảm phương sai bằng "proxy outcome" dùng hiệp biến (mục 5).

Số liệu: tóm tắt ghi phương pháp "would have stopped a 30,000 person Netflix experiment after the first 100 people". Mô phỏng (mục 6.1): ở kỳ t = 4, dãy tiệm cận trượt khỏi giá trị thật khoảng 2% số lần với nhiễu mũ.

Giới hạn (mục 3.2, bài tự nêu): độ rộng của dãy chính xác tỷ lệ với cận kết quả, mà cận này thường không biết trừ khi kết quả nhị phân; xác suất gán phải cố định trong khoảng đặt trước.

Hàm ý cho LiveLift:
1. Giám sát an toàn trong phiên là việc đúng, nhưng phải dùng dãy tin cậy chứ không nhìn p-value liên tục. Với 12 đến 24 khối mỗi phiên, dãy tiệm cận chưa đủ tin cậy; dùng dạng chính xác với biến bị chặn tự nhiên, ví dụ tỷ lệ khối có ít nhất một lượt nhấp, hoặc số nhấp đã cắt trần theo khối (PREREGISTRATION đã có trần 5 lượt nhấp mỗi mã băm mỗi link mỗi khối).
2. Dùng CTE làm estimand cho bảng giám sát (không cần giả định carryover), còn τ_m làm estimand cho kết luận cuối. Hai estimand phải được tách rõ trên giao diện.
3. Dãy tin cậy chỉ hiện cho người điều hành sau khi phiên kết thúc hoặc chỉ dùng cho quy tắc dừng vì hại đã viết trước, để không tạo kênh phản hồi vào lời người dẫn (đúng nguyên tắc F1 của chương trình vòng 2).

### 2.5 Simchi-Levi, Zheng, Zhu (Management Science 2024): lập kế hoạch và học khi phần thưởng hồi phục

Thư mục: *Offline Planning and Online Learning Under Recovering Rewards*, Management Science, công bố trực tuyến 03/04/2024, DOI 10.1287/mnsc.2021.04202 (Crossref). Bản arXiv 2106.14813v2, bản hội nghị ICML 2021. Mức: ĐĐ bản arXiv; bản tạp chí chỉ đọc tóm tắt Crossref.

Đóng góp: bài toán bandit trong đó mỗi kỳ được kéo tối đa K trên N "cánh tay"; phần thưởng kỳ vọng của một cánh tay sụt ngay sau khi được kéo rồi hồi dần theo thời gian nghỉ, với dạng hồi phục không tham số (chỉ giả định đơn điệu và bị chặn). Đề xuất chính sách tuần hoàn thuần (Purely Periodic Policies), mỗi sản phẩm có một chu kỳ kéo riêng; tỷ lệ xấp xỉ 1 − O(1/√K) cho bài toán biết tham số, và tích hợp UCB khi phải học.

Bối cảnh livestream (mục 1, bản arXiv): ví dụ thúc đẩy bài toán là phiên bán của KOL trên Amazon Live, Taobao Live, TikTok: mỗi phiên chọn khoảng K = 50 sản phẩm từ kho khoảng N = 500; quảng bá lại cùng sản phẩm ở kỳ ngay sau thì phần thưởng "can be much smaller than R". Kỳ ở đây là phiên hoặc ngày, không phải phút. Thực nghiệm chỉ là dữ liệu tổng hợp (mục 7).

Giới hạn: không có dữ liệu thật; không phải bài thiết kế thí nghiệm; đơn vị thời gian là phiên.

Hàm ý cho LiveLift:
1. Ở tầng trong, hiệu ứng của "ghim A" phụ thuộc thời gian kể từ lần ghim A trước. Đây là carryover cấp sản phẩm, khác carryover cấp phòng. Cần ghi biến "số khối kể từ lần ghim trước" cho mỗi sản phẩm và cân bằng nó trong lịch tầng trong (không để một sản phẩm luôn được ghim ngay sau chính nó).
2. Chính sách tầng trong mặc định của LiveLift nên có thời gian nghỉ tối thiểu cho mỗi sản phẩm, vừa hợp lý vận hành vừa giảm phương sai.
3. Bài này là trích dẫn tốt cho câu "tối ưu hóa thứ tự sản phẩm trong livestream là bài toán có thật trong tạp chí hàng đầu", trong khi LiveLift làm bước trước đó: đo hiệu ứng bằng thí nghiệm.

### 2.6 Zhang, Zhou, Jiang (Marketing Intelligence & Planning 2026): quan hệ động giữa tương tác và doanh số

Thư mục: *The relationship between consumer engagement behavior and sales performance in e-commerce live-streaming: from a dynamic perspective*, Marketing Intelligence & Planning 44(4):723–742, công bố trực tuyến 23/01/2026, DOI 10.1108/MIP-10-2024-0728 (Crossref ghi tên tác giả Zhang Bolun, Zhou Yan, Jiang Minghui). Mức: TT (chỉ đọc tóm tắt có cấu trúc trên Crossref và trang Emerald; toàn văn trả phí).

Đóng góp và phương pháp: dữ liệu theo phút thu bằng trình thu thập web trên "TikTok platform", 3.274 phiên của nhóm 100 phòng hàng đầu tháng 8 và 9/2023, sau làm sạch còn 6.945.013 nhóm dữ liệu từ 2.876 phiên; mô hình tự hồi quy vectơ dạng bảng (PVAR). Kết quả: tương tác (thích, bình luận) và doanh số tác động qua lại hai chiều, có độ trễ; bình luận ảnh hưởng mạnh và lâu hơn lên lượt thích; số người theo dõi, độ nổi tiếng và người dẫn có ảnh hưởng làm mạnh vòng tác động qua lại.

Giới hạn: dữ liệu quan sát thu bằng trình thu thập; không rõ là TikTok quốc tế hay Douyin; tóm tắt không nêu độ trễ cụ thể.

Hàm ý cho LiveLift:
1. Bình luận và doanh số là nội sinh của nhau theo phút. Vì vậy số bình luận trong khối không được dùng làm hiệp biến điều chỉnh cho kết quả cùng khối (hậu can thiệp). PREREGISTRATION đã cấm biến trễ trong phiên làm hiệp biến; bài này là căn cứ để giữ quy tắc đó.
2. Vòng phản hồi "tương tác kéo thêm người xem" chính là cơ chế phản hồi lưu lượng mà LiveRoomSim mô phỏng bằng thinning. Bài cho phép nói trong hồ sơ rằng cơ chế này có bằng chứng định lượng, không phải giả định tùy tiện, nhưng độ lớn trong mô phỏng vẫn phải coi là kịch bản.
3. Phương pháp thu thập của bài (trình thu thập web) là thứ LiveLift đã quyết định không dùng từ 17/09/2026; đây là khác biệt cần nêu khi so sánh nguồn dữ liệu.

### 2.7 Liu và Zhong (2026): kiểm định ngẫu nhiên hóa trong thí nghiệm switchback

Thư mục: *Randomization Tests in Switchback Experiments*, arXiv 2602.23257, v1 26/02/2026, **v2 29/09/2026**. Mức: ĐĐ (đọc HTML v2, mục 2 đến 8).

Đóng góp: kiểm định hợp lệ trong mẫu hữu hạn cho switchback có ít khối và có carryover, chỉ dựa vào cơ chế gán đã biết, không cần mô hình kết quả. Vì có carryover, giả thuyết "không có hiệu ứng tổng" chỉ là sắc một phần (partially sharp), nên kiểm định Fisher thông thường hoán vị mọi khối là không đúng. Cách giải: chia chuỗi thành các "đoạn" (section) đặt trước, chỉ giữ đoạn có gán không đổi, bỏ m kỳ đầu của mỗi đoạn, rồi rút lại nguyên đoạn (Procedure 3.1, Định lý 3.1). Thêm kiểm định carryover (Định nghĩa 4.1, Định lý 4.1) và kiểm định không tiên liệu (Định lý 4.3).

Chẩn đoán carryover (Procedure 4.1, Định lý 4.2): kiểm tra lần lượt các chân trời m₁ < m₂ < … ở mức α, dừng ở lần đầu không bác bỏ; các chân trời bị bác bỏ cho cận dưới của độ dài carryover. Bài nhấn mạnh lần không bác bỏ đầu tiên không phải ước lượng của m, và chọn m rồi kiểm định trên cùng dữ liệu là không được bảo đảm.

Lực kiểm định (mục 6): mỗi đoạn r khối được giữ với xác suất q^r + (1−q)^r, với q = 1/2 là 2^(1−r). Muốn bác bỏ ở mức α cần ít nhất ⌈log₂(1/α)⌉ đoạn được giữ, tức 5 đoạn ở mức 5%. Mô phỏng gọi xe (mục 7.2, Bảng 1): 300.000 yêu cầu, 300 xe; với kịch bản giả dược và m = 250, tỷ lệ bác bỏ là 0,040; 0,060; 0,052; 0,043 cho 300, 120, 60, 30 khối. Ví dụ cảnh báo: 300 khối với m quá dài cho 50 đoạn, mỗi đoạn được giữ với xác suất 1/32, xác suất ít hơn năm đoạn được giữ là 0,980.

Giới hạn: hợp lệ chỉ khi không tiên liệu và chân trời carryover khai đúng; thủ tục chọn chân trời từ dữ liệu là thăm dò.

Hàm ý cho LiveLift (quan trọng nhất trong mục này):
1. Nếu giả định chính là carryover ngắn hơn một khối (m nhỏ hơn L), mỗi khối là một đoạn, bỏ phần burn-in đầu khối, và mọi khối đều được giữ. Đây đúng là thiết kế hiện tại (khối 5 phút, burn-in 1 phút). **Sàn p-value do thiết kế quyết định, không phải do số khối** (sửa 15/10/2026, xem sổ sự cố): con số 1/C(18,9) ≈ 2,1 × 10⁻⁵ ghi trong bản trước chỉ đúng với gán ngẫu nhiên đầy đủ. Lịch của LiveLift còn ràng buộc ≥ 2 khối mỗi nhánh mỗi giai đoạn và cân bằng chuyển tiếp, nên số chuỗi gán khả dĩ mỗi phiên (đếm bằng `livelift.sim.liveroom_grid.design_richness`) là: phiên 40 phút có 2 chuỗi, phiên 60 phút có 4 chuỗi, phiên từ 90 phút trở lên có hàng nghìn chuỗi (khối 5 phút). Với khối 10 phút, phiên 60 phút chỉ còn 2 chuỗi, và phải dài 180 phút mới có hàng nghìn. Với S phiên, p chính xác hai phía không thể nhỏ hơn 2/k^S. Ví dụ: 3 phiên × 60 phút cho sàn 2/64 ≈ 0,031, chỉ đúng một cặp phép gán cực trị mới bác bỏ được. Quy tắc vận hành rút ra: **phiên thí nghiệm dài ≥ 90 phút với khối 5 phút**. Phòng dàn dựng (180 phút mỗi buổi) và bộ demo vàng (90 phút) đều thỏa.
2. Nếu phải giả định carryover một khối và ghép đoạn hai khối, mỗi đoạn chỉ được giữ với xác suất 1/2. Tính của nhóm: với 10 đoạn, xác suất có ít hơn 5 đoạn được giữ (tức không thể bác bỏ ở 5%) là khoảng 0,377; với 18 đoạn là khoảng 0,015. Kết luận cho phòng dàn dựng: một phiên 60 phút không đủ cho phân tích m = 1 khối; phải gộp ít nhất ba phiên hoặc giữ giả định m nhỏ hơn L và kiểm nó bằng kiểm định carryover.
3. Kiểm định không tiên liệu là phép thử giả dược rẻ: lịch được niêm phong trước phiên, nếu khối TẮT ngay trước khối BẬT đã có kết quả khác thì có rò rỉ (người dẫn biết lịch, hoặc nhân viên vô tình chuẩn bị).
4. Phải khai trong PREREGISTRATION trước phiên: m dùng cho kiểm định chính, ranh giới đoạn, thống kê kiểm định, lưới chân trời cho chẩn đoán. Thủ tục chọn m từ dữ liệu chỉ báo cáo như thăm dò.
5. Mục 5 của bản v2 xét đúng thiết kế của LiveLift: J khối độc lập cùng độ dài L, m nhỏ hơn L, mỗi khối là một đoạn và bỏ m kỳ đầu. Với giả thuyết yếu (hiệu ứng trung bình bằng 0, cho phép hiệu ứng khác nhau giữa khối), bài dùng thống kê chuẩn hóa (studentized) tính lại dưới mỗi lần rút, hợp lệ tiệm cận. Nhận xét 5.1: bộ ước lượng phương sai bảo thủ làm mất lực khi mức nền hoặc biến động theo mùa lớn so với hiệu ứng; trừ phần biến động giải thích bởi biến lịch định trước giúp tăng lực. Điều này khớp với lựa chọn CUPED chỉ dùng hiệp biến tất định (spline phút-vào-phiên) của LiveLift. Cách viết đúng trong hồ sơ: p-value chính xác cho giả thuyết sắc (không hiệu ứng ở mọi khối), p-value chuẩn hóa cho giả thuyết yếu (hiệu ứng trung bình bằng 0), và nói rõ cái sau chỉ hợp lệ tiệm cận.

### 2.8 Yu và cộng sự (WWW 2026 Demos): Click-to-Ask, trợ lý AI cho người dẫn

Thư mục: Ruizhi Yu, Keyang Zhong, Peng Liu, Qi Wu, Haoran Zhang, Yanhao Zhang, Chen Chen, Haonan Lu, *Click-to-Ask: An AI Live Streaming Assistant with Offline Copywriting and Online Interactive QA*, arXiv 2603.18649v1, 19/03/2026, ghi chú "Accepted at WWW2026 Demos", DOI 10.1145/3774905.3793134. Đơn vị: Đại học Sư phạm Hoa Đông, Đại học Trung Sơn, OPPO AI Center, Viện Công nghệ Tiên tiến Thâm Quyến. Mức: ĐĐ.

Đóng góp: trước phiên, hệ thống gom thông tin sản phẩm (văn bản, ảnh, PDF, âm thanh) thành dữ liệu có cấu trúc và sinh lời thoại nhiều phong cách, có bước lọc từ cấm. Trong phiên, người dẫn bấm vào câu hỏi trên màn hình, hệ thống chụp khung hình và tọa độ bấm, nhận câu hỏi và trả lời dựa trên dữ liệu sản phẩm cùng bộ nhớ sự kiện của phiên.

Số liệu: tập thử 396 cặp hỏi đáp từ dữ liệu "TikTok-style"; mô hình tốt nhất (Qwen2.5-VL 7B có gợi ý thị giác và GRPO) đạt chất lượng trả lời 0,876 và độ chính xác nhận câu hỏi 0,913, so với 0,536 và 0,512 của mô hình nền; số từ cấm trung bình mỗi bản lời thoại giảm từ 4,36 xuống 0,36. Chất lượng trả lời do GPT-4o chấm.

Giới hạn: không đo doanh số hay chuyển đổi, không có thí nghiệm A/B, không có số độ trễ; tập thử nhỏ.

Hàm ý cho LiveLift:
1. Trợ lý AI cho người dẫn đang thành hàng hóa phổ thông. LiveLift không nên cạnh tranh ở chỗ "sinh lời thoại" hay "trả lời câu hỏi"; chỗ đứng là đo xem các công cụ đó có làm bán thêm không.
2. Một ứng dụng tự nhiên: "bật trợ lý trả lời câu hỏi" có thể là một can thiệp tầng ngoài thứ hai, đo bằng đúng khung switchback. Bằng chứng có đối chứng cho thấy hỏi đáp thời gian thực có tác dụng (ISR 2026 của Liu, Wang, Yang, Wang: +25% sản phẩm bán, +86% doanh thu ở thí nghiệm thứ hai), nên đây là ứng viên can thiệp có cơ sở.
3. Chất lượng do mô hình ngôn ngữ chấm không thay được nhãn người. Cùng giới hạn này áp vào số 0,870 và 0,542 của radar ý định LiveLift (nhãn do tác tử AI gán), và phải nói ra.

### 2.9 Nền móng và các bài liên quan trực tiếp

**Bojinov, Simchi-Levi, Zhao (2023).** *Design and Analysis of Switchback Experiments*, Management Science 69(7):3759–3777, DOI 10.1287/mnsc.2022.4583; arXiv 2009.00148v4 (sửa lỗi đánh máy 17/09/2025). Mức: ĐĐ. Định lý 2 (mục 3): với carryover bậc m và T = nm, thiết kế tối ưu minimax ngẫu nhiên hóa tại {1, 2m+1, 3m+1, …, (n−2)m+1}, tức mỗi m kỳ đổi một lần, riêng đoạn đầu và cuối dài 2m. Ví dụ 7: tần suất ngẫu nhiên hóa tối ưu phụ thuộc thời lượng vật lý của carryover, không phụ thuộc độ mịn của kỳ. Ví dụ 8: thiết kế tối ưu khi m = 0 và m = 1 gần như giống nhau. Mục 4: nếu không chắc, chọn p "slightly larger than the true m as opposed to significantly smaller". Hàm ý: quy tắc khối biên 2× của LiveLift lấy từ đây; độ dài khối nên xấp xỉ thời lượng carryover vật lý; khai thừa m an toàn hơn khai thiếu.

**Hu và Wager.** *Switchback Experiments under Geometric Mixing*, arXiv 2209.00197, **v5 cập nhật 21/09/2026**. Mức: TT (tóm tắt v5). Trong hệ Markov trộn hình học, switchback thông thường có sai số giảm theo T^(−1/3) do carryover, còn có burn-in hợp lý thì đạt log(T)^(1/2)·T^(−1/2). Hàm ý: burn-in là công cụ chính thức chứ không phải mẹo; độ dài burn-in nên gắn với thời gian trộn đo từ pilot.

**Xiong, Chin, Taylor (2024).** *Data-Driven Switchback Experiments: Theoretical Tradeoffs and Empirical Bayes Designs*, arXiv 2406.06768v1. Mức: TT. Thiết kế Bayes thực nghiệm dùng dữ liệu cũ giảm MSE 33% so với thiết kế hiện hành của nền tảng gọi xe; ba lời khuyên: cân bằng theo chu kỳ, đổi ít hơn để giảm lệch carryover (đổi lấy phương sai), ngẫu nhiên hóa ranh giới khi chạy nhiều thí nghiệm song song. Hàm ý: khi có 4 đến 6 phiên pilot, chọn L bằng mô phỏng trên chính dữ liệu đó (đúng quy trình mục 3 của PREREGISTRATION).

**Zeng và cộng sự (2026).** *Sequentially-Rerandomized Switchback Experiments*, arXiv 2604.02489v1. Mức: TT. Tái ngẫu nhiên hóa từng kỳ để cân bằng biến tiên lượng từ quá khứ; biến thể phân tầng theo gán kỳ trước cho carryover bậc một. LiveLift đã áp dạng khả thi (ràng buộc chuyển trạng thái) và chủ động không áp tái ngẫu nhiên hóa theo kết quả trễ giữa mùa.

**Pankratev (2026).** arXiv 2606.03012v1 và 2606.27662v2 (cập nhật 20/08/2026). Mức: TT. Bài thứ hai so CUPED, CUPAC và doubly robust với sai số chuẩn cụm, đưa ra bản đồ chế độ; bản 17/09 của đội đã trích câu về độ phủ khoảng 82% khi có từ 10 cụm trở xuống. Hàm ý: giữ kiểm định ngẫu nhiên hóa làm kết luận chính; CUPED chỉ phụ.

**Lin và Ding (2025), Jiang và Ding (2025).** arXiv 2510.22864 (hồi quy trong khung dựa trên thiết kế cho thí nghiệm chuỗi thời gian; ước lượng phương sai HAC là bảo thủ so với phương sai thiết kế thật, vẫn đúng khi mô hình sai) và arXiv 2511.09215v3 (thiết kế bắt chéo, bình phương tối thiểu có ràng buộc). Mức: TT. Hàm ý: hồi quy có hiệp biến tất định là hợp lệ trong khung thiết kế, đúng hướng CUPED v1 của LiveLift.

### 2.10 Văn liệu mới tháng 6 đến 10/2026 có hàm ý trực tiếp

Một tác tử tìm riêng văn liệu mới (quét danh sách arXiv "switchback" và các truy vấn carryover, giao thoa, thí nghiệm nền tảng; đối chiếu qua arXiv API). Mức ghi theo từng bài.

**Thiết kế switchback:**
- **Hu (2026), *Spectral Design of Random-Duration Switchbacks*, arXiv 2609.13698v1, 12/09/2026.** Mức: ĐĐ (tóm tắt và mục 4 đến 5 qua tác tử; tóm tắt nhóm tự đọc). Cho độ dài khối ngẫu nhiên theo một quy tắc hai tốc độ phụ thuộc "tuổi" của khối; tóm tắt ghi quy tắc này *"reduces the asymptotic worst-case mean squared error by at least 32%"* so với switchback khối cố định. Thông điệp: thời lượng tối thiểu cứng làm thiết kế quá đều; nên giữ khối qua chân trời carryover rồi đổi nhanh hơn. Hàm ý: hướng cải tiến cho vòng sau, giúp tránh trùng nhịp với kịch bản người dẫn lặp mỗi N phút. Không đổi thiết kế trước phiên dàn dựng 18 đến 20/10.
- **Guo và Liang (2026), *Experimental Design When N Equals One*, arXiv 2606.28200v2.** Mức: TT (nhóm đọc tóm tắt; số liệu bảng do tác tử đọc HTML). Theo tác tử, mục 6 Bảng 2A cho thấy với xu hướng log(t) không được mô hình hóa, thiết kế đổi theo chu kỳ có MSE 1,626 so với 0,353 của thiết kế đổi ngẫu nhiên. Hàm ý: một phòng live trong một phiên chính là thí nghiệm N = 1; phiên live có xu hướng rõ (lượng người tăng rồi giảm), nên lịch phải ngẫu nhiên, không xen kẽ BẬT TẮT cố định.
- **Liu và Zhang (2026), *Analyzing Within-Subject Experiments: Identification, Testing, and Sensitivity*, arXiv 2608.26606v1.** Mức: TT. Cảnh báo: kiểm định carryover rồi mới gộp dữ liệu làm khoảng tin cậy hụt độ phủ. Hàm ý: không được làm "kiểm carryover, nếu không có thì bỏ burn-in"; m và burn-in phải chốt trước.
- **Pankratev và Arora (2026), *CUPED on Steroids*, arXiv 2608.24038; Pankratev (2026), *Power-Optimal Covariate Adjustment for Switchback Experiments*, arXiv 2607.27376.** Mức: TT. Hiệu chỉnh hiệp biến nhiều biến cho switchback, có trần giảm phương sai dạng đóng. Hàm ý: số "CUPED giảm phương sai bao nhiêu" phải đo, không lấy từ bài.
- **Ferrari-Ortiz và cộng sự (2026), switchback theo cụm cho thử giá ở LATAM Airlines, arXiv 2603.04252.** Mức: TT. Tóm tắt ghi switchback giảm sai số chuẩn tới 67%. Hàm ý: một ví dụ công nghiệp ngoài gọi xe, giúp trả lời "switchback có dùng cho bán hàng không".

**Thí nghiệm tại nền tảng và trợ lý AI:**
- Tác tử không tìm thấy bài mới năm 2025 đến 2026 của các nền tảng Trung Quốc về thiết kế thí nghiệm có giao thoa trong livestream, ngoài Min và cộng sự (arXiv 2602.08569) đã có.
- **Gu và cộng sự (RecSys 2026 Industry), xếp hạng đa mục tiêu cho livestream ở Twitch, arXiv 2608.04455.** Mức: TT. A/B trực tuyến báo +0,09% người xem hoạt động hằng ngày. Hàm ý: hiệu ứng thật trong livestream thường chỉ vài phần nghìn đến vài phần trăm; đặt kỳ vọng MDE khiêm tốn.
- **TaoLive AIGC LLM Team (2026), *TaoLive Digital Avatar Agent Technical Report*, arXiv 2608.15763v5.** Mức: ĐĐ qua tác tử. Trợ lý người dẫn số trả lời bình luận thời gian thực trên 淘宝直播; phân bố ý định bình luận trong Bảng 1: hỏi đáp sản phẩm khoảng 46%, trò chuyện khoảng 19%, hỏi lại khoảng 16%, hậu mãi khoảng 7%, khuyến mãi khoảng 4%. A/B chia người dùng 80/20 báo lượt xem trang sản phẩm trên mỗi người +0,9107% "significantly positive", không có p-value hay khoảng tin cậy. Hàm ý: phân bố ý định là tiên nghiệm tốt cho 11 lớp của radar tiếng Việt; và là ví dụ cho thấy ngay nhóm lớn cũng báo cáo thí nghiệm sơ sài, chỗ LiveLift có thể làm tốt hơn.
- **Chen (2026), *Ottilie: A Socially Intelligent Virtual Host for Sales-Driven Live Commerce*, arXiv 2605.14542v2 (28/09/2026).** Đây là bản đổi tên của VerbalValue đã có trong bản 17/09. Mức: TT.

**Hành động của người dẫn (tạp chí):**
- **Hu Jingyun (2026), *Beyond sales: Seller explanation, product availability, and returns in livestream commerce*, Journal of Retailing and Consumer Services 95, bài 105145, DOI 10.1016/j.jretconser.2026.105145.** Mức: TT (đoạn trích tìm kiếm). Giảng giải lâu hơn đi cùng tỷ lệ trả hàng thấp hơn, thời gian sản phẩm nằm trong giỏ lâu hơn đi cùng trả hàng cao hơn, cả hai đi cùng doanh số cao hơn; dữ liệu quan sát. Hàm ý: biến an toàn về trả hàng (B4 của bản 17/09) có thêm căn cứ.
- **Xu và Liang (2025), European Journal of Marketing 59(7):1774–1805, DOI 10.1108/ejm-11-2023-0863.** Mức: TT. Quan hệ chữ U ngược giữa thời lượng giới thiệu sản phẩm và hiệu quả phiên. Hàm ý: hiệu ứng của "giữ ghim lâu hơn" không đơn điệu; một thiết kế BẬT TẮT đo được điểm trung bình, không đo được điểm tối ưu.
- **Cong, Liu, Manchanda (2026), Marketing Science, DOI 10.1287/mksc.2024.1281.** Mức: TT. Cầu nhạy giá hơn trước sự kiện live so với sau. Tham khảo phụ.
- Tác tử không tìm thấy bài nhân quả (thí nghiệm, hồi quy gián đoạn hay sai biệt kép) về 福袋, đếm ngược flash sale hay phong bao trong livestream năm 2025 đến 2026.

## 3. Khoảng trống LiveLift lấp

### 3.1 Phát biểu khoảng trống (dạng dùng được trong hồ sơ)

> Trong phạm vi khảo sát của nhóm đến ngày 15/10/2026, chưa tìm thấy công bố nào dùng thiết kế switchback ngẫu nhiên theo khối thời gian **bên trong một phiên livestream bán hàng** để đo hiệu ứng của hành động người bán (ghim sản phẩm, thẻ giải thích, khuyến mãi chớp nhoáng), và chưa tìm thấy công cụ nào cho **người bán không sở hữu nền tảng** tự chạy loại thí nghiệm này.

Không viết "chưa ai làm" và không viết "đầu tiên trên thế giới". Đây là kết luận có giới hạn của một cuộc tìm kiếm, không phải chứng minh phủ định.

### 3.2 Ba nhóm công trình gần nhất và vì sao không trùng

| Nhóm | Ví dụ | Vì sao không trùng ô của LiveLift |
|---|---|---|
| Switchback đã chín ở miền khác | Bojinov và cộng sự 2023 (gọi xe), Xiong và cộng sự 2024 (gọi xe), Missault và cộng sự 2025 (sàn thương mại điện tử, đơn vị là sản phẩm × ngày), Chen và cộng sự 2025 (tồn kho), Liu và Zhong 2026 (gọi xe) | Đơn vị thời gian là giờ hoặc ngày của cả nền tảng; người chạy thí nghiệm sở hữu hệ thống |
| Thí nghiệm ngẫu nhiên trong livestream do nền tảng chạy | Wang và cộng sự, ISR 2025 (trợ lý AI cho người mua, +3,00% doanh số); He và cộng sự, MISQ 2025 (cho người dẫn xem số bán thời gian thực, khoảng +40% hàng đặt trước); Farias và cộng sự 2023 (tính năng cho người sáng tạo ở Douyin) | Ngẫu nhiên hóa theo người dùng hoặc theo người sáng tạo, từ bên trong nền tảng; người bán nhỏ không làm được |
| Nghiên cứu quan sát về đúng câu hỏi vận hành | Xie, Sharma, Mehra, POM 2025 (thời lượng giới thiệu sản phẩm); Zhang, Zhou, Jiang, MIP 2026 (tương tác và doanh số theo phút, PVAR); Meng và cộng sự, JAMS 2026 (chuyển cảm xúc, 80.600 quan sát theo phút) | Trả lời bằng dữ liệu hồi cứu, không có gán ngẫu nhiên; chính các bài này nêu vấn đề nội sinh |

Bằng chứng công nghiệp cho thấy kỹ thuật không mới: 快手 dùng 时间片轮转 cho cơ chế trong phòng live từ 2021 (bài nói DataFunTalk, không có số liệu), 美团 công bố sách trắng 随机轮转实验 năm 2025, Statsig và Eppo có tính năng switchback, Swiggy có "Time Sliced Randomized". Cái mới của LiveLift nằm ở người dùng (người bán đi thuê sân), ở quy mô (một phiên 60 đến 120 phút, 12 đến 24 khối) và ở bộ công cụ suy luận cho mẫu cực nhỏ.

### 3.3 Cách đã tìm

- Ngày 11/09/2026: nhiều truy vấn tiếng Anh, Trung, Việt (ghi trong `2026-09-11-vi-the-va-lo-trinh.md` mục 2.1).
- Ngày 17/09/2026: ba tác tử nghiên cứu, đối chiếu 24 mã arXiv và 12 DOI (ghi trong `2026-09-17-thi-truong-trung-quoc-an-do-va-bai-bao-moi.md`).
- Ngày 15/10/2026 (bản này): tìm lại trên web với các truy vấn "switchback experiment live streaming commerce product pinning randomized within session", "randomized field experiment livestream e-commerce host intervention time-varying treatment seller-side 2026"; đọc toàn văn tám bài lõi ở mục 2 và kiểm danh mục tham khảo của Liu và Zhong v2 (29/09/2026), nơi tổng hợp văn liệu switchback mới nhất: không có bài nào về livestream; một tác tử tìm riêng văn liệu tháng 6 đến 10/2026 (kết quả ở mục 3.4); một tác tử tìm riêng nguồn tiếng Trung (mục 4).
- Kết quả tìm kiếm gần nhất trả về là một bằng sáng chế Mỹ về ghim thẻ sản phẩm trong livestream nhiều người dẫn (USPTO 12393975), không có thiết kế thí nghiệm.

### 3.4 Văn liệu mới tháng 6 đến 10/2026 và vị trí của mô phỏng

Văn liệu mới về switchback được tóm ở mục 2.10; không bài nào chạm livestream. Riêng mảng mô phỏng phòng live và mô phỏng A/B bằng tác tử ngôn ngữ phát triển rất nhanh trong 2026, và đây là chỗ hội đồng dễ hỏi "sao không mô phỏng là đủ":

| Công trình | Nội dung | Kết quả kiểm định với dữ liệu thật | Mức |
|---|---|---|---|
| LiveSim, arXiv 2608.26849 (Xu, Qiao, Chen, Zhong, Ao, Cheng; 27 và 31/08/2026) | Mô phỏng người dùng trong hệ sinh thái livestream bằng nhiều tác tử; bối cảnh là **gian lận và kiểm soát rủi ro** (tài khoản mồi kéo người xem theo dõi, nhắn riêng), không phải mua hàng; dữ liệu nhật ký của một nền tảng lớn, 1.963 người dùng, 7.243 phiên | Đo độ giống phân phối hành vi (A-JSD giảm 43%), không so với thí nghiệm A/B thật | ĐĐ qua tác tử |
| SimGym, arXiv 2605.19219 (Li và 19 đồng tác giả, Shopify; 19/05/2026) | Tác tử thị giác ngôn ngữ mô phỏng người mua để thử biến thể giao diện cửa hàng | Tóm tắt: *"attaining 77% directional alignment with add-to-cart shifts observed across interface variants"*; theo tác tử đọc toàn văn, đo trên 50 cửa hàng, khoảng tin cậy 95% [66; 87], tương quan 0,55; chỉ là đổi giao diện, không phải livestream | ĐĐ (tóm tắt), toàn văn qua tác tử |
| Hut và Masoero, arXiv 2608.02345v3 (Amazon, 11/09/2026) | Khung kiểm định "tác tử AI có mô phỏng được kết quả A/B không" trên 67 thí nghiệm CTR quảng cáo lịch sử | Mục 3, Bảng 3: tỷ lệ trùng dấu 0,70, bài viết con số này *"falls below the 0.75"* của một dự báo không có thông tin; kết luận *"the baseline simulator is not yet useful for launch decisions without calibration"*; hiệu chỉnh hai pha trên 16 thí nghiệm giảm sai số bình phương khoảng 77 lần (mục 4.2) | ĐĐ |
| Benomar, Łajewska, Perelli, Mansour, arXiv 2609.01038v2 (EMNLP 2026 Industry) | Tác tử có hồ sơ người dùng mô phỏng 40 thí nghiệm widget | Độ chính xác xếp hạng cặp khoảng 0,78 | ĐĐ qua tác tử |
| Lu và cộng sự, arXiv 2503.20749v8 | Tác tử ngôn ngữ mô phỏng hành vi mua nhiều bước trên 31.865 phiên thật | Độ chính xác hành động kế tiếp 11,86% với mô hình chỉ dùng prompt | TT |
| KuaiSim, arXiv 2309.12645 (Kuaishou, NeurIPS 2023 theo tác tử) | Mô phỏng người dùng cho hệ đề xuất | Không có kiểm định với thí nghiệm thật | TT |

Ba hệ quả cho LiveLift:
1. Mô phỏng tốt nhất hiện có đạt khoảng 70% đến 78% trùng chiều hiệu ứng với thí nghiệm thật, và có nghiên cứu cho thấy thấp hơn cả một dự báo không thông tin. Vì vậy LiveRoomSim chỉ được dùng để kiểm hiệu chỉnh ước lượng viên và tính lực, đúng như đội đang làm; không được dùng để nói "ghim tăng doanh số X%".
2. Khi so LiveRoomSim với phòng dàn dựng, phải so với một mốc không thông tin (ví dụ luôn đoán "không đổi"), như Hut và Masoero làm, chứ không chỉ báo tỷ lệ trùng dấu.
3. Chưa tìm thấy mô phỏng phòng live nào có đồng thời: thời gian ở lại hiệu chỉnh từ dữ liệu thật (gồm người xem lướt qua), đơn hàng trễ, phản hồi lưu lượng và ghim nhiều sản phẩm. LiveRoomSim có thể đóng góp ở đây, với điều kiện công bố rõ cái gì được hiệu chỉnh từ KuaiLive và cái gì là giả định.

### 3.5 Những khoảng trống phụ cũng có thật

1. **Dữ liệu:** chưa tìm thấy dataset công khai có chuỗi số liệu theo phút trong phiên kèm lịch can thiệp. KuaiLive (SIGIR 2026) có tương tác theo thời gian thực nhưng không có dữ liệu mua và không có can thiệp; LSEC (2021) có hành vi mua nhưng không có lịch can thiệp.
2. **Tiếng Việt:** chưa tìm thấy công bố hay dataset công khai về phân loại ý định mua trong chat livestream tiếng Việt; các bài tiếng Việt về ý định mua qua TikTok live tìm được đều là khảo sát bảng hỏi và mô hình cấu trúc. Chuỗi nhiệm vụ chung VLSP 2025 (11 nhiệm vụ) và VLSP 2026 (8 nhiệm vụ, hội thảo 15/11/2026) không có nhiệm vụ nào về thương mại điện tử, bình luận hay dữ liệu cá nhân (tác tử đọc trang chính thức vlsp.org.vn). Tài nguyên gần nhất có thể dùng: ViSoBERT, ViSoLex, ViGoEmotions (mạng xã hội nói chung); ViDia2Std (arXiv 2603.10211, AAAI-26) với hơn 13.000 cặp câu phương ngữ sang chuẩn từ bình luận Facebook của 63 tỉnh, hữu ích cho chuẩn hóa bình luận; ViTOED (arXiv 2608.12776, MAPR 2026) với 10.985 bình luận gán bộ bốn ý kiến; CSConDa (Findings of EACL 2026) với hơn 9.000 cặp hỏi đáp chăm sóc khách hàng thật. Mức: TT.
3. **Kiểm định cho mẫu cực nhỏ trong live:** văn liệu switchback mới nhất (Liu và Zhong 2026) có công cụ, nhưng chưa có ai áp vào bối cảnh 12 đến 24 khối của một phiên live. LiveLift là nơi áp dụng, không phải nơi phát minh công cụ.

## 4. Trung Quốc

Phần này bổ sung cho mục 1 của bản 17/09/2026 (quy mô theo 网经社, 店播 50% dịp 618/2025, 《直播电商监督管理办法》 hiệu lực 01/02/2026, API 视频号 và 千川, án lệ 小葫芦 và 蝉小红, bằng chứng có đối chứng về AI). Không lặp lại các ý đó. Trang 抖音电商学习中心 (school.jinritemai.com) hiển thị bằng JavaScript; nhóm dựng trang bằng trình duyệt không giao diện để đọc nguyên văn. Mọi URL truy cập 15/10/2026.

### 4.1 Sách trắng 2025 của Trung tâm nghiên cứu phát triển Tổng cục Quản lý thị trường và Viện Chiến lược tài chính kinh tế, Viện Khoa học xã hội Trung Quốc

Tên đúng: 《2025直播电商行业发展白皮书》 (không phải "báo cáo phát triển chất lượng cao"; báo cáo 《直播电商高质量发展报告（2024）》 là của một viện khác). Bản xem trước công bố 26/06/2025 với số 2024; bản đầy đủ với số 2025 được báo chí đưa tin từ 04/02/2026. Câu mở đầu theo bản đăng lại của Sở Thương mại Phúc Kiến: *"由市场监管总局发展研究中心、中国社会科学院财经战略研究院课题组联合完成的《2025直播电商行业发展白皮书》…正式发布"* (https://swt.fujian.gov.cn/xxgk/jgzn/jgcs/sctxjsc/gzdt_386/202602/t20260228_7103174.htm, ĐĐ; đối chiếu 新华网 04/02/2026 http://www.news.cn/tech/20260204/61e8566bf2214265969471d0f9d976c3/c.html).

| Chỉ số (2025 trừ khi ghi khác) | Nguyên văn | Ý nghĩa cho LiveLift |
|---|---|---|
| Quy mô | *"直播电商GMV（商品交易总额）超5万亿元"*, *"占网络零售额近三分之一"* | Bối cảnh quy mô; lệch với số 69.461 亿 của 网经社 trong bản 17/09 vì khác phạm vi đo, ghi cả hai nếu dùng |
| Người dùng | *"行业用户规模预计达6.6亿"* | Bối cảnh |
| Cơ cấu | *"店播GMV占比超过50%"*; *"头部主播带动GMV占比下降至10.66%"*, *"中小主播提升至89.34%"* | Củng cố định vị khách hàng là shop tự phát và người dẫn vừa và nhỏ |
| Khiếu nại | *"投诉举报数量增幅从2023年的52.5%收窄至2024年的19.3%"* | Môi trường đang được siết, công cụ minh bạch có chỗ đứng |
| Doanh nghiệp | *"国内现存直播相关企业256.96万家"* | Bối cảnh |

Các câu về AI và người dẫn ảo (*"AI主播与虚拟人可以实现24小时直播，降低人力成本"*, *"但目前虚拟主播在直播领域的应用尚不够成熟"*) xuất hiện trong bài của 人民日报海外版 ngày 20/03/2026 viết về sách trắng (bản đăng lại https://finance.sina.cn/stock/jdts/2026-03-20/detail-inhrqtzi6926324.d.html, ĐĐ), nhưng chưa phân biệt được câu nào lấy từ sách trắng, câu nào là ý kiến chuyên gia trong bài. Không trích như lời sách trắng.

### 4.2 Công cụ chính chủ của 抖音: ghim, giảng giải, phân rã GMV

**Thẻ giảng giải (讲解卡) và ghim.** Hướng dẫn chính thức (https://school.jinritemai.com/doudian/web/articlev0/102057, ĐĐ): bấm "讲解" thì người xem thấy thẻ giảng giải; *"讲解卡展示一段时间后会自动消失，如果希望持续出现，再次点击“讲解”按钮即可"*. Bàn điều khiển di động (23/06/2023, https://school.jinritemai.com/doudian/web/articlev0/aHpasRTJBvgF, ĐĐ) cho xem số liệu *"近5分钟/整场累计"*, gắn nhãn sản phẩm tiềm năng (giao dịch cao, chuyển đổi cao, nhấp cao) và cho phép *"【置顶】"* (ghim lên đầu). Với người dẫn hạng L3 trở lên, nhãn dựa trên *"近10分钟结果统计"*.

**Dữ liệu giảng giải theo phút.** FAQ 罗盘 (15/12/2023, https://school.jinritemai.com/doudian/web/articlev0/aHyVTUvYbCBv, ĐĐ): *"累计成交金额是按分钟级别累计的"*; *"目前罗盘暂不提供下钻到秒级别的统计数据"*; *"结束一次讲解后，要过10秒再开始下一次讲解，否则讲解数据会被合并"*; trong điều kiện bất thường (*"使用第三方软件自动点击"*) điểm đánh dấu giảng giải có thể mất. Bài học: nhật ký ghim phải do chính người bán ghi (LiveLift đã có `exposure_event`), không dựa vào điểm đánh dấu của nền tảng; độ phân giải phút là trần dữ liệu chính chủ.

**Công thức vàng của 罗盘** (08/06/2023, https://school.jinritemai.com/doudian/web/articlev0/aHSMTiukjMnW, ĐĐ): *"直播间黄金公式：成交金额=单位小时曝光次数*直播时长*曝光-观看率（次数）*千次观看成交金额 / 1000"*. Cùng trang có dòng thời gian hành động: *"记录直播期间违规、上架、讲解、福袋、发券、秒杀、主播的直播间动作明细，识别动作与指标及流量变化趋势的相关性"*. Chữ then chốt là **相关性** (tương quan). Nền tảng lớn nhất Trung Quốc tự mô tả công cụ chẩn đoán hành động là đo tương quan; đây là trích dẫn tốt nhất cho khoảng trống "chẩn đoán bằng phễu, kết luận bằng thí nghiệm". Định nghĩa chỉ số chính thức (https://school.jinritemai.com/doudian/web/articlev0/104021, ĐĐ) tính phễu vào phòng, hiển thị sản phẩm, nhấp, tạo đơn, thành đơn; "五维四率" là khung của người làm nghề, không phải tên chính thức.

### 4.3 千川·乘方 và 智投星: tự động hóa quảng cáo, không phải quyết định trong phòng

千川·乘方 ra mắt 11/12/2025 tại hội nghị 千川 ở Thượng Hải (环球网 qua 腾讯新闻 https://news.qq.com/rain/a/20251211A06Y8X00 ; 新华财经 qua 新浪 https://finance.sina.com.cn/jjxw/2025-12-15/doc-inhavwnp4307756.shtml, ĐĐ). Ba năng lực *"策略托管、动态智能服务、精准推荐"*: đặt tổng ngân sách và ROI mục tiêu thì *"系统即可自动完成预算分配、出价调控及选品匹配"*; module 千意 tự sinh tư liệu quảng cáo (*"每日可自动生成100万—200万条"*, số do nhà cung cấp tự nêu); tác tử 智投星 *"可实时诊断经营问题并输出解决方案"*; trợ lý AI đưa *"为素材优化及直播间运营提供个性化建议"*. Từ 2026, đơn từ 乘方 được giảm phí dịch vụ kỹ thuật xuống 0,6% (亿邦动力 09/01/2026 https://news.qq.com/rain/a/20260109A055QB00, ĐĐ). 智投星 không ra đời tháng 12/2025: đó là trợ lý quảng cáo có từ trước, được gộp vào 乘方; bản nâng cấp được đưa tin 24/07/2026 (https://www.163.com/dy/article/L2K4B3BA05562ISM.html, ĐĐ).

Đọc cho LiveLift: 乘方 tự động hóa chi tiêu quảng cáo và đưa "gợi ý" vận hành phòng, không ngẫu nhiên hóa và không đo tác động của quyết định trong phòng. Một hệ quả thiết kế: nếu người bán bật đặt giá thầu tự động trong phiên thí nghiệm, lưu lượng có thể phản ứng theo khối. Giao thức phiên phải khai báo trước và giữ nguyên thiết lập quảng cáo suốt phiên (đúng việc A6 trong bản 17/09).

### 4.4 AI của 淘宝直播, 快手, 京东: số của nhà cung cấp

Tất cả số dưới đây là số công ty tự công bố, không có nhóm đối chứng được mô tả.

- **淘宝直播** (南方都市报 09/04/2026 qua 腾讯新闻 https://news.qq.com/rain/a/20260409A0696C00, ĐĐ): công cụ AI *"已覆盖60万的主播，主播人效提升20%"*; "直播AI大脑" *"持续实时监控流量变化、商品转化的情况、弹幕评论等，并且直接给出建议"*; và *"测试数据表明通过讲解的分发，可以帮助主播额外带来将近20%的成交增量"* (phân phối đoạn giảng giải sản phẩm vào tìm kiếm và đề xuất; không nêu thiết kế thử nghiệm).
- **快手**: báo cáo quý 4 và cả năm 2025 (25/03/2026, https://www.prnewswire.com/apac/news-releases/kuaishou-technology-announces-fourth-quarter-and-full-year-2025-financial-results-302724632.html, ĐĐ) ghi tổng GMV thương mại điện tử *"RMB1,598.1 billion, representing an increase of 15.0%"*, chi tiêu marketing dựa trên tư liệu AIGC quý 4 *"reached RMB4.0 billion"*, có giải pháp người dẫn số. Quy định 2024 của 快手 với người dẫn số: *"快手不会再给予额外的电商流量"* (电商派 25/06/2024 https://www.pai.com.cn/p/01j15agffj1br7gtr4214vzn7v, ĐĐ).
- **京东 言犀**: *"言犀数字人直播成本仅为真人成本的1/10"*, *"带动GMV超百亿"* (lời phụ trách mảng, 19/06/2024, https://m.163.com/dy/article/J51VJDDE05118HJE.html, ĐĐ). Sách trắng người dẫn số 2026 của 京东 và 艾瑞 (23/04/2026) không có số so sánh có đối chứng.

Đối chiếu với bằng chứng có đối chứng: ISR 2026 (Liu, Wang, Yang, Wang) cho thấy người dẫn số không tăng doanh số đáng kể so với không phát live, trừ khi có hỏi đáp thời gian thực. Khoảng cách giữa "số nhà cung cấp" và "số có đối chứng" chính là thị trường cho đo lường độc lập.

### 4.5 Quy định về nội dung do AI tạo và người dẫn số

| Văn bản | Điểm chính (nguyên văn) | Hiệu lực | Nguồn | Mức |
|---|---|---|---|---|
| 《人工智能生成合成内容标识办法》 (国信办通字〔2025〕2号; 网信办, 工信部, 公安部, 广电总局) | Điều 3: phân biệt *"显式标识"* (người dùng nhận biết được) và *"隐式标识"* (trong siêu dữ liệu tệp). Điều 4: với cảnh ảo, *"在起始画面的适当位置添加显著的提示标识"*. Điều 5: siêu dữ liệu gồm thuộc tính nội dung, tên hoặc mã nhà cung cấp, số hiệu nội dung | *"本办法自2025年9月1日起施行"* (Điều 14) | https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm | ĐĐ |
| Tiêu chuẩn quốc gia bắt buộc GB 45438-2025 về phương pháp gắn nhãn nội dung AI | Đi kèm văn bản trên | Thực hiện 01/09/2025 | Nguồn thứ cấp; chưa mở văn bản tiêu chuẩn | TT |
| 《直播电商监督管理办法》 (Lệnh 117), Điều 37 | Dùng hình ảnh, video người do AI tạo để bán hàng phải gắn nhãn và *"持续向消费者提示该人物图像、视频由人工智能等技术生成"*; người vận hành phòng chịu trách nhiệm | *"本办法自2026年2月1日起施行"* (Điều 69) | https://www.gov.cn/gongbao/2026/issue_12666/202604/content_7065114.html | ĐĐ |
| Họp báo 07/01/2026 của Tổng cục Quản lý thị trường | Biện pháp đưa người dẫn số vào quản lý, *"避免新技术成为生成或传播虚假信息的“挡箭牌”"* | — | https://www.elawcn.com/rule/2026/0110/1721.html | ĐĐ |

Đọc cho LiveLift: nếu sau này thử can thiệp có người dẫn số hoặc lời thoại do AI sinh, đó phải là một nhánh riêng có nhãn liên tục, không trộn với thí nghiệm ghim. Ở Việt Nam chưa thấy quy định tương đương riêng cho người dẫn số trong livestream (xem mục 5), nhưng cách làm an toàn là áp chuẩn chặt hơn.

Bằng chứng có đối chứng bổ sung: Han, Fang, Xie, Liao, Zhang (2025), Journal of Business Ethics 204(4), DOI 10.1007/s10551-025-06061-2, theo đoạn trích tìm kiếm có một thí nghiệm thực địa và ba thí nghiệm kịch bản đăng ký trước, cho thấy công khai người dẫn là ảo làm tăng mua trong bối cảnh trách nhiệm xã hội (TT, chưa đọc tóm tắt gốc).

### 4.6 时间片轮转: switchback trong công cụ thí nghiệm Trung Quốc

Ở Trung Quốc, switchback được gọi là 时间片轮转实验 ("thí nghiệm luân phiên lát thời gian").
- **火山引擎 DataTester** (công cụ A/B của ByteDance bán ra ngoài). Chỉ tìm được một bài trên cộng đồng nhà phát triển, ghi lời người phụ trách nghiên cứu phát triển DataTester và dẫn số liệu "截至2023年6月" (https://developer.volcengine.com/articles/7291560091340242963, ĐĐ): *"如何解决一些场景下用户间不独立、无法随机分流的问题？为了解决这一挑战，火山引擎 DataTester 引进了时间片轮转实验。"* Không tìm thấy trang tài liệu chính thức mô tả độ dài lát hay cách phân tích (CKC).
- **神策数据** có tài liệu đầy đủ: sổ tay "新建时间片轮转试验", sửa lần cuối 27/12/2024 (https://manual.sensorsdata.cn/abtesting/docs/time_slice_round_robin_experiment/v0102, ĐĐ). Ba điểm chính:
  - Độ dài lát: *"时间片大小支持设置为24小时、12小时、6小时、3小时、2小时、1小时。默认为 24 小时。"*
  - Thứ tự xen kẽ cố định, không bốc thăm: *"使不同的时间片段依次映射试验组 A 和试验组 B 两组策略"*; lát đầu mỗi ngày phải đảo chiều so với hôm trước.
  - Kịch bản dùng được ghi rõ, trong đó có quan hệ một-nhiều như người dẫn với người xem.
- **快手**: có bài về thí nghiệm hai phía người dẫn × người xem và dùng luân phiên thời gian cho tương tác PK giữa các phòng (bài trên 知乎, TT). Không tìm thấy công bố 2024–2026 của 抖音, 快手, 淘宝, 小红书 hay DataFun về switchback bên trong một phòng live. Đây là khoảng trống.

**Đọc cho LiveLift.** Công cụ Trung Quốc đã thừa nhận switchback là cách giải bài "người xem không độc lập". Nhưng các thiết kế công bố có ba hạn chế:
- lát ngắn nhất 1 giờ;
- thứ tự xen kẽ tất định;
- không có burn-in cho dư âm.

Phiên live 2–3 giờ cần khối tính bằng phút và thứ tự bốc thăm, để kiểm định ngẫu nhiên hóa có hiệu lực (Bojinov và cộng sự 2023; Liu và Zhong 2026). Thứ tự tất định A-B-A-B còn trùng nhịp với chu kỳ đẩy lưu lượng của nền tảng. Đây là điểm kỹ thuật cụ thể mà LiveLift khác các công cụ đang bán.

## 5. Việt Nam và Đông Nam Á

Mọi URL truy cập ngày 15/10/2026. Trang Seller University của TikTok và tài liệu nhà phát triển của TikTok Shop, Shopee hiển thị bằng JavaScript; nhóm đã dựng trang bằng trình duyệt không giao diện để đọc nguyên văn (mức ĐĐ).

### 5.1 Quy mô thị trường: hai đơn vị, hai con số

| Đơn vị | Phạm vi | Con số nửa đầu 2026 | Nguồn | Mức |
|---|---|---|---|---|
| Metric (công bố khoảng 25 đến 29/07/2026) | Shopee, Lazada, Tiki, TikTok Shop | *"quy mô doanh số đạt 291,6 nghìn tỷ đồng, tăng trưởng 44,11%"*; 2.186,7 triệu sản phẩm; 613,8 nghìn shop có phát sinh đơn; Shop Mall chiếm 2,79% số gian hàng nhưng 34,2% doanh số trên Shopee, Lazada, TikTok Shop | https://metric.vn/resource/blog/metric-bao-cao-thuong-mai-dien-tu-viet-nam-6-thang-dau-nam-2026 ; VnEconomy 25/07/2026 https://vneconomy.vn/nguoi-viet-chi-it-nhat-1611-ty-dong-moi-ngay-de-mua-sam-online.htm | ĐĐ |
| YouNet ECI (công bố 10/08/2026) | Shopee, TikTok Shop, Lazada, Tiki | GMV *"đạt 264,8 nghìn tỷ đồng"*, *"tăng 19%"*; Shopee *"54,5% thị phần"*; TikTok Shop *"từ 42% (H1'2025) lên 43,4%"*, doanh thu TikTok Shop tăng 27%; thời trang chiếm 28,5% GMV | https://youneteci.com/vi/bao-cao-toan-canh-tmdt-viet-nam-nua-dau-nam-2026/ | ĐĐ |

Vì sao lệch: cùng bốn sàn, cùng kỳ, nhưng khác cách đo. YouNet ECI ghi rõ lọc gian lận số bán và loại hàng quà tặng (trang phương pháp https://youneteci.com/dang-sau-cac-phan-tich-du-lieu-tmdt-cua-younet-eci-den-tu-dau/), Metric không công bố phương pháp trên trang báo cáo. Mức tăng trưởng chênh rất xa (44,11% so với 19%), nghĩa là ước tính năm gốc cũng khác. Cả hai là ước tính từ dữ liệu thu thập, không phải số sàn công bố. Trong hồ sơ ghi dạng khoảng: "264,8 đến 291,6 nghìn tỷ đồng nửa đầu 2026, tùy đơn vị đo".

Bối cảnh vận hành: Dân trí (29/09/2026) dẫn khoảng 436.000 gian hàng có phát sinh doanh thu và khoảng 162.700 gian hàng không còn doanh thu trong nửa đầu năm; các sàn *"đồng loạt tăng cường xác thực người bán, tài khoản thanh toán và hoạt động livestream"* sau khi Luật Thương mại điện tử có hiệu lực 01/07/2026 (https://dantri.com.vn/kinh-doanh/suc-ep-chi-phi-bua-vay-hon-160000-gian-hang-thuong-mai-dien-tu-dong-cua-20260929092200561.htm, ĐĐ). Người bán nhỏ đang chịu sức ép chi phí, nên một công cụ chỉ ra hành động nào thật sự có lời là có nhu cầu, nhưng điều này là suy luận, chưa có khảo sát người dùng.

**Con số "2,5 triệu phiên livestream mỗi tháng": không dùng làm sự thật.** Truy ngược: VnEconomy 03/05/2024 (https://vneconomy.vn/gioi-tre-viet-chuong-mua-hang-qua-phien-livestream.htm) ghi *"Bình quân mỗi tháng đang có 2,5 triệu phiên bán hàng livestream, có sự tham gia của hơn 50 nghìn nhà bán"*, dẫn "thông tin từ AccessTrade Việt Nam". Nguồn sớm hơn là PLO 24/04/2024 (https://tuoitre.vn/plo/moi-thang-nguoi-viet-chung-kien-25-trieu-phien-livestream-ban-hang-post787242.html): đây là lời *"ước tính"* của Giám đốc điều hành AccessTrade tại một diễn đàn ngày 24/04/2024, không nêu nguồn dữ liệu hay phương pháp. Ba vấn đề: số của năm 2024 chứ không phải 2026; là ước tính của một công ty tiếp thị liên kết; không có phương pháp. Nếu bắt buộc nhắc, chỉ viết "AccessTrade ước tính (04/2024)". Phần giới thiệu công khai vòng 2 của LiveLift vẫn đang dùng con số này (mục 6.2).

### 5.2 TikTok Shop: nền tảng đã có gì trong phòng live

1. **Phân tích do AI tạo trong LIVE** (Seller University Việt Nam, 24/06/2026, ghi áp dụng cho Việt Nam; https://seller-vn.tiktok.com/university/essay?knowledge_id=4898053111744273&lang=vi-VN). Tính năng *"hiện chỉ dành cho một số người bán và nhà sáng tạo được chọn"*. Khi AI phát hiện người dẫn đang giới thiệu một sản phẩm chưa ghim, hệ thống *"đưa ra đề xuất ghim sản phẩm vào phòng LIVE"*, người dẫn bấm "Ghim ngay". Bản tiếng Anh liệt kê thêm các gợi ý: ghim mã giảm giá khi tỷ lệ nhấp trang sản phẩm cao hoặc nhiều bình luận hỏi; mở flash sale khi tương tác cao mà tỷ lệ đặt đơn thấp; đổi sang sản phẩm bán chạy kế tiếp; cảnh báo lưu lượng giảm. Trang ghi *"Các chủ phòng LIVE sử dụng kịch bản đề xuất đã ghi nhận mức tăng GMV lên tới 7,38%!"*, chú thích *"Dựa trên dữ liệu nội bộ tại khu vực Đông Nam Á (SEA) năm 2025"*. Mức: ĐĐ.
   Đọc cho LiveLift: con số 7,38% là so sánh người tự chọn dùng với người không dùng, không có nhóm đối chứng được công bố. Đây chính là loại khẳng định mà switchback kiểm được. Ngoài ra, nhóm **không tìm thấy** trang chính thức nào mô tả gợi ý ghim "kèm GMV ước tính" như đề bài nêu; mục này ghi CKC.
2. **Tab Suggestions trong LIVE Manager** (Seller University Mỹ, 13/05/2026; https://seller-us.tiktok.com/university/essay?knowledge_id=3360165320984366): *"In the Suggestions tab, you'll receive suggestions on how you can optimize your session's performance in real-time"*; khi lưu lượng giảm có cảnh báo và bước hành động. Không thấy GMV ước tính. Mức: ĐĐ.
3. **Bảng điều khiển LIVE** (Việt Nam, 18/07/2025; https://seller-vn.tiktok.com/university/essay?knowledge_id=967473030956801&lang=vi-VN): xu hướng theo toàn phiên, 5 phút cuối hoặc 30 phút cuối; *"Chức năng xuất/tải xuống sẽ chỉ khả dụng sau khi hoàn tất LIVE."* Mức: ĐĐ. Bộ codex-gap-study của đội ghi thêm dòng thời gian có đánh dấu ghim, quảng cáo, vi phạm và bảng so sánh với 14 ngày trước (`codex-gap-study/02_TIKTOK_LIVE_DASHBOARD_DEEP_CRAWL.md`).
4. **Định nghĩa chỉ số** (Cẩm nang lưu lượng LIVE, 24/07/2025; https://seller-vn.tiktok.com/university/essay?knowledge_id=512121839519504&lang=en), mức ĐĐ:
   - ERR là **tỷ lệ vào phòng** (Enter Room Rate), không phải tỷ lệ tương tác: số lượt xem chia số lượt hiển thị phòng LIVE.
   - CTR: số lượt nhấp sản phẩm chia lượt xem LIVE.
   - CTOR: số đơn SKU chia số lượt nhấp sản phẩm.
   - Show GPM: GMV của phòng trên 1.000 lượt hiển thị; Watch GPM: GMV trên 1.000 lượt xem.
   Đọc cho LiveLift: biến kết quả của LiveLift (nhấp hợp lệ trên 1.000 viewer-giây) gần với CTR nhưng chuẩn hóa theo thời gian phơi nhiễm; không được gọi là "CTR" trên giao diện để tránh nhầm với định nghĩa của TikTok.
5. **Lời khuyên về nhịp ghim** (Seller University Mỹ, 14/05/2026; https://seller-us.tiktok.com/university/essay?knowledge_id=463621005051661): *"Do not switch up product pins too quickly. Give some time (at least 10-15 mins in a 2 hour LIVE) before you make a tactical decision to switch pins."* Mức: ĐĐ. Đây là căn cứ thực hành để cân nhắc khối 10 phút cho phiên thật dài 2 giờ, và để giải thích vì sao khối 5 phút ở phòng dàn dựng là lựa chọn kỹ thuật (phiên ngắn) chứ không phải khuyến nghị cho người bán.

### 5.3 API chính thức: ai lấy được gì, khi nào

| Nền tảng | Thứ lấy được | Thời điểm | Điều kiện | Nguồn | Mức |
|---|---|---|---|---|---|
| TikTok Shop, Get Shop LIVE Minute Performance (v202510) | Số liệu theo phút của một phiên | *"after the session is finished"* | Scope `data.shop_analytics.public.read`; *"only returns data for live streams hosted by the shop official account or marketing account"*; token người bán qua ứng dụng đăng ký ở Partner Center (OAuth) | https://partner.tiktokshop.com/docv2/page/get-shop-live-minute-performance-202510 | ĐĐ |
| TikTok Shop, Get Shop LIVE Performance Overview (v202609) | Tổng hợp theo ngày của mọi phiên, có cờ "today" cho số thời gian thực trong ngày | Trong ngày (tổng hợp cửa hàng, không theo phiên) | Như trên | https://partner.tiktokshop.com/docv2/page/get-shop-live-performance-overview-202609 | ĐĐ |
| TikTok Shop, Get Live Room Core Stats (v202502, cho nhà sáng tạo) | GMV, số đơn, người mua, lượt nhấp sản phẩm, lượt xem | Chưa rõ | Scope `creator.data.live.read.public`, token nhà sáng tạo | https://partner.tiktokshop.com/docv2/page/get-live-room-core-stats-202502 | ĐĐ |
| Shopee Open Platform, Livestream API | Tạo phiên, đặt sản phẩm đang hiển thị (`v2.livestream.update_show_item`), số liệu thời gian thực của phòng và từng sản phẩm (`get_session_metric`, `get_session_item_metric`), bình luận 10 giây gần nhất (`get_latest_comment_list`) | Trong lúc phát | *"Only Livestream Management applications are eligible"*; hỗ trợ TW, ID, TH, PH, MY, SG, VN; vai trò người bán tự phát và người phát liên kết; mọi API cần `user_id`; API mới từ 24/06/2025 | https://open.shopee.com/developer-guide/669 (cập nhật 09/01/2026) ; https://open.shopee.com/documents/v2/v2.livestream.update_show_item?module=125&type=1 | ĐĐ |

Hai điểm cần sửa so với giả định cũ:
1. Câu "số theo phút của TikTok Shop chỉ có sau phiên, chỉ cho người bán đã ủy quyền ứng dụng ở Partner Center" **đúng**, và còn hẹp hơn: chỉ cho phòng của tài khoản chính thức hoặc tài khoản marketing của shop, không cho phòng của nhà sáng tạo liên kết. Không thấy API đọc nội dung bình luận hay API ghim trong nhóm Analytics.
2. Câu "API Shopee chỉ dành cho shop Mall hoặc Preferred" **không khớp** với hướng dẫn Livestream API: điều kiện ghi trên trang là loại ứng dụng (Livestream Management), khu vực và ủy quyền của người phát. Có thể có điều kiện đăng ký tài khoản nhà phát triển ở nơi khác; nhóm chưa tìm thấy văn bản, nên ghi CKC cho câu cũ. Về kỹ thuật, Shopee Việt Nam cho phép ghim theo lịch bằng API, đọc số thời gian thực và đọc bình luận, tức là con đường đầy đủ nhất cho switchback tự động; TikTok Shop thì không có API ghim và số theo phút chỉ có sau phiên.

Thêm hai nguồn bình luận chính thức (ĐĐ qua tác tử): YouTube `liveChatMessages.streamList` đẩy tin nhắn theo luồng, mỗi lần gọi 5 đơn vị hạn mức, hạn mức mặc định 10.000 đơn vị mỗi ngày (https://developers.google.com/youtube/v3/live/docs/liveChatMessages/streamList); Facebook Live Video API cho đọc bình luận bằng truy vấn định kỳ hoặc Server-Sent Events, cần App Review và Page access token (https://developers.facebook.com/documentation/live-video-api/interact-with-viewers).

### 5.4 Pháp lý Việt Nam

**Luật Thương mại điện tử số 122/2025/QH15** (thông qua 10/12/2025; Điều 40: *"có hiệu lực thi hành từ ngày 01 tháng 7 năm 2026"*; toàn văn https://luatvietnam.vn/thuong-mai/luat-thuong-mai-dien-tu-cua-quoc-hoi-so-122-2025-qh15-423356-d1.html; ĐĐ qua tác tử):
- Điều 3 khoản 10 và 11 định nghĩa livestream bán hàng và người livestream bán hàng.
- Điều 22 khoản 4: nền tảng *"Thực hiện việc xác thực điện tử danh tính người livestream bán hàng … trước khi cho phép thực hiện livestream bán hàng"*; khoản 7: lưu hình ảnh, âm thanh của phiên *"ít nhất 01 năm"*.
- Điều 23: người bán phải đưa giấy tờ cho người livestream; *"Nội dung bán hàng livestream phải phù hợp với nội dung quảng cáo được xác nhận."*
- Điều 24 khoản 4: người livestream *"Không cung cấp thông tin gian dối hoặc gây nhầm lẫn về công dụng, xuất xứ, chất lượng, giá cả, chính sách khuyến mại"*.
- Đọc cho LiveLift: luật không điều chỉnh việc bốc thăm thời điểm ghim. Nhưng nếu thử nghiệm giá hay khuyến mãi, mọi lời nói về giá và khuyến mãi trong cả khối BẬT lẫn TẮT phải đúng sự thật và khớp nội dung quảng cáo đã xác nhận.

**Nghị định 248/2026/NĐ-CP** (ban hành 30/06/2026, hiệu lực 01/07/2026, hướng dẫn Luật Thương mại điện tử; danh mục văn bản https://vanban.chinhphu.vn/?pageid=27160&docid=218747; toàn văn https://dulieuphapluat.vn/van-ban/thuong-mai-van-ban/nghi-dinh-2482026nd-cp-huong-dan-luat-thuong-mai-dien-tu-1389723.html; ĐĐ qua tác tử):
- **Điều 52 khoản 2 lùi mốc định danh:** *"Chủ quản nền tảng thương mại điện tử có trách nhiệm thực hiện việc xác thực điện tử danh tính người bán và người livestream bán hàng kể từ ngày 01 tháng 01 năm 2027."* Luật có hiệu lực 01/07/2026, nhưng nghĩa vụ xác thực điện tử người livestream bắt đầu 01/01/2027. Nhiều bài báo viết gộp hai mốc; trên slide ghi đúng: "định danh người livestream bắt buộc từ 01/01/2027".
- Điều 12: quy chế livestream của nền tảng phải có sáu nội dung tối thiểu, trong đó có quy trình định danh xác thực điện tử người livestream.
- Điều 11 khoản 1: nền tảng dùng *"thuật toán … để hạn chế hoặc ưu tiên việc hiển thị"* phải *"công khai toàn bộ các tiêu chí chính"*. Đây là căn cứ để LiveLift coi việc nền tảng đẩy lưu lượng là biến gây nhiễu có thật và được thừa nhận, và là lý do phải bốc thăm thay vì so trước sau.
- Điều 52 khoản 3: Nghị định 52/2013 và 85/2021 hết hiệu lực.

**Luật sửa đổi, bổ sung Luật Quảng cáo số 75/2025/QH15** (thông qua 16/06/2025, Điều 3: *"hiệu lực thi hành từ ngày 01 tháng 01 năm 2026"*; bản PDF trên cổng Hà Nội; ĐĐ qua tác tử): Điều 15a khoản 3 buộc người chuyển tải sản phẩm quảng cáo không giới thiệu sản phẩm *"chưa sử dụng hoặc chưa hiểu rõ"* và *"Thông báo về việc quảng cáo ngay trước và trong khi thực hiện hoạt động quảng cáo"*; Điều 23 khoản 2 điểm đ buộc người dùng mạng xã hội quảng cáo *"phải có dấu hiệu phân biệt nội dung quảng cáo hoặc được tài trợ"*. Đọc cho LiveLift: video người dẫn của phòng dàn dựng chỉ giới thiệu sản phẩm đội đã dùng thật, không nói công dụng chưa kiểm, và gắn nhãn "dàn dựng, tiền ảo" suốt phiên (giao diện `/xem` đã làm).

**Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15** (thông qua 26/06/2025, hiệu lực 01/01/2026; toàn văn https://luatvietnam.vn/dan-su/luat-bao-ve-du-lieu-ca-nhan-2025-so-91-2025-qh15-405135-d1.html; ĐĐ qua tác tử):
- Điều 9: đồng ý phải *"tự nguyện và biết rõ"* mục đích, *"Thể hiện sự đồng ý đối với từng mục đích"*; *"Sự im lặng … không được coi là sự đồng ý"*. Điều 11 khoản 1: xin đồng ý trước khi thu.
- **Không có ngoại lệ cho nghiên cứu.** Điều 19 khoản 1 liệt kê năm trường hợp không cần đồng ý (khẩn cấp, an ninh, cơ quan nhà nước, thực hiện thỏa thuận với chủ thể, trường hợp luật khác quy định); không trường hợp nào là nghiên cứu hay thống kê. Vì vậy phòng xem bắt buộc có màn hình đồng ý trước mọi sự kiện, và máy chủ trả 403 cho sự kiện chưa đồng ý (đã kiểm ở cổng G2).
- Điều 2 khoản 1: *"Dữ liệu cá nhân sau khi khử nhận dạng không còn là dữ liệu cá nhân."* Điều 14 khoản 6 điểm b cấm tái nhận dạng. Phòng xem chỉ lưu băm của mã ngẫu nhiên do máy người xem tạo, không lưu IP, che số điện thoại và email trong bình luận.
- Điều 38 khoản 2 và 3: doanh nghiệp nhỏ, khởi nghiệp được miễn đánh giá tác động (Điều 21, 22) trừ khi xử lý dữ liệu nhạy cảm hoặc *"số lượng lớn"* chủ thể.

**Nghị định 356/2025/NĐ-CP** (ngày 31/12/2025, hiệu lực 01/01/2026, thay Nghị định 13/2023; ĐĐ qua tác tử): Điều 3 coi *"Hình ảnh của cá nhân"* và thông tin tài khoản số là dữ liệu cá nhân cơ bản, nên tên tài khoản người bình luận và hình người dẫn đều là dữ liệu cá nhân; Điều 6 yêu cầu đồng ý kiểm chứng được, không chấp nhận ô đánh dấu sẵn; Điều 41 đặt ngưỡng "số lượng lớn" từ 100 nghìn chủ thể.

### 5.5 Số liệu Đông Nam Á và cập nhật quý 3/2026

| Nguồn | Con số (nguyên văn) | Đọc đúng | Mức |
|---|---|---|---|
| Momentum Works, "Live Commerce in Southeast Asia 2026" (09/2026; trang giới thiệu https://momentum.asia/insights/detail/live-commerce-in-southeast-asia-2026 ; bài tóm tắt 08/09/2026 https://thelowdown.momentum.asia/new-report-southeast-asias-content-commerce-on-track-to-reach-us77-9b-in-2026/) | *"Content commerce now accounts for 37% of Southeast Asia's platform ecommerce GMV, up from 20% two years ago"*; *"on track to reach US$77.9 billion in 2026"*; *"US$33.8 billion in GMV in the first half of the year"* | "Content commerce" gồm *"live, short video and content-led affiliates"*, không phải riêng livestream. Không có số riêng cho Việt Nam. Báo cáo còn ghi *"Not all live GMV is incremental"*, đúng câu hỏi LiveLift đo | ĐĐ |
| Momentum Works, Ecommerce in SEA 2026 (14/04/2026, https://thelowdown.momentum.asia/new-report-southeast-asias-platform-ecommerce-reaches-us157-6b-in-2025-with-top-platforms-expanding-share-to-98-8/) | Thương mại điện tử nền tảng Đông Nam Á *"US$157.6 billion, growing 22.8% in 2025"*; content commerce *"US$49.7 billion … 32% of total platform GMV"* | Số năm 2025 | ĐĐ |
| YouNet ECI quý 3/2026 (14/10/2026, https://youneteci.com/vi/bao-cao-toan-canh-tmdt-viet-nam-q3-2026/) | 9 tháng đầu năm *"tổng GMV đạt mức 411.8 nghìn tỷ VNĐ"*, *"tăng trưởng 22%"*; quý 3 *"tăng lên 27% YoY"*; thị phần 9 tháng Shopee 53%, TikTok Shop 45%; TikTok Shop tăng 38%; trong quý 3 TikTok Shop *"chỉ còn kém 4.3 nghìn tỷ VNĐ so với Shopee"* | Số mới nhất có thể dẫn ngày 22/10. Không có tỷ trọng livestream | ĐĐ |
| TikTok Newsroom Việt Nam (30/07/2026, https://newsroom.tiktok.com/tiktok-shop-summit-vietnam-2026?lang=vi-VN) | GMV TikTok Shop Việt Nam tăng 66% năm 2025; mức ảnh hưởng của livestream *"cao gấp 1,3 lần"* trung bình châu Á Thái Bình Dương (dẫn Accenture) | Số tự công bố của nền tảng | ĐĐ |
| VTV (30/05/2026, https://vtv.vn/ai-hoan-toan-co-the-livestream-ban-hang-100260530094030536.htm) | Livestream bằng AI *"24/7 với hiệu suất tương đương 50-60% con người"* (lời ông Đỗ Hữu Hưng, VECOM) | Ước tính của người trong ngành, không có phương pháp | ĐĐ |

Chưa có: e-Conomy SEA 2026 (bản mới nhất là 2025), báo cáo quý 3 của Metric, và **không đơn vị nào công bố tỷ trọng livestream trong GMV Việt Nam 2025 đến 2026** (CKC). Trên slide không đưa con số tỷ trọng livestream của Việt Nam; dùng Momentum Works cho Đông Nam Á và ghi rõ là content commerce.

### 5.6 Công cụ thương mại tại Việt Nam và khu vực

| Công cụ | Làm gì (theo trang chính thức) | Giá | Thí nghiệm ngẫu nhiên | Mức |
|---|---|---|---|---|
| Opsique (https://www.opsique.com/platform/) | *"AI-powered operations for TikTok Shop LIVE"*: kịch bản chạy phiên, nhắc giờ, bảng nhiều phòng, kịch bản AI, tự động trả lời chat, báo cáo sau phiên GMV, CTOR, CVR | Gói Creator miễn phí, Pro dùng thử 15 ngày | Không; chỉ TikTok | ĐĐ |
| Haravan livestream (https://www.haravan.com/pages/phan-mem-ban-hang-livestream) | Tạo đơn từ cú pháp bình luận, gửi giỏ qua Messenger | *"Chi phí chỉ từ 800.000 đồng/tháng"* | Không | ĐĐ |
| Sapo, Pancake, KiotViet, TPOS | Chốt đơn theo bình luận | Giá chỉ thấy trên blog, không nhất quán | Không | TT |
| Kalodata, FastMoss, EchoTik | Dò sản phẩm, đối thủ trên TikTok Shop; EchoTik có mục "Live Monitor" | Blog: khoảng 9,90 đến 109 USD mỗi tháng | Không | TT |
| Shoflo, nay thuộc LASSO (https://www.lasso.io/rundown/) | *"digital cue sheet builder and run of show tool"* | — | Không | ĐĐ |

Kết luận có giới hạn (tìm có phạm vi): không công cụ nào nhóm tìm được cho phép bốc thăm quyết định trong phiên live. Đối thủ gần nhất là Opsique, nhưng Opsique giải bài điều phối, không giải bài đo.

## 6. Ma trận định vị

### 6.1 LiveLift so với công cụ thị trường

| Công cụ | Trả lời câu hỏi gì | Có nhóm đối chứng ngẫu nhiên | Cần sở hữu nền tảng | Quan hệ với LiveLift |
|---|---|---|---|---|
| TikTok: phân tích AI trong LIVE, tab Suggestions, bảng điều khiển LIVE (mục 5.2) | Nên ghim gì, khi nào lưu lượng giảm, phiên bán được bao nhiêu | Không công bố (số 7,38% là dữ liệu nội bộ) | Là chính nền tảng | Bổ sung: gợi ý của TikTok có thể làm chính sách tầng trong để LiveLift đo |
| 抖音 罗盘, 巨量百应, 千川·乘方 (mục 4.2, 4.3) | Phân rã GMV, dòng thời gian hành động, tự động hóa quảng cáo | Không; tự mô tả là tương quan | Là chính nền tảng | Mô hình tham chiếu; thiết lập quảng cáo phải cố định trong phiên thí nghiệm |
| 蝉妈妈 AI, 飞瓜 (giá 飞瓜 từ 399 NDT mỗi tháng, trang giá chính thức) | Theo dõi đối thủ, phục bàn, quy nguyên nhân bằng AI | Không | Không (thu thập phía người xem) | Khác loại; LiveLift không dùng số ước tính làm kết quả |
| Kalodata, FastMoss, EchoTik | Ai đang bán chạy trên TikTok Shop | Không | Không | Khác loại |
| Statsig, 火山引擎 DataTester | Thí nghiệm, có switchback | Có | Có (SDK, kho dữ liệu) | Cùng phương pháp, khác người dùng: LiveLift cho người đi thuê sân |
| Opsique, Shoflo (mục 5.6) | Kịch bản chạy phiên, nhắc giờ, phối hợp người dẫn | Không | Không | Đội đã bỏ hướng run-of-show khỏi bài nói |
| Haravan, Pancake, Sapo (mục 5.6) | Chốt đơn theo bình luận | Không | Không | Nguồn sự kiện đơn hàng tiềm năng |
| Các đội AISC cùng mảng (mục 6.2) | Dự đoán, tự động hóa, chẩn đoán | Không | Không | Bổ sung |

**Switchback thương mại, đã đọc tài liệu gốc (15/10/2026, ĐĐ qua tác tử):**
- **Statsig Switchback Tests** (https://docs.statsig.com/experiments/types/switchback-tests): người dùng đặt thời lượng (ngày), độ dài cửa sổ (phút), burn-in và burn-out (phút, *"whose exposures Statsig discards from analysis"*). Phân tích là *"difference in means … with bootstrapped confidence intervals"*, lấy mẫu lặp 10.000 lần trên các bucket. Giới hạn ghi trên trang: *"Switchback tests don't yet support CUPED and sequential testing"*; chưa có chuỗi thời gian và phân rã theo chiều; bucket ngẫu nhiên phải nhờ đội hỗ trợ bật. Bản V2 (https://docs.statsig.com/experiments/types/switchback-v2) chỉ có ở Warehouse Native, *"treats each bucket as one data point"*, có hồi quy theo giờ trong ngày, ngày trong tuần.
- **Eppo** (https://docs.geteppo.com/experiment-analysis/switchbacks/): *"currently in closed Beta"*. Trên slide không nêu Eppo (giữ quyết định ở mục 5 của kế hoạch).
- GrowthBook có cluster experiments (phương pháp delta), không có trang switchback; Optimizely không thấy tài liệu switchback. Trang so sánh của Spotify Confidence (bên cạnh tranh, cập nhật 16/06/2026) ghi chỉ hai nhà cung cấp hỗ trợ switchback.
- Khác biệt kỹ thuật LiveLift nói được: Statsig dùng bootstrap trên bucket, tức là dựa trên xấp xỉ khi số bucket lớn; LiveLift dùng kiểm định ngẫu nhiên hóa dựa trên thiết kế, chính xác với số khối nhỏ của một phiên live (12 đến 36 khối), và đã có dãy tin cậy trong lộ trình (Ham và cộng sự 2026) cho việc theo dõi giữa phiên mà Statsig ghi là chưa hỗ trợ. DataTester của 火山引擎: thông tin cũ ở bản 11/09 và 17/09, chưa đọc lại trong bản này (CKC).

### 6.2 Các đội vòng 2 AISC'26 cùng mảng

Nguồn: dữ liệu trưng bày công khai của vòng 2 (77 đội, tải ngày 14/10/2026), đối chiếu từng dòng với tệp `data/2026-10-15-doi-thi-vong-2.csv` (cùng thư mục với tài liệu này). Tệp CSV không chứa tên thành viên. Phân bố: 34 đội chủ đề Data Driven Business, 43 đội Digital Business Ideas; 18 đội ghi lĩnh vực thương mại điện tử. Phần giới thiệu công khai của mỗi đội bị cắt ở khoảng 1.000 ký tự, nên mọi nhận xét dưới đây chỉ dựa trên phần đó.

**Sự thật chính:** quét từ khóa trên tên dự án và phần giới thiệu của 76 đội còn lại (livestream, live, phát trực tiếp, thí nghiệm, A/B, ngẫu nhiên, nhân quả, uplift, switchback, đối chứng) cho thấy không đội nào làm livestream bán hàng và không đội nào làm thí nghiệm ngẫu nhiên. Các lần khớp từ khóa đều là nghĩa khác (ví dụ "trực tiếp" nghĩa là nhắn tin trực tiếp, "random" trong Random Forest, "ngẫu nhiên" là thứ tự đăng ký khám). Gần nhất về tư duy nhân quả là đội 0027 (uplift modeling trên dữ liệu nhỏ và dữ liệu tổng hợp) và đội 0080 (lấy lịch hiện tại làm đối chứng).

**Lưu ý về chính LiveLift:** phần giới thiệu công khai của LiveLift (mã 0039) vẫn có câu "Việt Nam có khoảng 2,5 triệu phiên live mỗi tháng". Con số này chưa truy được nguồn gốc (xem mục 5). Nên sửa trên slide và poster, và chuẩn bị câu trả lời nếu hội đồng hỏi.

| Mã | Đội | Họ làm gì | LiveLift khác ở đâu | Điều đáng học hoặc cơ hội hợp tác |
|---|---|---|---|---|
| 0010 | Hắc cơ mũ đen (Digital Business Ideas, TMĐT) | Hệ nhiều tác tử AI có một tác tử điều phối, tự động hóa việc hằng ngày của doanh nghiệp TMĐT vừa và nhỏ: tra sản phẩm, kiểm tồn kho, tạo đơn, trả lời khách | Họ tự động hóa thao tác; LiveLift đo xem một thao tác có tạo thêm doanh số không | Mẫu "tác tử điều phối gọi tác tử chuyên trách" hợp với bàn điều hành: trước khi ghim, gọi kiểm tồn kho. Có thể đề xuất LiveLift làm "tác tử đo lường" trong hệ của họ |
| 0013 | LDS (Data Driven Business, TMĐT) | Customer Radar: gom phản hồi đa kênh, phân tích cảm xúc theo khía cạnh, theo dõi xu hướng, đề xuất hành động trên dashboard | Họ xử lý phản hồi sau mua; LiveLift xử lý bình luận trong phiên và gắn với khối thí nghiệm | Bộ khía cạnh (giá, giao hàng, chất lượng) có thể làm giàu radar ý định của LiveLift; cách trình bày "vấn đề cần ưu tiên" đáng tham khảo |
| 0015 | SBCB (Data Driven Business, TMĐT) | Dự báo nhu cầu theo SKU (phân loại ABC–XYZ, chọn mô hình theo kiểu nhu cầu), chuyển thành quyết định khi nào nhập và nhập bao nhiêu | Họ dự báo; LiveLift đo tác động của hành động. Hai việc bổ sung nhau | Logic tồn kho an toàn và điểm đặt hàng lại là thứ LiveLift cần cho "liên kết tồn kho": cảnh báo khi sản phẩm sắp ghim có nguy cơ hết hàng giữa phiên (kênh carryover mà Chen và cộng sự 2025 chỉ ra) |
| 0025 | InsightX (Data Driven Business, TMĐT) | ReviewShield: phân loại đánh giá theo ma trận 4 ô (độ xác thực × cảm xúc), phát hiện bất thường, gợi ý phản hồi bằng AI | Họ làm với đánh giá sau mua; LiveLift lọc bình luận trong phiên | Trục "độ xác thực" gợi ý một bộ lọc bình luận mồi hoặc bình luận tự động trong live, giúp làm sạch biến phụ của RQ4 |
| 0027 | YE (Data Driven Business, Khác) | Kiến trúc chi phí thấp cho doanh nghiệp dịch vụ nhỏ: nội suy, sinh dữ liệu tổng hợp bằng TVAE, dự đoán bằng XGBoost, giải thích bằng SHAP và uplift modeling | Cùng bài toán dữ liệu nhỏ và câu hỏi tác động. Khác ở nguồn biến thiên: LiveLift tạo biến thiên bằng gán ngẫu nhiên nên ước lượng tác động không cần giả định không có biến gây nhiễu | Cách họ nói thẳng về dữ liệu thưa của doanh nghiệp nhỏ là cách đặt vấn đề tốt. Sau khi có đủ phiên ngẫu nhiên, uplift modeling của họ có thể dùng để tìm nhóm phiên hoặc sản phẩm hưởng lợi nhiều |
| 0028 | Pizza Seekers (Data Driven Business, TMĐT) | Cellaxnet: hỗ trợ quyết định cho người bán nhỏ ngành thời trang, mỹ phẩm trên Shopee, Lazada, TikTok Shop: cảm xúc khách, đánh giá giả, định giá động, gợi ý sản phẩm, khách sắp rời | Cùng khách hàng mục tiêu nhất. Họ đề xuất hành động dựa trên dự đoán; LiveLift kiểm hành động bằng thí nghiệm và tập trung vào phiên live | Cách đóng gói đề xuất thành cảnh báo cụ thể cho người bán. Ý tưởng chung: mỗi đề xuất của họ (ví dụ giảm giá) có thể được kiểm bằng khung switchback của LiveLift |
| 0051 | J4F (Data Driven Business, TMĐT) | Ước lượng mức bán tham chiếu của từng sản phẩm so với nhóm tương đồng (khoảng 41.603 bản ghi thời trang trên Tiki) để chỉ ra sản phẩm cần rà soát | Họ chẩn đoán mô tả; LiveLift kết luận bằng thí nghiệm. Đây đúng là chuỗi "chẩn đoán bằng phễu, kết luận bằng thí nghiệm" | Nhóm đối chiếu theo loại hàng là nguồn tốt để chọn sản phẩm đưa vào tầng trong (sản phẩm bán dưới mức tham chiếu là ứng viên để thử ghim) |
| 0058 | OmniAgent (Data Driven Business, TMĐT) | Đồng bộ dữ liệu POS, Shopee, TikTok Shop và giao nhận; dự báo XGBoost, ABC–XYZ, điểm đặt hàng động; cụm tác tử tự hành kích hoạt hành động tồn kho | Cùng nguồn dữ liệu sàn và khách hàng SME; họ tối ưu tồn kho đa kênh, LiveLift đo quyết định trong phiên | Bộ kết nối đơn hàng Shopee và TikTok Shop là đúng mảnh LiveLift còn thiếu (biến kết quả đơn hàng). Đáng hỏi về khả năng dùng chung hoặc học cách xin quyền API |
| 0068 | TrainToOlympus (Data Driven Business, TMĐT) | BrandSentinel: theo dõi bất thường cấp SKU từ số lượng đánh giá, điểm và nội dung; chỉ nâng cảnh báo khi nhiều tín hiệu cùng xuất hiện và kéo dài | Tín hiệu theo ngày; LiveLift theo phút trong phiên | Quy tắc "chỉ cảnh báo khi nhiều tín hiệu cùng kéo dài" là cách chống báo động giả hợp với bàn điều hành live, gần với tinh thần dãy tin cậy của Ham và cộng sự (2026) |
| 0071 | 2Ni (Data Driven Business, TMĐT) | Dự đoán khách TMĐT sắp rời bỏ từ đặc trưng RFM và lịch sử mua, bằng hồi quy logistic, cây quyết định, rừng ngẫu nhiên | Họ dự đoán cấp khách hàng; LiveLift đo tác động cấp khối thời gian | Ít điểm chung kỹ thuật. Câu hỏi nối hai bên: hành động giữ chân khách có hiệu quả thật không, chỉ trả lời được bằng nhóm đối chứng |
| 0072 | N2T (Data Driven Business, TMĐT) | RePrice MIS: dải giá tham chiếu từ giao dịch tương đồng, cảnh báo giá rao bất thường bằng Z-score cho đồ đã qua sử dụng C2C | Định giá C2C, không có can thiệp | Cách hiển thị dải tham chiếu kèm điểm hiện tại dễ đọc, có thể mượn cho thẻ "10 phút gần nhất so với dải bình thường" trên bàn điều hành (ghi rõ là mô tả, không phải nhân quả) |
| 0080 | Axiom (Data Driven Business, Khác) | EnergyShift: lấy lịch sản xuất hiện tại làm đối chứng, đánh giá phương án đổi lịch theo tổng chi phí, dám khuyên giữ nguyên hoặc đo thêm khi dữ liệu chưa đủ chắc | Cùng triết lý "so với đối chứng, dám nói chưa đủ bằng chứng". Họ so bằng mô hình chi phí; LiveLift so bằng gán ngẫu nhiên | Ba đầu ra "đổi, giữ nguyên, đo thêm" là cách trình bày quyết định rất rõ, nên mượn cho trang kết quả phiên của LiveLift (thay cho chỉ một p-value) |

Thông điệp khi được hỏi về đội khác: các đội cùng mảng thương mại điện tử giúp người bán dự đoán và tự động hóa; LiveLift trả lời câu hỏi đứng sau mọi đề xuất đó, "làm vậy có thật sự bán thêm không". Đây là quan hệ bổ sung, không phải cạnh tranh trực tiếp.

### 6.3 So trực diện theo tiêu chí chấm Vòng 2 và việc đã làm để vượt

Tiêu chí Vòng 2 (trang BTC, kiểm 14/10/2026; không công bố trọng số): ý nghĩa và tính mới; trình bày và phương pháp; demo và trả lời câu hỏi; sản phẩm (giao diện, công nghệ, khả năng mở rộng, thương mại hoá, đóng góp xã hội). Đối thủ so sánh là 5 đội "trực tiếp" (0010, 0015, 0028, 0051, 0058) và 0027 (gần nhất về tư duy tác động). **Giới hạn:** chỉ dựa trên phần giới thiệu công khai, khoảng 1.000 ký tự mỗi đội; chưa xem slide hay sản phẩm của họ.

| Tiêu chí | Đội có thể hơn LiveLift ở đâu | LiveLift hơn ở đâu | Việc đã làm hoặc sẽ làm để bù |
|---|---|---|---|
| Ý nghĩa, tính mới | 0010, 0058 dùng "tác tử AI" — chủ đề hội đồng dễ chú ý | Đội duy nhất trong 77 đội làm thí nghiệm ngẫu nhiên; đội duy nhất làm livestream; ô "thí nghiệm cho người đi thuê sân" chưa công cụ thương mại nào lấp (§6.1) | Slide 3 đặt ma trận định vị; câu hỏi đáp 29 (TikTok +7,38% không đối chứng); AI vẫn có mặt ở 3 chỗ (tầng trong, radar ý định, lọc dữ liệu cá nhân) — câu dự phòng "AI nằm ở đâu" |
| Phương pháp | 0051 dùng khoảng 41.603 bản ghi thật trên Tiki; 0027 có uplift modeling | Thiết kế có văn liệu 2023–2026 làm nền; kiểm định chính xác; LiveRoomSim lưới 40 ô × 200 lần; tự tìm và sửa lỗi p-value (sổ sự cố hàng 122) | Slide 6–7; giải thích vì sao uplift trên dữ liệu quan sát không thay được bốc thăm (câu hỏi đáp 3, 24) |
| Dữ liệu thật | 0051, 0058 có dữ liệu sàn thật; LiveLift có 0 phiên với người bán thật | 19.126 bình luận quan sát; phòng dàn dựng có người thật, đồng ý, ẩn danh | Phòng dàn dựng 18–20/10 (cổng G2 đạt 15/10); slide 13 nói thẳng các số 0 |
| Demo | 0010, 0028 có thể demo nhiều tính năng | Sản phẩm chạy thật trên API và cơ sở dữ liệu; ba màn hình của cùng một phiên; điện thoại người xem | Demo 2 phút theo `02` §3.2; video dự phòng trước 21/10 |
| Giao diện, công nghệ | 0058 nối POS, Shopee, TikTok Shop, giao nhận | Proxy có danh sách cho phép, token không tới trình duyệt; đường hầm chỉ mở phòng xem; nhãn nguồn dữ liệu luôn hiện | Tài liệu `docs/kien-truc/hop-nhat-next-api.md`; slide 10, D2 |
| Thương mại hoá | 0028 đóng gói nhiều đề xuất cho cùng khách hàng; 0015, 0058 gắn trực tiếp với tiền tồn kho | Đường vào Shopee có API ghim tự động; gói Performance kiểm chứng được | Còn yếu: 0 phỏng vấn mức sẵn lòng chi trả — việc cần người (Minh) trước 22/10 nếu kịp |
| Đóng góp xã hội | — | Người bán nhỏ tránh chi tiền cho chiêu không hiệu quả; minh bạch đúng hướng Luật TMĐT (định danh người livestream từ 01/01/2027) | Câu hỏi đáp 38 |

**Học từ các đội và ĐÃ đưa vào sản phẩm (15/10/2026):**

| Ý tưởng | Học từ | Đã làm trong LiveLift | Kiểm thử |
|---|---|---|---|
| Tồn kho an toàn và điểm đặt hàng lại | 0015, 0058 (và tác tử kiểm tồn kho trước khi tạo đơn của 0010) | Hệ thống chỉ ghim sản phẩm còn đủ hàng cho nhu cầu dự kiến của **một khối** × hệ số an toàn 2; lệnh ghim bị từ chối kèm lý do "SẮP HẾT HÀNG". Ghim một món sắp hết làm hết hàng giữa khối BẬT và lan sang khối sau (Chen và cộng sự, EC 2026) | `tests/test_ung_vien.py`; `src/livelift/api/ung_vien.py` |
| Ba đầu ra "đổi, giữ nguyên, đo thêm" | 0080 | Trang tổng kết và bàn thí nghiệm hiện quyết định **ĐỔI / GIỮ / ĐO THÊM / CHỜ** phía trên con số, chỉ dựa vào KTC 95% | `next/…/__tests__/hoc-tu-doi-khac.test.ts` (`verdict`) |
| Chỉ cảnh báo khi nhiều tín hiệu cùng xấu và kéo dài | 0068 | Thẻ "Nhịp phòng": cảnh báo chỉ khi người xem **và** lượt nhấp cùng dưới dải bình thường 10 phút liền; ghi rõ là mô tả, không phải nhân quả | như trên (`roomPulse`) |
| Dải tham chiếu từ dữ liệu tương đồng | 0072, 0051 | Dải bình thường (tứ phân vị) tính từ chính các cửa sổ 5 phút trước đó của phiên | như trên |

Một lỗi đồng bộ tìm ra trong lúc làm việc này: thẻ gợi ý trên bàn vận hành dựng từ toàn bộ danh mục, còn lệnh ghim đã lọc theo sản phẩm của phòng dàn dựng. Nay cả hai dùng chung `xep_hang_ung_vien` (`tests/test_api_xem.py::test_desk_cards_use_the_same_room_candidates_as_execute`).

**Chưa làm (để ngỏ có chủ đích):** bộ lọc "độ xác thực" của bình luận theo 0025 (cần nhãn, không kịp kiểm chứng trước 22/10); khía cạnh cảm xúc của 0013 (radar ý định đang yếu ở thang 11 lớp, chưa nên mở rộng); gom dữ liệu đơn đa kênh như 0058 (cần API đã được duyệt).

## 7. Gói dùng cho slide

### 7.1 Ba thông điệp

1. **Người bán đang đoán, công cụ hiện có chỉ đếm lại.** Phút 30 ghim sản phẩm B, phút 35 doanh số nhích lên, nhưng không ai tách được phần do ghim khỏi phần do nền tảng vừa đẩy thêm người vào phòng. Bảng số của nền tảng và công cụ bên thứ ba trả lời "phiên vừa rồi bán được bao nhiêu", không trả lời "bao nhiêu là do hành động của bạn".
2. **LiveLift chia thời gian thay vì chia người.** Phiên được cắt thành khối, bốc thăm bật hoặc tắt chính sách ghim cho từng khối, rồi so trong cùng phiên. Phương pháp là switchback đã dùng ở gọi xe, giao đồ ăn và trong phòng live của 快手; điều LiveLift thêm vào là đưa nó tới người bán không sở hữu nền tảng, với kiểm định chính xác cho 12 đến 24 khối (Bojinov và cộng sự 2023; Liu và Zhong 2026).
3. **Bằng chứng nói thật.** Ước lượng viên đã được kiểm hiệu chỉnh (A/A 200 lần: bác bỏ 3,50%, độ phủ 96,50%, độ lệch −0,84%). Số phiên ngẫu nhiên với người bán thật hiện là 0; phòng xem dàn dựng với người thật là bước đầu tiên. Radar ý định tiếng Việt đạt macro-F1 0,542 trên chat thật (nhãn do AI gán), nên chỉ là công cụ phụ.

### 7.2 Sáu trích dẫn ngắn (nguyên văn, đã đọc bản gốc)

1. Về rủi ro của cách đo thông thường trong livestream: *"the sign of the Naive estimator is always wrong"*. Farias và cộng sự, RecSys 2023, mục 7.3 (mô phỏng hiệu chỉnh theo dữ liệu Douyin).
2. Về tiền lệ công nghiệp trong phòng live: *"直播PK暴击时刻这种情况下，我们通过时间片轮转实验解决"*. 快手, DataFunTalk 2021 (đã kiểm trong bản 17/09).
3. Về chọn độ dài khối: *"practitioners should set each period to be almost as long as the order of the carryover effect"*. Bojinov, Simchi-Levi, Zhao, Management Science 2023, mục 3, sau Định lý 2.
4. Về bản chất bài toán: *"interference occurs not across different units, but across time within the same unit"*. Liu và Zhong, arXiv 2602.23257v2, mục 1.
5. Về giám sát an toàn: phương pháp *"would have stopped a 30,000 person Netflix experiment after the first 100 people"*. Ham, Lindon, Tingley, Bojinov, Management Science 2026, tóm tắt.
6. Về carryover cấp sản phẩm trong livestream: quảng bá lại cùng sản phẩm ngay kỳ sau thì phần thưởng *"can be much smaller than R"*. Simchi-Levi, Zheng, Zhu, Management Science 2024 (bản arXiv 2106.14813, mục 1).

Dự phòng nếu cần một số có đối chứng về AI trong live: trợ lý AI cho người mua *"increases sales by 3.00% and reduces product return rates by 12.55%"* (Wang và cộng sự, ISR 2025, tóm tắt).

### 7.3 Một ý tưởng hình

Một dải ngang là một phiên 60 phút cắt thành 12 khối 5 phút, tô hai màu BẬT và TẮT theo lịch bốc thăm thật của phòng dàn dựng; phút đầu mỗi khối gạch chéo nhạt (burn-in). Bên dưới là đường số người xem theo phút, có một chỗ vọt lên do "nền tảng đẩy người" rơi vào cả khối BẬT lẫn TẮT. Bên phải là hình nhỏ: phân phối thống kê kiểm định khi bốc thăm lại lịch nhiều lần, với vạch giá trị quan sát. Chú thích một dòng: "So trong cùng phiên, giữa các khối được bốc thăm, không so trước với sau." Hình này giải thích được cả ba ý: chia thời gian, burn-in, và kiểm định ngẫu nhiên hóa, mà không cần công thức.

## 8. Hai mươi câu hỏi phản biện

Câu trả lời viết ngắn để nói được trong 30 đến 45 giây. Mọi con số về LiveLift lấy từ bộ số chuẩn; mọi con số bên ngoài có nguồn ở mục 2, 4, 5.

**1. Phòng xem dàn dựng dùng tiền ảo thì kết quả có giá trị gì ngoài phòng đó?**
Giá trị chính là kiểm toàn bộ đường ống với người thật (gán, ghi phơi nhiễm, đo nhấp, phân tích) và đo các tham số mà mô phỏng phải đoán: độ dài carryover, tương quan giữa khối, tỷ lệ rời phòng. Độ lớn hiệu ứng ở phòng dàn dựng không ngoại suy sang phiên bán thật, vì người xem là tình nguyện viên và tiền là tiền ảo. Chúng tôi báo cáo nó là số pilot, không dùng để hứa doanh số.

**2. Chỉ 5 đến 15 người xem thì lực kiểm định bao nhiêu?**
Thấp, và chúng tôi nói trước. Tính đơn giản: với 18 khối BẬT và 18 khối TẮT (ba phiên khối 5 phút), mức hiệu ứng nhỏ nhất phát hiện được với lực 80% ở mức 5% hai phía vào khoảng 2,8 × √(2/18) ≈ 0,93 lần độ lệch chuẩn của kết quả giữa các khối. Nghĩa là chỉ thấy được hiệu ứng lớn. Mục tiêu của phòng dàn dựng là kiểm tra thủ tục và đo phương sai để tính cỡ mẫu cho phiên thật, không phải để tìm một kết quả có ý nghĩa.

**3. Thuật toán nền tảng đẩy thêm người xem sau một khối tốt thì ước lượng có lệch không?**
Có thể. Ba lớp phòng vệ: kết quả chuẩn hóa theo viewer-giây nên khối đông người không tự động thắng; burn-in đầu mỗi khối và phân tích độ nhạy với carryover một khối; kiểm định carryover của Liu và Zhong (2026) cho cận dưới độ dài carryover. Văn liệu cho thấy rủi ro này có thật: ở Douyin, ước lượng ngây thơ trong mô phỏng hiệu chỉnh sai dấu, khoảng −800% hiệu ứng thật (Farias và cộng sự 2023, mục 7.3). Trong phiên thật, phần lưu lượng do thuật toán đẩy thêm vì ghim là một phần hiệu ứng mà người bán quan tâm, nên estimand ITT bao gồm nó.

**4. Đồng ý và đạo đức thế nào?**
Phòng dàn dựng: người tham gia đồng ý trước, ẩn danh, mua bằng tiền ảo, không thu thông tin liên lạc. Phiên thật: can thiệp là hành động bình thường của người bán (ghim sản phẩm), mọi người xem thấy cùng một màn hình, không ai bị đối xử khác nhau theo cá nhân. Bình luận được lọc dữ liệu cá nhân trước khi ghi đĩa. Từ 17/09/2026 chỉ dùng API chính thức; 19.126 bình luận thu bằng yt-dlp ngày 9 và 10/09/2026 đã xóa dữ liệu thô. Khung pháp lý tham chiếu là Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 và Nghị định 356/2025/NĐ-CP.

**5. Đây chẳng phải chỉ là A/B test sao?**
A/B test chia người xem. Trong một phòng live mọi người thấy cùng màn hình nên không chia được người, phải chia thời gian. Đó là switchback, và phần khó là carryover, số khối rất ít, mẫu số nội sinh.

**6. Statsig và DataTester đã có switchback, vậy LiveLift mới ở đâu?**
Phương pháp không mới, và chúng tôi không nhận là mới. Các nền tảng đó giả định bạn sở hữu sản phẩm để nhúng SDK và có kho dữ liệu. Người bán trên TikTok Shop hay Shopee Live không có những thứ đó. Cái mới là đưa switchback tới người không sở hữu nền tảng, ở quy mô một phiên 12 đến 24 khối.

**7. TikTok đã gợi ý sản phẩm nên ghim kèm GMV ước tính, cần gì LiveLift?**
Gợi ý đó là dự đoán, không cho biết ghim làm bán thêm bao nhiêu so với không ghim. LiveLift có thể lấy chính gợi ý của TikTok làm chính sách tầng trong và đo xem làm theo gợi ý có tạo thêm nhấp không. Hai thứ bổ sung nhau.

**8. Chưa có phiên ngẫu nhiên nào với người bán thật, lấy gì chứng minh?**
Đúng, số phiên ngẫu nhiên với người bán thật hiện là 0. Thứ đã chứng minh được là ước lượng viên hiệu chỉnh đúng trên mô phỏng (A/A 200 lần: bác bỏ 3,50%, độ phủ 96,50%, độ lệch −0,84%) và đường ống chạy với người thật ở phòng dàn dựng. Thứ chưa chứng minh là hiệu ứng thật của ghim. Lộ trình là giao thức không cần API cho người bán TikTok (ghim theo lịch, gửi CSV đơn có giờ).

**9. Mô phỏng do chính đội viết thì có phải tự chấm điểm mình không?**
Mô phỏng chỉ dùng để kiểm hiệu chỉnh (khi không có hiệu ứng, có bác bỏ đúng 5% không), không dùng để chứng minh ghim có tác dụng. Văn liệu cũng cho thấy mô phỏng không thay được thí nghiệm thật: SimGym của Shopify báo 77% trùng chiều hiệu ứng với dữ liệu người mua thật, và một nghiên cứu của Amazon trên 67 thí nghiệm cho tỷ lệ trùng dấu 0,70, thấp hơn một dự báo không thông tin (mục 3.4).

**10. NLP 0,870 nhưng trên chat thật chỉ 0,542?**
Đúng, và 0,870 là trên mẫu do AI viết. Trên chat thật macro-F1 tăng từ 0,211 lên 0,542 sau cải tiến, với 11 lớp, nhãn do một tác tử AI gán chứ chưa phải người. Vì thế radar ý định chỉ là công cụ phụ, không nằm trong kết luận nhân quả. Việc tiếp theo là nhãn người độc lập.

**11. Nếu carryover dài hơn một khối thì sao?**
Phân tích độ nhạy với m = 1 khối có sẵn. Bojinov và cộng sự (2023) khuyên khai m hơi dài hơn thực tế thay vì ngắn hơn nhiều. Kiểm định carryover cho biết nếu giả định chính bị vi phạm. Nếu carryover dài thật, câu trả lời đúng là kéo dài khối cho phiên sau, không phải sửa số.

**12. Người dẫn biết lịch thì có tự làm khác đi không?**
Màn hình người dẫn che lịch khối, nhưng người dẫn vẫn thấy sản phẩm đang ghim, nên làm mù chỉ một phần. Kiểm định không tiên liệu (Liu và Zhong 2026) là phép thử: nếu khối ngay trước khối BẬT đã khác thì có rò rỉ. Bằng chứng cho thấy người dẫn ứng biến theo số liệu thời gian thực (MISQ 2025), nên chúng tôi không hiện số theo khối cho người dẫn.

**13. Kết quả không có ý nghĩa thống kê thì sản phẩm vô dụng?**
Không. Kết quả hợp lệ có ba dạng: nên làm, không nên làm, chưa đủ bằng chứng thì đo thêm. Biết một thói quen ghim không tạo thêm doanh số cũng là thông tin có giá trị.

**14. Vì sao đo nhấp chứ không đo đơn?**
Đơn hàng đến trễ và người bán nhỏ không có API đơn theo thời gian thực. Nhấp qua link đo là thứ đo được trong khối. Đơn là biến phụ khi có nguồn chính thức (xem mục 5 về số theo phút của TikTok Shop) và phải tách số tạm khỏi số đã chốt.

**15. Sao không dùng dữ liệu Kalodata, FastMoss hay 蝉妈妈?**
Số GMV của các công cụ đó là ước tính của mô hình, không phải sổ giao dịch, và họ không công bố cách thu thập. Ở Trung Quốc đã có án lệ về thu thập dữ liệu live trái phép (vụ 小葫芦 năm 2021, vụ 蝉小红 công bố năm 2025). Biến kết quả của thí nghiệm phải là dữ liệu do người bán sở hữu.

**16. 19.126 bình luận thu bằng yt-dlp có vấn đề pháp lý không?**
Đó là bình luận công khai của 16 phiên, thu ngày 9 và 10/09/2026 để kiểm thử. Dữ liệu thô đã xóa; từ 17/09/2026 đội chỉ dùng API chính thức. Chúng tôi nói rõ cách thu trên slide thay vì giấu.

**17. Người bán nhỏ có hiểu p-value không?**
Không cần. Đầu ra cho người bán là quyết định (nên làm, không nên, đo thêm) kèm một câu giải thích và khoảng ước lượng bằng đơn vị dễ hiểu (nhấp trên 1.000 người xem mỗi phút). Chi tiết thống kê nằm ở trang dành cho người kiểm tra.

**18. Thị trường có đủ lớn không?**
Doanh số thương mại điện tử Việt Nam nửa đầu 2026 trên các sàn lớn khoảng 264,8 đến 291,6 nghìn tỷ đồng tùy đơn vị đo (YouNet ECI và Metric, xem mục 5); TikTok Shop chiếm khoảng 43% theo YouNet ECI. Chúng tôi không dùng con số "2,5 triệu phiên live mỗi tháng" vì chưa truy được nguồn gốc.

**19. Khác gì các đội khác cùng mảng thương mại điện tử?**
Các đội khác giúp người bán dự đoán và tự động hóa (tồn kho, đánh giá, định giá, khách rời bỏ). LiveLift trả lời câu hỏi đứng sau mọi đề xuất: làm vậy có thật sự bán thêm không. Theo phần giới thiệu công khai, không đội nào khác làm livestream hay thí nghiệm ngẫu nhiên.

**20. Nếu nền tảng đổi quy tắc hoặc thuật toán giữa chừng thì sao?**
Thay đổi xảy ra trong phiên ảnh hưởng cả khối BẬT lẫn TẮT vì khối xen kẽ ngẫu nhiên; đó là lý do chia thời gian chứ không so trước sau. Thay đổi giữa các phiên được ghi trong nhật ký phiên và phân tích theo phiên. Rủi ro còn lại là thay đổi trùng thời điểm với lịch gán, xác suất thấp và được ghi làm giới hạn.

## 9. Danh mục tham khảo

Ngày truy cập mặc định 15/10/2026. Mức xác minh: ĐĐ đã đọc bản gốc (toàn văn hoặc trang chính thức); TT chỉ đọc tóm tắt, bản ghi Crossref hoặc arXiv, hay đoạn trích; CKC chưa kiểm chứng được.

### 9.1 Văn liệu học thuật

| # | Tác giả, năm | Tiêu đề | Nơi đăng | DOI hoặc URL | Mức |
|---|---|---|---|---|---|
| A1 | Missault, Masoero, Delbé, Richardson, Imbens (2025) | Robust and efficient multiple-unit switchback experimentation | arXiv 2506.12654v1 | https://arxiv.org/abs/2506.12654 | ĐĐ |
| A2 | Chen, Bai, Zheng, Si (2025, cập nhật 2026) | Experimental Designs for Multi-Item Multi-Period Inventory Control | arXiv 2501.11996v4; chấp nhận tại EC '26 | https://arxiv.org/abs/2501.11996 | ĐĐ |
| A3 | Farias, Li, Peng, Ren, Zhang, Zheng (2023) | Correcting for Interference in Experiments: A Case Study at Douyin | RecSys '23, tr. 455–466 | https://doi.org/10.1145/3604915.3608808 ; arXiv 2305.02542 | ĐĐ |
| A4 | Ham, Lindon, Tingley, Bojinov (2026) | Design-Based Confidence Sequences: A General Approach to Risk Mitigation in Panel Experiments | Management Science (trực tuyến 10/08/2026) | https://doi.org/10.1287/mnsc.2024.08235 ; arXiv 2210.08639v4 | ĐĐ (arXiv v4) |
| A5 | Simchi-Levi, Zheng, Zhu (2024) | Offline Planning and Online Learning Under Recovering Rewards | Management Science (trực tuyến 03/04/2024) | https://doi.org/10.1287/mnsc.2021.04202 ; arXiv 2106.14813v2 | ĐĐ (arXiv); TT (bản tạp chí) |
| A6 | Zhang Bolun, Zhou Yan, Jiang Minghui (2026) | The relationship between consumer engagement behavior and sales performance in e-commerce live-streaming: from a dynamic perspective | Marketing Intelligence & Planning 44(4):723–742 | https://doi.org/10.1108/MIP-10-2024-0728 | TT |
| A7 | Liu, Zhong (2026) | Randomization Tests in Switchback Experiments | arXiv 2602.23257v2 (29/09/2026) | https://arxiv.org/abs/2602.23257 | ĐĐ |
| A8 | Yu, Zhong, Liu, Wu, Zhang, Zhang, Chen, Lu (2026) | Click-to-Ask: An AI Live Streaming Assistant with Offline Copywriting and Online Interactive QA | WWW 2026 Demos | https://doi.org/10.1145/3774905.3793134 ; arXiv 2603.18649 | ĐĐ |
| A9 | Bojinov, Simchi-Levi, Zhao (2023) | Design and Analysis of Switchback Experiments | Management Science 69(7):3759–3777 | https://doi.org/10.1287/mnsc.2022.4583 ; arXiv 2009.00148v4 | ĐĐ |
| A10 | Hu, Wager (2022, v5 2026) | Switchback Experiments under Geometric Mixing | arXiv 2209.00197v5 (21/09/2026) | https://arxiv.org/abs/2209.00197 | TT |
| A11 | Xiong, Chin, Taylor (2024) | Data-Driven Switchback Experiments: Theoretical Tradeoffs and Empirical Bayes Designs | arXiv 2406.06768 | https://arxiv.org/abs/2406.06768 | TT |
| A12 | Zeng, Adjaho, Bucarey, Qin, Zhang, Hoban, Johari, Wager (2026) | Sequentially-Rerandomized Switchback Experiments | arXiv 2604.02489 | https://arxiv.org/abs/2604.02489 | TT |
| A13 | Pankratev (2026) | Powerful Switchback Experiments — Or Not? | arXiv 2606.03012 | https://arxiv.org/abs/2606.03012 | TT |
| A14 | Pankratev (2026) | Design-Aware Variance Reduction for Switchback Experiments: A Comparative Study | arXiv 2606.27662v2 | https://arxiv.org/abs/2606.27662 | TT |
| A15 | Lin, Ding (2025) | Unifying regression-based and design-based causal inference in time-series experiments | arXiv 2510.22864 | https://arxiv.org/abs/2510.22864 | TT |
| A16 | Jiang, Ding (2025, v3 2026) | Principled analysis of crossover designs: causal effects, efficient estimation, and robust inference | arXiv 2511.09215v3 | https://arxiv.org/abs/2511.09215 | TT |
| A17 | Missault, Masoero (2025) | Carryover Detection in Switchback Experimentation | NeurIPS 2025 Workshop CauScien (theo danh mục tham khảo của A7) | https://www.amazon.science/publications/carryover-detection-in-switchback-experimentation | TT |
| A18 | He, Huang, Wang, Sun (2025) | Real-Time Sales Data, Streamer Improvisation, and Sales Performance: Evidence from Live Stream Selling | MIS Quarterly 49(4):1567–1594 | https://aisel.aisnet.org/misq/vol49/iss4/17/ | TT (toàn văn bị chặn 403) |
| A19 | Wang, Huang, He, Liu, Guo, Sun, Chen (2025) | Artificial Intelligence (AI) Assistant in Online Shopping: A Randomized Field Experiment on a Livestream Selling Platform | Information Systems Research 36(4):2358–2374 | https://doi.org/10.1287/isre.2023.0103 | TT |
| A20 | Liu, Wang, Yang, Wang (2026) | Artificial Intelligence-Powered Digital Streamers in Online Retail | Information Systems Research 37(2):824–841 | https://doi.org/10.1287/isre.2023.0024 | TT (đã kiểm trong bản 17/09) |
| A21 | Xie, Sharma, Mehra (2025) | Designing E-commerce Livestreams: How Product Presentation Duration Affects Sales? | Production and Operations Management 34(12):4079–4096 | https://doi.org/10.1177/10591478251314455 | TT |

### 9.2 Trung Quốc: văn bản, tài liệu nền tảng, tin

| # | Nguồn | Nội dung dùng | URL | Mức |
|---|---|---|---|---|
| B1 | Sở Thương mại Phúc Kiến (28/02/2026), đăng lại 《2025直播电商行业发展白皮书》 | Quy mô trên 5 nghìn tỷ NDT, 店播 trên 50%, 6,6 trăm triệu người dùng | https://swt.fujian.gov.cn/xxgk/jgzn/jgcs/sctxjsc/gzdt_386/202602/t20260228_7103174.htm | ĐĐ |
| B2 | 新华网 (04/02/2026) | Đối chiếu công bố sách trắng | http://www.news.cn/tech/20260204/61e8566bf2214265969471d0f9d976c3/c.html | ĐĐ |
| B3 | 抖音电商学习中心: thẻ giảng giải | Thẻ giảng giải tự ẩn, bấm lại để giữ | https://school.jinritemai.com/doudian/web/articlev0/102057 | ĐĐ |
| B4 | 抖音电商学习中心: bàn điều khiển di động (23/06/2023) | Số 5 phút gần nhất, nhãn sản phẩm tiềm năng, 置顶 | https://school.jinritemai.com/doudian/web/articlev0/aHpasRTJBvgF | ĐĐ |
| B5 | FAQ 罗盘 (15/12/2023) | Độ phân giải phút; điểm giảng giải có thể mất | https://school.jinritemai.com/doudian/web/articlev0/aHyVTUvYbCBv | ĐĐ |
| B6 | 罗盘: công thức vàng và dòng thời gian hành động (08/06/2023) | Tự mô tả là *"相关性"* | https://school.jinritemai.com/doudian/web/articlev0/aHSMTiukjMnW | ĐĐ |
| B7 | 罗盘: định nghĩa chỉ số | Phễu vào phòng → hiển thị → nhấp → đơn | https://school.jinritemai.com/doudian/web/articlev0/104021 | ĐĐ |
| B8 | 环球网 qua 腾讯新闻 (11/12/2025); 新华财经 qua 新浪 (15/12/2025) | Ra mắt 千川·乘方 | https://news.qq.com/rain/a/20251211A06Y8X00 ; https://finance.sina.com.cn/jjxw/2025-12-15/doc-inhavwnp4307756.shtml | ĐĐ |
| B9 | 亿邦动力 (09/01/2026); 网易 (24/07/2026) | Phí 0,6%; nâng cấp 智投星 | https://news.qq.com/rain/a/20260109A055QB00 ; https://www.163.com/dy/article/L2K4B3BA05562ISM.html | ĐĐ |
| B10 | 南方都市报 qua 腾讯新闻 (09/04/2026) | Số AI của 淘宝直播 (nhà cung cấp tự nêu) | https://news.qq.com/rain/a/20260409A0696C00 | ĐĐ |
| B11 | 快手, báo cáo quý 4 và cả năm 2025 (25/03/2026) | GMV 1.598,1 tỷ NDT | https://www.prnewswire.com/apac/news-releases/kuaishou-technology-announces-fourth-quarter-and-full-year-2025-financial-results-302724632.html | ĐĐ |
| B12 | 《人工智能生成合成内容标识办法》 (14/03/2025) | Nhãn nội dung AI, hiệu lực 01/09/2025 | https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm | ĐĐ |
| B13 | 《直播电商监督管理办法》 (Lệnh 117), Công báo 2026 | Điều 37 người dẫn do AI tạo; hiệu lực 01/02/2026 | https://www.gov.cn/gongbao/2026/issue_12666/202604/content_7065114.html | ĐĐ |
| B14 | 火山引擎 DataTester, bài cộng đồng nhà phát triển | 时间片轮转实验 | https://developer.volcengine.com/articles/7291560091340242963 | ĐĐ |
| B15 | 神策数据, sổ tay "新建时间片轮转试验" (27/12/2024) | Lát 1–24 giờ, xen kẽ tất định | https://manual.sensorsdata.cn/abtesting/docs/time_slice_round_robin_experiment/v0102 | ĐĐ |

### 9.3 Việt Nam và Đông Nam Á: pháp luật, thị trường, nền tảng

| # | Nguồn | Nội dung dùng | URL | Mức |
|---|---|---|---|---|
| C1 | Luật Thương mại điện tử 122/2025/QH15 | Điều 3, 18, 22–24, 40 | https://luatvietnam.vn/thuong-mai/luat-thuong-mai-dien-tu-cua-quoc-hoi-so-122-2025-qh15-423356-d1.html | ĐĐ |
| C2 | Nghị định 248/2026/NĐ-CP | Điều 11, 12, 52 (định danh từ 01/01/2027) | https://vanban.chinhphu.vn/?pageid=27160&docid=218747 ; https://dulieuphapluat.vn/van-ban/thuong-mai-van-ban/nghi-dinh-2482026nd-cp-huong-dan-luat-thuong-mai-dien-tu-1389723.html | ĐĐ |
| C3 | Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 | Điều 2, 9, 11, 14, 19, 38 | https://luatvietnam.vn/dan-su/luat-bao-ve-du-lieu-ca-nhan-2025-so-91-2025-qh15-405135-d1.html | ĐĐ |
| C4 | Nghị định 356/2025/NĐ-CP | Điều 3, 6, 41 | https://luatvietnam.vn/dan-su/nghi-dinh-356-2025-nd-cp-quy-dinh-chi-tiet-luat-bao-ve-du-lieu-ca-nhan-422896-d1.html | ĐĐ |
| C5 | Luật sửa đổi Luật Quảng cáo 75/2025/QH15 | Điều 15a, 23 | Bản PDF trên cổng thông tin Hà Nội (storage-vnportal.vnpt.vn) | ĐĐ |
| C6 | Metric, nửa đầu 2026 | 291,6 nghìn tỷ đồng, +44,11% | https://metric.vn/resource/blog/metric-bao-cao-thuong-mai-dien-tu-viet-nam-6-thang-dau-nam-2026 | ĐĐ |
| C7 | YouNet ECI, nửa đầu 2026 | 264,8 nghìn tỷ đồng, +19% | https://youneteci.com/vi/bao-cao-toan-canh-tmdt-viet-nam-nua-dau-nam-2026/ | ĐĐ |
| C8 | YouNet ECI, quý 3/2026 (14/10/2026) | 411,8 nghìn tỷ đồng 9 tháng, +22% | https://youneteci.com/vi/bao-cao-toan-canh-tmdt-viet-nam-q3-2026/ | ĐĐ |
| C9 | PLO/Tuổi Trẻ (24/04/2024); VnEconomy (03/05/2024) | Gốc con số "2,5 triệu phiên" | https://tuoitre.vn/plo/moi-thang-nguoi-viet-chung-kien-25-trieu-phien-livestream-ban-hang-post787242.html ; https://vneconomy.vn/gioi-tre-viet-chuong-mua-hang-qua-phien-livestream.htm | ĐĐ |
| C10 | Dân trí (29/09/2026) | 162.700 gian hàng không còn doanh thu | https://dantri.com.vn/kinh-doanh/suc-ep-chi-phi-bua-vay-hon-160000-gian-hang-thuong-mai-dien-tu-dong-cua-20260929092200561.htm | ĐĐ |
| C11 | Momentum Works, Live Commerce in SEA 2026 (09/2026) | Content commerce 37%, 77,9 tỷ USD | https://thelowdown.momentum.asia/new-report-southeast-asias-content-commerce-on-track-to-reach-us77-9b-in-2026/ | ĐĐ |
| C12 | Momentum Works, Ecommerce in SEA 2026 (14/04/2026) | 157,6 tỷ USD năm 2025 | https://thelowdown.momentum.asia/new-report-southeast-asias-platform-ecommerce-reaches-us157-6b-in-2025-with-top-platforms-expanding-share-to-98-8/ | ĐĐ |
| C13 | TikTok Newsroom Việt Nam (30/07/2026) | GMV +66% năm 2025 | https://newsroom.tiktok.com/tiktok-shop-summit-vietnam-2026?lang=vi-VN | ĐĐ |
| C14 | TikTok Seller University VN: phân tích AI trong LIVE (24/06/2026) | Gợi ý ghim; +7,38% (dữ liệu nội bộ) | https://seller-vn.tiktok.com/university/essay?knowledge_id=4898053111744273&lang=vi-VN | ĐĐ |
| C15 | TikTok Seller University: LIVE Manager (US), Bảng điều khiển LIVE (VN), Cẩm nang lưu lượng (VN), nhịp ghim (US) | Suggestions; xuất số sau phiên; ERR/CTR/CTOR/GPM; "10–15 phút" | knowledge_id 3360165320984366 ; 967473030956801 ; 512121839519504 ; 463621005051661 | ĐĐ |
| C16 | TikTok Shop Partner Center: LIVE Minute Performance, Performance Overview, Core Stats, Authorization | Số theo phút sau phiên; OAuth | https://partner.tiktokshop.com/docv2/page/get-shop-live-minute-performance-202510 (và các trang cùng nhóm) | ĐĐ |
| C17 | Shopee Open Platform: Livestream API Integration Guide; `v2.livestream.update_show_item` | Ghim bằng API tại VN; số thời gian thực; bình luận 10 giây | https://open.shopee.com/developer-guide/669 ; https://open.shopee.com/documents/v2/v2.livestream.update_show_item?module=125&type=1 | ĐĐ |
| C18 | YouTube Data API: `liveChatMessages.streamList`; hạn mức | 5 đơn vị/lần; 10.000 đơn vị/ngày | https://developers.google.com/youtube/v3/live/docs/liveChatMessages/streamList | ĐĐ |
| C19 | Meta Live Video API: Interacting with Viewers | Bình luận truy vấn định kỳ hoặc SSE; App Review | https://developers.facebook.com/documentation/live-video-api/interact-with-viewers | ĐĐ |
| C20 | VTV (30/05/2026) | Livestream AI "50–60% con người" | https://vtv.vn/ai-hoan-toan-co-the-livestream-ban-hang-100260530094030536.htm | ĐĐ |

### 9.4 Công cụ và nền tảng thí nghiệm

| # | Nguồn | Nội dung dùng | URL | Mức |
|---|---|---|---|---|
| D1 | Statsig: Switchback Tests | Cửa sổ, burn-in; bootstrap trên bucket; chưa hỗ trợ CUPED và sequential | https://docs.statsig.com/experiments/types/switchback-tests | ĐĐ |
| D2 | Statsig: Switchback V2 (Warehouse Native) | Mỗi bucket một điểm dữ liệu; hồi quy theo giờ | https://docs.statsig.com/experiments/types/switchback-v2 | ĐĐ |
| D3 | Eppo: Switchbacks | Closed Beta | https://docs.geteppo.com/experiment-analysis/switchbacks/ | ĐĐ |
| D4 | GrowthBook: Cluster Experiments | Phương pháp delta, không có switchback | https://docs.growthbook.io/experimentation-analysis/cluster-experiments.md | ĐĐ |
| D5 | Spotify Confidence: trang so sánh switchback (16/06/2026, bên cạnh tranh) | Chỉ Eppo và Statsig hỗ trợ | https://confidence.spotify.com/rfp/rfp-switchback | ĐĐ |
| D6 | Opsique: Platform | Vận hành LIVE TikTok Shop, không A/B | https://www.opsique.com/platform/ | ĐĐ |
| D7 | Haravan: phần mềm bán hàng livestream | Chốt đơn theo bình luận, từ 800.000 đồng/tháng | https://www.haravan.com/pages/phan-mem-ban-hang-livestream | ĐĐ |
| D8 | LASSO Rundown (Shoflo) | Kịch bản chạy chương trình | https://www.lasso.io/rundown/ | ĐĐ |
