import React, { useState, useEffect, useRef } from "react";
import type { HostAppBagItem } from "./types";

export interface BagDrawerProps {
  bag: HostAppBagItem[];
  isOpen: boolean;
  onClose: () => void;
  onPin: (itemId: number) => void;
  onUnpin: () => void;
  onAddItem: (itemId: number) => void;
  onRemoveItem: (itemId: number) => void;
  className?: string;
}

export const BagDrawer: React.FC<BagDrawerProps> = ({
  bag,
  isOpen,
  onClose,
  onPin,
  onUnpin,
  onAddItem,
  onRemoveItem,
  className = "",
}) => {
  const [newItemId, setNewItemId] = useState<string>("");
  const drawerRef = useRef<HTMLDivElement>(null);
  const pendingFocusTargetRef = useRef<{ itemId: number; targetAction: "unpin" | "pin" } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // L05: Move focus to the resulting enabled control after keyboard/touch action.
  // Unrelated updates (comments, viewers, timers, external sync) must never move focus.
  useEffect(() => {
    if (!pendingFocusTargetRef.current) return;
    const { itemId, targetAction } = pendingFocusTargetRef.current;
    const testId = targetAction === "unpin" ? `host-app-unpin-${itemId}` : `host-app-pin-${itemId}`;

    const focusControl = () => {
      const el = drawerRef.current?.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      if (el) {
        el.focus();
        pendingFocusTargetRef.current = null;
        return true;
      }
      return false;
    };

    if (!focusControl()) {
      const raf = requestAnimationFrame(() => {
        focusControl();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [bag]);

  const handlePin = (itemId: number) => {
    pendingFocusTargetRef.current = { itemId, targetAction: "unpin" };
    onPin(itemId);
  };

  const handleUnpin = (itemId: number) => {
    pendingFocusTargetRef.current = { itemId, targetAction: "pin" };
    onUnpin();
  };

  if (!isOpen) return null;

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(newItemId.trim(), 10);
    if (!isNaN(id) && id > 0) {
      onAddItem(id);
      setNewItemId("");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shop product bag"
      data-testid="bag-drawer"
      className={`absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-300 motion-reduce:transition-none ${className}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Drawer surface */}
      <div
        ref={drawerRef}
        className="w-full max-h-[82%] bg-[#13161C] border-t border-[#39414D] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-[host-app-slide-up_250ms_ease-out] motion-reduce:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#2A303A] bg-[#181B22]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#252A34] text-[#DFFF00] flex items-center justify-center">
              <i className="ri-shopping-bag-3-fill text-[16px]" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-[#F5F7FC] flex items-center gap-1.5">
                <span>Shop Bag (SIMULATED)</span>
                <span className="text-[11px] font-mono font-medium text-[#C8B2FF] px-1.5 py-0.5 rounded bg-[#211F2B] border border-[#44385C]">
                  {bag.length} items
                </span>
              </h2>
              <p className="text-[10px] text-[#8A95A5]">
                Manage live pinned products & catalogue
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close product bag"
            className="min-w-[44px] min-h-[44px] w-[44px] h-[44px] rounded-xl bg-[#252A34] hover:bg-[#303643] text-[#CAD0DA] hover:text-[#F5F7FC] flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-[#DFFF00]"
          >
            <i className="ri-close-line text-[20px]" aria-hidden="true" />
          </button>
        </div>

        {/* Quick Add item bar */}
        <form
          onSubmit={handleQuickAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1B1F27] border-b border-[#2A303A]"
        >
          <div className="relative flex-1">
            <input
              type="number"
              placeholder="Enter item ID to add..."
              value={newItemId}
              onChange={(e) => setNewItemId(e.target.value)}
              className="w-full min-h-[44px] bg-[#13161C] border border-[#2A303A] rounded-lg px-3 py-2 text-[12px] text-[#F5F7FC] placeholder-[#8A95A5] focus-visible:outline-2 focus-visible:outline-[#DFFF00]"
            />
          </div>
          <button
            type="submit"
            disabled={!newItemId.trim()}
            className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-lg bg-[#252A34] hover:bg-[#303643] text-[#DFFF00] font-medium text-[12px] disabled:opacity-40 disabled:hover:bg-[#252A34] transition-colors flex items-center gap-1.5 border border-[#39414D] focus-visible:outline-2 focus-visible:outline-[#DFFF00]"
          >
            <i className="ri-add-line text-[15px]" aria-hidden="true" />
            <span>Add Item</span>
          </button>
        </form>

        {/* Products list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
          {bag.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-[#8A95A5]">
              <div className="w-12 h-12 rounded-full bg-[#1B1F27] border border-[#2A303A] flex items-center justify-center mb-2.5 text-[#8A95A5]">
                <i className="ri-shopping-bag-3-line text-[22px]" aria-hidden="true" />
              </div>
              <p className="text-[13px] font-medium text-[#F5F7FC]">Bag is empty</p>
              <p className="text-[11px] text-[#8A95A5] max-w-[200px] mt-1">
                No items in the shop bag. Add items above to pin them during the live.
              </p>
            </div>
          ) : (
            bag.map((item) => {
              const priceDisplay =
                item.priceLabel !== null ? item.priceLabel : "Price not set";
              const isPriceUnknown = item.priceLabel === null;

              return (
                <div
                  key={item.itemId}
                  data-testid={`bag-item-${item.itemId}`}
                  className={`flex items-center gap-2.5 sm:gap-3 p-2.5 rounded-xl border transition-all ${
                    item.pinned
                      ? "bg-[#1C2028] border-[#DFFF00]/50 shadow-xs"
                      : "bg-[#181B22] border-[#2A303A] hover:border-[#39414D]"
                  }`}
                >
                  {/* Initials & item number */}
                  <div
                    className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center shrink-0 border ${
                      item.pinned
                        ? "bg-[#DFFF00]/15 border-[#DFFF00]/40 text-[#DFFF00]"
                        : "bg-[#252A34] border-[#39414D] text-[#CAD0DA]"
                    }`}
                    aria-hidden="true"
                  >
                    <span className="text-[14px] font-bold leading-none">
                      {item.initials}
                    </span>
                    <span className="text-[8px] font-mono text-[#8A95A5] mt-0.5">
                      #{item.itemId}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {item.pinned && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-mono font-bold bg-[#DFFF00]/15 text-[#DFFF00] border border-[#DFFF00]/30">
                          <i className="ri-pushpin-2-fill text-[9px]" aria-hidden="true" />
                          PINNED
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-[#8A95A5]">
                        Item {item.itemId}
                      </span>
                    </div>

                    <p
                      className="text-[12px] font-medium leading-snug text-[#F5F7FC] line-clamp-2 break-words"
                      title={item.name}
                    >
                      {item.name}
                    </p>

                    <p
                      data-testid={`bag-item-price-${item.itemId}`}
                      className={`text-[12px] font-semibold mt-0.5 tabular-nums ${
                        isPriceUnknown
                          ? "text-[#CAD0DA] italic text-[11px] font-normal"
                          : "text-[#DFFF00]"
                      }`}
                    >
                      {priceDisplay}
                    </p>
                  </div>

                  {/* Action buttons (all >= 44x44px touch targets) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.pinned ? (
                      <button
                        type="button"
                        onClick={() => handleUnpin(item.itemId)}
                        aria-label={`Unpin ${item.name}`}
                        data-testid={`host-app-unpin-${item.itemId}`}
                        className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[#252A34] hover:bg-[#303643] text-[#CAD0DA] hover:text-[#F5F7FC] text-[11px] font-medium border border-[#39414D] transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00]"
                      >
                        Unpin
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePin(item.itemId)}
                        aria-label={`Pin ${item.name}`}
                        data-testid={`host-app-pin-${item.itemId}`}
                        className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[#DFFF00] hover:bg-[#CBEA00] text-[#111407] text-[11px] font-bold transition-colors shadow-xs flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00]"
                      >
                        Pin
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.itemId)}
                      aria-label={`Remove ${item.name} from bag`}
                      title="Remove from bag"
                      className="min-w-[44px] min-h-[44px] w-[44px] h-[44px] rounded-xl bg-[#1B1F27] hover:bg-[#302025] text-[#8A95A5] hover:text-[#FF5C5C] flex items-center justify-center transition-colors border border-[#2A303A] focus-visible:outline-2 focus-visible:outline-[#DFFF00]"
                    >
                      <i className="ri-delete-bin-line text-[15px]" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
