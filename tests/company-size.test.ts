import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classifyCompanySize,
  currentCompanySize,
  applyCompanyTarget,
} from "../lib/domain/company-size";
import { canContact } from "../lib/domain/prospects";
import { newCampaign, prepareCampaign } from "../lib/domain/campaigns";
import { blankProspect, emptyWorkspace } from "../lib/domain/defaults";
import { workspaceSchema } from "../lib/domain/schema";
import { discover } from "../lib/server/discovery";
import { lookupCompanySize } from "../lib/server/company-size";
import { readWorkspace, saveWorkspace } from "../lib/server/repository";
import { closeDatabase } from "../lib/server/database";
import { enqueueJob, claimJob, listJobs } from "../lib/server/jobs";
import { runPipeline } from "../lib/server/pipeline";
import { updateDueFollowUps } from "../lib/domain/automation";

test("Le plafond de 30 salariés utilise l’effectif de l’entreprise entière ; 20–49 reste incertain", () => {
  const campaign = prepareCampaign({ ...newCampaign(emptyWorkspace()), city: "Laval" });
  assert.equal(campaign.companyTarget, "small");
  for (const range of ["NN", "00", "01", "02", "03", "11"]) {
    assert.equal(
      classifyCompanySize({
        siren: "123456789",
        categorie_entreprise: "PME",
        tranche_effectif_salarie: range,
      }).status,
      "small",
    );
  }
  for (const company of [
    { categorie_entreprise: "GE", tranche_effectif_salarie: "01" },
    { categorie_entreprise: "ETI", tranche_effectif_salarie: null },
    { categorie_entreprise: "PME", tranche_effectif_salarie: "21" },
    { categorie_entreprise: "PME", tranche_effectif_salarie: "22" },
    { categorie_entreprise: "PME", tranche_effectif_salarie: "31" },
    { categorie_entreprise: null, tranche_effectif_salarie: "32" },
    { categorie_entreprise: null, tranche_effectif_salarie: "53" },
  ])
    assert.equal(classifyCompanySize({ siren: "123456789", ...company }).status, "large");
  for (const range of ["12", null, "invalid"])
    assert.equal(
      classifyCompanySize({
        siren: "123456789",
        categorie_entreprise: "PME",
        tranche_effectif_salarie: range,
      }).status,
      "uncertain",
    );
  const possible = classifyCompanySize({
    siren: "123456789",
    categorie_entreprise: null,
    tranche_effectif_salarie: "01",
  });
  assert.equal(possible.status, "uncertain");
  const ready = {
    ...blankProspect(),
    name: "Orange",
    city: "Laval",
    activity: "Télécom",
    siren: "123456789",
    status: "ready" as const,
    companySize: classifyCompanySize({ siren: "123456789", categorie_entreprise: "GE" }),
  };
  const excluded = applyCompanyTarget(ready, campaign);
  assert.equal(excluded.qualification, "excluded");
  assert.equal(canContact(excluded, campaign), false);
  assert.equal(currentCompanySize({ ...ready, siren: "987654321" }).status, "unchecked");
});

test("Les anciennes tailles PME sont réévaluées sans redater la source, bloquant contacts et relances", () => {
  const data = emptyWorkspace();
  const campaign = prepareCampaign({ ...newCampaign(data), city: "Laval" });
  data.campaigns.push(campaign);
  for (const range of ["21", "12", ""]) {
    const prospect = {
      ...blankProspect(),
      siren: "123456789",
      campaignId: campaign.id,
      status: "contacted" as const,
      followUpAt: "2026-10-12",
      companySize: {
        ...classifyCompanySize({
          siren: "123456789",
          categorie_entreprise: "PME",
          tranche_effectif_salarie: range,
        }),
        status: "small" as const,
        reason: "Ancien critère PME",
        checkedAt: "2026-10-01T12:00:00.000Z",
        employeeYear: "2024",
      },
    };
    const size = currentCompanySize(prospect);
    assert.equal(size.status, range === "21" ? "large" : "uncertain");
    assert.equal(size.checkedAt, prospect.companySize.checkedAt);
    assert.equal(size.employeeYear, "2024");
    assert.equal(canContact(prospect, campaign), false);
    data.prospects = [prospect];
    updateDueFollowUps(data, new Date("2026-10-13T12:00:00Z"));
    assert.equal(data.events.length, 0);
    assert.equal(prospect.status, "contacted");
  }
});

test("Les sauvegardes existantes passent aux TPE/PME et reprennent la découverte sans perdre leurs prospects", () => {
  const data = emptyWorkspace();
  data.campaigns.push(prepareCampaign({ ...newCampaign(data), city: "Laval" }));
  data.prospects.push({
    ...blankProspect(),
    name: "Entreprise",
    city: "Laval",
    activity: "Artisan",
  });
  const legacy = JSON.parse(JSON.stringify(data));
  delete legacy.campaigns[0].companyTarget;
  legacy.campaigns[0].searchPage = 7;
  legacy.campaigns[0].searchExhausted = true;
  delete legacy.prospects[0].companySize;
  const restored = workspaceSchema.parse(legacy);
  assert.equal(restored.campaigns[0].companyTarget, "small");
  assert.equal(restored.campaigns[0].searchPage, 1);
  assert.equal(restored.campaigns[0].searchExhausted, false);
  assert.equal(restored.prospects.length, 1);
  assert.equal(restored.prospects[0].companySize.status, "unchecked");
});

test("La découverte écarte les grands groupes même si leur agence locale compte deux salariés", async () => {
  const originalFetch = globalThis.fetch;
  const campaign = prepareCampaign({
    ...newCampaign(emptyWorkspace()),
    city: "Laval",
    batchSize: 25,
  });
  const company = (index: number, category: string | null, range: string | null) => {
    const local = {
      adresse: "12 Rue des Fleurs",
      libelle_commune: "Laval",
      etat_administratif: "A",
      activite_principale: "43.34Z",
      tranche_effectif_salarie: "01",
    };
    return {
      siren: String(100000000 + index),
      nom_complet: `Entreprise ${index}`,
      etat_administratif: "A",
      activite_principale: "43.34Z",
      categorie_entreprise: category,
      tranche_effectif_salarie: range,
      siege: local,
      matching_etablissements: [local],
    };
  };
  globalThis.fetch = (async (url) => {
    if (String(url).includes("geo.api.gouv.fr"))
      return Response.json([
        { nom: "Laval", codesPostaux: ["53000"], centre: { coordinates: [-0.77, 48.07] } },
      ]);
    const params = new URL(String(url)).searchParams;
    assert.equal(params.get("sort_by_size"), "false");
    assert.equal(params.has("categorie_entreprise"), false); // near_point does not support this filter.
    return Response.json({
      results: [
        company(0, "GE", "53"),
        company(1, "ETI", "01"),
        company(2, null, "32"),
        company(3, "PME", "NN"),
        company(4, "PME", "31"),
        company(5, null, "01"),
        company(6, "PME", "11"),
        company(7, "PME", "12"),
      ],
      total_pages: 1,
      total_results: 8,
    });
  }) as typeof fetch;
  try {
    const result = await discover(campaign);
    assert.equal(result.excludedLarge, 4);
    assert.deepEqual(
      result.prospects.map((p) => p.siren),
      ["100000003", "100000005", "100000006", "100000007"],
    );
    assert.equal(result.prospects[1].companySize.status, "uncertain");
    assert.equal(result.prospects[2].companySize.status, "small");
    assert.equal(result.prospects[3].companySize.status, "uncertain");
    assert.equal(result.exhausted, true);
    globalThis.fetch = (async () =>
      Response.json({
        results: [{ siren: "987654321", categorie_entreprise: "PME" }],
      })) as typeof fetch;
    assert.equal((await lookupCompanySize("123456789")).status, "uncertain");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Le parcours reclasse les anciennes grandes entreprises et ne consomme aucun appel Google/IA pour elles ni pour les tailles inconnues", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sillage-size-pipeline-"));
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, {
    SQLITE_PATH: join(directory, "test.sqlite"),
    DATABASE_URL: "",
    OPENAI_API_KEY: "test-only-ai",
    GOOGLE_PLACES_API_KEY: "test-only-google",
  });
  const data = emptyWorkspace();
  const campaign = prepareCampaign({ ...newCampaign(data), city: "Laval" });
  data.campaigns.push(campaign);
  data.settings.aiResearchEnabled = true;
  data.settings.webResearchEnabled = true;
  data.prospects = [0, 1, 2, 3, 4, 5].map((index) => ({
    ...blankProspect(),
    id: `old-${index}`,
    name: `Ancienne entreprise ${index}`,
    city: "Laval",
    activity: "Activité",
    campaignId: campaign.id,
    siren: String(100000000 + index),
  }));
  Object.assign(data.prospects[0], {
    status: "ready",
    presence: "absent",
    verifiedAt: "2026-10-12",
    evidence: "Constat ancien",
    emailDraft: {
      subject: "Ancien brouillon",
      body: "À conserver dans l’historique",
      method: "manual",
      createdAt: new Date().toISOString(),
    },
  });
  for (const [index, range] of [
    [3, "21"],
    [4, "12"],
    [5, ""],
  ] as const) {
    Object.assign(data.prospects[index], {
      ...data.prospects[0],
      id: `old-${index}`,
      name: `Ancienne entreprise ${index}`,
      siren: String(100000000 + index),
      companySize: {
        ...classifyCompanySize({
          siren: String(100000000 + index),
          categorie_entreprise: "PME",
          tranche_effectif_salarie: range,
        }),
        status: "small",
      },
    });
  }
  let paidCalls = 0;
  globalThis.fetch = (async (url) => {
    if (!String(url).includes("recherche-entreprises.api.gouv.fr/search?")) {
      paidCalls++;
      throw new Error("Aucun appel payant attendu");
    }
    const siren = new URL(String(url)).searchParams.get("q");
    return Response.json({
      results: [
        {
          siren,
          categorie_entreprise:
            siren === "100000000"
              ? "GE"
              : siren === "100000001"
                ? "ETI"
                : siren === "100000002"
                  ? null
                  : "PME",
          tranche_effectif_salarie:
            siren === "100000004" ? "12" : siren === "100000005" ? null : "01",
        },
      ],
    });
  }) as typeof fetch;
  try {
    await saveWorkspace("owner", data, 0);
    const queued = await enqueueJob("owner", campaign, "process");
    const claimed = (await claimJob())!;
    await runPipeline(claimed.job, claimed.token);
    const job = (await listJobs("owner")).find((j) => j.id === queued.id)!;
    assert.equal(job.state, "completed", job.error);
    assert.equal(job.processed, 6);
    assert.equal(job.aiCalls, 0);
    assert.equal(job.drafts, 0);
    assert.equal(paidCalls, 0);
    const saved = (await readWorkspace("owner")).data;
    assert.equal(saved.prospects[0].qualification, "excluded");
    assert.equal(saved.prospects[0].status, "review");
    assert.equal(saved.prospects[1].qualification, "excluded");
    assert.equal(saved.prospects[2].companySize.status, "uncertain");
    assert.equal(canContact(saved.prospects[0], campaign), false);
    assert.ok(saved.prospects[0].emailDraft); // Preserve past work without offering it for sending.
    assert.equal(saved.prospects[3].qualification, "excluded");
    assert.equal(saved.prospects[3].companySize.status, "large");
    for (const index of [4, 5]) {
      assert.equal(saved.prospects[index].companySize.status, "uncertain");
      assert.equal(saved.prospects[index].status, "review");
      assert.equal(saved.prospects[index].qualification, "review");
      assert.equal(canContact(saved.prospects[index], campaign), false);
      assert.ok(saved.prospects[index].emailDraft);
    }
  } finally {
    globalThis.fetch = originalFetch;
    await closeDatabase();
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
    await rm(directory, { recursive: true, force: true });
  }
});
