import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, isAbsolute } from "node:path";
import Database from "better-sqlite3";

test("Les commandes CLI initialisent une base en production et préservent le compte existant", async () => {
  const directory = await mkdtemp(join(tmpdir(), "prospection-cli-"));
  const project = process.cwd();
  const file = join(directory, "workspace.sqlite");
  const password = randomBytes(24).toString("hex");
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: "",
    SQLITE_PATH: file,
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    BETTER_AUTH_URL: "http://localhost:3000",
    OWNER_EMAIL: "cli@example.com",
    OWNER_NAME: "Compte de test CLI",
    OWNER_PASSWORD: password,
  };

  function run(script: string, ownerPassword = password) {
    const result = spawnSync(
      process.execPath,
      [join(project, "node_modules/tsx/dist/cli.mjs"), `scripts/${script}.ts`],
      {
        cwd: project,
        env: { ...environment, OWNER_PASSWORD: ownerPassword },
        encoding: "utf8",
        timeout: 30000,
        windowsHide: true,
      },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!result.stdout.includes(ownerPassword));
    assert.ok(!result.stderr.includes(ownerPassword));
    return result.stdout;
  }

  function storedAccount() {
    const db = new Database(file, { readonly: true });
    try {
      assert.equal(
        (db.prepare('SELECT COUNT(*) AS count FROM "user"').get() as { count: number }).count,
        1,
      );
      assert.ok(
        db.prepare("SELECT name FROM sqlite_master WHERE name = 'prospect_workspace'").get(),
      );
      return db.prepare('SELECT password FROM "account" WHERE "providerId" = ?').get("credential");
    } finally {
      db.close();
    }
  }

  try {
    assert.match(run("setup-database"), /compte privé créé/);
    const original = storedAccount();
    assert.match(run("setup-database", randomBytes(24).toString("hex")), /compte privé existant/);
    assert.deepEqual(storedAccount(), original);
    assert.match(run("setup-account", randomBytes(24).toString("hex")), /Compte existant conservé/);
    assert.deepEqual(storedAccount(), original);
  } finally {
    // Only remove the named temporary test directory, never a project database.
    const target = await realpath(directory);
    const base = await realpath(tmpdir());
    const local = relative(base, target);
    assert.ok(
      !isAbsolute(local) && !local.startsWith("..") && local.startsWith("prospection-cli-"),
    );
    await rm(target, { recursive: true, force: true });
  }
});
