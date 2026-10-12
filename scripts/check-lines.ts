import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

async function checkDirectory(directory: string): Promise<string[]> {
  const errors: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) errors.push(...(await checkDirectory(path)));
    else if (/\.(tsx?|css|mjs|md)$/.test(entry.name)) {
      const lines = (await readFile(path, "utf8")).trimEnd().split(/\r?\n/).length;
      if (lines > 500) errors.push(`${path} : ${lines} lignes (maximum 500)`);
    }
  }
  return errors;
}

async function main() {
  const results = await Promise.all(
    ["app", "components", "lib", "scripts", "tests"].map(checkDirectory),
  );
  const errors = results.flat();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else console.log("Tous les fichiers source respectent la limite de 500 lignes.");
}
void main();
