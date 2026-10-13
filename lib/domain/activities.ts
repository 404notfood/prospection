// Common NAF rev. 2 activities. Explicit campaign codes always take precedence.
const activities: [RegExp, string][] = [
  [/\b(peinture|peintre|vitrerie|vitrier)s?\b/, "43.34Z"],
  [/\b(menuiserie|menuisier)s?\b/, "43.32A"],
  [/\b(plomberie|plombier)s?\b/, "43.22A"],
  [/\b(chauffage|chauffagiste|climatisation)s?\b/, "43.22B"],
  [/\b(electricite|electricien)s?\b/, "43.21A"],
  [/\b(couverture|couvreur)s?\b/, "43.91B"],
  [/\b(maconnerie|macon)s?\b/, "43.99C"],
  [/\b(paysagiste|jardinier)s?\b/, "81.30Z"],
  [/\b(coiffure|coiffeur|coiffeuse)s?\b/, "96.02A"],
  [/\b(esthetique|estheticienne|institut de beaute)s?\b/, "96.02B"],
  [/\b(boulangerie|boulanger)s?\b/, "10.71C"],
  [/\b(fleuriste)s?\b/, "47.76Z"],
  [/\b(restaurant|restauration)s?\b/, "56.10A,56.10B,56.10C"],
  [/\b(garage|garagiste|reparation automobile)s?\b/, "45.20A"],
];

export function activityFilter(campaign: {
  searchScope?: "all" | "targeted";
  nafCodes: string;
  activities: string[];
}) {
  if (campaign.searchScope === "all") return { codes: "", inferred: false };
  if (campaign.nafCodes) return { codes: campaign.nafCodes, inferred: false };
  if (!campaign.activities.length) return { codes: "", inferred: false };
  const matches = campaign.activities.map((activity) => {
    const normalized = activity
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return activities
      .filter(([pattern]) => pattern.test(normalized))
      .map(([, codes]) => codes)
      .join(",");
  });
  // Never silently drop an activity that the catalog cannot resolve.
  return {
    codes: matches.every(Boolean)
      ? [...new Set(matches.flatMap((m) => m!.split(",")))].join(",")
      : "",
    inferred: true,
  };
}
