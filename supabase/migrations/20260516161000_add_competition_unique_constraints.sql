-- Adjust SQL constraints for competition teams and members
DO $$ 
BEGIN 
    -- 1. Ensure unique team names within a competition
    -- Clean up duplicates if any (keep the newest record)
    DELETE FROM public.competition_teams a
    USING public.competition_teams b
    WHERE a.id < b.id 
    AND a.competition_id = b.competition_id 
    AND a.name = b.name;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'competition_teams_competition_id_name_key') THEN
        ALTER TABLE public.competition_teams ADD CONSTRAINT competition_teams_competition_id_name_key UNIQUE (competition_id, name);
    END IF;

    -- 2. Ensure unique members within a team
    -- Clean up duplicate memberships if any
    DELETE FROM public.competition_team_members a
    USING public.competition_team_members b
    WHERE a.id < b.id 
    AND a.team_id = b.team_id 
    AND a.user_id = b.user_id;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'competition_team_members_team_id_user_id_key') THEN
        ALTER TABLE public.competition_team_members ADD CONSTRAINT competition_team_members_team_id_user_id_key UNIQUE (team_id, user_id);
    END IF;

    -- 3. Add index for performance on name searches
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_full_name_lower') THEN
        CREATE INDEX idx_profiles_full_name_lower ON public.profiles (LOWER(full_name));
    END IF;
END $$;
