import { OperateModelOutputSchema, ReviewModelOutputSchema, type AiContext, type AiInvalidReason, type AiTask, type OperateModelOutput, type ReviewModelOutput } from "@/contracts/ai";

/**
 * Model output is untrusted too. Whatever the model says is parsed against a closed schema and then checked
 * against an allowlist before any of it can reach a screen:
 *
 *   schema             exactly the expected keys and bounded lengths
 *   unknown_reference  it may cite only fact ids, and name only option / change aliases, that LiveLift supplied
 *   unsafe_content     no links, markup or code blocks
 *   unsupported_claim  Review provider numbers require exact cited facts; no causation or "already applied"
 *   ungrounded_number  every number it writes must appear in the evidence it was given
 *
 * Any failure rejects the whole answer as "invalid response". Nothing is repaired, guessed or half-shown.
 */

export type Validated<T> = { ok: true; output: T } | { ok: false; reason: AiInvalidReason };

export interface OutputAllowlist {
  factIds: ReadonlySet<string>;
  /** option aliases (operate) or change aliases (review) the model may name. */
  aliases: ReadonlySet<string>;
  /** The evidence the model was given (see groundingCorpus); numbers in the answer must come from it. */
  evidence: string;
  /** Review-only exact sentences and fact ids; quantitative provider claims cannot be paraphrased. */
  providerFacts?: ReadonlyArray<{ id: string; text: string }>;
}

// Control characters never belong in advice shown to an operator.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B-\u001F]/;
const UNSAFE = /https?:\/\/|\bwww\.|<\/?[a-z!][^>]*>|\]\(|```|javascript:|data:text|mailto:/i;

const UNSUPPORTED_CLAIMS: RegExp[] = [
  /\b(?:platform|tiktok)[- ]+(?:has\s+)?(?:confirmed|verified)\b|\b(?:platform_confirmed|verified on stream|broadcast verified)\b/i,
  /\b(?:caus(?:ed|es)|drove|drives?|led to|resulted in|responsible for|generated|boosted|yielded|produced)\b[^.]{0,100}\b(?:sales|viewers?|revenue|conversions?|orders?|engagement|clicks?|gmv|impressions?)\b/i,
  // How something "performed" with the audience or the platform.
  /\b(?:perform(?:s|ed|ing)?|sold|sells?|converted|converts?|did|doing)\s+(?:very\s+|really\s+|so\s+)?(?:well|poorly|badly|great|strongly|weakly|better|worse)\b/i,
  /\b(?:under|over)[- ]?perform/i,
  /\b(?:best|top|worst|poor)[- ](?:selling|performing)\b/i,
  /\b(?:viewers?|audience|sales|revenue|conversions?|engagement|orders?|clicks?|impressions?|retention|gmv|watch[- ]?time)\b[^.]{0,60}\b(?:drop(?:ped|s)?|fell|fall(?:s|en)?|increas(?:ed|es)?|rose|ris(?:e|es|en)|spik(?:ed|es)?|declin(?:ed|es)?|surg(?:ed|es)?|improv(?:ed|es)?|worse|better|higher|lower|strong|weak)\b/i,
  /\b(?:caused|drove|led to|resulted in)\b[^.]{0,40}\b(?:sales|viewers?|revenue|conversions?|orders?|engagement)\b/i,
  // A recommendation presented as an action already taken.
  /\b(?:i|we|copilot)\s+(?:have\s+|has\s+|already\s+)?(?:applied|shortened|skipped|ended|extended|moved|re-?anchored|started|accepted|executed|changed|updated)\b/i,
  /\b(?:has|have|was|were)\s+(?:been\s+)?(?:already\s+)?(?:applied|accepted|executed)\b/i,
];

function strip(raw: string): string {
  const text = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  return fenced ? fenced[1] : text;
}

/** The citation-free prose of an answer: what a reader will actually read. */
function proseOf(output: OperateModelOutput | ReviewModelOutput): string[] {
  const prose: string[] = [];
  const visit = (value: unknown, key?: string): void => {
    if (typeof value === "string") {
      if (key !== "optionId" && key !== "changeId") prose.push(value);
    } else if (Array.isArray(value)) {
      for (const v of value) visit(v, key);
    } else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) if (k !== "cites") visit(v, k);
    }
  };
  visit(output);
  return prose;
}

function citesOf(output: OperateModelOutput | ReviewModelOutput): string[] {
  const cites: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        if (k === "cites" && Array.isArray(v)) cites.push(...(v as string[]));
        else visit(v);
      }
    }
  };
  visit(output);
  return cites;
}

function aliasesOf(output: OperateModelOutput | ReviewModelOutput): string[] {
  const out: string[] = [];
  if ("recommendations" in output) out.push(...output.recommendations.map((r) => r.optionId));
  if ("nextLive" in output) out.push(...output.nextLive.map((r) => r.changeId));
  return out;
}

const numbersIn = (text: string): string[] => text.match(/\d+/g) ?? [];

/**
 * The text whose numbers an answer may quote: the evidence WITHOUT its opaque ids and contract tag, so that "f12" or
 * "opt3" does not make 12 or 3 look like evidence.
 */
export function groundingCorpus(context: AiContext): string {
  return JSON.stringify(context, (key, value) => (key === "id" || key === "opt" || key === "chg" || key === "contract" ? undefined : value));
}

export function validateModelOutput(task: "operate", raw: string, allow: OutputAllowlist): Validated<OperateModelOutput>;
export function validateModelOutput(task: "review", raw: string, allow: OutputAllowlist): Validated<ReviewModelOutput>;
export function validateModelOutput(task: AiTask, raw: string, allow: OutputAllowlist): Validated<OperateModelOutput | ReviewModelOutput>;
export function validateModelOutput(task: AiTask, raw: string, allow: OutputAllowlist): Validated<OperateModelOutput | ReviewModelOutput> {
  if (typeof raw !== "string" || raw.trim() === "") return { ok: false, reason: "empty" };
  let json: unknown;
  try {
    json = JSON.parse(strip(raw));
  } catch {
    return { ok: false, reason: "not_json" };
  }
  const parsed = (task === "operate" ? OperateModelOutputSchema : ReviewModelOutputSchema).safeParse(json);
  if (!parsed.success) return { ok: false, reason: "schema" };
  const output = parsed.data;

  if (citesOf(output).some((id) => !allow.factIds.has(id)) || aliasesOf(output).some((id) => !allow.aliases.has(id))) {
    return { ok: false, reason: "unknown_reference" };
  }
  const prose = proseOf(output);
  if (prose.some((s) => UNSAFE.test(s) || CONTROL.test(s))) return { ok: false, reason: "unsafe_content" };
  const providerFacts = task === "review" ? allow.providerFacts ?? [] : [];
  const providerTexts = new Set(providerFacts.map((f) => f.text));
  if (prose.some((s) => UNSUPPORTED_CLAIMS.slice(0, 2).some((re) => re.test(s)) || !providerTexts.has(s) && UNSUPPORTED_CLAIMS.slice(2).some((re) => re.test(s)))) return { ok: false, reason: "unsupported_claim" };
  // Grounded numbers still cannot move between metrics, windows, or evidence perspectives.
  {
    let invalidProvider = false;
    const visit = (v: unknown): void => {
      if (!v || typeof v !== "object") return;
      if (Array.isArray(v)) { v.forEach(visit); return; }
      const row = v as Record<string, unknown>;
      for (const [key, value] of Object.entries(row)) {
        if (key !== "cites" && typeof value === "string" && (/provider[- ]observed/i.test(value) || /\b(?:viewers?|visitors?|audience|clicks?|orders?|gmv|impressions?|sales|revenue|comments?|likes?|shares?)\b/i.test(value) && /\d|\b(?:zero|higher|lower|more|less)\b/i.test(value))) {
          const fact = providerFacts.find((f) => f.text === value);
          if (!fact || !Array.isArray(row.cites) || !row.cites.includes(fact.id)) invalidProvider = true;
        } else if (typeof value === "object") visit(value);
      }
    };
    visit(output);
    if (invalidProvider) return { ok: false, reason: "unsupported_claim" };
  }
  const known = new Set(numbersIn(allow.evidence));
  if (prose.some((s) => numbersIn(s).some((n) => !known.has(n)))) return { ok: false, reason: "ungrounded_number" };
  return { ok: true, output };
}
