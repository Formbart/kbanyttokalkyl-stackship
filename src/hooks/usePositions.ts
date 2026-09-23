import { useEffect, useState } from "react";
import { listPositions } from "@/lib/positions.functions";
import type { PersonalData } from "@/lib/nyttokalkyl/types";

/** Hämtar kommunens gemensamma befattningslistor per förvaltning. */
export function usePositions() {
  const [personalData, setPersonalData] = useState<PersonalData>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setPersonalData(await listPositions());
    } catch {
      setPersonalData({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return { personalData, loading, reload: load };
}
