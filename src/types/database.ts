export type AppRole = 'admin' | 'pengurus' | 'warga';

export type ComplaintStatus = 'pending' | 'in_progress' | 'resolved';

export type PaymentStatus = 'pending' | 'paid' | 'overdue';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface House {
  id: string;
  block: string;
  number: string;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  color: string | null;
  is_occupied: boolean;
  created_at: string;
  updated_at: string;
}

export interface HouseResident {
  id: string;
  house_id: string;
  user_id: string;
  is_owner: boolean;
  move_in_date: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  is_published: boolean;
  published_at: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_date: string;
  image_url: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRsvp {
  id: string;
  event_id: string;
  user_id: string;
  status: string;
  created_at: string;
}

export interface Payment {
  id: string;
  house_id: string;
  amount: number;
  month: number;
  year: number;
  status: PaymentStatus;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Complaint {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: ComplaintStatus;
  response: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Poll {
  id: string;
  title: string;
  description: string | null;
  options: string[];
  is_active: boolean;
  ends_at: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  user_id: string;
  option_index: number;
  created_at: string;
}

export interface Document {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  order_index: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

// Extended types with relations
export interface HouseWithResidents extends House {
  residents?: (HouseResident & { profile?: Profile })[];
  payments?: Payment[];
}

export interface AnnouncementWithAuthor extends Announcement {
  author?: Profile;
}

export interface EventWithRsvps extends Event {
  rsvps?: EventRsvp[];
  author?: Profile;
}

export interface ComplaintWithUser extends Complaint {
  user?: Profile;
  responder?: Profile;
}

export interface PollWithVotes extends Poll {
  votes?: PollVote[];
  vote_counts?: number[];
}
