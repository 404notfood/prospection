import test from "node:test";
import assert from "node:assert/strict";
import { fixtureWorkspace } from "./fixtures/workspace";
import { discover } from "../lib/server/discovery";

test("La découverte garde les établissements ouverts dans la zone et ne fabrique pas de coordonnées", async () => {
  const original = globalThis.fetch;
  const called: string[] = [];
  globalThis.fetch = (async (url) => {
    called.push(String(url));
    if (String(url).includes("geo.api.gouv.fr"))
      return Response.json([
        { nom: "Laval", codesPostaux: ["53000"], centre: { coordinates: [-0.77, 48.07] } },
      ]);
    const seat = {
      adresse: "Siège hors zone",
      libelle_commune: "Paris",
      etat_administratif: "A",
      activite_principale: "43.34Z",
    };
    const active = {
      adresse: "Établissement local",
      libelle_commune: "Laval",
      etat_administratif: "A",
      activite_principale: "43.34Z",
    };
    return Response.json({
      results: [
        {
          siren: "123456789",
          nom_complet: "Entreprise valide",
          etat_administratif: "A",
          activite_principale: "43.34Z",
          siege: seat,
          matching_etablissements: [active],
        },
        {
          siren: "987654321",
          nom_complet: "Établissement fermé",
          etat_administratif: "A",
          activite_principale: "43.34Z",
          siege: seat,
          matching_etablissements: [{ ...active, etat_administratif: "F" }],
        },
      ],
      total_pages: 3,
      total_results: 25,
    });
  }) as typeof fetch;
  try {
    const campaign = fixtureWorkspace().campaigns[0];
    const result = await discover(campaign);
    assert.equal(result.prospects.length, 1);
    assert.equal(result.prospects[0].city, "Laval");
    assert.equal(result.prospects[0].address, "Établissement local");
    assert.equal(result.prospects[0].email, "");
    assert.equal(result.prospects[0].phone, "");
    assert.equal(result.prospects[0].presence, "unknown");
    assert.equal(result.prospects[0].status, "review");
    assert.equal(result.nextPage, 2);
    assert.equal(result.exhausted, false);
    assert.ok(called[1].includes("radius=30"));
    assert.ok(called[1].includes("per_page=10"));
    await assert.rejects(() => discover({ ...campaign, nafCodes: "" }), /codes NAF/);
  } finally {
    globalThis.fetch = original;
  }
});
