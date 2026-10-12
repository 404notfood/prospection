import type { EmailTemplate, Prospect, Settings } from "./schema";

export function renderMessage(template: EmailTemplate, prospect: Prospect, settings: Settings) {
  const variables: Record<string, string> = {
    entreprise: prospect.name,
    ville: prospect.city,
    activite: prospect.activity,
    nom: settings.name,
    societe: settings.company,
    signature: settings.signature,
    constat: prospect.evidence || "[Ajoutez un constat vérifié et adapté à cette entreprise.]",
  };
  const replace = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] ?? match);
  return { subject: replace(template.subject), body: replace(template.body) };
}

export function mailto(email: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
