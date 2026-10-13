import type { Prospect } from "./schema";
import { qualificationError } from "./prospects";

export function mergeProspectChanges(
  current: Prospect,
  before: Prospect,
  proposed: Prospect,
  strict = false,
) {
  const merged = { ...current };
  for (const key of Object.keys(proposed) as (keyof Prospect)[]) {
    if (JSON.stringify(proposed[key]) === JSON.stringify(before[key])) continue;
    if (
      JSON.stringify(current[key]) !== JSON.stringify(before[key]) &&
      JSON.stringify(current[key]) !== JSON.stringify(proposed[key])
    ) {
      if (strict)
        throw new Error(
          "Cette fiche a changé pendant votre modification. Rechargez-la avant d’enregistrer ce champ.",
        );
      continue;
    }
    Object.assign(merged, { [key]: proposed[key] });
  }
  if (current.website !== before.website && !strict)
    merged.websiteVerification = current.websiteVerification;
  if (current.googleBusinessUrl !== before.googleBusinessUrl && !strict)
    merged.googleVerification = current.googleVerification;
  return merged;
}
export function keepValidQualification(prospect: Prospect) {
  if (qualificationError(prospect))
    return { ...prospect, status: "review" as const, qualification: "review" as const };
  return prospect;
}
