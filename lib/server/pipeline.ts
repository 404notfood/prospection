import { readWorkspace, mutateWorkspace } from "./repository";
import { discover } from "./discovery";
import { enrichProspects, googleResearchConfigured } from "./web-research";
import { researchWithAi, openAiConfiguration } from "./ai-research";
import { preparePersonalizedDraft } from "./draft-mail";
import { checkpoint, jobIsRunning, type AutomationJob } from "./jobs";
import { deduplicate, canContact } from "@/lib/domain/prospects";
import { campaignTarget, qualifyAutomatically } from "@/lib/domain/automation";
import {
  researchIdentity,
  researchIdentityKey,
  applyAiVerification,
} from "@/lib/domain/ai-research";
import { verification } from "@/lib/domain/verification";
import { mergeProspectChanges, keepValidQualification } from "@/lib/domain/merge";
import { activityFilter } from "@/lib/domain/activities";
import { resolveActivities } from "./activity-research";

export async function runPipeline(job: AutomationJob, token: string) {
  const active = async () => {
    if (!(await jobIsRunning(job.id, token))) return null;
    const { data } = await readWorkspace(job.ownerId);
    const campaign = data.campaigns.find((c) => c.id === job.campaignId);
    if (!campaign || campaign.state !== "active" || campaignTarget(campaign) !== job.target) {
      job.state = "paused";
      job.error =
        "Campagne en pause, supprimée ou ciblage modifié. Après un changement de ciblage, annulez ce parcours et lancez-en un nouveau.";
      await checkpoint(job, token);
      return null;
    }
    return { data, campaign };
  };
  try {
    const initial = await active();
    if (!initial) return;
    if (
      job.stage === "discovery" &&
      job.pages === 0 &&
      initial.campaign.searchScope !== "all" &&
      initial.campaign.activities.length > 0 &&
      !activityFilter(initial.campaign).codes &&
      initial.data.settings.aiResearchEnabled &&
      (await openAiConfiguration(job.ownerId)).configured &&
      job.aiCalls < job.aiLimit
    ) {
      job.aiCalls++;
      if (!(await checkpoint(job, token))) return;
      let codes: string | null = null;
      try {
        codes = await resolveActivities(initial.campaign.activities, job.ownerId);
      } catch {
        /* Keep geographic discovery usable. */
      }
      if (!(await active())) return;
      if (codes) {
        const saved = await mutateWorkspace(job.ownerId, (workspace) => {
          const campaign = workspace.campaigns.find((c) => c.id === job.campaignId)!;
          if (campaignTarget(campaign) !== job.target || campaign.nafCodes) return workspace;
          campaign.nafCodes = codes;
          campaign.searchPage = 1;
          campaign.searchOffset = 0;
          campaign.searchExhausted = false;
          return workspace;
        });
        const campaign = saved.data.campaigns.find((c) => c.id === job.campaignId)!;
        job.target = campaignTarget(campaign);
        job.startPage = campaign.searchPage;
        job.warnings.push(`Filtre NAF déterminé depuis les sources INSEE : ${codes}.`);
      } else
        job.warnings.push(
          "Activités non résolues avec certitude : découverte géographique toutes activités. Vérifiez le métier des résultats.",
        );
      if (!(await checkpoint(job, token))) return;
    }
    while (job.stage === "discovery") {
      const context = await active();
      if (!context) return;
      job.pages = Math.max(job.pages, context.campaign.searchPage - job.startPage);
      job.added = context.data.prospects.filter((p) => p.discoveryRunId === job.id).length;
      if (job.pages >= job.pageLimit || context.campaign.searchExhausted) break;
      if (!context.data.settings.discoveryEnabled)
        throw new Error("La découverte est désactivée dans les paramètres.");
      const capacity = Math.min(
        10000 - context.data.prospects.length,
        job.prospectLimit - job.added,
      );
      if (capacity <= 0) break;
      const page = context.campaign.searchPage;
      const offset = context.campaign.searchOffset;
      const result = await discover(context.campaign, capacity);
      if (!(await active())) return;
      let added = 0;
      await mutateWorkspace(job.ownerId, (workspace) => {
        const campaign = workspace.campaigns.find((c) => c.id === job.campaignId)!;
        if (
          campaign.searchPage !== page ||
          campaign.searchOffset !== offset ||
          campaignTarget(campaign) !== job.target
        )
          return workspace;
        const unique = deduplicate(workspace.prospects, result.prospects).slice(
          0,
          10000 - workspace.prospects.length,
        );
        added = unique.length;
        workspace.prospects.push(...unique.map((p) => ({ ...p, discoveryRunId: job.id })));
        campaign.searchPage = result.nextPage;
        campaign.searchOffset = result.nextOffset;
        campaign.searchExhausted = result.exhausted;
        const id = `${job.id}-page-${page}-offset-${offset}`;
        if (!workspace.events.some((e) => e.id === id))
          workspace.events.unshift({
            id,
            prospectId: "",
            campaignId: campaign.id,
            kind: "discovery",
            title: "Lot découvert automatiquement",
            detail: `${unique.length} entreprises ajoutées après dédoublonnage.`,
            createdAt: new Date().toISOString(),
          });
        return workspace;
      });
      job.added += added;
      if (result.nextPage > page) job.pages++;
      job.warnings.push(...result.warnings);
      if (!(await checkpoint(job, token))) return;
    }
    if (job.stage === "discovery") {
      job.stage = "prospects";
      if (!(await checkpoint(job, token))) return;
    }
    if (!job.ids.length) {
      const context = await active();
      if (!context) return;
      job.ids = context.data.prospects
        .filter(
          (p) =>
            p.campaignId === job.campaignId &&
            !p.opposed &&
            ((p.status === "review" && p.qualification !== "excluded") ||
              (p.status === "ready" && !p.emailDraft)),
        )
        .sort(
          (a, b) =>
            Number(!!a.automationRunId) - Number(!!b.automationRunId) ||
            (
              a.aiResearch?.researchedAt ||
              a.websiteVerification.checkedAt ||
              a.discoveredAt
            ).localeCompare(
              b.aiResearch?.researchedAt || b.websiteVerification.checkedAt || b.discoveredAt,
            ),
        )
        .slice(0, job.prospectLimit)
        .map((p) => p.id);
      if (!(await checkpoint(job, token))) return;
    }
    while (job.processed < job.ids.length) {
      const context = await active();
      if (!context) return;
      const before = context.data.prospects.find((p) => p.id === job.ids[job.processed]);
      if (!before || before.opposed || before.automationRunId === job.id) {
        job.processed++;
        await checkpoint(job, token);
        continue;
      }
      let next = structuredClone(before);
      if (next.status === "review") {
        if (
          context.data.settings.webResearchEnabled &&
          (await googleResearchConfigured(job.ownerId)) &&
          !job.googleUnavailable
        ) {
          const google = await enrichProspects([next], job.ownerId);
          next = google.prospects[0];
          job.warnings.push(...google.warnings);
          if (next.googleVerification.status === "error") job.googleUnavailable = true;
        }
        if (
          context.data.settings.aiResearchEnabled &&
          (await openAiConfiguration(job.ownerId)).configured &&
          job.aiCalls < job.aiLimit &&
          !job.aiUnavailable
        ) {
          job.aiCalls++; // Reserve before a paid call so a restart cannot erase consumed budget.
          if (!(await checkpoint(job, token))) return;
          try {
            const [result] = await researchWithAi([researchIdentity(next)], job.ownerId);
            if (result && result.research.identityKey === researchIdentityKey(next))
              next = applyAiVerification(next, result.research);
          } catch {
            job.aiUnavailable = true;
            next.websiteVerification =
              next.websiteVerification.status === "confirmed"
                ? next.websiteVerification
                : verification("error", "Recherche IA interrompue. Résultat à reprendre.", "ai");
            next.googleVerification =
              next.googleVerification.status === "confirmed"
                ? next.googleVerification
                : verification("error", "Recherche IA interrompue. Résultat à reprendre.", "ai");
            job.warnings.push(
              "Une analyse IA a échoué. Les informations confirmées sont conservées.",
            );
          }
        } else if (context.data.settings.aiResearchEnabled && job.aiCalls >= job.aiLimit)
          job.warnings.push("Plafond d’appels IA atteint. Les autres fiches restent à vérifier.");
        if (context.campaign.automation.qualify)
          next = qualifyAutomatically(next, context.campaign);
      }
      if (!(await active())) return;
      if (context.campaign.automation.prepareMessages && canContact(next) && !next.emailDraft) {
        const useAi =
          context.data.settings.aiResearchEnabled &&
          (await openAiConfiguration(job.ownerId)).configured &&
          job.aiCalls < job.aiLimit &&
          !job.aiUnavailable;
        if (useAi) {
          job.aiCalls++;
          if (!(await checkpoint(job, token))) return;
        }
        const draft = await preparePersonalizedDraft(next, context.data, useAi, job.ownerId);
        next = draft.prospect;
        if (draft.warning) {
          job.warnings.push(draft.warning);
          job.aiUnavailable = true;
        }
      }
      if (!(await active())) return;
      next.automationRunId = job.id;
      await mutateWorkspace(job.ownerId, (workspace) => {
        const current = workspace.prospects.find((p) => p.id === before.id);
        if (
          !current ||
          current.opposed ||
          researchIdentityKey(current) !== researchIdentityKey(before)
        )
          return workspace;
        let merged = mergeProspectChanges(current, before, next);
        const campaign = workspace.campaigns.find((c) => c.id === job.campaignId)!;
        if (campaignTarget(campaign) !== job.target || campaign.state !== "active")
          return workspace;
        if (current.status !== "review") merged.status = current.status;
        merged = keepValidQualification(merged);
        workspace.prospects = workspace.prospects.map((p) => (p.id === current.id ? merged : p));
        const id = `${job.id}-prospect-${current.id}`;
        if (!workspace.events.some((e) => e.id === id))
          workspace.events.unshift({
            id,
            prospectId: current.id,
            campaignId: job.campaignId,
            kind: "automation",
            title: "Vérifications et préparation terminées",
            detail: `${current.name} · ${merged.qualificationReason || "Informations à examiner"}${merged.emailDraft ? " · brouillon enregistré" : ""}`,
            createdAt: new Date().toISOString(),
          });
        return workspace;
      });
      job.qualified += before.status === "review" && next.status === "ready" ? 1 : 0;
      job.drafts += !before.emailDraft && next.emailDraft ? 1 : 0;
      job.processed++;
      if (!(await checkpoint(job, token))) return;
    }
    job.state = "completed";
    const final = (await readWorkspace(job.ownerId)).data.prospects.filter(
      (p) => p.automationRunId === job.id,
    );
    job.qualified = final.filter((p) => p.qualification === "matched").length;
    job.drafts = final.filter((p) => p.emailDraft).length;
    job.stage = "finished";
    await checkpoint(job, token);
  } catch {
    job.state = "failed";
    job.error =
      "Traitement interrompu. Vérifiez les connexions et la configuration, puis reprenez. Les étapes enregistrées sont conservées.";
    await checkpoint(job, token);
  }
}
