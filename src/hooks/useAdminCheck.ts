import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAdminCheck(redirectOnFail = true) {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          if (redirectOnFail) {
            navigate("/auth");
          }
          setLoading(false);
          return;
        }

        setUserId(user.id);

        // Check if user has admin role using the has_role function
        const { data: hasRole, error } = await supabase.rpc('has_role', {
          _role: 'admin',
          _user_id: user.id
        });

        if (error) {
          console.error("Admin check error:", error);
          if (redirectOnFail) {
            toast.error("Failed to verify admin access");
            navigate("/dashboard");
          }
          setLoading(false);
          return;
        }

        if (!hasRole && redirectOnFail) {
          toast.error("You don't have permission to access this page");
          navigate("/dashboard");
          return;
        }

        setIsAdmin(!!hasRole);
      } catch (error) {
        console.error("Admin check error:", error);
        if (redirectOnFail) {
          navigate("/dashboard");
        }
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [navigate, redirectOnFail]);

  return { isAdmin, loading, userId };
}
