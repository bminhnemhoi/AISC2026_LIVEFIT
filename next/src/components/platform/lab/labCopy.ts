/**
 * Every word the Platform Lab shows, in English and Vietnamese. One file, so a reviewer can read both side by side.
 *
 * Rules for both languages: the word SIMULATED stays in English on every simulated surface (it is the honesty mark,
 * not prose); evidence terms such as "Provider observed (SIMULATED)" keep their English form; Shopee's own error text
 * is quoted, never translated. Never claim a connection to Shopee: write "SIMULATED Live" (a generic simulated platform).
 * Lines marked `vi-check` are ones a native speaker should confirm.
 */
import type { DirectorStepId, HostAction, HostAppWords, NoticeData, RecordSource, ShopeeFault } from "@/lib/platform";

export type LabLang = "en" | "vi";

/** What a Director caption may mention: names and the flash sale's time, from the show's own plan. */
export interface CaptionContext {
  first: string;
  second: string;
  flash: string;
  flashAt: string;
}

type Caption = (c: CaptionContext) => string;

/** A notice worded from typed data. `original` is text that is not LiveLift's (a platform message) and is shown as it came. */
export interface NoticeLine { lead: string; original?: string; tail?: string }


const en = {
  lang: { label: "Language", en: "EN", vi: "VI" },
  header: {
    title: "Platform Lab",
    labRun: "Lab run · nothing is saved",
    labRunHint: "A copy of this show as planned, with its own SIMULATED Live. The show, its Review and the Operate desk are not changed.",
    presenter: "Presenter",
    presenterHint: "Press P to switch presenter mode",
    leave: "Leave the Lab",
    openLab: "Open the Platform Lab",
  },
  notSimulated: {
    title: "The Platform Lab is for SIMULATED shows",
    body: "This is a REAL show. The Lab only runs rehearsals against SIMULATED Live, so nothing here could reach a real live.",
    back: "Back to the show",
  },
  director: {
    region: "Demo Director",
    play: "Play",
    pause: "Pause",
    step: "Step",
    reset: "Reset",
    speed: "Speed",
    progress: (n: number, total: number): string => `Step ${n} of ${total}`,
    ready: "Press Play for the 90 second story, or Step through it.",
    done: "The story is over. Reset to play it again; the call log will be identical.",
    unavailable: { products: "The story needs two planned products in this show.", flash: "The story needs a hard-anchored flash sale after the opening." },
    captions: {
      "show-starts": () => "The show starts in LiveLift. SIMULATED Live knows nothing yet.",
      "live-opens": (c) => `LiveLift opens a live on SIMULATED Live, loads the planned products and schedules the ${c.flashAt} flash sale.`,
      "products-load": (c) => `${c.first} is up. The host's bag holds the planned products.`,
      "livelift-pins": (c) => `LiveLift pins ${c.first}. SIMULATED Live accepts the request; LiveLift records it as performed, platform verification unknown.`,
      "host-pins": (c) => `The host pins ${c.second} in the app. LiveLift has not been told.`,
      "livelift-notices": () => "LiveLift's next read notices it and records Provider observed (SIMULATED).",
      "auth-expires": () => "Authorisation expires. Every call is refused, and LiveLift switches to manual and says so once.",
      "stays-manual": () => "Still refused. LiveLift does not repeat the warning; the operator carries on by hand.",
      "recovers": () => "Authorisation is back. LiveLift says the platform is answering again.",
      "flash-sale": (c) => `${c.flashAt}: ${c.flash} is active on the host's phone, on time.`,
      "live-ends": () => "The show ends, and LiveLift ends the live on SIMULATED Live.",
      "recap": () => "Every call here was SIMULATED. Nothing was sent to any real live platform.",
    } satisfies Record<DirectorStepId, Caption> as Record<DirectorStepId, Caption>,
  },
  assumptions: {
    title: "Assumptions",
    caveat: "Not verified on a real platform",
    a1: "A1 · The API can control a live the host started in the app",
    a2: "A2 · Reading the live shows which product is pinned",
    condition: "Platform condition",
  },
  faults: {
    none: "Normal",
    token_expired: "Authorisation expired",
    region_unsupported: "Region not supported",
    rate_limited: "Rate limited",
    server_error: "Platform server error",
  } satisfies Record<ShopeeFault | "none", string>,
  desk: {
    region: "LiveLift desk",
    now: "Now",
    next: "Next",
    why: "Why",
    notStarted: "Not started",
    ended: "Show ended",
    nothingNext: "Nothing left",
    noAnchor: "No hard anchor ahead",
    anchor: (title: string, at: string): string => `${title} is anchored at ${at}`,
    startShow: "Start the show",
    nextSegment: "Next segment",
    endShow: "End the show",
    clock: "Virtual clock",
    virtualClock: (time: string): string => `SIMULATED clock ${time}`,
    toAnchor: "To anchor",
    toAnchorHint: "Jump to one minute before the next hard anchor",
    products: "Pin on SIMULATED Live",
    noProducts: "The run of show uses no products.",
    pin: "Pin",
    pinned: "Pinned",
    pinnedOnShopee: "pinned on SIMULATED Live",
    inBag: "in the live bag",
    notInBag: "not in the live bag",
    unpin: "Unpin",
    unpinNote: "No unpin endpoint was found, so unpinning stays with the operator.",
    autoSync: "Auto-sync after each action",
    syncNow: "Sync now",
    manual: "Manual: SIMULATED Live is refusing calls. Pin in the app and report it.",
    records: "Records",
    noRecords: "Nothing recorded yet.",
    notices: "What LiveLift noticed",
    noNotices: "Nothing yet.",
  },
  state: { performed: "Performed", attempted: "Attempted", cancelled: "Cancelled" } satisfies Record<"performed" | "attempted" | "cancelled", string>,
  source: {
    request_accepted: "Request accepted (SIMULATED) · platform verification unknown",
    request_refused: "Refused by SIMULATED Live",
    provider_observed: "Provider observed (SIMULATED)",
    operator_reported: "Operator reported",
  } satisfies Record<RecordSource, string>,
  /** Notice headlines. English shows LiveLift's own sentence alone, so this stays empty. */
  noticeTitles: {} as Record<string, string>,
  /** English shows the sentence stored with the notice, so there is nothing to build. */
  noticeLine: (_code: string, _data: NoticeData | undefined): NoticeLine | null => null,
  wire: {
    region: "The wire",
    /** Names the scrollable log inside the wire, so a keyboard user can tell it from the wire itself. */
    scrollName: "Wire log, scrollable",
    lanes: { livelift: "LiveLift", platform: "SIMULATED Live", host: "Host's app (SIMULATED)" },
    basis: { documented: "shape from Shopee's page", inferred: "shape inferred" },
    read: "read",
    ok: "OK",
    host: "Host in the app",
    /** What the host did, by action. English shows the call log's own sentence instead, which names the product. */
    hostActions: {
      add_catalog_item: "Added a product to the shop",
      start_live: "Went live",
      end_live: "Ended the live",
      add_live_item: "Added a product to the live bag",
      remove_live_item: "Removed a product from the live bag",
      pin_item: "Pinned a product",
      unpin_item: "Unpinned the product",
      create_promotion: "Scheduled a promotion",
    } satisfies Record<HostAction["type"], string>,
    notPossible: "not possible right now",
    recorded: "LiveLift recorded",
    showJson: (endpoint: string): string => `Show the JSON for ${endpoint}`,
    showReads: "Show reads",
    empty: "No calls yet. Start the show or press Play.",
    digest: (digest: string, calls: number): string => `Call log ${digest} · ${calls} calls`,
    digestHint: "Same script, same call log, same fingerprint.",
  },
  phone: {
    region: "Host's live app (SIMULATED)",
  },
  hostApp: {
    faults: {
      token_expired: "Authorisation expired",
      region_unsupported: "Region not supported",
      rate_limited: "Rate limited",
      server_error: "Platform server error (SIMULATED)",
    },
    startsIn: (clock: string): string => `in ${clock}`,
    endsIn: (clock: string): string => `ends in ${clock}`,
    comments: [
      "Is size M still available?",
      "Does it come in black?",
      "How long is shipping to Da Nang?",
      "Is the fabric thick?",
      "Can I see the size chart?",
      "Is shipping free at this price?",
      "I'm 1m65, 55kg. Which size?",
      "Looks great!",
      "Can I return it if it doesn't fit?",
      "I'll take one!",
      "Is the beige one in stock?",
      "Does it wrinkle easily?",
    ],
    reactions: {
      pinned: (name: string): string => `${name} is pinned! How much?`,
      pinnedInApp: "Ooh, what's the new one?",
      promotion: (name: string): string => `${name} is on, let's go!`,
    },
  } satisfies HostAppWords,
};

export type LabWords = typeof en;

const vi: LabWords = {
  lang: { label: "Ngôn ngữ", en: "EN", vi: "VI" },
  header: {
    title: "Platform Lab",
    labRun: "Bản chạy thử · không lưu lại", // vi-check
    labRunHint: "Bản sao buổi live theo kế hoạch, chạy với SIMULATED Live riêng. Buổi live gốc, phần Review và bàn Operate không bị thay đổi.",
    presenter: "Trình chiếu",
    presenterHint: "Nhấn P để bật hoặc tắt chế độ trình chiếu",
    leave: "Rời Lab",
    openLab: "Mở Platform Lab",
  },
  notSimulated: {
    title: "Platform Lab chỉ dành cho buổi live SIMULATED",
    body: "Đây là buổi live REAL. Lab chỉ chạy diễn tập với SIMULATED Live, nên không thao tác nào ở đây có thể chạm tới một buổi live thật.",
    back: "Quay lại buổi live",
  },
  director: {
    region: "Demo Director",
    play: "Phát",
    pause: "Tạm dừng",
    step: "Từng bước",
    reset: "Làm lại",
    speed: "Tốc độ",
    progress: (n, total) => `Bước ${n}/${total}`,
    ready: "Nhấn Phát để xem câu chuyện 90 giây, hoặc đi từng bước.",
    done: "Câu chuyện đã hết. Nhấn Làm lại để phát lại; nhật ký lệnh gọi sẽ giống hệt.",
    unavailable: {
      products: "Câu chuyện cần hai sản phẩm có trong kế hoạch của buổi live.",
      flash: "Câu chuyện cần một flash sale có giờ cố định sau phần mở đầu.", // vi-check
    },
    captions: {
      "show-starts": () => "Buổi live bắt đầu trên LiveLift. SIMULATED Live chưa biết gì.",
      "live-opens": (c) => `LiveLift mở phiên live trên SIMULATED Live, nạp các sản phẩm theo kế hoạch và đặt lịch flash sale lúc ${c.flashAt}.`,
      "products-load": (c) => `Đến lượt ${c.first}. Giỏ hàng của host đã có các sản phẩm theo kế hoạch.`,
      "livelift-pins": (c) => `LiveLift ghim ${c.first}. SIMULATED Live nhận yêu cầu; LiveLift ghi là đã thực hiện, nền tảng chưa xác minh.`, // vi-check
      "host-pins": (c) => `Host tự ghim ${c.second} trên ứng dụng. LiveLift chưa hề hay biết.`,
      "livelift-notices": () => "Ở lần đọc kế tiếp, LiveLift phát hiện thay đổi và ghi nhận Provider observed (SIMULATED).",
      "auth-expires": () => "Quyền truy cập hết hạn. Mọi lệnh gọi đều bị từ chối; LiveLift chuyển sang thao tác tay và chỉ báo một lần.", // vi-check
      "stays-manual": () => "Vẫn bị từ chối. LiveLift không nhắc lại cảnh báo; người vận hành tiếp tục làm tay.",
      "recovers": () => "Quyền truy cập đã trở lại. LiveLift báo nền tảng đã phản hồi bình thường.",
      "flash-sale": (c) => `${c.flashAt}: ${c.flash} đã bật trên điện thoại của host, đúng giờ.`,
      "live-ends": () => "Buổi live kết thúc, LiveLift đóng phiên live trên SIMULATED Live.",
      "recap": () => "Mọi lệnh gọi ở đây đều là SIMULATED. Không có gì được gửi tới nền tảng live thật nào.",
    },
  },
  assumptions: {
    title: "Giả định",
    caveat: "Chưa kiểm chứng trên nền tảng thật",
    a1: "A1 · API điều khiển được phiên live do host mở trên ứng dụng",
    a2: "A2 · Đọc phiên live sẽ biết sản phẩm nào đang được ghim",
    condition: "Tình trạng nền tảng",
  },
  faults: {
    none: "Bình thường",
    token_expired: "Hết hạn quyền truy cập",
    region_unsupported: "Khu vực không được hỗ trợ",
    rate_limited: "Vượt giới hạn tần suất", // vi-check
    server_error: "Lỗi máy chủ nền tảng",
  },
  desk: {
    region: "Bàn LiveLift",
    now: "Hiện tại",
    next: "Tiếp theo",
    why: "Vì sao",
    notStarted: "Chưa bắt đầu",
    ended: "Buổi live đã kết thúc",
    nothingNext: "Không còn phần nào",
    noAnchor: "Phía trước không có mốc giờ cố định",
    anchor: (title, at) => `${title} cố định lúc ${at}`,
    startShow: "Bắt đầu buổi live",
    nextSegment: "Sang phần tiếp",
    endShow: "Kết thúc buổi live",
    clock: "Đồng hồ ảo",
    virtualClock: (time) => `Đồng hồ SIMULATED ${time}`,
    toAnchor: "Tới mốc",
    toAnchorHint: "Nhảy tới một phút trước mốc giờ cố định kế tiếp",
    products: "Ghim trên SIMULATED Live",
    noProducts: "Kịch bản không dùng sản phẩm nào.",
    pin: "Ghim",
    pinned: "Đã ghim",
    pinnedOnShopee: "đang ghim trên SIMULATED Live",
    inBag: "có trong giỏ live",
    notInBag: "chưa có trong giỏ live",
    unpin: "Bỏ ghim",
    unpinNote: "Không tìm thấy endpoint bỏ ghim, nên việc bỏ ghim vẫn do người vận hành làm.",
    autoSync: "Tự đồng bộ sau mỗi thao tác", // vi-check
    syncNow: "Đọc ngay", // vi-check
    manual: "Làm tay: SIMULATED Live đang từ chối lệnh gọi. Hãy ghim trên ứng dụng rồi báo lại.",
    records: "Ghi nhận",
    noRecords: "Chưa có ghi nhận nào.",
    notices: "LiveLift nhận thấy",
    noNotices: "Chưa có gì.",
  },
  state: { performed: "Đã thực hiện", attempted: "Đã thử", cancelled: "Đã huỷ" },
  source: {
    request_accepted: "Yêu cầu được nhận (SIMULATED) · nền tảng chưa xác minh",
    request_refused: "SIMULATED Live từ chối",
    provider_observed: "Provider observed (SIMULATED)",
    operator_reported: "Người vận hành báo",
  },
  noticeTitles: {
    observed: "Host vừa thao tác trên ứng dụng",
    platform_problem: "Nền tảng không phản hồi",
    platform_recovered: "Nền tảng đã phản hồi lại",
    pin_refused: "Lệnh ghim bị từ chối",
    pin_not_sent: "Chưa gửi lệnh ghim",
    unpin_unsupported: "Không có endpoint bỏ ghim",
    item_added_known: "Host thêm sản phẩm vào giỏ",
    item_removed: "Host bỏ sản phẩm khỏi giỏ",
    unknown_item: "Sản phẩm LiveLift chưa biết",
    live_ended_on_platform: "Phiên live đã kết thúc trên nền tảng",
    promotion_scheduled: "Đã có lịch khuyến mãi",
    promotion_refused: "Khuyến mãi bị từ chối",
    showing_unobservable: "Không đọc được sản phẩm đang ghim",
    show_refused: "LiveLift không thực hiện được",
    record_refused: "LiveLift không ghi nhận được",
  },
  noticeLine: (code: string, d: NoticeData | undefined): NoticeLine | null => {
    const item = d?.product ?? (d?.itemId !== undefined ? `mã ${d.itemId}` : undefined);
    switch (code) {
      case "observed":
        return d?.product && d.action === "pinned" ? { lead: "Host đã ghim", original: d.product, tail: "trên nền tảng." }
          : d?.product && d.action === "unpinned" ? { lead: "Host đã bỏ ghim", original: d.product, tail: "trên nền tảng." } : null;
      case "item_added_known":
        return d?.product ? { lead: "Host đã thêm", original: d.product, tail: "vào giỏ live." } : null;
      case "item_removed":
        return item ? { lead: "Host đã bỏ", original: item, tail: "khỏi giỏ live." } : null;
      case "unknown_item":
        return d?.itemId !== undefined
          ? { lead: d.action === "pinned" ? "Host đã ghim một sản phẩm mà LiveLift chưa có" : "Host đã thêm một sản phẩm mà LiveLift chưa có", original: `(mã ${d.itemId})`, tail: d.action === "pinned" ? "Hãy nhập từ danh mục để theo dõi." : undefined }
          : null;
      case "promotion_scheduled":
        return d?.name ? { lead: "Đã có lịch khuyến mãi", original: `"${d.name}"`, tail: "trên nền tảng." } : null;
      case "promotion_refused":
        return d?.message ? { lead: "Nền tảng từ chối khuyến mãi:", original: d.message, tail: "Sẽ không thử lại cho đến khi bạn yêu cầu." } : null;
      case "pin_refused":
        return d?.message ? { lead: "Nền tảng từ chối lệnh ghim:", original: d.message } : null;
      case "record_refused":
        return d?.message ? { lead: "LiveLift không ghi nhận được:", original: d.message } : null;
      case "live_ended_on_platform":
        return { lead: "Phiên live đã kết thúc trên nền tảng. Hãy kết thúc show LiveLift khi bạn sẵn sàng: LiveLift không bao giờ tự kết thúc show." };
      case "platform_recovered":
        return { lead: "Nền tảng đã phản hồi lại." };
      case "showing_unobservable":
        return { lead: "Nền tảng không cho biết sản phẩm nào đang ghim. Những lần ghim trong ứng dụng phải được báo thủ công." };
      default:
        return null;
    }
  },
  wire: {
    region: "Đường truyền",
    scrollName: "Nhật ký đường truyền, cuộn được",
    lanes: { livelift: "LiveLift", platform: "SIMULATED Live", host: "Ứng dụng của host (SIMULATED)" },
    basis: { documented: "dạng lấy từ trang của Shopee", inferred: "dạng suy đoán" }, // vi-check
    read: "đọc",
    ok: "OK",
    host: "Host thao tác trên ứng dụng",
    hostActions: {
      add_catalog_item: "Thêm sản phẩm vào shop",
      start_live: "Bắt đầu phát live",
      end_live: "Kết thúc live",
      add_live_item: "Thêm sản phẩm vào giỏ live",
      remove_live_item: "Bỏ sản phẩm khỏi giỏ live",
      pin_item: "Ghim một sản phẩm",
      unpin_item: "Bỏ ghim sản phẩm",
      create_promotion: "Đặt lịch khuyến mãi",
    },
    notPossible: "lúc này không làm được",
    recorded: "LiveLift ghi nhận",
    showJson: (endpoint) => `Xem JSON của ${endpoint}`,
    showReads: "Hiện lệnh đọc",
    empty: "Chưa có lệnh gọi nào. Hãy bắt đầu buổi live hoặc nhấn Phát.",
    digest: (digest, calls) => `Nhật ký ${digest} · ${calls} lệnh gọi`,
    digestHint: "Cùng kịch bản, cùng nhật ký, cùng dấu vân tay.", // vi-check
  },
  phone: {
    region: "Ứng dụng live của host (SIMULATED)",
  },
  hostApp: {
    faults: {
      token_expired: "Hết hạn quyền truy cập",
      region_unsupported: "Khu vực không được hỗ trợ",
      rate_limited: "Vượt giới hạn tần suất", // vi-check
      server_error: "Lỗi máy chủ nền tảng (SIMULATED)",
    },
    startsIn: (clock) => `còn ${clock} nữa`,
    endsIn: (clock) => `kết thúc sau ${clock}`,
    comments: [
      "Còn size M không shop?",
      "Áo này có màu đen không ạ?",
      "Ship ra Đà Nẵng mất mấy ngày vậy shop?",
      "Chất vải có dày không shop?",
      "Cho mình xin bảng size với ạ",
      "Giá này có freeship không shop?",
      "Mình cao 1m65 nặng 55kg thì mặc size nào?",
      "Đẹp quá shop ơi",
      "Mặc không vừa có đổi được không shop?",
      "Chốt 1 cái nha shop",
      "Màu be còn hàng không ạ?",
      "Vải có dễ nhăn không shop?",
    ],
    reactions: {
      pinned: (name) => `Ghim ${name} rồi kìa, giá sao shop?`,
      pinnedInApp: "Món mới ghim là gì vậy shop?",
      promotion: (name) => `${name} bắt đầu rồi, chốt đơn thôi!`,
    },
  },
};

export const labCopy: Record<LabLang, LabWords> = { en, vi };
