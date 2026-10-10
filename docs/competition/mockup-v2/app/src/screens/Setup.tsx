// Chuẩn bị: three steps, one primary action at a time. Connect (SIMULATED), products (CSV or
// sample pack; each row goes queued → syncing → on the SIMULATED platform), start live.

import { PRODUCTS, SAMPLE_CSV, type ProductId } from "../data";
import { fmtPrice } from "../format";
import { IconCheck, IconLink, IconUpload } from "../icons";
import { connect, importProducts, setState, setupReady, startLive, useSampleCsv, useStore, type RowStatus } from "../store";
import { Button, Skeleton, SimTag } from "../ui";

const STATUS: Record<RowStatus, string> = {
  queued: "Đang chờ",
  syncing: "Đang nạp…",
  synced: "Đã có trên SIMULATED",
};

function StepHead({ n, title, state, summary }: { n: number; title: string; state: "todo" | "active" | "done"; summary?: string }) {
  return (
    <div class="step-head">
      <span class={`step-n is-${state}`} aria-hidden="true">
        {state === "done" ? <IconCheck size={18} /> : n}
      </span>
      <h2>
        <span class="sr-only">Bước {n}: </span>
        {title}
      </h2>
      {summary && <p class="step-summary">{summary}</p>}
      <span class="sr-only">{state === "done" ? "Đã xong" : state === "active" ? "Đang làm" : "Chưa tới"}</span>
    </div>
  );
}

function ProductTable() {
  const rows = useStore((s) => s.rows);
  const importing = useStore((s) => s.importing);
  if (importing) {
    return (
      <div class="table-skel" aria-busy="true" aria-label="Đang đọc CSV">
        {PRODUCTS.map((p) => (
          <div class="skel-row" key={p.id}>
            <Skeleton w={36} h={36} r={10} />
            <Skeleton w="40%" h={14} />
            <Skeleton w="14%" h={14} />
            <Skeleton w="10%" h={14} />
            <Skeleton w="18%" h={24} r={12} />
          </div>
        ))}
      </div>
    );
  }
  const byId = (id: ProductId) => PRODUCTS.find((p) => p.id === id)!;
  return (
    <table class="ptable">
      <caption class="sr-only">Sản phẩm đã nhập và trạng thái trên SIMULATED Shopee Live</caption>
      <thead>
        <tr>
          <th scope="col">Sản phẩm</th>
          <th scope="col" class="r">
            Giá
          </th>
          <th scope="col" class="r">
            Tồn kho
          </th>
          <th scope="col">
            Trạng thái <SimTag quiet>SIMULATED</SimTag>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const p = byId(r.id);
          const missing = p.price === null;
          return (
            <tr key={r.id} class={`prow is-${r.status}`}>
              <th scope="row">
                <span class="thumb sm" aria-hidden="true">
                  {p.initials}
                </span>
                {p.name}
              </th>
              <td class="r num">{missing ? <span class="missing">Chưa nhập</span> : fmtPrice(p.price)}</td>
              <td class="r num">{p.stock === null ? <span class="missing">Chưa nhập</span> : p.stock}</td>
              <td>
                <span class={`status is-${r.status}`}>
                  {r.status === "synced" && <IconCheck size={16} />}
                  {r.status === "syncing" && <span class="spinner" aria-hidden="true" />}
                  {STATUS[r.status]}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function Setup() {
  const s = useStore((x) => x);
  const step1 = s.connect === "done" ? "done" : "active";
  const step2 = s.connect !== "done" ? "todo" : s.rows.length && s.rows.every((r) => r.status === "synced") ? "done" : "active";
  const step3 = setupReady(s) ? "active" : "todo";
  const missing = PRODUCTS.filter((p) => p.price === null || p.stock === null);
  return (
    <main class="screen setup" id="main">
      <div class="setup-intro">
        <h1>Chuẩn bị buổi live</h1>
        <p class="lede">Ba bước, chừng một phút. Sau đó LiveLift đọc bình luận và giỏ hàng để gợi ý bạn nên ghim gì, và vì sao.</p>
        <div class="sim-note">
          <p class="sim-note-title">
            <SimTag>SIMULATED Shopee Live</SimTag>
          </p>
          <p>
            Nền tảng trong mockup này là một bản mô phỏng chạy ngay trong trang. Không có gì được gửi tới Shopee, và mọi con số là dữ liệu mẫu.
          </p>
        </div>
      </div>

      <ol class="steps">
        <li class={`step is-${step1}`}>
          <StepHead n={1} title="Kết nối" state={step1} summary={step1 === "done" ? "Đã kết nối SIMULATED Shopee Live, tài khoản shop_mau_01" : undefined} />
          {step1 !== "done" && (
            <div class="step-body">
              <p>LiveLift cần đọc bình luận, số người xem, lượt thêm giỏ, và gửi lệnh ghim sản phẩm.</p>
              <Button variant="primary" size="lg" icon={<IconLink />} onClick={connect} disabled={s.connect === "connecting"}>
                {s.connect === "connecting" ? "Đang kết nối…" : "Kết nối SIMULATED Shopee Live"}
              </Button>
            </div>
          )}
        </li>

        <li class={`step is-${step2}`}>
          <StepHead
            n={2}
            title="Sản phẩm"
            state={step2}
            summary={step2 === "done" ? `${PRODUCTS.length} sản phẩm đã có trên SIMULATED, ${missing.length} sản phẩm thiếu giá và tồn kho` : undefined}
          />
          {step2 === "active" && s.rows.length === 0 && !s.importing && (
            <div class="step-body">
              <div class="empty-inline">
                <p class="empty-title">Chưa có sản phẩm nào</p>
                <p>Dán CSV có ba cột: tên, giá, tồn kho. Hoặc dùng bộ sản phẩm mẫu để thử.</p>
              </div>
              <label class="field">
                <span class="field-label">CSV sản phẩm</span>
                <textarea
                  rows={5}
                  value={s.csv}
                  spellcheck={false}
                  placeholder={"ten_san_pham,gia,ton_kho\nÁo hoodie zip,199000,24"}
                  onInput={(e) => setState({ csv: (e.target as HTMLTextAreaElement).value })}
                />
              </label>
              <div class="row">
                <Button variant={s.csv.trim() ? "primary" : "secondary"} size="lg" icon={<IconUpload />} disabled={!s.csv.trim()} onClick={importProducts}>
                  Nhập sản phẩm
                </Button>
                {!s.csv.trim() && (
                  <Button variant="quiet" size="lg" onClick={useSampleCsv}>
                    Dùng bộ sản phẩm mẫu
                  </Button>
                )}
              </div>
            </div>
          )}
          {step2 !== "todo" && (s.rows.length > 0 || s.importing) && (
            <div class="step-body">
              <ProductTable />
              {s.rows.length > 0 && (
                <p class="note-warn">
                  <b>Túi vải tote</b>: giá và tồn kho chưa nhập. LiveLift để trống, không coi là 0. Vẫn bắt đầu live được; thêm giá trước khi ghim sản phẩm này.
                </p>
              )}
              {s.rows.length > 0 && s.csv.trim() !== SAMPLE_CSV && (
                <p class="step-note">Mockup này luôn nạp bộ sản phẩm mẫu, kể cả khi bạn dán CSV khác. Bản thật đọc đúng CSV của bạn.</p>
              )}
            </div>
          )}
        </li>

        <li class={`step is-${step3}`}>
          <StepHead n={3} title="Bắt đầu live" state={step3} />
          {step3 === "active" && (
            <div class="step-body">
              <p>
                Buổi mẫu dài 30 phút. LiveLift bắt đầu đọc tín hiệu ngay khi bạn bấm; bạn vẫn ghim, bỏ ghim bất kỳ lúc nào.
              </p>
              <Button variant="primary" size="lg" onClick={startLive}>
                Bắt đầu live
              </Button>
            </div>
          )}
        </li>
      </ol>
    </main>
  );
}
