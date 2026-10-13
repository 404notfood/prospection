import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixtureWorkspace } from "./fixtures/workspace";
import { blankProspect } from "../lib/domain/defaults";
import { closeDatabase } from "../lib/server/database";
import { readWorkspace, saveWorkspace } from "../lib/server/repository";
import { enqueueJob, claimJob, controlJob, checkpoint, listJobs } from "../lib/server/jobs";
import { runPipeline } from "../lib/server/pipeline";
import { reserveAiCall, aiUsage } from "../lib/server/ai-usage";
import { resolveActivities } from "../lib/server/activity-research";

test("La déduction NAF rejette les codes sans source INSEE réellement retournée", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-only";
  let consulted = true;
  const source = "https://www.insee.fr/fr/metadonnees/nafr2/sousClasse/43.32B";
  globalThis.fetch = (async () =>
    Response.json({
      status: "completed",
      output: [
        { type: "web_search_call", action: { sources: consulted ? [{ url: source }] : [] } },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                results: [{ activity: "Stores", codes: ["43.32B"], sources: [source] }],
              }),
            },
          ],
        },
      ],
    })) as typeof fetch;
  try {
    assert.equal(await resolveActivities(["Stores"]), "43.32B");
    consulted = false;
    assert.equal(await resolveActivities(["Stores"]), null);
    assert.equal(await resolveActivities(["Activité inconnue"]), null);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test("Pause en cours de requête, reprise après crash et plafond quotidien restent effectifs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sillage-resilience-"));
  const previous = {
    SQLITE_PATH: process.env.SQLITE_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
  };
  const originalFetch = globalThis.fetch;
  process.env.SQLITE_PATH = join(directory, "resilience.sqlite");
  process.env.DATABASE_URL = "";
  process.env.GOOGLE_PLACES_API_KEY = "test-only";
  const data = fixtureWorkspace();
  data.prospects = [
    {
      ...blankProspect(),
      id: "p",
      name: "Atelier",
      city: "Laval",
      activity: "Peinture",
      address: "12 Rue des Fleurs",
      campaignId: "artisans",
    },
  ];
  data.campaigns = [data.campaigns[0]];
  data.events = [];
  data.settings.webResearchEnabled = true;
  data.settings.aiResearchEnabled = false;
  data.settings.dailyAiCalls = 3;
  try {
    await saveWorkspace("owner", data, 0);
    const queued = await enqueueJob("owner", data.campaigns[0], "process");
    const claimed = (await claimJob())!;
    globalThis.fetch = (async () => {
      await controlJob("owner", queued.id, "pause");
      return Response.json({ places: [] });
    }) as typeof fetch;
    await runPipeline(claimed.job, claimed.token);
    assert.equal((await listJobs("owner"))[0].state, "paused");
    assert.equal(
      (await readWorkspace("owner")).data.prospects[0].websiteVerification.status,
      "unsearched",
    );
    await controlJob("owner", queued.id, "resume");
    const resumed = (await claimJob())!;
    globalThis.fetch = (async () =>
      Response.json({
        places: [
          {
            id: "place",
            displayName: { text: "Atelier" },
            formattedAddress: "12 Rue des Fleurs, Laval, France",
            websiteUri: "https://example.com/",
            googleMapsUri: "https://www.google.com/maps/place/Atelier",
          },
        ],
      })) as typeof fetch;
    await runPipeline(resumed.job, resumed.token);
    assert.equal((await listJobs("owner"))[0].state, "completed");
    assert.equal((await readWorkspace("owner")).data.prospects[0].qualification, "excluded");
    const idempotent = await enqueueJob("owner", data.campaigns[0], "process");
    const replay = (await claimJob())!;
    replay.job.ids = ["p"];
    await checkpoint(replay.job, replay.token);
    const latest = await readWorkspace("owner");
    latest.data.prospects[0].automationRunId = idempotent.id;
    await saveWorkspace("owner", latest.data, latest.revision);
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      throw new Error("Un appel déjà terminé ne doit pas être répété");
    }) as typeof fetch;
    await runPipeline(replay.job, replay.token);
    assert.equal(calls, 0);
    assert.equal((await listJobs("owner"))[0].processed, 1);
    const snapshot = await readWorkspace("owner");
    snapshot.data.prospects = [0, 1].map((index) => ({
      ...blankProspect(),
      id: `d${index}`,
      name: `Découverte ${index}`,
      city: "Laval",
      activity: "Peinture",
      campaignId: "artisans",
    }));
    snapshot.data.settings.webResearchEnabled = false;
    snapshot.data.settings.discoveryEnabled = true;
    snapshot.data.campaigns[0].automation.maxProspects = 2;
    snapshot.data.campaigns[0].automation.maxPages = 10;
    await saveWorkspace("owner", snapshot.data, snapshot.revision);
    const discovery = await enqueueJob("owner", snapshot.data.campaigns[0], "discover");
    const discoveryClaim = (await claimJob())!;
    const committed = await readWorkspace("owner");
    committed.data.campaigns[0].searchPage = 2;
    for (const p of committed.data.prospects) p.discoveryRunId = discovery.id;
    await saveWorkspace("owner", committed.data, committed.revision);
    await runPipeline(discoveryClaim.job, discoveryClaim.token);
    assert.equal(calls, 0);
    const finished = (await listJobs("owner")).find((j) => j.id === discovery.id)!;
    assert.equal(finished.state, "completed");
    assert.equal(finished.added, 2);
    assert.equal(finished.pages, 1);
    const reservations = await Promise.allSettled(
      Array.from({ length: 6 }, () => reserveAiCall("owner")),
    );
    assert.equal(reservations.filter((r) => r.status === "fulfilled").length, 3);
    assert.equal((await aiUsage("owner")).used, 3);
    assert.equal((await aiUsage("another-owner")).used, 0);
  } finally {
    globalThis.fetch = originalFetch;
    await closeDatabase();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
