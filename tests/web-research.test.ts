import test from "node:test";
import assert from "node:assert/strict";
import { researchBusiness, enrichProspects } from "../lib/server/web-research";
import { applyWebCandidate } from "../lib/domain/web-research";
import { blankProspect, emptyWorkspace } from "../lib/domain/defaults";
import { workspaceSchema } from "../lib/domain/schema";
import { activityFilter } from "../lib/domain/activities";
import { webUrl, mapsSearch } from "../lib/domain/urls";
import { exportProspects } from "../lib/domain/export";

test("Les liens externes rejettent les protocoles exécutables et encodent les recherches", () => {
  for (const value of [
    "",
    "javascript:alert(1)",
    "data:text/html,x",
    "file:///C:/test",
    "example.com",
  ])
    assert.equal(webUrl(value), null);
  assert.equal(webUrl(" https://example.com/a?x=1&y=2 "), "https://example.com/a?x=1&y=2");
  assert.equal(
    new URL(mapsSearch("Bois & Matière", "Laval")).searchParams.get("query"),
    "Bois & Matière Laval",
  );
});

test("Les anciennes sauvegardes acquièrent les champs facultatifs et les exports conservent les liens", () => {
  const workspace = emptyWorkspace();
  workspace.prospects.push({
    ...blankProspect(),
    name: "Exemple",
    city: "Laval",
    activity: "Peinture",
  });
  const legacy = JSON.parse(JSON.stringify(workspace));
  delete legacy.settings.webResearchEnabled;
  delete legacy.prospects[0].seoAuditUrl;
  delete legacy.prospects[0].googleBusinessUrl;
  const restored = workspaceSchema.parse(legacy);
  assert.equal(restored.prospects[0].seoAuditUrl, "");
  assert.equal(restored.prospects[0].googleBusinessUrl, "");
  assert.equal(restored.settings.webResearchEnabled, false);
  restored.prospects[0].seoAuditUrl = "https://example.com/audit";
  assert.ok(exportProspects(restored.prospects).includes("https://example.com/audit"));
});

test("Le filtre d’activité respecte les codes saisis et ne perd pas les métiers inconnus", () => {
  assert.equal(activityFilter({ nafCodes: "43.21A", activities: ["Peinture"] }).codes, "43.21A");
  assert.equal(
    activityFilter({ nafCodes: "", activities: ["Peinture et plomberie"] }).codes,
    "43.34Z,43.22A",
  );
  assert.equal(activityFilter({ nafCodes: "", activities: ["Peinture", "Sur mesure"] }).codes, "");
});

test("Google propose des candidats, rejette les homonymes et ne déduit jamais une absence de site", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GOOGLE_PLACES_API_KEY;
  let places: unknown[] = [];
  const requests: RequestInit[] = [];
  const prospect = {
    ...blankProspect(),
    name: "Atelier Rivage",
    city: "Laval",
    activity: "Menuiserie",
    address: "12 Rue des Fleurs",
  };
  const place = {
    id: "place1",
    displayName: { text: prospect.name },
    formattedAddress: "12 Rue des Fleurs, 53000 Laval, France",
    googleMapsUri: "https://maps.google.com/place1",
    websiteUri: "https://example.com/",
  };
  try {
    delete process.env.GOOGLE_PLACES_API_KEY;
    await assert.rejects(() => researchBusiness(prospect), /pas configuré/);
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    globalThis.fetch = (async (_url, options) => {
      requests.push(options!);
      return Response.json({ places });
    }) as typeof fetch;
    places = [place];
    let result = await researchBusiness(prospect);
    assert.equal(result.match?.website, place.websiteUri);
    const headers = requests[0].headers as Record<string, string>;
    assert.equal(headers["X-Goog-Api-Key"], "test-key");
    assert.ok(headers["X-Goog-FieldMask"].includes("places.websiteUri"));
    const enriched = await enrichProspects([prospect]);
    assert.equal(enriched.prospects[0].website, place.websiteUri);
    assert.equal(enriched.prospects[0].presence, "unknown");
    assert.equal(enriched.prospects[0].status, "review");
    assert.equal(enriched.prospects[0].verifiedAt, "");
    assert.equal(
      applyWebCandidate({ ...prospect, website: "https://original.example" }, result.match!, true)
        .website,
      "https://original.example",
    );
    places = [place, { ...place, id: "duplicate" }];
    assert.equal((await researchBusiness(prospect)).match, null);
    places = [{ ...place, formattedAddress: "12 Rue des Fleurs, Paris, France" }];
    assert.equal((await researchBusiness(prospect)).match, null);
    places = [{ ...place, websiteUri: "javascript:alert(1)" }];
    assert.equal((await researchBusiness(prospect)).match?.website, "");
    places = [{ ...place, businessStatus: "CLOSED_PERMANENTLY" }];
    assert.equal((await researchBusiness(prospect)).candidates.length, 0);
    places = [];
    result = await researchBusiness(prospect);
    assert.equal(result.match, null);
    assert.deepEqual(result.candidates, []);
    globalThis.fetch = (async () => new Response("", { status: 429 })) as typeof fetch;
    const failed = await enrichProspects([prospect]);
    assert.equal(failed.prospects[0].website, "");
    assert.equal(failed.prospects[0].presence, "unknown");
    assert.equal(failed.warnings.length, 1);
    let failedRequests = 0;
    globalThis.fetch = (async () => {
      failedRequests++;
      return new Response("", { status: 429 });
    }) as typeof fetch;
    const interrupted = await enrichProspects(Array.from({ length: 10 }, () => prospect));
    assert.equal(failedRequests, 3);
    assert.equal(interrupted.prospects.length, 10);
    assert.ok(interrupted.warnings[0].includes("10 entreprise"));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
  }
});
