import {PLUGIN_FEATURES} from './plugin-page';

/** Account settings sections, shown as horizontal tabs like the staff portal and leaderboard. RuneLite shows only where the plugin page does (dev). */
export const ACCOUNT_SECTIONS = [
  {id: "account", label: "Account", icon: "/icons/community/settings-icon.png", title: "Account", description: "Your Discord sign-in and account-wide settings."},
  {id: "profiles", label: "Profiles", icon: "/icons/community/friends-list.png", title: "Profiles", description: "Privacy, details and linking for each RuneScape name."},
  {id: "supporter", label: "Supporter", icon: "/icons/community/supporters-heart.png", title: "Supporter", description: "Donations to your linked names, and what each profile shows."},
  {id: "runelite", label: "RuneLite", icon: "/icons/runelite/plugin-default.png", title: "RuneLite plugin", description: "Connect the plugin on each computer you play on."},
] as const;
export type AccountSection = (typeof ACCOUNT_SECTIONS)[number]["id"];

const ALIASES: Record<string, AccountSection> = {plugin: "runelite", privacy: "profiles", profile: "profiles", donations: "supporter", support: "supporter"};

/** The section an address opens: ?tab=<id> (or #<id>); ?claim (with or without a code) opens Supporter, where the claim form is.
 * Unknown sections, and RuneLite while the plugin page is off, open Account. */
export function accountSectionFrom(search: string, hash = "", plugin = PLUGIN_FEATURES): AccountSection {
  const params = new URLSearchParams(search);
  const raw = (params.get("tab") ?? hash.replace(/^#/, "")).trim().toLowerCase();
  const wanted = ALIASES[raw] ?? raw;
  const found = ACCOUNT_SECTIONS.find((s) => s.id === wanted && (s.id !== "runelite" || plugin))?.id;
  if (found) return found;
  return params.has("claim") ? "supporter" : "account";
}
