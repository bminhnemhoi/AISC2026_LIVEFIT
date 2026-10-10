"use client";

import React, { useState } from "react";
import Link from "next/link";
import { StandardShell } from "@/components/shell";
import { Button, Dialog } from "@/components/ui";
import { ProductSnapshot } from "@/contracts";
import { PACK_LIBRARY, PRODUCT_LIBRARY } from "@/fixtures/library";

export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState<"products" | "packs">("products");
  const [products] = useState<ProductSnapshot[]>(PRODUCT_LIBRARY);
  const [selectedProduct, setSelectedProduct] = useState<ProductSnapshot | null>(null);
  const [inspectPackId, setInspectPackId] = useState<string | null>(null);
  const inspected = PACK_LIBRARY.find((p) => p.id === inspectPackId) ?? null;

  const packs = PACK_LIBRARY;

  return (
    <StandardShell>
      <div className="flex-1 overflow-y-auto w-full max-w-[1240px] mx-auto px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[34px] font-medium tracking-tight text-[#F5F7FC]">
              Product Library
            </h1>
            <p className="text-[16px] text-[#B7C1CE] mt-1">
              Sample products and pack templates for Run of Show preparation.
            </p>
          </div>

          <div className="flex gap-2 bg-[#13161C] p-1 rounded-[8px] border border-[#232935]" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "products"}
              onClick={() => setActiveTab("products")}
              className={`min-h-[44px] px-4 rounded-[8px] text-[15px] font-medium cursor-pointer transition-colors ${
                activeTab === "products"
                  ? "bg-[#252A34] text-[#DFFF00]"
                  : "text-[#CAD0DA] hover:text-white"
              }`}
            >
              Products ({products.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "packs"}
              onClick={() => setActiveTab("packs")}
              className={`min-h-[44px] px-4 rounded-[8px] text-[15px] font-medium cursor-pointer transition-colors ${
                activeTab === "packs"
                  ? "bg-[#252A34] text-[#DFFF00]"
                  : "text-[#CAD0DA] hover:text-white"
              }`}
            >
              Packs ({packs.length})
            </button>
          </div>
        </div>

        <p className="text-[15px] text-[#CAD0DA]">
          To use your own products, create a LIVE and paste your lineup in Prepare → Product Pack → Import.{" "}
          <Link href="/live/new" className="text-[#DFFF00] underline underline-offset-4">Create LIVE</Link>
        </p>

        {/* Note on session separation */}
        <div className="rounded-[8px] bg-[#101319] border border-[#232935] px-4 py-2.5 text-[14px] text-[#8A95A5]">
          <i className="ri-information-line mr-1.5 text-[#CAD0DA]" />
          <span data-testid="sample-library-notice">
            This is the sample library shipped with LiveLift: example names and prices, not your catalog. Adding a product to a show copies it as
            a snapshot marked “Sample” — check it in Prepare. Nothing here changes past or active shows.
          </span>
        </div>

        {/* PRODUCTS TAB */}
        {activeTab === "products" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 motion-safe:animate-content-in" data-testid="products-grid">
            {products.map((prod) => (
              <div
                key={prod.id}
                role="button"
                tabIndex={0}
                aria-label={`Open ${prod.code} ${prod.name}`}
                data-testid={`product-card-${prod.id}`}
                onClick={() => setSelectedProduct(prod)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedProduct(prod);
                  }
                }}
                className="rounded-[12px] bg-[#13161C] border border-[#232935] p-5 flex flex-col justify-between hover:bg-[#181C24] cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[#DFFF00] focus-visible:outline-offset-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[13px] font-mono text-[#B7C1CE]">{prod.code}</span>
                    {prod.priority === "high" && (
                      <span className="text-[12px] font-semibold text-[#DFFF00] inline-flex items-center gap-1">
                        <i className="ri-flag-line" />
                        <span>High Priority</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3.5 mb-3">
                    <div className="w-[50px] h-[50px] shrink-0 rounded-[10px] bg-[#2A303B] border border-[#373F4D] flex flex-col items-center justify-center">
                      <span className="text-[20px] font-medium text-[#D2D9E4]">{prod.initials}</span>
                      <span className="text-[10px] font-mono text-[#AFB8C7]">{prod.code}</span>
                    </div>

                    <div className="min-w-0">
                      <h2 className="text-[18px] font-medium text-[#F5F7FC] truncate">{prod.name}</h2>
                      <p className="text-[14px] text-[#CAD0DA]">
                        {prod.price !== null ? `${prod.currency} ${prod.price}` : "Not entered"}
                      </p>
                    </div>
                  </div>

                  {prod.notes && (
                    <p className="text-[14px] text-[#B7C1CE] line-clamp-2 mt-2">{prod.notes}</p>
                  )}
                </div>

                <div className="pt-3 mt-4 border-t border-[#202632] flex items-center justify-between text-[12px] text-[#8A95A5]">
                  <span>Status: {prod.status}</span>
                  <span>{prod.asOf || "As-of not recorded"}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PACKS TAB */}
        {activeTab === "packs" && (
          <div className="space-y-4 motion-safe:animate-content-in" data-testid="packs-list">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className="rounded-[12px] bg-[#13161C] border border-[#232935] p-5 flex items-center justify-between gap-6"
              >
                <div>
                  <h2 className="text-[19px] font-medium text-[#F5F7FC]">{pack.name}</h2>
                  <p className="text-[14px] text-[#CAD0DA] mt-1">{pack.description}</p>
                  <p className="text-[13px] text-[#8A95A5] mt-2 font-mono">
                    {pack.productIds.length} items in pack · Updated {pack.updatedAt}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Button variant="secondary" size="sm" onClick={() => setInspectPackId(pack.id)} data-testid={`inspect-pack-${pack.id}`}>
                    Inspect pack
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pack inspection */}
        <Dialog isOpen={inspected !== null} onClose={() => setInspectPackId(null)} title={inspected ? `Pack: ${inspected.name}` : ""} cancelText="Close">
          {inspected && (
            <div className="space-y-2 pb-1" data-testid="pack-dialog">
              <p className="text-[15px] text-[#CAD0DA]">{inspected.description}</p>
              <ul className="divide-y divide-[#262C38]">
                {inspected.productIds.map((id) => {
                  const p = PRODUCT_LIBRARY.find((x) => x.id === id);
                  return (
                    <li key={id} className="py-2 flex items-center justify-between gap-3 text-[15px]">
                      <span className="text-[#F5F7FC]">
                        <span className="font-mono text-[14px] text-[#AEB7C5] mr-2">{p?.code ?? id}</span>
                        {p?.name ?? "Not in the library"}
                      </span>
                      <span className="text-[#CAD0DA] tabular-nums">{p ? (p.price !== null ? `${p.currency} ${p.price}` : "Not entered") : "—"}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[14px] text-[#9AA5B5]">This copies sample products into a new plan. Check their details in Prepare.</p>
              <Link href={`/live/new?pack=${encodeURIComponent(inspected.id)}`} className="inline-flex min-h-[44px] items-center text-[#DFFF00] underline underline-offset-4">Create LIVE with this sample pack</Link>
            </div>
          )}
        </Dialog>

        {/* Product Inspection Modal */}
        <Dialog
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          title={`Product: ${selectedProduct?.name || ""}`}
        >
          {selectedProduct && (
            <div className="space-y-3.5 text-[15px]">
              <div>
                <p className="text-[13px] font-mono text-[#AEB7C5]">Code: {selectedProduct.code}</p>
                <p className="text-[16px] text-[#F5F7FC] mt-0.5">
                  Price: {selectedProduct.price !== null ? `${selectedProduct.currency} ${selectedProduct.price}` : "Not entered"}
                </p>
              </div>

              {selectedProduct.talkingPoints.length > 0 && (
                <div>
                  <p className="font-medium text-[#CAD0DA]">Talking points:</p>
                  <ul className="list-disc list-inside space-y-1 text-[#B7C1CE] mt-1">
                    {selectedProduct.talkingPoints.map((tp, idx) => (
                      <li key={idx}>{tp}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedProduct.notes && (
                <div>
                  <p className="font-medium text-[#CAD0DA]">Notes:</p>
                  <p className="text-[#B7C1CE] mt-0.5">{selectedProduct.notes}</p>
                </div>
              )}
            </div>
          )}
        </Dialog>
      </div>
    </StandardShell>
  );
}
