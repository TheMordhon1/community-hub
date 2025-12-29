-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'pengurus', 'warga');

-- Create enum for complaint status
CREATE TYPE public.complaint_status AS ENUM ('pending', 'in_progress', 'resolved');

-- Create enum for payment status
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'overdue');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'warga',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create houses table for Konva.js mapping
CREATE TABLE public.houses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block TEXT NOT NULL,
  number TEXT NOT NULL,
  x_position FLOAT NOT NULL DEFAULT 0,
  y_position FLOAT NOT NULL DEFAULT 0,
  width FLOAT NOT NULL DEFAULT 60,
  height FLOAT NOT NULL DEFAULT 60,
  color TEXT DEFAULT '#4ade80',
  is_occupied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (block, number)
);

-- Create house_residents table to link houses and profiles
CREATE TABLE public.house_residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID REFERENCES public.houses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_owner BOOLEAN DEFAULT false,
  move_in_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (house_id, user_id)
);

-- Create announcements table
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  image_url TEXT,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create event_rsvps table
CREATE TABLE public.event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'attending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- Create payments table for fee tracking
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID REFERENCES public.houses(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  status payment_status DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (house_id, month, year)
);

-- Create complaints table
CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status complaint_status DEFAULT 'pending',
  response TEXT,
  responded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create polls table
CREATE TABLE public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  options JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  ends_at TIMESTAMPTZ,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create poll_votes table
CREATE TABLE public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  option_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);

-- Create documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create gallery table
CREATE TABLE public.gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create faqs table
CREATE TABLE public.faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.house_residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'admin' THEN 1 
      WHEN 'pengurus' THEN 2 
      WHEN 'warga' THEN 3 
    END
  LIMIT 1
$$;

-- Create trigger function for new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email
  );
  
  -- Insert default role (warga) - can be upgraded by admin later
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::app_role, 'warga')
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_houses_updated_at BEFORE UPDATE ON public.houses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_complaints_updated_at BEFORE UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_polls_updated_at BEFORE UPDATE ON public.polls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_faqs_updated_at BEFORE UPDATE ON public.faqs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- RLS Policies for user_roles (only admins can manage, users can view their own)
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for houses
CREATE POLICY "Anyone can view houses" ON public.houses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert houses" ON public.houses FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update houses" ON public.houses FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete houses" ON public.houses FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for house_residents
CREATE POLICY "Anyone can view house_residents" ON public.house_residents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage house_residents" ON public.house_residents FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for announcements
CREATE POLICY "Anyone can view published announcements" ON public.announcements FOR SELECT TO authenticated USING (is_published = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pengurus'));
CREATE POLICY "Admins and Pengurus can insert announcements" ON public.announcements FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pengurus'));
CREATE POLICY "Admins and Pengurus can update announcements" ON public.announcements FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pengurus'));
CREATE POLICY "Admins can delete announcements" ON public.announcements FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for events
CREATE POLICY "Anyone can view events" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and Pengurus can insert events" ON public.events FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pengurus'));
CREATE POLICY "Admins and Pengurus can update events" ON public.events FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pengurus'));
CREATE POLICY "Admins can delete events" ON public.events FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for event_rsvps
CREATE POLICY "Anyone can view event_rsvps" ON public.event_rsvps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own rsvp" ON public.event_rsvps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rsvp" ON public.event_rsvps FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rsvp" ON public.event_rsvps FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for payments
CREATE POLICY "Users can view payments for their house" ON public.payments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.house_residents WHERE house_residents.house_id = payments.house_id AND house_residents.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
);
CREATE POLICY "Admins and Pengurus can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pengurus'));
CREATE POLICY "Admins and Pengurus can update payments" ON public.payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pengurus'));
CREATE POLICY "Admins can delete payments" ON public.payments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for complaints
CREATE POLICY "Users can view own complaints or admins/pengurus can view all" ON public.complaints FOR SELECT TO authenticated USING (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'pengurus')
);
CREATE POLICY "Users can insert own complaints" ON public.complaints FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own complaints or admins/pengurus can update all" ON public.complaints FOR UPDATE TO authenticated USING (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'pengurus')
);
CREATE POLICY "Admins can delete complaints" ON public.complaints FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for polls
CREATE POLICY "Anyone can view active polls" ON public.polls FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pengurus'));
CREATE POLICY "Admins and Pengurus can insert polls" ON public.polls FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pengurus'));
CREATE POLICY "Admins and Pengurus can update polls" ON public.polls FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pengurus'));
CREATE POLICY "Admins can delete polls" ON public.polls FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for poll_votes
CREATE POLICY "Users can view own votes or admins can view all" ON public.poll_votes FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pengurus'));
CREATE POLICY "Users can insert own vote" ON public.poll_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users cannot update votes" ON public.poll_votes FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Users cannot delete votes" ON public.poll_votes FOR DELETE TO authenticated USING (false);

-- RLS Policies for documents
CREATE POLICY "Anyone can view documents" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage documents" ON public.documents FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for gallery
CREATE POLICY "Anyone can view gallery" ON public.gallery FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage gallery" ON public.gallery FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for faqs
CREATE POLICY "Anyone can view published faqs" ON public.faqs FOR SELECT TO authenticated USING (is_published = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage faqs" ON public.faqs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));