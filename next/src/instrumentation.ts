export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { getRuntime, closeRuntime } = await import("./lib/server/runtime");
    await getRuntime();
    process.once("SIGTERM", () => { void closeRuntime(); });
    process.once("SIGINT", () => { void closeRuntime(); });
  }
}
