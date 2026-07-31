# THE HOUSE — Boss Behavior Analysis

A read of every code path where THE HOUSE takes points, deals damage, or touches
player records. Written to answer three questions:

1. What "attacks" does the boss actually perform?
2. Is the points history safe — can the real list get deleted?
3. What does Phase 3 actually do?

Nothing in this document changes game behavior. It's an audit.

---

## 1. Short answer on the points history

**The boss never deletes a `PointLog` row. Not once, anywhere in the codebase.**

When the flavor text says a reward was "erased," what actually happens is:

- The player's `points` balance is decremented, and
- a **new** negative `PointLog` entry is appended with the reason
  `The House woke: erased "<original reason>"`.

The original positive entry stays exactly where it is. Grep confirms only **one**
call site in the entire app deletes point history:

```
src/app/api/admin/restart/route.ts:93 →  prisma.pointLog.deleteMany()
```

That's the admin "Restart Game" button, which wipes everything and recreates the
admin account. It is behind a two-step confirm in the admin panel and is admin-only.
The boss cannot reach it. So: the real list is safe from the boss.

Two caveats worth knowing before boss night — see §4 and §5.

---

## 2. The attack catalogue

THE HOUSE has exactly **five** offensive behaviors. All of them are gated on
`bossActive === true` (i.e. Phase 4). At Phase 3 and below, the boss does nothing
but talk.

### Attack 1 — The Targeted Strike (the main one)

`src/lib/houseStrike.ts → executeTargetedStrike()`

Picks the victim's **most recent positive point log entry** and reclaims exactly
that many points.

| | |
|---|---|
| **Cost to victim** | The full value of their last gain — *uncapped* |
| **Fallback** | If they have no positive entries: flat 50 pt "silence tax" (skipped entirely if they hold under 50 pts) |
| **Record kept** | `HouseAttackLog` row + a negative `PointLog` entry |
| **Notification** | Discord DM to the victim |
| **Achievement** | 3+ strikes taken → `war_criminal` |

This is the one that *sounds* destructive and isn't. "Erased" is narrative.

### Attack 2 — The Auto-Strike (the scheduler)

`src/app/api/house/boss/route.ts` (GET), lines 15–34

The boss strikes on a timer with no cron job — it fires lazily whenever any player
loads the boss page and `nextStrikeAt` has passed.

- **Interval:** random 2–6 hours (`nextStrikeTime()`)
- **Window:** only 6:00am–8:00pm local (`HOUSE_UTC_OFFSET`, default −4 / EDT)
- **Target:** random non-admin player
- **Weighting:** players with `im_special` (the PETAI donation achievement) are
  targeted at **1/3 the normal rate** — 1 pool entry vs 3. That's what the manual
  meant by "details become visible at Phase 3."
- **Concurrency:** guarded by an `updateMany` compare-and-swap on `nextStrikeAt`,
  so two simultaneous page loads can't double-strike.

Every **2nd** strike also triggers `refreshPasswordLeak()` — rerolls which player
achievement is publicly leaked on the House page. A soft information attack, not a
points attack.

### Attack 3 — The Wake-Up Retaliation

`src/app/api/house/boss/attack/route.ts`, lines 95–114

Attacking the boss while it sleeps (8pm–6am local) risks waking it.

- **Wake chance:** `5% + 3% per 10 HP` dealt since 8pm, **capped at 80%**
- The counter is **shared across all players** — it's a group risk pool, so one
  person hammering it at 2am endangers everyone who attacks after them
- **On wake:** targeted strike on *that specific attacker*, plus `houseBanDate`
  set — spin and blackjack locked for a day

### Attack 4 — Boss Healing from Losses

`src/app/api/house/spin/route.ts`, lines 64–71

At Phase 4, any point loss on the wheel heals the boss at the same 2:1 ratio
attacks use (`House Wins` = −75 pts → +37 HP back). Capped at `bossMaxHp`.

Separately, playing **any** game during the sleep window logs a 25 HP `sleep_game`
"noise" entry that feeds the wake-chance meter. Players get no warning that
spinning at midnight raises everyone's risk. Top healer earns `top_healer` /
"Unwitting Accomplice" (+300 pts).

### Attack 5 — The Sacrifice (player-on-player, House-brokered)

`src/app/api/admin/house/sacrifice/route.ts` (admin) · `src/app/api/house/sacrifice/route.ts` (players)

Not strictly a boss attack — the boss just profits. **Fully manual: there is no
cron and no trigger condition.** Nothing opens, closes, or resolves it except an
admin POSTing `action: "open"` / `"close"` / `"execute"`.

- Opening clears all previous votes. One vote per player, changeable any time
  while open. Admins can't vote and can't be targeted
- **Thumb on the Scale** doubles a vote to weight 2, consuming one charge
- Players vote; highest weighted vote loses **their entire balance** (ties broken randomly)
- Half is distributed evenly to every surviving non-admin player
- **Half of that half** is banked as `sacrificeBonusHp` and added to the boss's max
  HP when it launches
- Sacrificed player's balance is set to `0` — but a `PointLog` entry records the
  full amount, so history survives
- Consolation: `fatted_calf` (+500) if they had the most points, `suffer_meek`
  (+300) if the least

### Damage economy, for reference

| Action | Effect |
|---|---|
| Player attack | 2 pts = 1 HP, minimum 50 pts per attack |
| Approved bingo square | 10 HP, free |
| Wheel loss (Phase 4) | Heals boss 1 HP per 2 pts lost |
| Boss max HP | `bossHpMultiplier` (default 3,000) × player count + sacrifice bonus |

With 8 players that's **24,000 HP = 48,000 points** the group has to burn.

---

## 3. Where the boss is *not* dangerous

Confirmed safe by inspection:

- ✅ No `deleteMany` / `delete` on `PointLog` in any House, boss, or strike path
- ✅ No user deletion outside `admin/restart`
- ✅ Strikes are transactional — balance change, attack log, and point log commit together or not at all
- ✅ `HouseAttackLog` and `HouseDamageLog` are append-only; nothing prunes them
- ✅ The boss cannot reach admin routes; every one checks `user.isAdmin`
- ✅ Auto-strike is race-safe

---

## 4. Real risks found (not boss-caused)

These are the things that could actually cost you the list. None are exploits the
boss performs — they're gaps to close before boss night.

### 4.1 The restart snapshot doesn't save point history — **highest priority**

`admin/restart` writes a text file to `/data/records/` before wiping. That file
contains **only final standings (username + total) and bingo memories**. The entire
`PointLog` — every transaction of the whole event — is deleted with no export.

If anyone hits Restart Game, the narrative record of the event is gone permanently.

**Mitigation available today:** `GET /api/admin/backup` downloads the raw SQLite
`.db` file. That's a complete backup including all point history. Pull one before
boss night and again after. On Railway the DB lives on the `/data` volume, so it
survives redeploys — but not a restart, and not a volume loss.

### 4.2 Strikes are uncapped and can drive a balance negative

`executeTargetedStrike` reclaims `lastPositive.amount` with no ceiling and no check
against the victim's current balance. A player who just won a 5,000 pt wager and
then spent it can be struck for 5,000 they no longer have, landing them below zero.
Only the 50 pt fallback branch checks affordability.

### 4.3 Wards don't protect against strikes

`boss/attack/route.ts:71` comments that Signal Scrambler is "handled by ward check,"
but no ward check exists in the strike path. `ward` and `signal_scrambler` are only
read by `shop/use/xray` (PIN cracking). Players holding wards — including the top
damage dealer who earned a Scrambler — will reasonably expect protection and get
none. Either wire it up or make the item description explicit.

### 4.4 The sleep ban lands a day late

The wake-up sets `houseBanDate = tomorrowUtcDate()`, and spin/blackjack check
`houseBanDate === todayUtcDate()`. But the sleep window (8pm–6am local at UTC−4) is
already the *next* UTC day — 9pm EDT July 31 is 01:00 UTC Aug 1. So "tomorrow UTC"
resolves to Aug 2, and the player plays freely on Aug 1 and gets banned a day later.
During the sleep window the ban should be `todayUtcDate()`.

### 4.5 A bingo-square killing blow skips the post-battle awards

If the final 10 HP comes off via `admin/bingo/approve`, the boss dies and
`last_stand` is granted — but `top_damage` (+400 pts + Signal Scrambler) and
`top_healer` (+300 pts) are never awarded. That logic lives only in the attack
route. Unlikely, but it would silently eat two achievements and 700 points.

### 4.6 Minor

- Changing your sacrifice vote after spending a Thumb on the Scale silently resets
  you to weight 1 — the `upsert` writes `weight` unconditionally, and the charge is
  already gone
- Attack route validates `amount > user.points` before the transaction, not inside
  it — concurrent attacks could overdraw
- `pool.sort(() => Math.random() - 0.5)` in `executeHouseStrike` is a statistically
  biased shuffle; the `im_special` 3:1 weighting still works, but not cleanly

**None of §4.2–4.6 destroy history.** Worst case they misprice points, which is
correctable from the admin panel.

---

## 5. Phase refresher

Phases **do not advance on their own.** There is no scheduler, no cron, no date
check — `POST /api/admin/house/phase` with a number 0–4 is the only way the phase
ever changes. Whatever happens tomorrow happens because you press the button.

Current phase isn't in the repo (it's `HouseConfig.phase` row 1 in the live DB) —
check the admin panel or the /house page on the Railway deploy.

| Phase | Name | Wheel | Blackjack | What actually happens |
|---|---|---|---|---|
| 0 | Online | ✅ | ✅ | Normal. Friendly greeting. |
| 1 | Glitch | ✅ | ✅ | Corrupted text only. No mechanical change. |
| 2 | Aware | ✅ | ✅ | More corrupted text. No mechanical change. |
| 3 | **Hostile** | 🔒 | 🔒 | **Casino goes dark. Nothing else.** |
| 4 | BOSS MODE | ✅ | ✅ | Everything in §2 switches on — **and the casino re-opens as a trap** |

`HOUSE_PHASES` marks the wheel and blackjack locked at *both* 3 and 4, but both
routes explicitly bypass the lock at phase 4 (`spin/route.ts:29`,
`blackjack/start/route.ts:19`) so that losses can heal the boss. Phase 3 is
therefore the **only** phase where the casino is genuinely dark.

### The thing to know about Phase 3

**Phase 3 locks the casino but does not start the boss fight.** No strikes, no
attacking, no HP bar — every attack path checks `bossActive`, which only
`admin/house/boss` `action: "launch"` sets. Phase 3 alone leaves players with points
they can't spend and nothing to do with them.

Be aware the manual muddies this: `THE_HOUSE_INSTRUCTIONS_PHASE3.md` labels the boss
achievements "PHASE 3 UNLOCKED," so players reading it will expect to fight
something the moment you flip to 3. If tomorrow is meant to be fight night, you
want **Phase 3 as a short dramatic beat and then `launch` the boss** — or go
straight to 4, which the launch action sets automatically.

### Boss night launch order

1. `GET /api/admin/backup` — pull the .db file **first**
2. Set `bossHpMultiplier` if 3,000/player is wrong for the group size
3. Optionally run the sacrifice vote (banks bonus HP for the boss)
4. Phase → 3 for the announcement
5. Admin panel → launch boss (sets phase 4, sets HP, schedules first strike)
6. Strikes fire automatically as players load the boss page, 6am–8pm local
7. `GET /api/admin/backup` again once it's over

### Env to verify on Railway

- `HOUSE_UTC_OFFSET` — defaults to `-4` (EDT). This defines the 6am–8pm strike
  window and the 8pm sleep boundary. Wrong value = boss strikes at wrong hours.
- `DATABASE_URL` — must be `file:/data/prod.db` so the volume persists it.
