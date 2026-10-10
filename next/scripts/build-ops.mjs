import ts from "typescript";
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
function compile(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const source = join(path, entry.name);
    if (entry.isDirectory()) { compile(source); continue; }
    if (!source.endsWith(".ts") || source.endsWith(".test.ts")) continue;
    const target = join(root, ".ops", relative(root, source).replace(/\.ts$/, ".js"));
    let code = ts.transpileModule(readFileSync(source, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    code = code.replace(/(from\s+["']|import\(["'])(@\/[^"']+|\.[^"']+)(["'])/g, (_, prefix, specifier, quote) => {
      const absolute = specifier.startsWith("@/") ? join(root, "src", specifier.slice(2)) : resolve(dirname(source), specifier);
      const extension = readdirSync(dirname(absolute)).includes(`${absolute.split("/").at(-1)}.ts`) ? ".js" : "/index.js";
      let local = relative(dirname(source), absolute) + extension;
      if (!local.startsWith(".")) local = "./" + local;
      return prefix + local + quote;
    });
    mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, code);
  }
}
for (const path of ["src/contracts", "src/lib/domain", "src/lib/server", "src/app/api"]) compile(join(root, path));
// Compile just the CLI entry point; the directory walker also ignores this .mjs builder.
compile(join(root, "scripts"));
