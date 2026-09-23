import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setUser(data.user ?? null);
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", data.user.id)
          .maybeSingle();
        if (active) setFullName(profile?.full_name ?? null);
        const { data: isAdminData } = await supabase.rpc("is_platform_admin", {
          _user_id: data.user.id,
        });
        if (active) setIsAdmin(isAdminData === true);
        const { data: isSuperData } = await supabase.rpc("has_role", {
          _user_id: data.user.id,
          _role: "superadmin",
        });
        if (active) setIsSuperAdmin(isSuperData === true);
      } else {
        setFullName(null);
        setIsAdmin(false);
        setIsSuperAdmin(false);
      }
      if (active) setLoading(false);
    };

    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void load();
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, fullName, isAdmin, isSuperAdmin, loading };
}
