import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { blankProspect } from "../lib/domain/defaults";
import { verification, displayVerification } from "../lib/domain/verification";
import { qualifyAutomatically, updateDueFollowUps } from "../lib/domain/automation";
import { mergeProspectChanges } from "../lib/domain/merge";
import {
  applyAiVerification,
  aiResearchSchema,
  researchIdentityKey,
} from "../lib/domain/ai-research";
import { fixtureWorkspace } from "./fixtures/workspace";
import { closeDatabase, query } from "../lib/server/database";
import { saveWorkspace, readWorkspace } from "../lib/server/repository";
import {
  enqueueJob,
  listJobs,
  claimJob,
  checkpoint,
  controlJob,
  jobIsRunning,
  workerOnline,
} from "../lib/server/jobs";
import { runPipeline } from "../lib/server/pipeline";
import { scheduleDueWork } from "../lib/server/scheduler";
import { saveApiCredentials } from "../lib/server/api-credentials";

test("Le site et Google ont des états indépendants ; une ambiguïté ou une seule source Google ne qualifie pas", () => {
  const campaign = fixtureWorkspace().campaigns[0];
  const prospect = {
    ...blankProspect(),
    name: "Entreprise",
    city: "Laval",
    activity: "Peinture",
    campaignId: campaign.id,
  };
  const googleOnly = {
    ...prospect,
    websiteVerification: verification("not-found", "Aucun site dans Google", "google", [
      "https://google.com/",
      "https://maps.google.com/",
    ]),
  };
  assert.equal(qualifyAutomatically(googleOnly, campaign).status, "review");
  const research = aiResearchSchema.parse({
    identityKey: researchIdentityKey(prospect),
    summary: "Recherche sourcée",
    researchedAt: new Date().toISOString(),
    website: "",
    googleBusinessUrl: "",
    identityConfirmed: true,
    websiteStatus: "not-found",
    googleStatus: "uncertain",
    sources: [
      { url: "https://annuaire-entreprises.data.gouv.fr/", title: "Identité" },
      { url: "https://google.com/", title: "Recherche" },
    ],
  });
  const verified = applyAiVerification(prospect, research);
  assert.equal(verified.websiteVerification.status, "not-found");
  assert.equal(verified.googleVerification.status, "uncertain");
  const qualified = qualifyAutomatically(verified, campaign);
  assert.equal(qualified.status, "ready");
  assert.equal(qualified.presence, "absent");
  const found = {
    ...prospect,
    website: "https://example.com/",
    websiteVerification: verification("confirmed", "Site vérifié", "google", [
      "https://maps.google.com/",
    ]),
  };
  assert.equal(qualifyAutomatically(found, campaign).qualification, "excluded");
  const known = {
    ...found,
    websiteVerification: verification("confirmed", "Confirmation humaine", "manual", [
      found.website,
    ]),
  };
  assert.equal(applyAiVerification(known, research).website, found.website);
  assert.equal(applyAiVerification(known, research).websiteVerification.method, "manual");
  assert.equal(
    displayVerification({ ...prospect, website: "https://example.com/" }, "website").status,
    "uncertain",
  );
});

test("Les relances sont datées à Paris, idempotentes et arrêtées après réponse ou opposition", () => {
  const data = fixtureWorkspace();
  data.events = [];
  data.prospects = data.prospects
    .slice(0, 3)
    .map((p) => ({ ...p, status: "contacted", followUpAt: "2026-10-13" }));
  data.prospects[1].repliedAt = "2026-10-12T10:00:00Z";
  data.prospects[2].opposed = true;
  updateDueFollowUps(data, new Date("2026-10-12T22:30:00Z"));
  assert.equal(data.prospects[0].status, "follow-up");
  assert.equal(data.prospects[1].status, "contacted");
  assert.equal(data.events.length, 1);
  updateDueFollowUps(data, new Date("2026-10-13T08:00:00Z"));
  assert.equal(data.events.length, 1);
});

test("La fusion conserve les notes humaines pendant le travail et détecte les conflits", () => {
  const before = { ...blankProspect(), name: "Entreprise", city: "Laval", activity: "Artisan" };
  const current = { ...before, notes: "Note humaine" };
  const proposal = { ...before, website: "https://example.com/" };
  const merged = mergeProspectChanges(current, before, proposal);
  assert.equal(merged.notes, current.notes);
  assert.equal(merged.website, proposal.website);
  assert.throws(
    () => mergeProspectChanges(current, before, { ...proposal, notes: "Autre note" }, true),
    /a changé/,
  );
});

test("La file persiste les parcours, isole les comptes, reprend les étapes et enregistre un brouillon sans envoyer", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sillage-workflow-"));
  const originalFetch = globalThis.fetch;
  const previousEnv = {
    SQLITE_PATH: process.env.SQLITE_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  };
  process.env.SQLITE_PATH = join(directory, "workflow.sqlite");
  process.env.DATABASE_URL = "";
  process.env.OPENAI_API_KEY = "test-only-openai";
  process.env.GOOGLE_PLACES_API_KEY = "test-only-google";
  process.env.BETTER_AUTH_SECRET = "test-credential-encryption-secret-only";
  const data = fixtureWorkspace();
  data.campaigns = [data.campaigns[0]];
  data.events = [];
  data.settings.aiResearchEnabled = true;
  data.settings.webResearchEnabled = true;
  data.campaigns[0].automation.maxProspects = 2;
  data.campaigns[0].automation.maxAiCalls = 4;
  data.prospects = [
    {
      ...blankProspect(),
      id: "unknown",
      name: "Atelier sans site",
      city: "Laval",
      activity: "Peinture",
      address: "12 Rue des Fleurs",
      campaignId: "artisans",
    },
    {
      ...blankProspect(),
      id: "site",
      name: "Atelier avec site",
      city: "Laval",
      activity: "Peinture",
      address: "15 Rue des Fleurs",
      campaignId: "artisans",
    },
  ];
  const destinations: string[] = [];
  globalThis.fetch = (async (url, options) => {
    destinations.push(String(url));
    const body = JSON.parse(options!.body as string);
    if (String(url).includes("places.googleapis.com")) {
      assert.equal(
        (options!.headers as Record<string, string>)["X-Goog-Api-Key"],
        "saved-google-key-only",
      );
      return Response.json({
        places: body.textQuery.includes("avec site")
          ? [
              {
                id: "google-site",
                displayName: { text: "Atelier avec site" },
                formattedAddress: "15 Rue des Fleurs, Laval, France",
                websiteUri: "https://example.com/",
                googleMapsUri: "https://www.google.com/maps/place/Atelier",
                internationalPhoneNumber: "+33 2 43 00 00 00",
              },
            ]
          : [],
      });
    }
    assert.equal(
      (options!.headers as Record<string, string>).Authorization,
      "Bearer saved-openai-key-only",
    );
    if (body.tools) {
      const [identity] = JSON.parse(body.input);
      const sources = [
        "https://annuaire-entreprises.data.gouv.fr/entreprise/test",
        "https://www.google.com/search?q=atelier",
      ];
      return Response.json({
        status: "completed",
        output: [
          { type: "web_search_call", action: { sources: sources.map((url) => ({ url })) } },
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  results: [
                    {
                      id: identity.id,
                      identityConfirmed: true,
                      summary: "Aucun site officiel identifié après recherche [1] [2].",
                      website: "",
                      googleBusinessUrl: "",
                      sourceUrls: sources,
                      websiteStatus: "not-found",
                      googleStatus: "not-found",
                      email: "contact@example.com",
                      phone: "",
                      contactSourceUrl: sources[0],
                    },
                  ],
                }),
              },
            ],
          },
        ],
      });
    }
    return Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                subject: "Votre activité à Laval",
                opening:
                  "Je me permets de vous contacter au sujet de votre activité à Laval et de votre présence en ligne.",
              }),
            },
          ],
        },
      ],
    });
  }) as typeof fetch;
  try {
    await saveApiCredentials("owner", "openai", "saved-openai-key-only", "gpt-4.1-mini");
    await saveApiCredentials("owner", "google", "saved-google-key-only");
    await saveWorkspace("owner", data, 0);
    const queued = await enqueueJob("owner", data.campaigns[0], "process");
    assert.equal((await enqueueJob("owner", data.campaigns[0], "process")).id, queued.id);
    assert.deepEqual(await listJobs("another-owner"), []);
    await assert.rejects(() => controlJob("another-owner", queued.id, "pause"), /introuvable/);
    const claimed = (await claimJob())!;
    assert.equal(claimed.job.id, queued.id);
    assert.equal(await claimJob(), null);
    await runPipeline(claimed.job, claimed.token);
    const complete = (await listJobs("owner"))[0];
    assert.equal(complete.state, "completed");
    assert.equal(complete.processed, 2);
    const saved = (await readWorkspace("owner")).data;
    const qualified = saved.prospects.find((p) => p.id === "unknown")!;
    assert.equal(qualified.status, "ready");
    assert.equal(qualified.email, "contact@example.com");
    assert.ok(qualified.emailDraft?.body.includes("Site vitrine"));
    assert.ok(qualified.emailDraft?.body.includes(data.settings.signature));
    assert.equal(qualified.emailDraft?.method, "ai");
    assert.equal(saved.prospects.find((p) => p.id === "site")!.qualification, "excluded");
    assert.equal(
      saved.prospects.find((p) => p.id === "site")!.googleVerification.status,
      "confirmed",
    );
    assert.ok(!saved.events.some((e) => e.kind === "email"));
    assert.ok(
      destinations.every(
        (url) => url.includes("api.openai.com") || url.includes("places.googleapis.com"),
      ),
    );
    const fresh = await enqueueJob("owner", data.campaigns[0], "process");
    await controlJob("owner", fresh.id, "pause");
    assert.equal(await claimJob(), null);
    await controlJob("owner", fresh.id, "resume");
    const resumed = (await claimJob())!;
    await query("UPDATE automation_jobs SET lease_until = $1 WHERE id = $2", [
      "2000-01-01T00:00:00Z",
      resumed.job.id,
    ]);
    const reclaimed = (await claimJob())!;
    assert.notEqual(reclaimed.token, resumed.token);
    assert.equal(await jobIsRunning(resumed.job.id, resumed.token), false);
    assert.equal(await checkpoint(resumed.job, resumed.token), false);
    await controlJob("owner", reclaimed.job.id, "cancel");
    const scheduling = (await readWorkspace("owner")).data;
    scheduling.campaigns[0].automation.enabled = true;
    scheduling.settings.aiResearchEnabled = false;
    scheduling.settings.webResearchEnabled = false;
    await saveWorkspace("owner", scheduling, (await readWorkspace("owner")).revision);
    await scheduleDueWork();
    const count = (await listJobs("owner")).length;
    await scheduleDueWork();
    assert.equal((await listJobs("owner")).length, count);
    assert.ok((await readWorkspace("owner")).data.campaigns[0].automation.nextRunAt);
    await closeDatabase();
    const cli = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/automation-worker.ts", "--once"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 30000,
        env: {
          ...process.env,
          SQLITE_PATH: join(directory, "worker-empty.sqlite"),
          OPENAI_API_KEY: "",
          GOOGLE_PLACES_API_KEY: "",
          DATABASE_URL: "",
        },
      },
    );
    assert.equal(cli.status, 0, cli.stderr);
    process.env.SQLITE_PATH = join(directory, "worker-empty.sqlite");
    assert.equal(await workerOnline(), true);
  } finally {
    globalThis.fetch = originalFetch;
    await closeDatabase();
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
