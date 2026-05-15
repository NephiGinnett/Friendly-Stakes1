const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export function vpnAlias(seed: number, userId: number): string {
  return US_STATES[Math.abs(seed ^ userId) % US_STATES.length] + "-Gambler";
}

type UserRef = { id: number; username: string };

export function maskWager<T extends {
  vpnActive: boolean; vpnSeed: number;
  creatorId: number; creator: UserRef; creatorStake: number;
  entries: Array<{ userId: number; user: UserRef; stake: number }>;
}>(wager: T, viewerId: number): T & { vpnMasked: boolean } {
  if (!wager.vpnActive) return { ...wager, vpnMasked: false };
  const participants = new Set([wager.creatorId, ...wager.entries.map(e => e.userId)]);
  if (participants.has(viewerId)) return { ...wager, vpnMasked: false };
  return {
    ...wager,
    vpnMasked: true,
    creator: { ...wager.creator, username: vpnAlias(wager.vpnSeed, wager.creatorId) },
    creatorStake: 0,
    entries: wager.entries.map(e => ({
      ...e,
      user: { ...e.user, username: vpnAlias(wager.vpnSeed, e.userId) },
      stake: 0,
    })),
  };
}

export function maskChallenge<T extends {
  vpnActive: boolean; vpnSeed: number;
  creatorId: number; creator: UserRef;
  targetId: number | null; target: UserRef | null;
  acceptedById: number | null; acceptedBy: UserRef | null;
  offer: number;
}>(challenge: T, viewerId: number): T & { vpnMasked: boolean } {
  if (!challenge.vpnActive) return { ...challenge, vpnMasked: false };
  const participants = new Set(
    [challenge.creatorId, challenge.acceptedById].filter((id): id is number => id !== null)
  );
  if (participants.has(viewerId)) return { ...challenge, vpnMasked: false };
  return {
    ...challenge,
    vpnMasked: true,
    creator: { ...challenge.creator, username: vpnAlias(challenge.vpnSeed, challenge.creatorId) },
    target: challenge.target
      ? { ...challenge.target, username: vpnAlias(challenge.vpnSeed, challenge.targetId!) }
      : null,
    acceptedBy: challenge.acceptedBy
      ? { ...challenge.acceptedBy, username: vpnAlias(challenge.vpnSeed, challenge.acceptedById!) }
      : null,
    offer: 0,
  };
}
