import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuth } from "../lib/server/auth";
import { database, query } from "../lib/server/database";
import { readWorkspace, saveWorkspace } from "../lib/server/repository";
import { emptyWorkspace } from "../lib/domain/defaults";
import { initializeApplication } from "../lib/server/bootstrap";
import { Pool } from "pg";

test("Compte privé, session, isolation du stockage et sauvegardes concurrentes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sillage-test-"));
  process.env.SQLITE_PATH = join(directory, "test.sqlite");
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString("hex");
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  delete process.env.DATABASE_URL;
  try {
    const password = randomBytes(24).toString("hex");
    assert.equal(
      await initializeApplication({ email: "test@example.com", name: "Test local", password }),
      "created",
    );
    const [user] = await query<{ id: string; email: string }>('SELECT id, email FROM "user"');
    const created = { user };
    const privateAuth = createAuth();
    const denied = await privateAuth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "other@example.com", name: "Blocked", password }),
      }),
    );
    assert.equal(denied.status, 400);
    assert.equal((await denied.json()).code, "EMAIL_PASSWORD_SIGN_UP_DISABLED");
    assert.equal(
      await initializeApplication({
        email: "test@example.com",
        name: "Test local",
        password: randomBytes(24).toString("hex"),
      }),
      "existing",
    );
    await assert.rejects(
      () => initializeApplication({ email: "another@example.com", name: "Autre compte", password }),
      /Un compte existe déjà/,
    );
    const signedIn = await privateAuth.api.signInEmail({
      body: { email: "test@example.com", password },
    });
    assert.equal(signedIn.user.id, created.user.id);
    const login = await privateAuth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "test@example.com", password }),
      }),
    );
    assert.equal(login.status, 200);
    const cookie = login.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const validSession = await privateAuth.api.getSession({
      headers: new Headers({ Cookie: cookie }),
    });
    assert.equal(validSession?.user.id, created.user.id);
    const session = await privateAuth.api.getSession({
      headers: new Headers({
        Cookie: `better-auth.session_token=${signedIn.token}.${"invalid-signature"}`,
      }),
    });
    assert.equal(session, null);
    const original = await readWorkspace(created.user.id);
    assert.equal(original.revision, 0);
    const updated = emptyWorkspace();
    updated.settings.company = "Test sauvegardé";
    assert.equal(await saveWorkspace(created.user.id, updated, 0), 1);
    assert.equal(await saveWorkspace(created.user.id, emptyWorkspace(), 0), undefined);
    const recovered = await readWorkspace(created.user.id);
    assert.equal(recovered.data.settings.company, "Test sauvegardé");
    assert.equal(recovered.revision, 1);
    assert.equal((await readWorkspace("other-owner")).data.settings.company, "404NotFood");
  } finally {
    const db = database();
    if (db instanceof Pool) await db.end();
    else db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
