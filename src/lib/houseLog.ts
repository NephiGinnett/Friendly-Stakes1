/**
 * Taxonomy for HouseDamageLog.source.
 *
 * The table stores three different kinds of event that must never be summed
 * together — a heal is not damage, and sleep-window noise is neither.
 */

/** Rows that reduce boss HP. These are the only rows that count as "damage". */
export const DAMAGE_SOURCES = ["attack", "sleep_attack", "bingo"] as const;

/** Rows that restore boss HP — a player's gambling losses feeding The House. */
export const HEAL_SOURCE = "heal";

/**
 * Rows logged when a player uses the casino during the sleep window. These
 * represent noise that raises the wake-chance meter, not HP in either
 * direction, so they are excluded from both the damage and heal boards.
 */
export const NOISE_SOURCE = "sleep_game";

/** `where` fragment selecting only real damage. */
export const DAMAGE_WHERE = { source: { in: [...DAMAGE_SOURCES] } };

/** `where` fragment selecting only real healing. */
export const HEAL_WHERE = { source: HEAL_SOURCE };

/**
 * Rows that move the wake-chance meter: attacks landed during the sleep window
 * plus casino noise. Heals never wake The House — being fed is not a
 * disturbance.
 */
export const WAKE_NOISE_WHERE = {
  source: { in: ["attack", "sleep_attack", "bingo", NOISE_SOURCE] },
};
