import { prisma } from "@/lib/db";

const TEAMS = [
  // CONCACAF (6) — includes 3 hosts
  { name: "United States",  code: "USA", flag: "🇺🇸", confederation: "CONCACAF" },
  { name: "Canada",         code: "CAN", flag: "🇨🇦", confederation: "CONCACAF" },
  { name: "Mexico",         code: "MEX", flag: "🇲🇽", confederation: "CONCACAF" },
  { name: "Panama",         code: "PAN", flag: "🇵🇦", confederation: "CONCACAF" },
  { name: "Honduras",       code: "HON", flag: "🇭🇳", confederation: "CONCACAF" },
  { name: "Jamaica",        code: "JAM", flag: "🇯🇲", confederation: "CONCACAF" },

  // CONMEBOL (6)
  { name: "Argentina",      code: "ARG", flag: "🇦🇷", confederation: "CONMEBOL" },
  { name: "Brazil",         code: "BRA", flag: "🇧🇷", confederation: "CONMEBOL" },
  { name: "Colombia",       code: "COL", flag: "🇨🇴", confederation: "CONMEBOL" },
  { name: "Ecuador",        code: "ECU", flag: "🇪🇨", confederation: "CONMEBOL" },
  { name: "Uruguay",        code: "URU", flag: "🇺🇾", confederation: "CONMEBOL" },
  { name: "Venezuela",      code: "VEN", flag: "🇻🇪", confederation: "CONMEBOL" },

  // UEFA (19)
  { name: "Germany",        code: "GER", flag: "🇩🇪", confederation: "UEFA" },
  { name: "Spain",          code: "ESP", flag: "🇪🇸", confederation: "UEFA" },
  { name: "France",         code: "FRA", flag: "🇫🇷", confederation: "UEFA" },
  { name: "England",        code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", confederation: "UEFA" },
  { name: "Portugal",       code: "POR", flag: "🇵🇹", confederation: "UEFA" },
  { name: "Netherlands",    code: "NED", flag: "🇳🇱", confederation: "UEFA" },
  { name: "Italy",          code: "ITA", flag: "🇮🇹", confederation: "UEFA" },
  { name: "Belgium",        code: "BEL", flag: "🇧🇪", confederation: "UEFA" },
  { name: "Switzerland",    code: "SUI", flag: "🇨🇭", confederation: "UEFA" },
  { name: "Croatia",        code: "CRO", flag: "🇭🇷", confederation: "UEFA" },
  { name: "Denmark",        code: "DEN", flag: "🇩🇰", confederation: "UEFA" },
  { name: "Austria",        code: "AUT", flag: "🇦🇹", confederation: "UEFA" },
  { name: "Hungary",        code: "HUN", flag: "🇭🇺", confederation: "UEFA" },
  { name: "Serbia",         code: "SRB", flag: "🇷🇸", confederation: "UEFA" },
  { name: "Romania",        code: "ROU", flag: "🇷🇴", confederation: "UEFA" },
  { name: "Scotland",       code: "SCO", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", confederation: "UEFA" },
  { name: "Norway",         code: "NOR", flag: "🇳🇴", confederation: "UEFA" },
  { name: "Sweden",         code: "SWE", flag: "🇸🇪", confederation: "UEFA" },
  { name: "Bosnia-Herzegovina", code: "BIH", flag: "🇧🇦", confederation: "UEFA" },

  // CAF (12)
  { name: "Morocco",        code: "MAR", flag: "🇲🇦", confederation: "CAF" },
  { name: "Nigeria",        code: "NGA", flag: "🇳🇬", confederation: "CAF" },
  { name: "Senegal",        code: "SEN", flag: "🇸🇳", confederation: "CAF" },
  { name: "Egypt",          code: "EGY", flag: "🇪🇬", confederation: "CAF" },
  { name: "Ivory Coast",    code: "CIV", flag: "🇨🇮", confederation: "CAF" },
  { name: "South Africa",   code: "RSA", flag: "🇿🇦", confederation: "CAF" },
  { name: "Tunisia",        code: "TUN", flag: "🇹🇳", confederation: "CAF" },
  { name: "Mali",           code: "MLI", flag: "🇲🇱", confederation: "CAF" },
  { name: "DR Congo",       code: "COD", flag: "🇨🇩", confederation: "CAF" },
  { name: "Algeria",        code: "ALG", flag: "🇩🇿", confederation: "CAF" },
  { name: "Cape Verde Islands", code: "CPV", flag: "🇨🇻", confederation: "CAF" },
  { name: "Ghana",          code: "GHA", flag: "🇬🇭", confederation: "CAF" },

  // AFC (8)
  { name: "Japan",          code: "JPN", flag: "🇯🇵", confederation: "AFC" },
  { name: "South Korea",    code: "KOR", flag: "🇰🇷", confederation: "AFC" },
  { name: "Australia",      code: "AUS", flag: "🇦🇺", confederation: "AFC" },
  { name: "Iran",           code: "IRN", flag: "🇮🇷", confederation: "AFC" },
  { name: "Saudi Arabia",   code: "KSA", flag: "🇸🇦", confederation: "AFC" },
  { name: "Iraq",           code: "IRQ", flag: "🇮🇶", confederation: "AFC" },
  { name: "Jordan",         code: "JOR", flag: "🇯🇴", confederation: "AFC" },
  { name: "Uzbekistan",     code: "UZB", flag: "🇺🇿", confederation: "AFC" },

  // OFC (1)
  { name: "New Zealand",    code: "NZL", flag: "🇳🇿", confederation: "OFC" },

  // Inter-confederation playoff (2)
  { name: "Indonesia",      code: "IDN", flag: "🇮🇩", confederation: "AFC" },
  { name: "Paraguay",       code: "PAR", flag: "🇵🇾", confederation: "CONMEBOL" },
];

export async function seedWorldCupTeams() {
  const existing = await prisma.worldCupTeam.count();
  if (existing >= TEAMS.length) return;

  for (const t of TEAMS) {
    await prisma.worldCupTeam.upsert({
      where: { code: t.code },
      create: t,
      update: {},
    });
  }
}
