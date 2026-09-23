import { formatKr } from "./calc";
import type { Position } from "./types";

/** Visningsnamn för en befattning — index används som nyckel eftersom
 *  kombinationen befattning + AID inte är unik. */
export function positionLabel(position: Position): string {
  const aid = position.aid ? ` — ${position.aid}` : "";
  return `${position.befattning}${aid} (${formatKr(position.manadslon)})`;
}
