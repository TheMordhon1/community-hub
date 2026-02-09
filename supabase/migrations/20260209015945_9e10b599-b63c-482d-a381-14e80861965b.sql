-- Add event_type column to events table
ALTER TABLE public.events 
ADD COLUMN event_type text NOT NULL DEFAULT 'regular';

-- Add check constraint for valid event types
ALTER TABLE public.events
ADD CONSTRAINT events_event_type_check 
CHECK (event_type IN ('regular', 'competition'));

-- Create index for better query performance
CREATE INDEX idx_events_event_type ON public.events(event_type);