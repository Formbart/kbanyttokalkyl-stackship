-- Nyttokalkyl – databasschema för Stackship (PostgreSQL 17)
-- Speglar Supabase-migrationerna i kbanyttokalkyl, men utan Supabase Auth:
-- inloggning hanteras av appens egna serverfunktioner (tabellerna users och sessions).
-- Behörighet (RLS) ersätts av kontroller i serverfunktionerna, eftersom
-- webbläsaren aldrig pratar direkt med databasen.

-- ---------- Konton och inloggning ----------
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash   text NOT NULL,              -- scrypt-hash från Node (crypto.scrypt), aldrig klartext
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_sign_in_at timestamptz
);

CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,               -- sha256 av sessionstoken; själva token ligger bara i en httpOnly-cookie
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

-- ---------- Profiler och roller (samma som Supabase-versionen) ----------
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  full_name   text,
  forvaltning text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'admin', 'superadmin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE FUNCTION has_role(_user_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE FUNCTION is_platform_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles
                 WHERE user_id = _user_id AND role IN ('admin', 'superadmin'))
$$;

-- Nytt konto får automatiskt profil och rollen 'user' (motsvarar handle_new_user i Supabase).
CREATE FUNCTION handle_new_user() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO profiles (id, email) VALUES (NEW.id, NEW.email) ON CONFLICT (id) DO NOTHING;
  INSERT INTO user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_user_created AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ---------- Kalkyler ----------
CREATE TABLE calculations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'Namnlös nyttokalkyl',
  data        jsonb NOT NULL,
  share_token uuid UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calculations_user_idx ON calculations (user_id, updated_at DESC);

CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER calculations_set_updated_at BEFORE UPDATE ON calculations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE FUNCTION get_shared_calculation(_token uuid)
RETURNS TABLE (title text, data jsonb, updated_at timestamptz) LANGUAGE sql STABLE AS $$
  SELECT c.title, c.data, c.updated_at FROM calculations c
  WHERE c.share_token = _token AND _token IS NOT NULL
$$;

-- ---------- Befattningar per förvaltning ----------
CREATE TABLE positions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forvaltning text NOT NULL,
  befattning  text NOT NULL,
  aid         text NOT NULL DEFAULT '',
  manadslon   numeric(12,2) NOT NULL DEFAULT 0,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX positions_forvaltning_idx ON positions (forvaltning, sort_order);
