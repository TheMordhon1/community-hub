-- Create event_rsvps table for tracking event attendance
create table if not exists public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'not_going')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, user_id)
);

-- Create index for better query performance
create index if not exists idx_event_rsvps_event_id on public.event_rsvps(event_id);
create index if not exists idx_event_rsvps_user_id on public.event_rsvps(user_id);
create index if not exists idx_event_rsvps_status on public.event_rsvps(status);

-- Enable RLS
alter table public.event_rsvps enable row level security;

-- RLS Policies
-- Anyone can view RSVPs
create policy "Anyone can view event RSVPs"
  on public.event_rsvps for select
  using (true);

-- Users can insert their own RSVPs
create policy "Users can create their own RSVPs"
  on public.event_rsvps for insert
  with check (auth.uid() = user_id);

-- Users can update their own RSVPs
create policy "Users can update their own RSVPs"
  on public.event_rsvps for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own RSVPs
create policy "Users can delete their own RSVPs"
  on public.event_rsvps for delete
  using (auth.uid() = user_id);

-- Create function to update updated_at timestamp
create or replace function public.handle_event_rsvps_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger for updated_at
create trigger handle_event_rsvps_updated_at
  before update on public.event_rsvps
  for each row
  execute function public.handle_event_rsvps_updated_at();
