"use client";

import React, { useState } from "react";
import {
  HostApp,
  type HostAppActions,
  type HostAppBagItem,
  type HostAppMode,
  type HostAppPromotion,
  type HostAppViewModel,
  FIXTURE_ITEMS,
  FIXTURE_EDGE_ITEMS,
  FIXTURE_STANDARD_COMMENTS,
  generateSyntheticComments,
  fixtureIdle,
  fixtureLiveStandard,
  fixtureLiveEdgeCases,
  fixtureLiveEmptyBag,
  fixtureLiveHeavyComments,
  fixtureEnded,
  fixtureLiveLongVietnamese,
  fixtureLiveLongEnglish,
} from "@/components/platform/host-app";

type PresetKey =
  | "standard"
  | "edge"
  | "long-vn"
  | "long-en"
  | "empty"
  | "heavy"
  | "idle"
  | "ended";

export default function HostAppGalleryPage() {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>("standard");
  const [phoneWidth, setPhoneWidth] = useState<"200px" | "320px" | "390px" | "480px" | "fluid">("390px");

  // State driving the interactive phone
  const [mode, setMode] = useState<HostAppMode>("live");
  const [title, setTitle] = useState<string>("Đại Tiệc Săn Deal Công Nghệ & Thời Trang");
  const [bag, setBag] = useState<HostAppBagItem[]>(FIXTURE_ITEMS);
  const [viewers, setViewers] = useState<number | null>(1420);
  const [elapsedLabel, setElapsedLabel] = useState<string | null>("00:14:32");
  const [promotion, setPromotion] = useState<HostAppPromotion | null>({
    name: "Flash Sale 20:12",
    status: "active",
    countdownLabel: "ends in 04:30",
  });
  const [banner, setBanner] = useState<{
    tone: "info" | "warn" | "danger";
    text: string;
  } | null>({
    tone: "info",
    text: "LiveLift SIMULATED desk connected",
  });
  const [comments, setComments] = useState(FIXTURE_STANDARD_COMMENTS);
  const [actionLog, setActionLog] = useState<string[]>([
    "Initial gallery state loaded",
  ]);

  const logAction = (msg: string) => {
    setActionLog((prev) => [
      `[${new Date().toLocaleTimeString()}] ${msg}`,
      ...prev.slice(0, 9),
    ]);
  };

  // Actions wired to interactive phone
  const actions: HostAppActions = {
    onGoLive: () => {
      logAction("actions.onGoLive() called");
      setMode("live");
      setElapsedLabel("00:00:01");
      if (viewers === null) setViewers(100);
    },
    onEndLive: () => {
      logAction("actions.onEndLive() called");
      setMode("ended");
    },
    onPin: (itemId: number) => {
      logAction(`actions.onPin(${itemId}) called`);
      setBag((prev) =>
        prev.map((item) => ({
          ...item,
          pinned: item.itemId === itemId,
        }))
      );
    },
    onUnpin: () => {
      logAction("actions.onUnpin() called");
      setBag((prev) => prev.map((item) => ({ ...item, pinned: false })));
    },
    onAddItem: (itemId: number) => {
      logAction(`actions.onAddItem(${itemId}) called`);
      const newItem: HostAppBagItem = {
        itemId,
        name: `Sản Phẩm Thêm Mới #${itemId}`,
        priceLabel: "219.000 ₫",
        initials: "NEW",
        pinned: false,
      };
      setBag((prev) => [...prev, newItem]);
    },
    onRemoveItem: (itemId: number) => {
      logAction(`actions.onRemoveItem(${itemId}) called`);
      setBag((prev) => prev.filter((item) => item.itemId !== itemId));
    },
  };

  const applyPreset = (key: PresetKey) => {
    setSelectedPreset(key);
    switch (key) {
      case "idle":
        setMode(fixtureIdle.mode);
        setTitle(fixtureIdle.title);
        setBag(fixtureIdle.bag);
        setViewers(fixtureIdle.viewers);
        setElapsedLabel(fixtureIdle.elapsedLabel);
        setPromotion(fixtureIdle.promotion);
        setBanner(fixtureIdle.banner);
        setComments(fixtureIdle.comments);
        logAction("Applied preset: Pre-Live Setup (Idle)");
        break;
      case "standard":
        setMode(fixtureLiveStandard.mode);
        setTitle(fixtureLiveStandard.title);
        setBag(fixtureLiveStandard.bag);
        setViewers(fixtureLiveStandard.viewers);
        setElapsedLabel(fixtureLiveStandard.elapsedLabel);
        setPromotion(fixtureLiveStandard.promotion);
        setBanner(fixtureLiveStandard.banner);
        setComments(fixtureLiveStandard.comments);
        logAction("Applied preset: Standard Active Live");
        break;
      case "edge":
        setMode(fixtureLiveEdgeCases.mode);
        setTitle(fixtureLiveEdgeCases.title);
        setBag(fixtureLiveEdgeCases.bag);
        setViewers(fixtureLiveEdgeCases.viewers);
        setElapsedLabel(fixtureLiveEdgeCases.elapsedLabel);
        setPromotion(fixtureLiveEdgeCases.promotion);
        setBanner(fixtureLiveEdgeCases.banner);
        setComments(fixtureLiveEdgeCases.comments);
        logAction("Applied preset: Edge Cases (Long names, Price unknown, Danger)");
        break;
      case "long-vn":
        setMode(fixtureLiveLongVietnamese.mode);
        setTitle(fixtureLiveLongVietnamese.title);
        setBag(fixtureLiveLongVietnamese.bag);
        setViewers(fixtureLiveLongVietnamese.viewers);
        setElapsedLabel(fixtureLiveLongVietnamese.elapsedLabel);
        setPromotion(fixtureLiveLongVietnamese.promotion);
        setBanner(fixtureLiveLongVietnamese.banner);
        setComments(fixtureLiveLongVietnamese.comments);
        logAction("Applied preset: Long Vietnamese Strings (Diacritics & Multi-line)");
        break;
      case "long-en":
        setMode(fixtureLiveLongEnglish.mode);
        setTitle(fixtureLiveLongEnglish.title);
        setBag(fixtureLiveLongEnglish.bag);
        setViewers(fixtureLiveLongEnglish.viewers);
        setElapsedLabel(fixtureLiveLongEnglish.elapsedLabel);
        setPromotion(fixtureLiveLongEnglish.promotion);
        setBanner(fixtureLiveLongEnglish.banner);
        setComments(fixtureLiveLongEnglish.comments);
        logAction("Applied preset: Long English Strings (Specs & Questions)");
        break;
      case "empty":
        setMode(fixtureLiveEmptyBag.mode);
        setTitle(fixtureLiveEmptyBag.title);
        setBag(fixtureLiveEmptyBag.bag);
        setViewers(fixtureLiveEmptyBag.viewers);
        setElapsedLabel(fixtureLiveEmptyBag.elapsedLabel);
        setPromotion(fixtureLiveEmptyBag.promotion);
        setBanner(fixtureLiveEmptyBag.banner);
        setComments(fixtureLiveEmptyBag.comments);
        logAction("Applied preset: Empty Bag & Scheduled Promo");
        break;
      case "heavy":
        setMode(fixtureLiveHeavyComments.mode);
        setTitle(fixtureLiveHeavyComments.title);
        setBag(fixtureLiveHeavyComments.bag);
        setViewers(fixtureLiveHeavyComments.viewers);
        setElapsedLabel(fixtureLiveHeavyComments.elapsedLabel);
        setPromotion(fixtureLiveHeavyComments.promotion);
        setBanner(fixtureLiveHeavyComments.banner);
        setComments(fixtureLiveHeavyComments.comments);
        logAction("Applied preset: Heavy Synthetic Comments (115+ comments)");
        break;
      case "ended":
        setMode(fixtureEnded.mode);
        setTitle(fixtureEnded.title);
        setBag(fixtureEnded.bag);
        setViewers(fixtureEnded.viewers);
        setElapsedLabel(fixtureEnded.elapsedLabel);
        setPromotion(fixtureEnded.promotion);
        setBanner(fixtureEnded.banner);
        setComments(fixtureEnded.comments);
        logAction("Applied preset: Ended Live Summary");
        break;
    }
  };

  const [viewMode, setViewMode] = useState<"gallery" | "phone-only">("gallery");
  const [drawerOpen, setDrawerOpen] = useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") === "phone") {
        setViewMode("phone-only");
      }
      if (params.get("drawer") === "open") {
        setDrawerOpen(true);
      }
      const widthParam = params.get("width");
      if (widthParam === "200" || widthParam === "200px") setPhoneWidth("200px");
      else if (widthParam === "320" || widthParam === "320px") setPhoneWidth("320px");
      else if (widthParam === "390" || widthParam === "390px") setPhoneWidth("390px");
      else if (widthParam === "480" || widthParam === "480px") setPhoneWidth("480px");
      else if (widthParam === "fluid") setPhoneWidth("fluid");

      const presetParam = params.get("preset") as PresetKey | null;
      if (
        presetParam &&
        ["standard", "edge", "long-vn", "long-en", "empty", "heavy", "idle", "ended"].includes(
          presetParam
        )
      ) {
        applyPreset(presetParam);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const viewModel: HostAppViewModel = {
    mode,
    title,
    sessionId: 884210,
    viewers,
    elapsedLabel,
    bag,
    promotion,
    comments,
    banner,
  };

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FC] p-2.5 sm:p-6 md:p-8 font-sans selection:bg-[#DFFF00] selection:text-[#111407] overflow-x-hidden">
      {/* Top Header Banner */}
      <header className="max-w-7xl mx-auto mb-6 border-b border-[#2A303A] pb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-[#211F2B] text-[#C8B2FF] border border-[#44385C]">
                SIMULATED PLATFORM LAB
              </span>
              <span className="text-[11px] font-mono text-[#8A95A5]">
                WP2 · Host App Component
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-[#F5F7FC]">
              Host App Gallery (SIMULATED Live)
            </h1>
            <p className="text-xs sm:text-sm text-[#CAD0DA] mt-1 max-w-2xl">
              Isolated fixture review harness for the simulated mobile host
              interface. Demonstrates idle, live, and ended modes, edge cases,
              drawer interactions, and honesty guarantees.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex rounded-lg bg-[#13161C] border border-[#2A303A] p-1 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("gallery")}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-md font-medium transition-colors flex items-center justify-center ${
                  viewMode === "gallery"
                    ? "bg-[#252A34] text-[#DFFF00] font-bold"
                    : "text-[#CAD0DA] hover:text-[#F5F7FC]"
                }`}
              >
                Gallery & Controls
              </button>
              <button
                type="button"
                onClick={() => setViewMode("phone-only")}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-md font-medium transition-colors flex items-center justify-center ${
                  viewMode === "phone-only"
                    ? "bg-[#252A34] text-[#DFFF00] font-bold"
                    : "text-[#CAD0DA] hover:text-[#F5F7FC]"
                }`}
              >
                Phone View Only
              </button>
            </div>

            {/* Phone Width Switcher */}
            <div className="flex items-center gap-1 bg-[#13161C] border border-[#2A303A] p-1 rounded-lg text-xs">
              <span className="text-[10px] font-mono text-[#8A95A5] px-1.5 hidden md:inline">WIDTH:</span>
              {(["200px", "320px", "390px", "480px", "fluid"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setPhoneWidth(w)}
                  className={`min-h-[40px] px-2.5 py-1 rounded-md font-mono text-xs transition-colors flex items-center justify-center ${
                    phoneWidth === w
                      ? "bg-[#252A34] text-[#DFFF00] font-bold border border-[#39414D]"
                      : "text-[#CAD0DA] hover:text-[#F5F7FC]"
                  }`}
                >
                  {w === "fluid" ? "Fluid" : w}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* When Phone View Only is active: clean centered view with quick toolbar */}
      {viewMode === "phone-only" ? (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-140px)] py-2 w-full">
          {/* Quick preset bar above phone */}
          <div
            style={{ width: phoneWidth === "fluid" ? "100%" : phoneWidth, maxWidth: "100%" }}
            className="mb-3 flex items-center justify-between px-2 text-xs"
          >
            <span className="font-mono text-[#8A95A5] uppercase">
              Mode: <strong className="text-[#DFFF00]">{mode}</strong>
            </span>
            <div className="flex gap-1.5">
              {(["idle", "live", "ended"] as HostAppMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`min-h-[44px] min-w-[44px] px-3 py-1 rounded-lg text-[11px] font-mono capitalize border flex items-center justify-center transition-colors ${
                    mode === m
                      ? "bg-[#DFFF00] text-[#111407] font-bold border-[#DFFF00]"
                      : "bg-[#181B22] text-[#CAD0DA] border-[#2A303A]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{ width: phoneWidth === "fluid" ? "100%" : phoneWidth, maxWidth: "100%" }}
            className="transition-all duration-300 flex flex-col items-center mx-auto"
          >
            <HostApp
              key={`phone-${drawerOpen}-${selectedPreset}-${phoneWidth}`}
              viewModel={viewModel}
              actions={actions}
              initialBagOpen={drawerOpen}
            />
          </div>
        </div>
      ) : (
        /* Main Grid: Interactive Stage + Sandbox Controls */
        <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
          {/* Left Column: Interactive Phone Display */}
          <section
            aria-label="Interactive Phone Preview"
            className="lg:col-span-5 flex flex-col items-center w-full"
          >
            <div
              style={{ width: phoneWidth === "fluid" ? "100%" : phoneWidth, maxWidth: "100%" }}
              className="flex items-center justify-between mb-3 px-2"
            >
              <span className="text-xs font-mono uppercase tracking-wider text-[#8A95A5]">
                Width: {phoneWidth}
              </span>
              <span className="text-xs font-mono text-[#DFFF00] bg-[#DFFF00]/10 border border-[#DFFF00]/20 px-2 py-0.5 rounded">
                Mode: {mode.toUpperCase()}
              </span>
            </div>

            {/* THE HOST APP PHONE FRAME */}
            <div
              style={{ width: phoneWidth === "fluid" ? "100%" : phoneWidth, maxWidth: "100%" }}
              className="transition-all duration-300 flex flex-col items-center mx-auto"
            >
              <HostApp
                key={`gallery-${drawerOpen}-${selectedPreset}-${phoneWidth}`}
                viewModel={viewModel}
                actions={actions}
                initialBagOpen={drawerOpen}
              />
            </div>
          </section>

          {/* Right Column: Preset Chooser, Custom Toggles & Action Logs */}
          <section
            aria-label="Gallery Controls and Fixtures"
            className="lg:col-span-7 space-y-6 w-full"
          >
          {/* Preset Buttons */}
          <div className="rounded-2xl bg-[#13161C] border border-[#2A303A] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#CAD0DA] flex items-center gap-2">
                <i className="ri-folder-shared-line text-[#DFFF00]" />
                <span>Preset Scenarios</span>
              </h2>
              <span className="text-xs font-mono text-[#8A95A5]">
                One-tap fixture states
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: "standard", label: "Standard Live", desc: "Active pinned & promo" },
                { id: "edge", label: "Edge Cases", desc: "Unknown price, long names" },
                { id: "long-vn", label: "Long Vietnamese", desc: "Compound diacritics & chat" },
                { id: "long-en", label: "Long English", desc: "Audio specs & questions" },
                { id: "empty", label: "Empty Bag", desc: "0 items, scheduled sale" },
                { id: "heavy", label: "100+ Comments", desc: "Heavy synthetic stream" },
                { id: "idle", label: "Pre-Live Setup", desc: "Idle with bag preview" },
                { id: "ended", label: "Ended Summary", desc: "Quiet wrap-up state" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id as PresetKey)}
                  className={`min-h-[58px] p-3 text-left rounded-xl border transition-all text-xs focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                    selectedPreset === p.id
                      ? "bg-[#1B202A] border-[#DFFF00] text-[#F5F7FC] shadow-sm"
                      : "bg-[#181B22] border-[#2A303A] text-[#CAD0DA] hover:border-[#39414D] hover:text-[#F5F7FC]"
                  }`}
                >
                  <p className="font-semibold text-[13px]">{p.label}</p>
                  <p className="text-[11px] text-[#8A95A5] mt-0.5 truncate">
                    {p.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Granular State Controls */}
          <div className="rounded-2xl bg-[#13161C] border border-[#2A303A] p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#CAD0DA] flex items-center gap-2">
              <i className="ri-sound-module-line text-[#DFFF00]" />
              <span>Interactive Property Toggles</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Mode Control */}
              <div>
                <label className="block text-[#8A95A5] mb-1.5 font-medium">
                  Screen Mode
                </label>
                <div className="flex rounded-lg bg-[#181B22] border border-[#2A303A] p-1">
                  {(["idle", "live", "ended"] as HostAppMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`flex-1 min-h-[44px] py-2 text-center font-medium rounded capitalize transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                        mode === m
                          ? "bg-[#252A34] text-[#DFFF00] font-bold"
                          : "text-[#CAD0DA] hover:text-[#F5F7FC]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Viewers Control */}
              <div>
                <label className="block text-[#8A95A5] mb-1.5 font-medium">
                  Simulated Viewers
                </label>
                <div className="flex rounded-lg bg-[#181B22] border border-[#2A303A] p-1">
                  <button
                    type="button"
                    onClick={() => setViewers(null)}
                    className={`flex-1 min-h-[44px] py-2 text-center rounded transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      viewers === null
                        ? "bg-[#252A34] text-[#C8B2FF] font-bold"
                        : "text-[#CAD0DA]"
                    }`}
                  >
                    Null (None)
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewers(1420)}
                    className={`flex-1 min-h-[44px] py-2 text-center rounded transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      viewers === 1420
                        ? "bg-[#252A34] text-[#DFFF00] font-bold"
                        : "text-[#CAD0DA]"
                    }`}
                  >
                    1,420
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewers(28540)}
                    className={`flex-1 min-h-[44px] py-2 text-center rounded transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      viewers === 28540
                        ? "bg-[#252A34] text-[#DFFF00] font-bold"
                        : "text-[#CAD0DA]"
                    }`}
                  >
                    28,540
                  </button>
                </div>
              </div>

              {/* Platform Condition Banner */}
              <div>
                <label className="block text-[#8A95A5] mb-1.5 font-medium">
                  Condition Banner Tone
                </label>
                <div className="grid grid-cols-4 gap-1 rounded-lg bg-[#181B22] border border-[#2A303A] p-1">
                  <button
                    type="button"
                    onClick={() => setBanner(null)}
                    className={`min-h-[44px] py-1 text-center rounded flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      banner === null ? "bg-[#252A34] text-[#F5F7FC]" : "text-[#8A95A5]"
                    }`}
                  >
                    None
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBanner({ tone: "info", text: "SIMULATED desk connected" })
                    }
                    className={`min-h-[44px] py-1 text-center rounded flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      banner?.tone === "info"
                        ? "bg-[#12222A] text-[#7DD8EA] font-bold border border-[#25505F]"
                        : "text-[#CAD0DA]"
                    }`}
                  >
                    Info
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBanner({
                        tone: "warn",
                        text: "Observation delayed by 3,200ms",
                      })
                    }
                    className={`min-h-[44px] py-1 text-center rounded flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      banner?.tone === "warn"
                        ? "bg-[#2A2316] text-[#F6C875] font-bold border border-[#5E4822]"
                        : "text-[#CAD0DA]"
                    }`}
                  >
                    Warn
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBanner({
                        tone: "danger",
                        text: "Authorisation token expired. LiveLift degraded to manual.",
                      })
                    }
                    className={`min-h-[44px] py-1 text-center rounded flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      banner?.tone === "danger"
                        ? "bg-[#302025] text-[#FF5C5C] font-bold border border-[#6B2A35]"
                        : "text-[#CAD0DA]"
                    }`}
                  >
                    Danger
                  </button>
                </div>
              </div>

              {/* Promotion Status */}
              <div>
                <label className="block text-[#8A95A5] mb-1.5 font-medium">
                  Flash Promotion
                </label>
                <div className="grid grid-cols-4 gap-1 rounded-lg bg-[#181B22] border border-[#2A303A] p-1">
                  <button
                    type="button"
                    onClick={() => setPromotion(null)}
                    className={`min-h-[44px] py-1 text-center rounded flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      promotion === null
                        ? "bg-[#252A34] text-[#F5F7FC]"
                        : "text-[#8A95A5]"
                    }`}
                  >
                    None
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPromotion({
                        name: "Flash Sale 20:12",
                        status: "scheduled",
                        countdownLabel: "in 02:10",
                      })
                    }
                    className={`min-h-[44px] py-1 text-center rounded flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      promotion?.status === "scheduled"
                        ? "bg-[#252218] text-[#F6C875] font-bold border border-[#967526]"
                        : "text-[#CAD0DA]"
                    }`}
                  >
                    Sched
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPromotion({
                        name: "Flash Sale 20:12",
                        status: "active",
                        countdownLabel: "ends in 04:30",
                      })
                    }
                    className={`min-h-[44px] py-1 text-center rounded flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      promotion?.status === "active"
                        ? "bg-[#281816] text-[#FF8585] font-bold border border-[#E24A24]"
                        : "text-[#CAD0DA]"
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPromotion({
                        name: "Flash Sale 20:12",
                        status: "ended",
                        countdownLabel: null,
                      })
                    }
                    className={`min-h-[44px] py-1 text-center rounded flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      promotion?.status === "ended"
                        ? "bg-[#181B22] text-[#8A95A5] font-bold"
                        : "text-[#CAD0DA]"
                    }`}
                  >
                    Ended
                  </button>
                </div>
              </div>

              {/* Bag Composition */}
              <div>
                <label className="block text-[#8A95A5] mb-1.5 font-medium">
                  Bag Item Selection
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBag([])}
                    className={`flex-1 min-h-[44px] py-2 px-2.5 rounded-lg border text-center flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      bag.length === 0
                        ? "bg-[#252A34] border-[#DFFF00] text-[#DFFF00] font-bold"
                        : "bg-[#181B22] border-[#2A303A] text-[#CAD0DA]"
                    }`}
                  >
                    Empty (0)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBag(FIXTURE_ITEMS.slice(0, 3))}
                    className={`flex-1 min-h-[44px] py-2 px-2.5 rounded-lg border text-center flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      bag.length === 3
                        ? "bg-[#252A34] border-[#DFFF00] text-[#DFFF00] font-bold"
                        : "bg-[#181B22] border-[#2A303A] text-[#CAD0DA]"
                    }`}
                  >
                    Short (3)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBag(FIXTURE_ITEMS)}
                    className={`flex-1 min-h-[44px] py-2 px-2.5 rounded-lg border text-center flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      bag.length === 10
                        ? "bg-[#252A34] border-[#DFFF00] text-[#DFFF00] font-bold"
                        : "bg-[#181B22] border-[#2A303A] text-[#CAD0DA]"
                    }`}
                  >
                    Standard (10)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBag(FIXTURE_EDGE_ITEMS)}
                    className={`flex-1 min-h-[44px] py-2 px-2.5 rounded-lg border text-center flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      bag === FIXTURE_EDGE_ITEMS
                        ? "bg-[#252A34] border-[#DFFF00] text-[#DFFF00] font-bold"
                        : "bg-[#181B22] border-[#2A303A] text-[#CAD0DA]"
                    }`}
                  >
                    Edge Items
                  </button>
                </div>
              </div>

              {/* Comment Stream Volume */}
              <div>
                <label className="block text-[#8A95A5] mb-1.5 font-medium">
                  Comments Stream
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setComments([])}
                    className={`flex-1 min-h-[44px] py-2 px-2 rounded-lg border text-center flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      comments.length === 0
                        ? "bg-[#252A34] border-[#DFFF00] text-[#DFFF00] font-bold"
                        : "bg-[#181B22] border-[#2A303A] text-[#CAD0DA]"
                    }`}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => setComments(FIXTURE_STANDARD_COMMENTS)}
                    className={`flex-1 min-h-[44px] py-2 px-2 rounded-lg border text-center flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      comments.length === 5
                        ? "bg-[#252A34] border-[#DFFF00] text-[#DFFF00] font-bold"
                        : "bg-[#181B22] border-[#2A303A] text-[#CAD0DA]"
                    }`}
                  >
                    5 Comments
                  </button>
                  <button
                    type="button"
                    onClick={() => setComments(generateSyntheticComments(115))}
                    className={`flex-1 min-h-[44px] py-2 px-2 rounded-lg border text-center flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      comments.length > 50
                        ? "bg-[#252A34] border-[#DFFF00] text-[#DFFF00] font-bold"
                        : "bg-[#181B22] border-[#2A303A] text-[#CAD0DA]"
                    }`}
                  >
                    115+ Synthetic
                  </button>
                </div>
              </div>

              {/* Bag Drawer State */}
              <div className="sm:col-span-2">
                <label className="block text-[#8A95A5] mb-1.5 font-medium">
                  Bag Drawer (Slide-up Sheet)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className={`flex-1 min-h-[44px] py-2 px-3 rounded-lg border text-center transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      !drawerOpen
                        ? "bg-[#252A34] border-[#CAD0DA] text-[#F5F7FC] font-semibold"
                        : "bg-[#181B22] border-[#2A303A] text-[#8A95A5]"
                    }`}
                  >
                    Closed
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className={`flex-1 min-h-[44px] py-2 px-3 rounded-lg border text-center transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#DFFF00] ${
                      drawerOpen
                        ? "bg-[#252A34] border-[#DFFF00] text-[#DFFF00] font-bold"
                        : "bg-[#181B22] border-[#2A303A] text-[#CAD0DA]"
                    }`}
                  >
                    Open Drawer
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Callbacks Log */}
          <div className="rounded-2xl bg-[#13161C] border border-[#2A303A] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#CAD0DA] flex items-center gap-2">
                <i className="ri-terminal-box-line text-[#DFFF00]" />
                <span>HostAppActions Dispatch Log</span>
              </h2>
              <button
                type="button"
                onClick={() => setActionLog(["Log cleared"])}
                className="text-[11px] font-mono text-[#8A95A5] hover:text-[#CAD0DA]"
              >
                Clear
              </button>
            </div>
            <p className="text-[11px] text-[#8A95A5] mb-2">
              Interactions on the phone call actions without mutation inside the
              component.
            </p>
            <div className="p-3 rounded-xl bg-[#090B0F] border border-[#2A303A] font-mono text-xs space-y-1 max-h-36 overflow-y-auto scrollbar-thin">
              {actionLog.map((log, idx) => (
                <div
                  key={idx}
                  className={idx === 0 ? "text-[#DFFF00]" : "text-[#8A95A5]"}
                >
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Model & Honesty Invariants Checklist */}
          <div className="rounded-2xl bg-[#13161C] border border-[#2A303A] p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#CAD0DA] mb-3 flex items-center gap-2">
              <i className="ri-shield-check-line text-[#22C55E]" />
              <span>Evidence Model & Simulation Honesty Checklist</span>
            </h2>

            <ul className="space-y-2 text-xs text-[#CAD0DA]">
              <li className="flex items-start gap-2">
                <i className="ri-checkbox-circle-fill text-[#22C55E] mt-0.5" />
                <span>
                  <strong>Permanent SIMULATED Tag:</strong> Permanent badge
                  positioned at the top of the phone frame with violet
                  token (<code className="text-[#C8B2FF]">#211F2B / #C8B2FF</code>).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <i className="ri-checkbox-circle-fill text-[#22C55E] mt-0.5" />
                <span>
                  <strong>Unknown Price Guarantee:</strong> Any product with{" "}
                  <code className="text-[#C8B2FF]">priceLabel: null</code> renders
                  explicitly as{" "}
                  <span className="italic text-[#CAD0DA] font-semibold">
                    &quot;Price not set&quot;
                  </span>
                  , never 0 or empty string.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <i className="ri-checkbox-circle-fill text-[#22C55E] mt-0.5" />
                <span>
                  <strong>Pure View-Model Architecture:</strong> HostApp takes
                  only <code className="text-[#CAD0DA]">HostAppViewModel</code>{" "}
                  and <code className="text-[#CAD0DA]">HostAppActions</code>. Zero
                  clock reading, zero randomness, zero platform logic imports.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <i className="ri-checkbox-circle-fill text-[#22C55E] mt-0.5" />
                <span>
                  <strong>Synthetic Comments:</strong> Clearly badged with{" "}
                  <code className="text-[#C8B2FF]">SYNTHETIC CHAT</code>,{" "}
                  <code className="text-[#CAD0DA]">aria-live=&quot;polite&quot;</code>,
                  and never stealing keyboard focus.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <i className="ri-checkbox-circle-fill text-[#22C55E] mt-0.5" />
                <span>
                  <strong>Accessibility & Motion:</strong> Visible focus rings,
                  real button elements, WCAG AA dark tokens, and full fallback
                  under <code className="text-[#CAD0DA]">prefers-reduced-motion</code>.
                </span>
              </li>
            </ul>
          </div>
        </section>
      </main>
      )}
    </div>
  );
}
