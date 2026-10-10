// Checks that the scripted sample data gives the numbers the story promises, without a browser.
// Run: npm run check:story
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = await build({
  entryPoints: [join(here, "../src/engine.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const url = "data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64");
const E = await import(url);

let failures = 0;
const expect = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};

const act = (t, kind, product, source = "list", evidence = "platform") => ({ t, kind, product, source, evidence });
const w = (t, actions = [], outages = []) => ({ t, actions, outages });

// beat 4: live opens
expect("viewers at 0:00", E.viewersNow(w(0)), 120);
expect("suggestion at 0:20", E.suggestionAt(w(20)).kind, "waiting");

// beat 5: low confidence on 4 comments
const s2 = E.suggestionAt(w(120));
expect("2:00 suggestion", [s2.kind, s2.product, s2.signals?.mentions, s2.confidence], ["pin", "hoodie", 4, "low"]);

// beat 6: medium on 12, reasons 7 / 8 vs 3 / 24
const s4 = E.suggestionAt(w(240));
expect("4:00 suggestion", [s4.kind, s4.product, s4.signals.mentions, s4.confidence], ["pin", "hoodie", 12, "medium"]);
expect("4:00 reasons (ask price, cart now, cart before)", [s4.signals.byIntent.price, s4.signals.cartNow, s4.signals.cartBefore], [7, 8, 3]);
expect("4:00 ask-price counter", E.intentCounts(w(240)).price, 7);

// beat 7: pin hoodie
const A = [act(240, "pin", "hoodie", "suggestion")];
expect("4:00 after pin", E.suggestionAt(w(240, A)).kind, "keep");

// beat 8: flash not enough signal
const f8 = E.flashAt(w(390, A));
expect("6:30 flash", [f8.kind, f8.reason], ["insufficient", "cart"]);
console.log(`     6:30 flash cart now = ${f8.cartNow}`);

// beat 9: flash ready
const f9 = E.flashAt(w(540, A));
expect("9:00 flash", f9.kind, "ready");
console.log(`     9:00 flash reasons: cart ${f9.cartNow} vs ${f9.cartBefore}, stock ${f9.stock}, pinned ${f9.pinnedFor}s, orders ${f9.orders}`);

// beat 10: dismissed
const A2 = [...A, act(540, "flash-dismiss", "hoodie", "suggestion")];
expect("9:00 after dismiss", E.flashAt(w(541, A2)).kind, "dismissed");

// beat 11/12: platform condition 11:00 to 12:30
const O = [{ from: 660, to: null }];
expect("11:00 suggestion during condition", E.suggestionAt(w(700, A2, O)).kind, "paused");
expect("11:40 viewers unknown", E.viewersNow(w(700, A2, O)), null);
const O2 = [{ from: 660, to: 750 }];

// beat 13: hoodie still kept at 15:00, so pinning cargo is the operator's own call
const s15 = E.suggestionAt(w(900, A2, O2));
expect("15:00 before switch", [s15.kind, s15.product], ["keep", "hoodie"]);
const A3 = [...A2, act(900, "unpin", "hoodie"), act(901, "pin", "cargo")];

// recap at 29:40
const r = E.recapOf(w(1780, A3, O2), 1780);
console.log(`     recap: peak ${r.peakViewers}, comments ${r.comments}, masked ${r.masked}, cart ${r.cart}, pins ${r.pins}, blind ${r.blindSeconds}s`);
console.log(`     intents ${JSON.stringify(r.byIntent)}`);
for (const row of r.log) console.log(`     log ${row.t}s ${row.what} | ${row.why ?? "-"} | ${row.outcome}${row.outcomeAt !== null ? " @" + row.outcomeAt : ""}`);
expect("recap outcomes", r.log.map((x) => x.outcome), ["accepted", "dismissed", "self", "self"].concat(r.log.slice(4).map((x) => x.outcome)));
expect("blind seconds", r.blindSeconds, 90);
expect("viewers at 30:00 about 440", Math.abs(E.viewersNow(w(1800)) - 440) <= 10, true);

console.log(failures ? `\n${failures} check(s) failed` : "\nall story checks passed");
process.exit(failures ? 1 : 0);
