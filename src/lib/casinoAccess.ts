/**
 * Who can reach the Casino Night floor (roulette, scratch cards, Strike It Rich).
 *
 * Two situations open it:
 *  1. An admin has flipped Casino Night live.
 *  2. The boss fight is running — at Phase 4 every point lost at a table feeds
 *     THE HOUSE, so the tables have to be reachable for that mechanic to exist.
 *
 * Both close again on their own: Casino Night when the admin flips it off, the
 * boss floor when The House is defeated (bossActive flips false).
 */
export interface CasinoGateConfig {
  casinoNightActive?: boolean | null;
  phase?: number | null;
  bossActive?: boolean | null;
}

/** True while THE HOUSE is a live boss taking damage. */
export function isBossFightLive(config: CasinoGateConfig | null | undefined): boolean {
  return config?.phase === 4 && !!config?.bossActive;
}

/** True when the Casino Night games should accept play. */
export function isCasinoNightOpen(config: CasinoGateConfig | null | undefined): boolean {
  return !!config?.casinoNightActive || isBossFightLive(config);
}
