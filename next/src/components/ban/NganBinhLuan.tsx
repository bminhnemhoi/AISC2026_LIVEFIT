"use client";

import React from "react";
import { ThanhYDinh } from "@/components/bieu-do";
import { Chip } from "@/components/nen";
import { intentLabel } from "@/lib/livelift-api/desk";
import type { Comment } from "@/lib/livelift-api/types";
import { docChoDaChe, toneYDinh } from "./logic";

/** Ngăn phải: thanh ý định ở đầu, rồi bình luận mới nhất tô màu theo ý định. Bình luận đã che thông tin cá nhân. */
export function NganBinhLuan({ binhLuan, toiDa = 40 }: { binhLuan: Comment[]; toiDa?: number }) {
  const ds = [...binhLuan].reverse().slice(0, toiDa);
  return (
    <section className="ban-the ban-ngan" aria-labelledby="ban-h-binh-luan">
      <h2 id="ban-h-binh-luan" className="ban-the__tieu-de">
        Bình luận
      </h2>
      <p className="ban-phu">Đã che thông tin cá nhân · {binhLuan.length.toLocaleString("vi-VN")} bình luận</p>
      <ThanhYDinh binhLuan={binhLuan} toiDa={5} muc={3} />
      {ds.length === 0 ? (
        <p className="ban-phu">Chưa có bình luận.</p>
      ) : (
        <ul className="ban-ngan__ds">
          {ds.map((c) => {
            const ten = intentLabel(c.intent);
            return (
              <li key={c.comment_id} className="ban-ngan__dong" data-tone={toneYDinh(c.intent)}>
                {ten ? <Chip tone={toneYDinh(c.intent)}>{ten}</Chip> : null}
                <span className="ban-ngan__chu">{docChoDaChe(c.text)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
