import { BASE_URL } from "@/app/data/seoProducts";

export default function robots() {
  // The wildcard allows search/retrieval bots, including OAI-SearchBot and
  // Claude-SearchBot. Search eligibility does not require opting into training.
  // Keep policy changes explicit; a bot-specific group can override wildcard rules.
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
