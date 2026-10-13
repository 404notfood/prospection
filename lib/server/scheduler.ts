import { query, initializeWorkspaceTable } from "./database";
import { readWorkspace, mutateWorkspace } from "./repository";
import { enqueueJob, listJobs } from "./jobs";
import { updateDueFollowUps } from "@/lib/domain/automation";

export async function scheduleDueWork() {
  await initializeWorkspaceTable();
  const owners = await query<{ owner_id: string }>("SELECT owner_id FROM prospect_workspace");
  for (const owner of owners) {
    const { data } = await readWorkspace(owner.owner_id);
    const jobs = await listJobs(owner.owner_id);
    for (const campaign of data.campaigns) {
      if (
        !campaign.automation.enabled ||
        campaign.state !== "active" ||
        (campaign.automation.nextRunAt && Date.parse(campaign.automation.nextRunAt) > Date.now())
      )
        continue;
      if (
        jobs.some(
          (j) => j.campaignId === campaign.id && ["queued", "running", "paused"].includes(j.state),
        )
      )
        continue;
      const backlog = data.prospects.filter(
        (p) =>
          p.campaignId === campaign.id && p.status === "review" && !p.opposed && !p.automationRunId,
      ).length;
      await enqueueJob(
        owner.owner_id,
        campaign,
        campaign.searchExhausted || backlog >= campaign.automation.maxProspects
          ? "process"
          : "discover",
      );
      await mutateWorkspace(owner.owner_id, (workspace) => {
        const current = workspace.campaigns.find((c) => c.id === campaign.id);
        if (current)
          current.automation.nextRunAt = new Date(
            Date.now() + current.automation.intervalHours * 3600000,
          ).toISOString();
        return workspace;
      });
    }
    await mutateWorkspace(owner.owner_id, updateDueFollowUps);
  }
}
