const allowedDevOrigins = ["127.0.0.1", "localhost"];
if (process.env.LIVELIFT_APP_ORIGIN) {
  const origin = new URL(process.env.LIVELIFT_APP_ORIGIN);
  if (origin.protocol !== "https:" || origin.origin !== process.env.LIVELIFT_APP_ORIGIN || origin.hostname.includes("*")) {
    throw new Error("LIVELIFT_APP_ORIGIN must be an exact HTTPS origin.");
  }
  // Next dev validates the HMR WebSocket's Origin before the app can hydrate.
  allowedDevOrigins.push(origin.hostname);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  allowedDevOrigins,
  // The SIMULATED competition launcher runs `next dev`; the route indicator is framework chrome, not LiveLift UI.
  // Compile and runtime errors still surface in the error overlay.
  devIndicators: false,
};

export default nextConfig;
