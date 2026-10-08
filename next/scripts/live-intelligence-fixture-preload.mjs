// Certification only: doubles the official upstream, never the LiveLift API or its AVAILABLE state.
// Loaded explicitly by the disposable harness. The application never imports this module.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { officialFixturePayloads } = await import(pathToFileURL(process.env.LIVELIFT_CERT_INTELLIGENCE_FIXTURES));
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input?.url ?? input));
  if (url.origin !== 'https://open-api.tiktokglobalshop.com') return realFetch(input, init);
  const control = JSON.parse(readFileSync(process.env.LIVELIFT_CERT_INTELLIGENCE_CONTROL, 'utf8'));
  const response = (status, data, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });
  if (control.state === 'denied') return response(403, { code: 105005 });
  if (control.state === 'expired') return response(401, { code: 105002 });
  if (control.state === 'limited') return response(429, { code: 36009002 }, { 'retry-after': '60' });
  if (control.state === 'unavailable') return response(503, { code: 1 });
  if (control.state === 'unsupported') return response(404, { code: 36009009 });
  const payload = officialFixturePayloads(control.startMs, control.endMs, control.case ?? 'normal');
  const data = url.pathname.endsWith('performance_per_minutes') ? payload.minutes : url.pathname.endsWith('products_performance') ? payload.products : payload.creator;
  return response(200, { code: 0, data });
};
