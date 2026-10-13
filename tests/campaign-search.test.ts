import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newCampaign, prepareCampaign, campaignSearchLabel } from "../lib/domain/campaigns";
import { campaignSchema } from "../lib/domain/schema";
import { emptyWorkspace } from "../lib/domain/defaults";
import { activityFilter } from "../lib/domain/activities";
import { fixtureWorkspace } from "./fixtures/workspace";
import { readWorkspace, saveWorkspace } from "../lib/server/repository";
import { closeDatabase } from "../lib/server/database";
import { enqueueJob, claimJob, listJobs } from "../lib/server/jobs";
import { runPipeline } from "../lib/server/pipeline";

test("Une campagne se crée avec la ville seule, sans activité ni NAF ; les anciennes campagnes gardent leur ciblage", () => {
  const draft = { ...newCampaign(emptyWorkspace()), city: "Laval" };
  const campaign = campaignSchema.parse(prepareCampaign(draft));
  assert.equal(campaign.searchScope, "all");
  assert.deepEqual(campaign.activities, []);
  assert.equal(campaign.nafCodes, "");
  assert.equal(campaign.name, "Prospection autour de Laval");
  assert.equal(campaign.radius, 20);
  assert.equal(activityFilter(campaign).codes, "");
  const stale = { ...campaign, activities: ["Peinture"], nafCodes: "43.34Z" };
  assert.equal(activityFilter(stale).codes, "");
  assert.equal(prepareCampaign(stale).nafCodes, "");
  assert.deepEqual(prepareCampaign(stale).activities, []);
  assert.match(campaignSearchLabel(stale), /Tous les métiers/);
  const old = JSON.parse(JSON.stringify(fixtureWorkspace().campaigns[0]));
  delete old.searchScope;
  delete old.searchOffset;
  const restored = campaignSchema.parse(old);
  assert.equal(restored.searchScope, "targeted");
  assert.equal(restored.searchOffset, 0);
  assert.equal(activityFilter(restored).codes, "43.34Z,43.32A");
  assert.equal(prepareCampaign({ ...draft, name: "Ma campagne" }).name, "Ma campagne");
});

test("La recherche large inclut tous les codes, ignore la déduction NAF et reprend chaque résultat entre les lots", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sillage-all-trades-"));
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, {
    SQLITE_PATH: join(directory, "test.sqlite"),
    DATABASE_URL: "",
    OPENAI_API_KEY: "test-only-mocked-ai",
    GOOGLE_PLACES_API_KEY: "",
  });
  const data = emptyWorkspace();
  const campaign = {
    ...prepareCampaign({ ...newCampaign(data), city: "Laval" }),
    activities: ["Horloger", "Sculpteur"],
    nafCodes: "43.34Z",
  };
  campaign.automation.maxProspects = 3;
  campaign.automation.maxPages = 3;
  data.campaigns.push(campaign);
  data.settings.discoveryEnabled = true;
  data.settings.aiResearchEnabled = true;
  const sourceCalls: URL[] = [];
  let nafLookups = 0;
  const allCompanies = Array.from({ length: 12 }, (_, index) => {
    const establishment = {
      adresse: `${index + 1} Rue des Fleurs`,
      libelle_commune: "Laval",
      etat_administratif: "A",
      activite_principale: ["43.34Z", "95.25Z", "10.71C"][index % 3],
    };
    return {
      siren: String(100000000 + index),
      nom_complet: `Entreprise ${index}`,
      etat_administratif: "A",
      activite_principale: establishment.activite_principale,
      siege: establishment,
      matching_etablissements: [establishment],
    };
  });
  globalThis.fetch = (async (url, options) => {
    if (String(url).includes("geo.api.gouv.fr"))
      return Response.json([
        { nom: "Laval", codesPostaux: ["53000"], centre: { coordinates: [-0.77, 48.07] } },
      ]);
    if (String(url).includes("recherche-entreprises.api.gouv.fr")) {
      const request = new URL(String(url));
      sourceCalls.push(request);
      const size = Number(request.searchParams.get("per_page"));
      const start = (Number(request.searchParams.get("page")) - 1) * size;
      return Response.json({
        results: allCompanies.slice(start, start + size),
        total_pages: Math.ceil(12 / size),
        total_results: 12,
      });
    }
    const body = JSON.parse(options!.body as string);
    if (body.tools?.[0]?.filters) nafLookups++;
    const [identity] = JSON.parse(body.input);
    return Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                results: [
                  {
                    id: identity.id,
                    identityConfirmed: false,
                    summary: "À vérifier",
                    website: "",
                    googleBusinessUrl: "",
                    sourceUrls: [],
                    websiteStatus: "unknown",
                    googleStatus: "unknown",
                    email: "",
                    phone: "",
                    contactSourceUrl: "",
                  },
                ],
              }),
            },
          ],
        },
      ],
    });
  }) as typeof fetch;
  try {
    await saveWorkspace("owner", data, 0);
    for (let index = 0; index < 4; index++) {
      const latest = (await readWorkspace("owner")).data;
      const queued = await enqueueJob("owner", latest.campaigns[0], "discover");
      const claimed = (await claimJob())!;
      assert.equal(claimed.job.id, queued.id);
      await runPipeline(claimed.job, claimed.token);
      const job = (await listJobs("owner")).find((item) => item.id === queued.id)!;
      assert.equal(job.state, "completed", job.error);
      assert.equal(job.added, 3);
      const saved = (await readWorkspace("owner")).data;
      assert.equal(saved.prospects.length, (index + 1) * 3);
    }
    const saved = (await readWorkspace("owner")).data;
    assert.equal(new Set(saved.prospects.map((prospect) => prospect.siren)).size, 12);
    assert.equal(saved.campaigns[0].searchExhausted, true);
    assert.equal(saved.campaigns[0].searchOffset, 0);
    assert.equal(nafLookups, 0);
    assert.ok(sourceCalls.every((call) => call.searchParams.get("per_page") === "10"));
    assert.ok(sourceCalls.every((call) => !call.searchParams.has("activite_principale")));
    assert.ok(saved.prospects.some((prospect) => prospect.activity === "95.25Z"));
  } finally {
    globalThis.fetch = originalFetch;
    await closeDatabase();
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
    await rm(directory, { recursive: true, force: true });
  }
});
