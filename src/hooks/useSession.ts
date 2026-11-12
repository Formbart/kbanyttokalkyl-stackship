import { useEffect, useState } from "react";
import { getSessionInfo, type SessionInfo } from "@/lib/auth.functions";

const EMPTY: SessionInfo = {
  user: null,
  fullName: null,
  forvaltning: null,
  isAdmin: false,
  isSuperAdmin: false,
};

export function useSession() {
  const [info, setInfo] = useState<SessionInfo>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getSessionInfo()
      .then((result) => {
        if (active) setInfo(result);
      })
      .catch(() => {
        if (active) setInfo(EMPTY);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { ...info, loading };
}
