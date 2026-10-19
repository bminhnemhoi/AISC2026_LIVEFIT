import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BaoCaoSchema, type BaoCao, type Session } from "@/lib/livelift-api/types";
import type { DuLieuPhien } from "@/lib/livelift-api/hooks";

const mo = vi.hoisted(() => ({ duLieu: null as unknown }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/phien/s1/tong-ket",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/livelift-api/hooks", () => ({ useDuLieuPhien: () => mo.duLieu }));
vi.mock("@/components/dien-thoai/hooks", () => ({ useDongThoiGian: () => [] }));

import { TongKet } from "../TongKet";

const DOI = BaoCaoSchema.parse(
  JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "lib", "livelift-api", "__tests__", "fixtures", "bao-cao-demo-vang-duong.json"), "utf-8")),
);

const PHIEN = {
  session_id: "s1",
  platform: "sim",
  title: "Demo vàng · ĐỔI #1",
  mode: "auto",
  status: "ended",
  planned_duration_min: 90,
  dry_run: false,
  is_demo: true,
} as unknown as Session;

function duLieu(baoCao: BaoCao, sua: Partial<DuLieuPhien> = {}): DuLieuPhien {
  return {
    phien: PHIEN,
    khoi: [],
    ticks: [],
    binhLuan: [],
    don: null,
    baoCao,
    nguon: { kind: "mo_phong", text: "MÔ PHỎNG", note: "" },
    dangLive: false,
    khoa: false,
    khoiDo: [],
    toNen: { cho: true, dong: null },
    loi: null,
    dangTai: false,
    capNhatLuc: 0,
    lamMoi: () => {},
    ...sua,
  } as DuLieuPhien;
}

beforeEach(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= RO;
});

describe("TongKet", () => {
  it("thẻ kết luận ĐỔI: một data-chup, vùng chính, nút chính, giữ data-testid cũ, không chữ cấm", () => {
    mo.duLieu = duLieu(DOI);
    const { container } = render(<TongKet sessionId="s1" />);
    const the = container.querySelectorAll("[data-chup='ket-luan']");
    expect(the).toHaveLength(1);
    expect(the[0].hasAttribute("data-vung-chinh")).toBe(true);
    expect(the[0].querySelector("[data-testid='verdict']")?.textContent).toContain("ĐỔI");
    for (const id of ["experiment-recap", "verdict", "estimate-card", "source-badge", "recap-summary"]) {
      expect(container.querySelector(`[data-testid='${id}']`), id).not.toBeNull();
    }
    const nut = container.querySelector("[data-nut-chinh]");
    expect(nut?.textContent).toBe("Lên lịch phiên tiếp");
    const chu = container.textContent ?? "";
    for (const cam of ["—", "KTC", "hoán vị", "khóa", "SIMULATED"]) expect(chu).not.toContain(cam);
    expect(chu).toContain("Điều chưa biết");
    expect(chu).toContain("Chi tiết cho người kiểm");
  });

  it("khoá §7: không có chữ ĐỔI / GIỮ / ĐO THÊM lớn và không có số ước lượng", () => {
    const khoa = {
      ...DOI,
      ket_qua_thi_nghiem: { ...DOI.ket_qua_thi_nghiem!, khoa: true, ly_do_khoa: "đang chạy", estimate: null, ci_low: null, ci_high: null, p_value: null },
    } as BaoCao;
    mo.duLieu = duLieu(khoa, { khoa: true, khoiDo: null, dangLive: true, phien: { ...PHIEN, status: "live" } as Session });
    const { container } = render(<TongKet sessionId="s1" />);
    const verdict = container.querySelector("[data-testid='verdict']");
    expect(verdict?.getAttribute("data-kind")).toBe("khoa");
    expect(verdict?.textContent).toBe("Đang khoá");
    expect(container.querySelector("[data-chup='ket-luan']")?.textContent).not.toMatch(/1,224|0,932|1,498/);
    expect(container.querySelector("[data-testid='bd-cham']")).toBeNull();
    expect(container.querySelector("[data-testid='bd-cham-khoa']")).not.toBeNull();
    expect(container.querySelector("[data-testid='bd-thuoc']")).toBeNull();
  });
});
