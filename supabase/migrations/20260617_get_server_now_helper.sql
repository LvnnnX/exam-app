-- BUG-H1 fix: helper RPC to sync client clock with server clock.
-- TS layer calls this once when expiry timer mounts, computes
-- offset = serverNow - (clientNowBefore + RTT/2), and uses
-- (Date.now() + offset) as authoritative time.
-- Defeats client-clock manipulation (user setting OS clock backward to extend exam time).
--
-- Returns: jsonb { server_now: text } where server_now is now()::text in UTC.
-- Granted to anon + authenticated (no sensitive data).

CREATE OR REPLACE FUNCTION public.get_server_now()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object('server_now', now()::text);
$function$;

GRANT EXECUTE ON FUNCTION public.get_server_now() TO anon, authenticated;
