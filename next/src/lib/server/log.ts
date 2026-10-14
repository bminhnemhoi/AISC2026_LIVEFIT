type Fields = {
  requestId?: string; route?: string; status?: number; durationMs?: number;
  workspaceId?: string; roomId?: string; actorId?: string; commandId?: string;
  revision?: number; resultCode?: string;
};
const keys = ["requestId", "route", "status", "durationMs", "workspaceId", "roomId", "actorId", "commandId", "revision", "resultCode"] as const;
/** Allowlisted fields only: error messages, paths and arbitrary objects never enter logs. */
export function log(event: string, fields: Fields = {}, level: "info" | "warn" | "error" = "info"): void {
  const safe = Object.fromEntries(keys.filter((key) => fields[key] !== undefined && (typeof fields[key] !== "string" || /^[A-Za-z0-9_.:-]{1,128}$/.test(String(fields[key])) || (key === "route" && /^\/api\/[A-Za-z0-9/:_-]{1,128}$/.test(String(fields[key]))))).map((key) => [key, fields[key]]));
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...safe }));
}
