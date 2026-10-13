import type { EmailTemplate, Prospect, Settings, Offer } from "./schema";

export function renderMessage(
  template: EmailTemplate,
  prospect: Prospect,
  settings: Settings,
  offer?: Offer,
) {
  const variables: Record<string, string> = {
    entreprise: prospect.name,
    ville: prospect.city,
    activite: prospect.activity,
    nom: settings.name,
    societe: settings.company,
    signature: settings.signature,
    constat: prospect.evidence || "[Ajoutez un constat vérifié et adapté à cette entreprise.]",
    prestation: offer?.name || "",
    tarif: offer?.price || "",
    conditions: offer?.conditions || "",
  };
  const replace = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] ?? match);
  return { subject: replace(template.subject), body: replace(template.body) };
}

export function addCampaignOffer(
  body: string,
  offer: Offer | undefined,
  signature: string,
  templateBody: string,
) {
  if (!offer || templateBody.includes("{{prestation}}")) return body;
  const block = `${offer.name}\n${offer.description}${offer.price ? `\nTarif indicatif : ${offer.price}` : ""}${offer.conditions ? `\n${offer.conditions}` : ""}`;
  return (
    signature && body.includes(signature)
      ? body.replace(signature, `${block}\n\n${signature}`)
      : `${body}\n\n${block}`
  ).slice(0, 10000);
}

export function mailto(email: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
