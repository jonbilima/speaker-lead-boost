import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface AuthResult {
  user: { id: string; email?: string } | null;
  error: string | null;
  isAdmin: boolean;
}

/**
 * Validates the request authentication and checks for admin role
 * Returns user info if authenticated, null otherwise
 */
export async function validateAuth(req: Request): Promise<AuthResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return { user: null, error: 'No authorization header provided', isAdmin: false };
  }

  const token = authHeader.replace('Bearer ', '');
  
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: error?.message || 'Invalid token', isAdmin: false };
  }

  // Check for admin role
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  return { 
    user: { id: user.id, email: user.email }, 
    error: null, 
    isAdmin: !!roles 
  };
}

/**
 * Returns an unauthorized response with proper CORS headers
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

/**
 * Returns a forbidden response with proper CORS headers
 */
export function forbiddenResponse(message: string = 'Admin access required'): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { 
      status: 403, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}
