export type CapabilityCategory =
  | "available"
  | "manual"
  | "adapter_ready"
  | "unsupported";

export type Variant =
  | "available"
  | "manual"
  | "adapter_ready"
  | "unsupported"
  | "unknown"
  | "unavailable"
  | "not_connected";

export interface CapabilityItem {
  id: string;
  name: string;
  status: string;
  variant: Variant;
  category: CapabilityCategory;
  details: string;
  epistemicNote: string;
  cta?: {
    label: string;
    href: string;
    icon: string;
  };
  secondaryCta?: {
    label: string;
    href: string;
    icon: string;
  };
}

export interface CategoryGroup {
  id: CapabilityCategory;
  title: string;
  badge: string;
  description: string;
  items: CapabilityItem[];
}

export const CATEGORIES: CategoryGroup[] = [
  {
    id: "available",
    title: "Available Today: Core Standalone Operations",
    badge: "Core Operational Loop",
    description:
      "Create → Prepare → Operate → Review → Next LIVE needs no external platform integration. REAL shows require a configured shared room; SIMULATED rehearsals stay in this browser.",
    items: [
      {
        id: "manual_desk",
        name: "Manual Operation Desk",
        status: "Available",
        variant: "available",
        category: "available",
        details:
          "Create, Prepare, Operate, Review, and Next LIVE work without a TikTok connection. REAL shows use the signed-in operator and shared room clock. SIMULATED rehearsals use browser storage and a virtual clock.",
        epistemicNote:
          "LiveLift records show operations. TikTok owns video, chat, native actions and platform analytics.",
        cta: {
          label: "Create LIVE",
          href: "/live/new",
          icon: "ri-add-circle-line",
        },
        secondaryCta: {
          label: "View Sessions",
          href: "/sessions",
          icon: "ri-stack-line",
        },
      },
      {
        id: "simulator",
        name: "Local Rehearsal Simulator & Virtual Clock",
        status: "Available",
        variant: "available",
        category: "available",
        details:
          "Deterministic offline rehearsal environment powered by a manual virtual clock and realistic scripted scenarios. Host and operator practice overruns, buffer collapses, and recovery maneuvers without risking live audience or seller account standing.",
        epistemicNote:
          "SIMULATED partition strictly isolated from REAL data: virtual clock advances only on command.",
        cta: {
          label: "Launch Simulator",
          href: "/simulator",
          icon: "ri-flask-line",
        },
      },
      {
        id: "room_authority",
        name: "Multi-Client Room Authority",
        status: "Available",
        variant: "available",
        category: "available",
        details:
          "With a configured server and operator accounts, REAL shows share one room record. Commands receive durable receipts, and conflicting changes require reconciliation.",
        epistemicNote:
          "Requires the shared room. Server or storage failure pauses REAL changes; rehearsals remain separate.",
        cta: {
          label: "Room Sessions",
          href: "/sessions",
          icon: "ri-team-line",
        },
      },
      {
        id: "variance_analysis",
        name: "Variance Analysis & Learning Feedback",
        status: "Available",
        variant: "available",
        category: "available",
        details:
          "Review compares the baseline plan with recorded actuals, reports and corrections. The operator selects proposed adjustments for a new plan; past runtime and reports are never copied.",
        epistemicNote:
          "One show supports a manual choice. Observation is not causation, and Review makes no sales or conversion claim.",
        cta: {
          label: "Review Past Shows",
          href: "/sessions",
          icon: "ri-history-line",
        },
      },
    ],
  },
  {
    id: "manual",
    title: "Manual / Built-In: Native Operator Workflows",
    badge: "First-Class Operator Workflows",
    description:
      "First-class native operator workflows built directly into LiveLift that eliminate reliance on opaque platform APIs.",
    items: [
      {
        id: "catalog_import",
        name: "Manual Product & Catalog Ingestion",
        status: "Manual",
        variant: "manual",
        category: "manual",
        details:
          "Add products by hand, select from pre-packaged sample libraries, or batch-import via CSV/TSV copy-paste. Strict validation preserves unentered prices as null ('Not entered', never fabricated as zero) and enforces product code uniqueness without requiring external catalog sync.",
        epistemicNote:
          "Missing != Zero: Omitted prices and metrics are preserved as null, never falsified as zero.",
        cta: {
          label: "Product Library",
          href: "/products",
          icon: "ri-shopping-bag-3-line",
        },
      },
      {
        id: "cue_reporting",
        name: "Manual Operator Cue & Promotion Reporting",
        status: "Manual",
        variant: "manual",
        category: "manual",
        details:
          "Record attempts and operator reports for pins, flash sales, vouchers and verbal cues. The operator performs platform actions in TikTok, then records what they did in LiveLift.",
        epistemicNote:
          "Operator reported != Provider observed: Human assertion logged with actor and timestamp.",
        cta: {
          label: "Rehearse Cue Reporting",
          href: "/simulator",
          icon: "ri-hand-heart-line",
        },
      },
      {
        id: "anchor_protection",
        name: "Operator Pacing & Anchor Commitment Protection",
        status: "Manual",
        variant: "manual",
        category: "manual",
        details:
          "Human-in-the-loop drift estimation and buffer management. Overruns surface clean recovery options (shorten pending segments, drop optional segments, re-anchor) and require explicit operator acknowledgement for commitment modifications.",
        epistemicNote:
          "Planned != Actual: Baseline timeline locked; modifications append explicit decisions.",
        cta: {
          label: "Explore Run of Show",
          href: "/simulator",
          icon: "ri-timer-line",
        },
      },
    ],
  },
  {
    id: "adapter_ready",
    title: "Platform-Limited: Optional External Capabilities",
    badge: "Intentionally Bounded Extensions",
    description:
      "No platform provider is connected to this V3 candidate. These capabilities require a sanctioned provider, credentials and verified access before they can be offered.",
    items: [
      {
        id: "tiktok_analytics",
        name: "TikTok Shop Post-Stream Analytics",
        status: "Platform-limited",
        variant: "adapter_ready",
        category: "adapter_ready",
        details:
          "Not connected in V3. Post-LIVE analytics stay in TikTok. Any future import would require sanctioned access and source-labelled evidence; it would not make live chat or native actions available.",
        epistemicNote:
          "Platform-limited, not a working integration. Missing analytics remain unavailable, never zero.",
      },
      {
        id: "shopee_adapter",
        name: "Shopee Live Pin & Comment Adapter",
        status: "Platform-limited",
        variant: "adapter_ready",
        category: "adapter_ready",
        details:
          "Not connected to the V3 desk. Older Python tooling in this repository does not provide a working Shopee integration here. A sanctioned provider and verified account access would be required.",
        epistemicNote:
          "Platform-limited. No pin control or chat ingestion is available in this candidate.",
      },
      {
        id: "youtube_client",
        name: "YouTube Live Streaming Client",
        status: "Platform-limited",
        variant: "adapter_ready",
        category: "adapter_ready",
        details:
          "Not connected to the V3 desk. Older Python tooling is separate from this product. Provider authorization, permissions and quota handling would need validation before any connection.",
        epistemicNote:
          "Platform-limited. No YouTube chat or analytics feed is available in this candidate.",
      },
      {
        id: "facebook_adapter",
        name: "Facebook Live Graph API Adapter",
        status: "Platform-limited",
        variant: "adapter_ready",
        category: "adapter_ready",
        details:
          "Not connected to the V3 desk. Older Python tooling is separate from this product. A sanctioned provider and verified Page permissions would be required.",
        epistemicNote:
          "Platform-limited. No Facebook chat or analytics feed is available in this candidate.",
      },
      {
        id: "workspace_export",
        name: "Workspace Data Export & Audit Portability",
        status: "Available",
        variant: "available",
        category: "adapter_ready",
        details:
          "Signed-in operators can export the configured shared workspace as JSON from Sessions. The export contains REAL show operations and receipts; browser rehearsals and account secrets are excluded.",
        epistemicNote:
          "Requires an operator account and available server storage. This is a data export, not a platform analytics integration.",
        cta: {
          label: "Open export controls",
          href: "/sessions",
          icon: "ri-download-2-line",
        },
      },
      {
        id: "platform_verification",
        name: "Independent Platform Action Verification",
        status: "Unknown",
        variant: "unknown",
        category: "adapter_ready",
        details:
          "An operator report is a human assertion. No independent platform verification channel is connected, so verification stays Unknown even when a report or attempt was recorded.",
        epistemicNote:
          "Unknown != Failed: Missing telemetry is neutral; never marked with a false failure badge.",
      },
    ],
  },
  {
    id: "unsupported",
    title: "Not Available / Unsupported: Deliberate Platform Boundaries",
    badge: "Deliberate Platform Guardrails",
    description:
      "These platform features are unavailable in this candidate. The operator uses TikTok directly; LiveLift records show operations and truthful evidence.",
    items: [
      {
        id: "direct_action_control",
        name: "Direct Platform Pin / Action Control",
        status: "Unsupported",
        variant: "unsupported",
        category: "unsupported",
        details:
          "LiveLift does not pin, unpin or trigger promotions inside TikTok. The operator executes those actions in TikTok and reports them here. A browser or HTTP action is not verified TikTok action.",
        epistemicNote:
          "Safety guardrail: Zero automated platform tampering or unauthorized bot control.",
      },
      {
        id: "headless_scraping",
        name: "Realtime Headless Stream Engagement Scraping",
        status: "Unavailable",
        variant: "unavailable",
        category: "unsupported",
        details:
          "No realtime chat or engagement ingestion is connected. LiveLift does not scrape TikTok. The desk runs on the plan, clock and what the operator records.",
        epistemicNote:
          "Compliance guardrail: Official developer APIs only; zero unauthorized scraping.",
      },
      {
        id: "automated_metric_import",
        name: "Automated Post-LIVE Platform Metric Import",
        status: "Not connected",
        variant: "not_connected",
        category: "unsupported",
        details:
          "Platform figures remain inside TikTok Seller Center. Nothing here is imported, so no metric is shown — an unmeasured figure is never fabricated as zero or defaulted to zero.",
        epistemicNote:
          "Missing != Zero: No fabricated zeroes or placeholder telemetry.",
      },
    ],
  },
];
