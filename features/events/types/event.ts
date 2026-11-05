// Database-backed Event types for the V1 registration flow.

export interface AgendaItem {
  time: string;
  title: string;
  desc: string;
}

export interface EventRow {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  full_description: string | null;
  speaker_name: string | null;
  speaker_designation: string | null;
  speaker_company: string | null;
  speaker_image: string | null;
  speaker_bio: string | null;
  poster_url: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  event_date: string; // ISO date (yyyy-mm-dd)
  start_time: string | null;
  end_time: string | null;
  timezone: string | null;
  duration: string | null;
  format: string | null;
  badge: string | null;
  price: string | null;
  learnings: string[];
  agenda: AgendaItem[];
  registration_limit: number | null;
  is_active: boolean;
  event_mode: "offline" | "online";
  meeting_platform?: "zoom" | "google_meet" | null;
  meeting_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistrationInput {
  eventId: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  designation: string;
  linkedinUrl?: string;
  expectations?: string;
}

export interface RegistrationResult {
  ok: boolean;
  error?: string;
  alreadyRegistered?: boolean;
}
