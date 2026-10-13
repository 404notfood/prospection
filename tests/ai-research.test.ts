import test from "node:test";
import assert from "node:assert/strict";
import { blankProspect, emptyWorkspace } from "../lib/domain/defaults";
import { workspaceSchema } from "../lib/domain/schema";
import { researchIdentity, researchIdentityKey, applyAiResearch } from "../lib/domain/ai-research";
import {
  researchWithAi,
  enrichProspectsWithAi,
  openAiConfiguration,
} from "../lib/server/ai-research";

test("Les sauvegardes existantes reprennent l’IA désactivée et sans analyse", () => {
  const data = emptyWorkspace();
  data.prospects.push({
    ...blankProspect(),
    name: "Entreprise",
    city: "Laval",
    activity: "Peinture",
  });
  const legacy = JSON.parse(JSON.stringify(data));
  delete legacy.settings.aiResearchEnabled;
  delete legacy.settings.aiBatchSize;
  delete legacy.prospects[0].aiResearch;
  const restored = workspaceSchema.parse(legacy);
  assert.equal(restored.settings.aiResearchEnabled, false);
  assert.equal(restored.settings.aiBatchSize, 3);
  assert.equal(restored.prospects[0].aiResearch, null);
});

test("OpenAI recherche avec des sources, filtre les URL inventées et conserve les données existantes", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  const prospect = {
    ...blankProspect(),
    name: "Atelier Rivage",
    city: "Laval",
    activity: "Menuiserie",
    address: "12 rue des Fleurs",
    email: "private@example.com",
    notes: "Note privée à ne pas transmettre",
  };
  const identity = researchIdentity(prospect);
  let generated = {
    id: prospect.id,
    identityConfirmed: true,
    summary: "Un site officiel est proposé [1].",
    website: "https://example.com/",
    googleBusinessUrl: "https://www.google.com/maps/place/Rivage",
    sourceUrls: ["https://example.com/", "https://www.google.com/maps/place/Rivage"],
    websiteStatus: "confirmed" as const,
    googleStatus: "confirmed" as const,
    email: "",
    phone: "",
    contactSourceUrl: "",
  };
  let status = "completed";
  let outputText: string | null = null;
  let refusal = false;
  let requestBody: Record<string, unknown> = {};
  try {
    delete process.env.OPENAI_API_KEY;
    assert.equal((await openAiConfiguration()).configured, false);
    await assert.rejects(() => researchWithAi([identity]), /pas configuré/);
    process.env.OPENAI_API_KEY = "test-only-openai-key";
    process.env.OPENAI_MODEL = "gpt-4.1-mini";
    globalThis.fetch = (async (url, options) => {
      assert.equal(String(url), "https://api.openai.com/v1/responses");
      assert.equal(
        (options!.headers as Record<string, string>).Authorization,
        "Bearer test-only-openai-key",
      );
      requestBody = JSON.parse(options!.body as string);
      return Response.json({
        status,
        output: [
          {
            type: "web_search_call",
            action: {
              sources: [
                { url: "https://example.com/", title: "Atelier Rivage" },
                { url: "https://www.google.com/maps/place/Rivage", title: "Fiche Google" },
              ],
            },
          },
          {
            type: "message",
            content: refusal
              ? [{ type: "refusal", refusal: "Refus" }]
              : [
                  {
                    type: "output_text",
                    text: outputText ?? JSON.stringify({ results: [generated] }),
                  },
                ],
          },
        ],
      });
    }) as typeof fetch;
    let [result] = await researchWithAi([identity]);
    assert.equal(result.research.website, "https://example.com/");
    assert.equal(result.research.googleBusinessUrl, generated.googleBusinessUrl);
    assert.equal(result.research.sources.length, 2);
    assert.equal(requestBody.store, false);
    assert.equal(requestBody.tool_choice, "required");
    assert.equal(requestBody.max_tool_calls, 2);
    assert.equal(requestBody.max_output_tokens, 6000);
    assert.ok(!JSON.stringify(requestBody).includes(prospect.email));
    assert.ok(!JSON.stringify(requestBody).includes(prospect.notes));
    const auto = await enrichProspectsWithAi([prospect], 1);
    assert.equal(auto.prospects[0].website, "");
    assert.equal(auto.prospects[0].presence, "unknown");
    assert.equal(auto.prospects[0].status, "review");
    assert.equal(auto.prospects[0].aiResearch?.website, "https://example.com/");
    const applied = applyAiResearch(
      { ...prospect, website: "https://existing.example/" },
      result.research,
    );
    assert.equal(applied.website, "https://existing.example/");
    assert.equal(applied.verifiedAt, "");
    assert.equal(applied.status, "review");
    assert.equal(applied.notes, prospect.notes);
    assert.equal(researchIdentityKey(applied), result.research.identityKey);
    generated = {
      ...generated,
      website: "https://invented.example/",
      googleBusinessUrl: "javascript:alert(1)",
    };
    [result] = await researchWithAi([identity]);
    assert.equal(result.research.website, "");
    assert.equal(result.research.googleBusinessUrl, "");
    generated = { ...generated, website: "https://example.com/", identityConfirmed: false };
    assert.equal((await researchWithAi([identity]))[0].research.website, "");
    generated = { ...generated, sourceUrls: ["https://invented.example/"] };
    [result] = await researchWithAi([identity]);
    assert.equal(result.research.sources.length, 0);
    assert.ok(result.research.summary.includes("reste à vérifier"));
    status = "incomplete";
    await assert.rejects(() => researchWithAi([identity]), /incomplète/);
    status = "completed";
    outputText = "texte non JSON";
    await assert.rejects(() => researchWithAi([identity]), /illisible/);
    outputText = null;
    refusal = true;
    await assert.rejects(() => researchWithAi([identity]), /illisible/);
    refusal = false;
    generated = { ...generated, id: "unexpected-id" };
    await assert.rejects(() => researchWithAi([identity]), /ne correspond pas/);
    globalThis.fetch = (async () =>
      new Response("secret provider error", { status: 429 })) as typeof fetch;
    const failed = await enrichProspectsWithAi([prospect], 1);
    assert.equal(failed.prospects[0].aiResearch, null);
    assert.ok(failed.warnings[0].includes("crédits API"));
    assert.ok(!failed.warnings[0].includes("secret"));
    assert.deepEqual((await enrichProspectsWithAi([], 1)).warnings, []);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
  }
});
