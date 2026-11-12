/** Social providers that are actually configured (id + secret present). */
export type SocialProviderId = "google" | "github";

export function getEnabledSocialProviders(): SocialProviderId[] {
  const enabled: SocialProviderId[] = [];
  if (
    process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim()
  ) {
    enabled.push("google");
  }
  if (
    process.env.GITHUB_CLIENT_ID?.trim() &&
    process.env.GITHUB_CLIENT_SECRET?.trim()
  ) {
    enabled.push("github");
  }
  return enabled;
}
