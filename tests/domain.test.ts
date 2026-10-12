import test from "node:test";
import assert from "node:assert/strict";
import { blankProspect, emptyWorkspace } from "../lib/domain/defaults";
import { fixtureWorkspace } from "./fixtures/workspace";
import {
  counts,
  deduplicate,
  qualificationError,
  canContact,
  validateWorkspace,
} from "../lib/domain/prospects";
import { workspaceSchema } from "../lib/domain/schema";
import { exportProspects } from "../lib/domain/export";
import { renderMessage } from "../lib/domain/messages";

test("Les exemples sont valides, séparés et comptés sans indicateurs inventés", () => {
  const data = fixtureWorkspace();
  assert.ok(workspaceSchema.safeParse(data).success);
  assert.equal(validateWorkspace(data), null);
  assert.deepEqual(counts(data.prospects), {
    found: 24,
    review: 9,
    qualified: 14,
    ready: 6,
    won: 1,
  });
  assert.equal(emptyWorkspace().prospects.length, 0);
});

test("Un site non renseigné ne qualifie jamais une entreprise", () => {
  const prospect = {
    ...blankProspect(),
    name: "Exemple",
    city: "Rennes",
    activity: "Artisan",
    status: "ready" as const,
  };
  assert.ok(qualificationError(prospect));
  prospect.verifiedAt = "2026-10-12";
  prospect.evidence = "Vérifications de l’identité et recherche du site officiel.";
  assert.ok(qualificationError(prospect));
  assert.equal(qualificationError({ ...prospect, presence: "absent" }), null);
  assert.ok(
    qualificationError({ ...prospect, presence: "absent", website: "https://example.com" }),
  );
});

test("Une opposition interdit toute prise de contact", () => {
  const prospect = fixtureWorkspace().prospects[0];
  assert.equal(canContact(prospect), true);
  assert.equal(canContact({ ...prospect, opposed: true }), false);
  assert.ok(qualificationError({ ...prospect, opposed: true }));
});

test("Dédupliquer par SIREN, puis rapprocher un ajout manuel sans SIREN", () => {
  const base = { ...blankProspect(), name: "Atelier Rivage", city: "Rennes", activity: "Artisan" };
  assert.equal(deduplicate([base], [{ ...base, id: "new", siren: "123456789" }]).length, 0);
  assert.equal(
    deduplicate(
      [{ ...base, siren: "123456789" }],
      [{ ...base, name: "Autre nom", siren: "123456789" }],
    ).length,
    0,
  );
  assert.equal(
    deduplicate([base], [{ ...base, name: "ATELIER RIVAGE", city: "RENnES" }]).length,
    0,
  );
  assert.equal(deduplicate([], [base, { ...base, id: "second" }]).length, 1);
});

test("Les sauvegardes rejettent les références cassées et les URL exécutables", () => {
  const data = fixtureWorkspace();
  data.prospects[0].campaignId = "missing";
  assert.ok(validateWorkspace(data));
  data.prospects[0].website = "javascript:alert(1)";
  assert.equal(workspaceSchema.safeParse(data).success, false);
});

test("L’export CSV conserve les accents et neutralise les formules Excel", () => {
  const prospect = {
    ...blankProspect(),
    name: "=HYPERLINK(1)",
    activity: "Ébéniste",
    city: "Rennes",
  };
  const csv = exportProspects([prospect]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("' =HYPERLINK".replace("' ", "'")));
  assert.ok(csv.includes("Ébéniste"));
});

test("Les messages utilisent les faits conservés sans déduire un besoin ni un prix", () => {
  const data = fixtureWorkspace();
  const prospect = data.prospects[0];
  const message = renderMessage(data.templates[0], prospect, data.settings);
  assert.ok(message.subject.includes(prospect.name));
  assert.ok(message.body.includes(prospect.evidence));
  assert.ok(message.body.includes(data.settings.signature));
  assert.ok(!message.body.includes("{{entreprise}}"));
});
