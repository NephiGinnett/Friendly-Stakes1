// Bump CURRENT_VERSION with every meaningful update.
// PLAYER_VERSION is what non-admin users see until VERSION_LAUNCH passes.
// After VERSION_LAUNCH both groups see CURRENT_VERSION.

export const CURRENT_VERSION = "3.2";
export const PLAYER_VERSION = "3.0";
export const VERSION_LAUNCH = new Date("2026-05-16T18:00:00");

export function getDisplayVersion(isAdmin: boolean): string {
  if (isAdmin || new Date() >= VERSION_LAUNCH) return CURRENT_VERSION;
  return PLAYER_VERSION;
}
