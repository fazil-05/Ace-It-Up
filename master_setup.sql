-- =========================================================
-- COMPLETE BACKEND FIX SQL
-- Run this ENTIRE script in your NEW Supabase SQL Editor
-- URL: https://supabase.com → Your Project → SQL Editor
-- =========================================================

-- =========================================================
-- Profiles
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- =========================================================
-- Attempts (every practice attempt)
-- =========================================================
DO $$ BEGIN
    CREATE TYPE public.module_key AS ENUM ('aptitude', 'gd', 'communication', 'interview');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module public.module_key NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  detail TEXT,
  prompt TEXT,
  answer TEXT,
  feedback JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  difficulty TEXT CHECK (difficulty IN ('easy','medium','hard')),
  topic TEXT,
  time_spent_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_attempts_user_created ON public.attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_user_module ON public.attempts (user_id, module);
CREATE INDEX IF NOT EXISTS idx_attempts_user_module_created ON public.attempts (user_id, module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_user_topic ON public.attempts (user_id, module, topic);

ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own attempts" ON public.attempts;
CREATE POLICY "Users can view own attempts"
  ON public.attempts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own attempts" ON public.attempts;
CREATE POLICY "Users can insert own attempts"
  ON public.attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own attempts" ON public.attempts;
CREATE POLICY "Users can delete own attempts"
  ON public.attempts FOR DELETE
  USING (auth.uid() = user_id);

-- =========================================================
-- Module scores (rolling aggregate per user/module)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.module_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module public.module_key NOT NULL,
  attempts_count INTEGER NOT NULL DEFAULT 0,
  avg_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  best_score INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, module)
);

ALTER TABLE public.module_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own module scores" ON public.module_scores;
CREATE POLICY "Users can view own module scores"
  ON public.module_scores FOR SELECT
  USING (auth.uid() = user_id);

-- =========================================================
-- Shared updated_at trigger function
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Auto-create profile on signup
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- Recompute module_scores after every attempt
-- =========================================================
CREATE OR REPLACE FUNCTION public.recompute_module_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_avg NUMERIC;
  v_best INTEGER;
  v_last TIMESTAMPTZ;
BEGIN
  SELECT COUNT(*), COALESCE(AVG(score), 0), COALESCE(MAX(score), 0), MAX(created_at)
    INTO v_count, v_avg, v_best, v_last
  FROM public.attempts
  WHERE user_id = NEW.user_id AND module = NEW.module;

  INSERT INTO public.module_scores (user_id, module, attempts_count, avg_score, best_score, last_attempt_at, updated_at)
  VALUES (NEW.user_id, NEW.module, v_count, v_avg, v_best, v_last, now())
  ON CONFLICT (user_id, module) DO UPDATE
  SET attempts_count = EXCLUDED.attempts_count,
      avg_score = EXCLUDED.avg_score,
      best_score = EXCLUDED.best_score,
      last_attempt_at = EXCLUDED.last_attempt_at,
      updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_attempt_insert_recompute ON public.attempts;
CREATE TRIGGER on_attempt_insert_recompute
  AFTER INSERT ON public.attempts
  FOR EACH ROW EXECUTE FUNCTION public.recompute_module_score();
