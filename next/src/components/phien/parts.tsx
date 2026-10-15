import type { EstimateState, SourceLabel } from "@/lib/livelift-api/desk";
import { fmtNum, verdict } from "@/lib/livelift-api/desk";

/** The seller-facing decision (đổi / giữ / đo thêm) above the numbers it rests on. */
export function VerdictBanner({ state }: { state: EstimateState }) {
  const v = verdict(state);
  return (
    <div className="ph-verdict" data-kind={v.kind} data-testid="verdict" role="status">
      <strong>{v.label}</strong>
      <span>{v.detail}</span>
    </div>
  );
}

export function SourceBadge({ label }: { label: SourceLabel }) {
  return (
    <span className="ph-badge" data-kind={label.kind} data-testid="source-badge">
      {label.text}
      <span className="ph-badge-note">{label.note}</span>
    </span>
  );
}

/** A number line from ciLow to ciHigh with zero marked: the reader sees at once whether the interval crosses 0. */
function CiLine({ lo, hi, est }: { lo: number; hi: number; est: number }) {
  const min = Math.min(lo, 0);
  const max = Math.max(hi, 0);
  const span = max - min || 1;
  const x = (v: number): number => 8 + ((v - min) / span) * 284;
  return (
    <svg width="300" height="40" viewBox="0 0 300 40" role="img" aria-label={`Khoảng tin cậy 95% từ ${fmtNum(lo, 3)} đến ${fmtNum(hi, 3)}`}>
      <line x1={x(0)} y1="4" x2={x(0)} y2="36" stroke="var(--ink-3)" strokeDasharray="3 3" />
      <line x1={x(lo)} y1="20" x2={x(hi)} y2="20" stroke="var(--ink)" strokeWidth="3" />
      <circle cx={x(est)} cy="20" r="6" fill="var(--ink)" />
      <text x={x(0)} y="38" fontSize="10" textAnchor="middle" fill="var(--ink-3)">0</text>
    </svg>
  );
}

export function EstimateCard({ state }: { state: EstimateState }) {
  switch (state.kind) {
    case "estimate":
      return (
        <div data-testid="estimate-card">
          <div className="ph-est-num">{state.estimate >= 0 ? "+" : ""}{fmtNum(state.estimate, 3)}</div>
          <p className="ph-muted" style={{ margin: 0 }}>
            click / 1.000 giây·người xem · KTC 95% [{fmtNum(state.ciLow, 3)}; {fmtNum(state.ciHigh, 3)}]
            {state.pValue != null && ` · p = ${fmtNum(state.pValue, 3)}`}
          </p>
          <CiLine lo={state.ciLow} hi={state.ciHigh} est={state.estimate} />
          <p className="ph-small">
            Từ {state.nBlocks} khối bốc thăm ({state.nOn} BẬT, {state.nOff} TẮT).{" "}
            {state.crossesZero ? "Khoảng tin cậy chứa 0: chưa đủ bằng chứng là ghim có tác dụng." : "Khoảng tin cậy không chứa 0."}
          </p>
        </div>
      );
    case "not_enough":
      return (
        <div data-testid="estimate-card">
          <p style={{ margin: 0 }}><strong>Chưa đủ khối để kết luận</strong></p>
          <p className="ph-muted">{state.message}</p>
          <p className="ph-small">Đã có {state.nBlocks} khối đo được.</p>
        </div>
      );
    case "locked":
      return (
        <div data-testid="estimate-card">
          <p style={{ margin: 0 }}><strong>Kết quả đang khoá</strong></p>
          <p className="ph-muted">{state.reason}</p>
        </div>
      );
    case "observational":
      return (
        <div data-testid="estimate-card">
          <p style={{ margin: 0 }}><strong>Phiên quan sát: không có số nhân quả</strong></p>
          <p className="ph-muted">{state.reason}</p>
        </div>
      );
  }
}
