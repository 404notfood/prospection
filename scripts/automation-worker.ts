import { loadEnvConfig } from "@next/env";
import { setTimeout as delay } from "node:timers/promises";
import { closeDatabase } from "../lib/server/database";
import { initializeJobs, claimJob, heartbeat } from "../lib/server/jobs";
import { runPipeline } from "../lib/server/pipeline";
import { scheduleDueWork } from "../lib/server/scheduler";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
async function main() {
  await initializeJobs();
  let lastSchedule = 0;
  do {
    await heartbeat();
    if (Date.now() - lastSchedule > 30000) {
      await scheduleDueWork();
      lastSchedule = Date.now();
    }
    const claimed = await claimJob();
    if (claimed) {
      const timer = setInterval(() => {
        void heartbeat(claimed.job.id, claimed.token).catch(() => {
          stopping = true;
        });
      }, 15000);
      try {
        await runPipeline(claimed.job, claimed.token);
      } finally {
        clearInterval(timer);
      }
    } else if (!process.argv.includes("--once")) await delay(2000);
  } while (!stopping && !process.argv.includes("--once"));
}
void main()
  .catch(() => {
    console.error(
      "Worker interrompu. Vérifiez la base et les connexions. Aucun secret n’est affiché.",
    );
    process.exitCode = 1;
  })
  .finally(closeDatabase);
