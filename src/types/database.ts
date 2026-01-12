export type AppRole = 'admin' | 'pengurus' | 'warga';

// Legacy type - kept for backward compatibility
export type PengurusTitle = 'ketua' | 'wakil_ketua' | 'sekretaris' | 'bendahara' | 'menteri_keamanan' | 'menteri_agama' | 'menteri_humas' | 'menteri_olahraga' | 'menteri_sisdigi' | 'anggota';

export type ComplaintStatus = 'pending' | 'in_progress' | 'resolved';

export type PaymentStatus = 'pending' | 'paid' | 'overdue';

// Dynamic pengurus title from database
export interface PengurusTitleRecord {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  has_finance_access: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// Legacy static labels - kept for backward compatibility
export const PENGURUS_TITLE_LABELS: Record<PengurusTitle, string> = {
  ketua: 'Ketua',
  wakil_ketua: 'Wakil Ketua',
  sekretaris: 'Sekretaris',
  bendahara: 'Bendahara',
  menteri_keamanan: 'Menteri Keamanan',
  menteri_agama: 'Menteri Agama',
  menteri_humas: 'Menteri Humas',
  menteri_olahraga: 'Menteri Olahraga',
  menteri_sisdigi: 'Menteri Sistem & Digital',
  anggota: 'Anggota Pengurus',
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Super Admin',
  pengurus: 'Pengurus',
  warga: 'Warga',
};

export type PollVoteType = 'per_account' | 'per_house';

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
  title: PengurusTitle | null; // Legacy field
  title_id: string | null; // New dynamic field
  created_at: string;
}

export interface UserRoleWithTitle extends UserRole {
  pengurus_title?: PengurusTitleRecord;
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
  event_time: string | null;
  image_url: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRsvp {
  id: string
  event_id: string
  user_id: string
  status: "maybe" | "not_going" | "attending"
  created_at: string
  updated_at?: string
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
  description: string | null;
  proof_url: string | null;
  submitted_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceRecord {
  id: string;
  type: 'income' | 'outcome';
  amount: number;
  description: string;
  category: string | null;
  recorded_by: string | null;
  payment_id: string | null;
  transaction_date: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentWithDetails extends Payment {
  house?: House;
  submitter?: Profile;
  verifier?: Profile;
}

export interface FinanceRecordWithDetails extends FinanceRecord {
  recorder?: Profile;
  payment?: Payment;
  isGroup?: boolean;
  groupRecords?: FinanceRecordWithDetails[];
}

export interface Complaint {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: ComplaintStatus;
  response: string | null;
  is_public: boolean;
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
  vote_type: PollVoteType;
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
export interface UserWithRole extends Profile {
  user_role?: UserRole;
}

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
