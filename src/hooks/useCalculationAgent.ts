import { useNyttokalkyl } from "@/lib/nyttokalkyl/store";
import { usePositions } from "./usePositions";
import { callAgent, type AgentAction } from "@/lib/nyttokalkyl/agent";
import { discountRate } from "@/lib/nyttokalkyl/calc";
import { ROLE_NAMES } from "@/lib/nyttokalkyl/types";

/** All AI actions receive current assumptions and exact position names. */
export function useCalculationAgent() {
  const { state } = useNyttokalkyl();
  const { personalData } = usePositions();
  return <T,>(action: AgentAction, context: Record<string, unknown>) =>
    callAgent<T>(action, {
      ...context,
      discountRate: discountRate(state) * 100,
      roles: [...new Set([...ROLE_NAMES, ...Object.values(personalData).flat().map((p) => p.befattning)])],
    });
}