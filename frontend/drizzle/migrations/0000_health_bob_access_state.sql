CREATE TABLE public.health_bob_access_state (
  id text PRIMARY KEY,
  status integer NOT NULL,
  reason text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.health_bob_access_state TO service_role;
ALTER TABLE public.health_bob_access_state ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.health_bob_access_state IS 'Server-only durable AI access pause; no visitor data or public access.';