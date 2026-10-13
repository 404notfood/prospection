import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

test("Le worker autonome charge la production par défaut ; son diagnostic ne lance ni travail ni faux heartbeat", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sillage-worker-env-"));
  const project = process.cwd();
  const production = join(directory, "production.sqlite");
  const development = join(directory, "development.sqlite");
  await writeFile(
    join(directory, ".env.production"),
    `SQLITE_PATH=${JSON.stringify(production.replace(/\\/g, "/"))}\n`,
  );
  await writeFile(
    join(directory, ".env.development"),
    `SQLITE_PATH=${JSON.stringify(development.replace(/\\/g, "/"))}\n`,
  );
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: "",
    OPENAI_API_KEY: "",
    GOOGLE_PLACES_API_KEY: "",
  };
  delete (env as Record<string, string | undefined>).NODE_ENV;
  delete env.SQLITE_PATH;
  delete env.__NEXT_PROCESSED_ENV;
  function run(args: string[], overrides: Partial<NodeJS.ProcessEnv> = {}) {
    return spawnSync(
      process.execPath,
      [
        join(project, "node_modules/tsx/dist/cli.mjs"),
        "--tsconfig",
        join(project, "tsconfig.json"),
        join(project, "scripts/automation-worker.ts"),
        ...args,
      ],
      {
        cwd: directory,
        env: { ...env, ...overrides },
        timeout: 20000,
        encoding: "utf8",
        windowsHide: true,
      },
    );
  }
  try {
    const check = run(["--check"]);
    assert.equal(check.status, 0, check.stderr);
    assert.match(check.stdout, /vérifiées/);
    await assert.rejects(() => access(development));
    const db = new Database(production, { readonly: true });
    try {
      assert.equal(
        (db.prepare("SELECT COUNT(*) AS count FROM automation_worker").get() as { count: number })
          .count,
        0,
      );
      assert.equal(
        (db.prepare("SELECT COUNT(*) AS count FROM automation_jobs").get() as { count: number })
          .count,
        0,
      );
    } finally {
      db.close();
    }
    const devCheck = run(["--dev", "--check"]);
    assert.equal(devCheck.status, 0, devCheck.stderr);
    await access(development);
    const missingConfig = run(["--check"], { NODE_ENV: "production", SQLITE_PATH: "" });
    assert.equal(missingConfig.status, 1);
    assert.match(missingConfig.stderr, /Worker interrompu/);
    await assert.rejects(() => access(join(directory, "data", "prospection.sqlite")));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
