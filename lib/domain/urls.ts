export function webUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function mapsSearch(name: string, city: string, address = "") {
  return `https://www.google.com/maps/search/?${new URLSearchParams({
    api: "1",
    query: [name, address, city].filter(Boolean).join(" "),
  })}`;
}

export function websiteSearch(name: string, city: string) {
  return `https://www.google.com/search?${new URLSearchParams({ q: `${name} ${city} site officiel` })}`;
}
