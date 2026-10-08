// Release tooling only: use the locked compiler, never runtime TypeScript loading.
/* global process */
import ts from "typescript";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { URL, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "livelift-soak-"));
try {
  for (const name of ["productionClient", "liveSoak"]) {
    const source = readFileSync(new URL(`./${name}.ts`, import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    });
    writeFileSync(join(output, `${name}.mjs`), outputText.replace('"./productionClient"', '"./productionClient.mjs"'));
  }
  const { runSoakCli } = await import(pathToFileURL(join(output, "liveSoak.mjs")).href);
  process.exitCode = await runSoakCli();
} catch {
  process.stderr.write('soak: release tooling failed; run npm ci and npm run typecheck\n');
  process.exitCode = 1;
} finally {
  rmSync(output, { recursive: true, force: true });
}
