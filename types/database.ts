/**
 * Row shapes for the marketing tables (events, applications, bookings, bot, admin log). They describe the MySQL tables in
 * db/migrations/20261101000001_marketing.sql and are used by the data layer in lib/data. Edit them together with the migration.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_activity_logs: {
        Row: {
          action_type: string
          admin_email: string
          admin_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          new_value: string | null
          old_value: string | null
          target_id: string | null
          target_name: string | null
        }
        Insert: {
          action_type: string
          admin_email: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          target_id?: string | null
          target_name?: string | null
        }
        Update: {
          action_type?: string
          admin_email?: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          target_id?: string | null
          target_name?: string | null
        }
        Relationships: []
      }
      ambassador_applications: {
        Row: {
          aadhaar_number: string | null
          cohort: string
          college: string
          college_location: string | null
          course: string
          created_at: string
          current_address: string | null
          email: string
          experience: string | null
          full_name: string
          gender: string | null
          home_town: string | null
          id: string
          instagram: string | null
          internal_notes: string | null
          led_something: string
          linkedin: string
          notes: string | null
          passing_year: string
          phone: string
          resume: string
          semester: string | null
          status: string
          student_id: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string
          why_fit: string
          why_join: string
          youtube: string | null
        }
        Insert: {
          aadhaar_number?: string | null
          cohort?: string
          college: string
          college_location?: string | null
          course: string
          created_at?: string
          current_address?: string | null
          email: string
          experience?: string | null
          full_name: string
          gender?: string | null
          home_town?: string | null
          id?: string
          instagram?: string | null
          internal_notes?: string | null
          led_something: string
          linkedin: string
          notes?: string | null
          passing_year: string
          phone: string
          resume: string
          semester?: string | null
          status?: string
          student_id: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp: string
          why_fit: string
          why_join: string
          youtube?: string | null
        }
        Update: {
          aadhaar_number?: string | null
          cohort?: string
          college?: string
          college_location?: string | null
          course?: string
          created_at?: string
          current_address?: string | null
          email?: string
          experience?: string | null
          full_name?: string
          gender?: string | null
          home_town?: string | null
          id?: string
          instagram?: string | null
          internal_notes?: string | null
          led_something?: string
          linkedin?: string
          notes?: string | null
          passing_year?: string
          phone?: string
          resume?: string
          semester?: string | null
          status?: string
          student_id?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string
          why_fit?: string
          why_join?: string
          youtube?: string | null
        }
        Relationships: []
      }
      ambassador_waitlist: {
        Row: {
          created_at: string
          email: string
          id: number
        }
        Insert: {
          created_at?: string
          email: string
          id?: never
        }
        Update: {
          created_at?: string
          email?: string
          id?: never
        }
        Relationships: []
      }
      b2b_leads: {
        Row: {
          agent: string | null
          company: string
          country_code: string | null
          created_at: string
          crm_sync_attempts: number
          crm_sync_error: string | null
          crm_sync_status: string
          crm_synced_at: string | null
          email: string
          gclid: string | null
          id: number
          landing_page: string | null
          message: string | null
          name: string
          page_path: string | null
          referrer: string | null
          solution: string | null
          team_size: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          zoho_lead_id: string | null
        }
        Insert: {
          agent?: string | null
          company: string
          country_code?: string | null
          created_at?: string
          crm_sync_attempts?: number
          crm_sync_error?: string | null
          crm_sync_status?: string
          crm_synced_at?: string | null
          email: string
          gclid?: string | null
          id?: never
          landing_page?: string | null
          message?: string | null
          name: string
          page_path?: string | null
          referrer?: string | null
          solution?: string | null
          team_size?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          zoho_lead_id?: string | null
        }
        Update: {
          agent?: string | null
          company?: string
          country_code?: string | null
          created_at?: string
          crm_sync_attempts?: number
          crm_sync_error?: string | null
          crm_sync_status?: string
          crm_synced_at?: string | null
          email?: string
          gclid?: string | null
          id?: never
          landing_page?: string | null
          message?: string | null
          name?: string
          page_path?: string | null
          referrer?: string | null
          solution?: string | null
          team_size?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          zoho_lead_id?: string | null
        }
        Relationships: []
      }
      booking_intents: {
        Row: {
          agent: string | null
          consumed_at: string | null
          country_code: string | null
          created_at: string
          gclid: string | null
          id: string
          landing_page: string | null
          page_path: string | null
          referrer: string | null
          solution: string | null
          source: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          agent?: string | null
          consumed_at?: string | null
          country_code?: string | null
          created_at?: string
          gclid?: string | null
          id?: string
          landing_page?: string | null
          page_path?: string | null
          referrer?: string | null
          solution?: string | null
          source: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          agent?: string | null
          consumed_at?: string | null
          country_code?: string | null
          created_at?: string
          gclid?: string | null
          id?: string
          landing_page?: string | null
          page_path?: string | null
          referrer?: string | null
          solution?: string | null
          source?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          amount_inr: number | null
          created_at: string
          end_time: string
          expert_slug: string
          google_event_id: string | null
          google_meet_link: string | null
          id: string
          payment_status: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          reminder_1h_email_ids: string[] | null
          reminder_1h_sent: boolean
          reminder_24h_email_ids: string[] | null
          reminder_24h_sent: boolean
          reminder_sent: boolean
          session_topic: string | null
          start_time: string
          status: string
          user_email: string
          user_name: string
          user_phone: string | null
        }
        Insert: {
          amount_inr?: number | null
          created_at?: string
          end_time: string
          expert_slug: string
          google_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          payment_status?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          reminder_1h_email_ids?: string[] | null
          reminder_1h_sent?: boolean
          reminder_24h_email_ids?: string[] | null
          reminder_24h_sent?: boolean
          reminder_sent?: boolean
          session_topic?: string | null
          start_time: string
          status?: string
          user_email: string
          user_name: string
          user_phone?: string | null
        }
        Update: {
          amount_inr?: number | null
          created_at?: string
          end_time?: string
          expert_slug?: string
          google_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          payment_status?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          reminder_1h_email_ids?: string[] | null
          reminder_1h_sent?: boolean
          reminder_24h_email_ids?: string[] | null
          reminder_24h_sent?: boolean
          reminder_sent?: boolean
          session_topic?: string | null
          start_time?: string
          status?: string
          user_email?: string
          user_name?: string
          user_phone?: string | null
        }
        Relationships: []
      }
      bot_events: {
        Row: {
          conversation_id: string | null
          created_at: string
          event_type: string
          id: number
          lead_id: number | null
          payload: Json | null
          status: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          event_type: string
          id?: never
          lead_id?: number | null
          payload?: Json | null
          status?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          event_type?: string
          id?: never
          lead_id?: number | null
          payload?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "bot_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_leads: {
        Row: {
          avuid: string | null
          company: string | null
          conversation_id: string
          conversation_ids: string[]
          country_code: string | null
          created_at: string
          crm_sync_attempts: number
          crm_sync_error: string | null
          crm_sync_status: string
          crm_synced_at: string | null
          designation: string | null
          email: string | null
          first_seen_at: string
          id: number
          intent: string
          last_page_path: string | null
          last_visit_at: string
          name: string | null
          notification_sent: boolean
          page_path: string | null
          team_size: string | null
          use_case: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          visit_count: number
          zoho_lead_id: string | null
          zoho_note_created: boolean
          zoho_notes_count: number
          zoho_notes_pending: boolean | null
          zoho_task_created: boolean
        }
        Insert: {
          avuid?: string | null
          company?: string | null
          conversation_id: string
          conversation_ids?: string[]
          country_code?: string | null
          created_at?: string
          crm_sync_attempts?: number
          crm_sync_error?: string | null
          crm_sync_status?: string
          crm_synced_at?: string | null
          designation?: string | null
          email?: string | null
          first_seen_at?: string
          id?: never
          intent: string
          last_page_path?: string | null
          last_visit_at?: string
          name?: string | null
          notification_sent?: boolean
          page_path?: string | null
          team_size?: string | null
          use_case?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visit_count?: number
          zoho_lead_id?: string | null
          zoho_note_created?: boolean
          zoho_notes_count?: number
          zoho_notes_pending?: boolean | null
          zoho_task_created?: boolean
        }
        Update: {
          avuid?: string | null
          company?: string | null
          conversation_id?: string
          conversation_ids?: string[]
          country_code?: string | null
          created_at?: string
          crm_sync_attempts?: number
          crm_sync_error?: string | null
          crm_sync_status?: string
          crm_synced_at?: string | null
          designation?: string | null
          email?: string | null
          first_seen_at?: string
          id?: never
          intent?: string
          last_page_path?: string | null
          last_visit_at?: string
          name?: string | null
          notification_sent?: boolean
          page_path?: string | null
          team_size?: string | null
          use_case?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visit_count?: number
          zoho_lead_id?: string | null
          zoho_note_created?: boolean
          zoho_notes_count?: number
          zoho_notes_pending?: boolean | null
          zoho_task_created?: boolean
        }
        Relationships: []
      }
      bot_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: number
          page_path: string | null
          role: string
          synced_at: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: never
          page_path?: string | null
          role: string
          synced_at?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: never
          page_path?: string | null
          role?: string
          synced_at?: string | null
        }
        Relationships: []
      }
      bot_unanswered: {
        Row: {
          answered_by: string | null
          conversation_id: string | null
          country_code: string | null
          created_at: string
          id: number
          page_path: string | null
          question: string
        }
        Insert: {
          answered_by?: string | null
          conversation_id?: string | null
          country_code?: string | null
          created_at?: string
          id?: never
          page_path?: string | null
          question: string
        }
        Update: {
          answered_by?: string | null
          conversation_id?: string | null
          country_code?: string | null
          created_at?: string
          id?: never
          page_path?: string | null
          question?: string
        }
        Relationships: []
      }
      bot_visitors: {
        Row: {
          avuid: string
          bot_lead_id: number | null
          country_code: string | null
          email: string | null
          first_seen_at: string
          id: number
          last_conversation_id: string | null
          last_page_path: string | null
          last_seen_at: string
          visit_count: number
          zoho_lead_id: string | null
        }
        Insert: {
          avuid: string
          bot_lead_id?: number | null
          country_code?: string | null
          email?: string | null
          first_seen_at?: string
          id?: number
          last_conversation_id?: string | null
          last_page_path?: string | null
          last_seen_at?: string
          visit_count?: number
          zoho_lead_id?: string | null
        }
        Update: {
          avuid?: string
          bot_lead_id?: number | null
          country_code?: string | null
          email?: string | null
          first_seen_at?: string
          id?: number
          last_conversation_id?: string | null
          last_page_path?: string | null
          last_seen_at?: string
          visit_count?: number
          zoho_lead_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_visitors_bot_lead_id_fkey"
            columns: ["bot_lead_id"]
            isOneToOne: false
            referencedRelation: "bot_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      cal_webhook_events: {
        Row: {
          cal_uid: string | null
          dedupe_key: string
          error: string | null
          event_at: string | null
          id: number
          payload: Json
          processed_at: string | null
          received_at: string
          signature_ok: boolean
          trigger_event: string
        }
        Insert: {
          cal_uid?: string | null
          dedupe_key: string
          error?: string | null
          event_at?: string | null
          id?: number
          payload: Json
          processed_at?: string | null
          received_at?: string
          signature_ok: boolean
          trigger_event: string
        }
        Update: {
          cal_uid?: string | null
          dedupe_key?: string
          error?: string | null
          event_at?: string | null
          id?: number
          payload?: Json
          processed_at?: string | null
          received_at?: string
          signature_ok?: boolean
          trigger_event?: string
        }
        Relationships: []
      }
      calendar_connections: {
        Row: {
          connected_at: string
          expert_slug: string | null
          google_email: string | null
          google_refresh_token: string | null
          id: string
          is_active: boolean
        }
        Insert: {
          connected_at?: string
          expert_slug?: string | null
          google_email?: string | null
          google_refresh_token?: string | null
          id?: string
          is_active?: boolean
        }
        Update: {
          connected_at?: string
          expert_slug?: string | null
          google_email?: string | null
          google_refresh_token?: string | null
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      call_bookings: {
        Row: {
          attendee_name: string
          attendee_notifications_count: number
          attendee_notifications_pending: boolean | null
          attendee_timezone: string | null
          booked_at: string
          cal_booking_id: number | null
          cal_event_type_id: number | null
          cal_uid: string
          cancellation_reason: string | null
          cancelled_at: string | null
          company: string | null
          country_code: string | null
          created_at: string
          crm_record_type: string | null
          crm_sync_attempts: number
          crm_sync_error: string | null
          crm_sync_status: string
          crm_synced_at: string | null
          email: string
          end_time: string | null
          events_count: number
          gclid: string | null
          id: string
          intent_id: string | null
          is_disposable_email: boolean
          landing_page: string | null
          last_event_at: string
          last_trigger_event: string
          meeting_url: string | null
          notifications_count: number
          notifications_pending: boolean | null
          page_path: string | null
          raw_payload: Json | null
          referrer: string | null
          rescheduled_at: string | null
          rescheduled_from_uid: string | null
          responses: Json | null
          source: string | null
          start_time: string
          status: string
          team_size: string | null
          title: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          zoho_contact_id: string | null
          zoho_lead_id: string | null
          zoho_notes_count: number
          zoho_notes_pending: boolean | null
          zoho_task_created: boolean
          zoho_task_id: string | null
        }
        Insert: {
          attendee_name: string
          attendee_notifications_count?: number
          attendee_notifications_pending?: boolean | null
          attendee_timezone?: string | null
          booked_at: string
          cal_booking_id?: number | null
          cal_event_type_id?: number | null
          cal_uid: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          company?: string | null
          country_code?: string | null
          created_at?: string
          crm_record_type?: string | null
          crm_sync_attempts?: number
          crm_sync_error?: string | null
          crm_sync_status?: string
          crm_synced_at?: string | null
          email: string
          end_time?: string | null
          events_count?: number
          gclid?: string | null
          id?: string
          intent_id?: string | null
          is_disposable_email?: boolean
          landing_page?: string | null
          last_event_at: string
          last_trigger_event: string
          meeting_url?: string | null
          notifications_count?: number
          notifications_pending?: boolean | null
          page_path?: string | null
          raw_payload?: Json | null
          referrer?: string | null
          rescheduled_at?: string | null
          rescheduled_from_uid?: string | null
          responses?: Json | null
          source?: string | null
          start_time: string
          status?: string
          team_size?: string | null
          title?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          zoho_contact_id?: string | null
          zoho_lead_id?: string | null
          zoho_notes_count?: number
          zoho_notes_pending?: boolean | null
          zoho_task_created?: boolean
          zoho_task_id?: string | null
        }
        Update: {
          attendee_name?: string
          attendee_notifications_count?: number
          attendee_notifications_pending?: boolean | null
          attendee_timezone?: string | null
          booked_at?: string
          cal_booking_id?: number | null
          cal_event_type_id?: number | null
          cal_uid?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          company?: string | null
          country_code?: string | null
          created_at?: string
          crm_record_type?: string | null
          crm_sync_attempts?: number
          crm_sync_error?: string | null
          crm_sync_status?: string
          crm_synced_at?: string | null
          email?: string
          end_time?: string | null
          events_count?: number
          gclid?: string | null
          id?: string
          intent_id?: string | null
          is_disposable_email?: boolean
          landing_page?: string | null
          last_event_at?: string
          last_trigger_event?: string
          meeting_url?: string | null
          notifications_count?: number
          notifications_pending?: boolean | null
          page_path?: string | null
          raw_payload?: Json | null
          referrer?: string | null
          rescheduled_at?: string | null
          rescheduled_from_uid?: string | null
          responses?: Json | null
          source?: string | null
          start_time?: string
          status?: string
          team_size?: string | null
          title?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          zoho_contact_id?: string | null
          zoho_lead_id?: string | null
          zoho_notes_count?: number
          zoho_notes_pending?: boolean | null
          zoho_task_created?: boolean
          zoho_task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_bookings_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "booking_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_sends: {
        Row: {
          campaign: string
          college: string | null
          cta_url: string | null
          email: string
          error: string | null
          guide_url: string | null
          id: string
          provider_id: string | null
          sent_at: string
          sent_by: string | null
          status: string
        }
        Insert: {
          campaign: string
          college?: string | null
          cta_url?: string | null
          email: string
          error?: string | null
          guide_url?: string | null
          id?: string
          provider_id?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
        }
        Update: {
          campaign?: string
          college?: string | null
          cta_url?: string | null
          email?: string
          error?: string | null
          guide_url?: string | null
          id?: string
          provider_id?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          country_code: string | null
          created_at: string | null
          crm_sync_attempts: number
          crm_sync_error: string | null
          crm_sync_status: string
          crm_synced_at: string | null
          email: string
          gclid: string | null
          id: string
          landing_page: string | null
          message: string
          name: string
          page_path: string | null
          read: boolean | null
          referrer: string | null
          replied: boolean | null
          subject: string | null
          type: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          zoho_lead_id: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          crm_sync_attempts?: number
          crm_sync_error?: string | null
          crm_sync_status?: string
          crm_synced_at?: string | null
          email: string
          gclid?: string | null
          id?: string
          landing_page?: string | null
          message: string
          name: string
          page_path?: string | null
          read?: boolean | null
          referrer?: string | null
          replied?: boolean | null
          subject?: string | null
          type?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          zoho_lead_id?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          crm_sync_attempts?: number
          crm_sync_error?: string | null
          crm_sync_status?: string
          crm_synced_at?: string | null
          email?: string
          gclid?: string | null
          id?: string
          landing_page?: string | null
          message?: string
          name?: string
          page_path?: string | null
          read?: boolean | null
          referrer?: string | null
          replied?: boolean | null
          subject?: string | null
          type?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          zoho_lead_id?: string | null
        }
        Relationships: []
      }
      event_registrations: {
        Row: {
          company: string | null
          confirmation_sent: boolean
          created_at: string
          email: string
          event_id: string
          expectations: string | null
          full_name: string
          id: string
          phone: string | null
          reminder_1h_sent: boolean
          reminder_24h_sent: boolean
        }
        Insert: {
          company?: string | null
          confirmation_sent?: boolean
          created_at?: string
          email: string
          event_id: string
          expectations?: string | null
          full_name: string
          id?: string
          phone?: string | null
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
        }
        Update: {
          company?: string | null
          confirmation_sent?: boolean
          created_at?: string
          email?: string
          event_id?: string
          expectations?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          agenda: Json | null
          badge: string | null
          city: string | null
          country: string | null
          created_at: string
          duration: string | null
          end_time: string | null
          event_date: string
          event_mode: string
          format: string | null
          full_description: string | null
          id: string
          is_active: boolean
          learnings: Json | null
          meeting_platform: string | null
          meeting_url: string | null
          poster_url: string | null
          price: string | null
          registration_limit: number | null
          short_description: string | null
          slug: string
          speaker_bio: string | null
          speaker_company: string | null
          speaker_designation: string | null
          speaker_image: string | null
          speaker_name: string | null
          start_time: string | null
          timezone: string | null
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          agenda?: Json | null
          badge?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          duration?: string | null
          end_time?: string | null
          event_date: string
          event_mode?: string
          format?: string | null
          full_description?: string | null
          id?: string
          is_active?: boolean
          learnings?: Json | null
          meeting_platform?: string | null
          meeting_url?: string | null
          poster_url?: string | null
          price?: string | null
          registration_limit?: number | null
          short_description?: string | null
          slug: string
          speaker_bio?: string | null
          speaker_company?: string | null
          speaker_designation?: string | null
          speaker_image?: string | null
          speaker_name?: string | null
          start_time?: string | null
          timezone?: string | null
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          agenda?: Json | null
          badge?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          duration?: string | null
          end_time?: string | null
          event_date?: string
          event_mode?: string
          format?: string | null
          full_description?: string | null
          id?: string
          is_active?: boolean
          learnings?: Json | null
          meeting_platform?: string | null
          meeting_url?: string | null
          poster_url?: string | null
          price?: string | null
          registration_limit?: number | null
          short_description?: string | null
          slug?: string
          speaker_bio?: string | null
          speaker_company?: string | null
          speaker_designation?: string | null
          speaker_image?: string | null
          speaker_name?: string | null
          start_time?: string | null
          timezone?: string | null
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      expert_availability: {
        Row: {
          day_of_week: number
          end_time: string
          expert_slug: string
          id: string
          is_active: boolean
          slot_duration_min: number
          start_time: string
        }
        Insert: {
          day_of_week: number
          end_time: string
          expert_slug: string
          id?: string
          is_active?: boolean
          slot_duration_min?: number
          start_time: string
        }
        Update: {
          day_of_week?: number
          end_time?: string
          expert_slug?: string
          id?: string
          is_active?: boolean
          slot_duration_min?: number
          start_time?: string
        }
        Relationships: []
      }
      expert_submissions: {
        Row: {
          about: string
          awards: Json
          bio: string
          certifications: Json
          country: string
          created_at: string
          display_name: string | null
          education: Json
          email: string
          expertise: Json
          faq: Json
          headline: string
          id: string
          image_url: string
          industries: Json
          intro: string
          languages: Json
          location: string | null
          name: string
          persona: string | null
          price: string
          reviews: Json
          role: string
          session_duration: string
          skills: Json
          socials: Json
          stats: Json
          status: string
          supports: Json
          tag: string
          trusted_by: Json
          trusted_by_label: string | null
          what_you_get: Json
          work_experience: Json
          years_experience: number
        }
        Insert: {
          about: string
          awards?: Json
          bio: string
          certifications?: Json
          country: string
          created_at?: string
          display_name?: string | null
          education?: Json
          email: string
          expertise?: Json
          faq?: Json
          headline: string
          id?: string
          image_url: string
          industries?: Json
          intro: string
          languages?: Json
          location?: string | null
          name: string
          persona?: string | null
          price: string
          reviews?: Json
          role: string
          session_duration: string
          skills?: Json
          socials?: Json
          stats?: Json
          status?: string
          supports?: Json
          tag: string
          trusted_by?: Json
          trusted_by_label?: string | null
          what_you_get?: Json
          work_experience?: Json
          years_experience?: number
        }
        Update: {
          about?: string
          awards?: Json
          bio?: string
          certifications?: Json
          country?: string
          created_at?: string
          display_name?: string | null
          education?: Json
          email?: string
          expertise?: Json
          faq?: Json
          headline?: string
          id?: string
          image_url?: string
          industries?: Json
          intro?: string
          languages?: Json
          location?: string | null
          name?: string
          persona?: string | null
          price?: string
          reviews?: Json
          role?: string
          session_duration?: string
          skills?: Json
          socials?: Json
          stats?: Json
          status?: string
          supports?: Json
          tag?: string
          trusted_by?: Json
          trusted_by_label?: string | null
          what_you_get?: Json
          work_experience?: Json
          years_experience?: number
        }
        Relationships: []
      }
      growqrgroup: {
        Row: {
          contact_no: string | null
          country: string
          created_at: string
          email: string
          full_name: string
          id: string
          organisation: string | null
          purpose: string
        }
        Insert: {
          contact_no?: string | null
          country: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          organisation?: string | null
          purpose: string
        }
        Update: {
          contact_no?: string | null
          country?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          organisation?: string | null
          purpose?: string
        }
        Relationships: []
      }
      internship_applications: {
        Row: {
          aadhaar_number: string | null
          additional_notes: string | null
          availability: string
          career_profile_score: number | null
          college: string
          college_location: string | null
          course: string
          created_at: string
          current_address: string | null
          degree_specialization: string | null
          dob: string | null
          duration: string | null
          email: string
          father_name: string | null
          full_name: string
          gender: string | null
          graduation_year: string
          growqr_account_email: string | null
          growqr_avatar_url: string | null
          growqr_profile_snapshot: Json | null
          growqr_profile_url: string | null
          growqr_rq_score: number | null
          growqr_user_id: string | null
          home_town: string | null
          id: string
          internal_notes: string | null
          languages: string | null
          linkedin: string | null
          mode: string | null
          mother_name: string | null
          phone: string
          portfolio: string | null
          preferred_role: string
          resume: string
          semester: string | null
          skills: string
          status: string
          triage: string | null
          triage_score: number | null
          triaged_at: string | null
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          why_intern: string
        }
        Insert: {
          aadhaar_number?: string | null
          additional_notes?: string | null
          availability: string
          career_profile_score?: number | null
          college: string
          college_location?: string | null
          course: string
          created_at?: string
          current_address?: string | null
          degree_specialization?: string | null
          dob?: string | null
          duration?: string | null
          email: string
          father_name?: string | null
          full_name: string
          gender?: string | null
          graduation_year: string
          growqr_account_email?: string | null
          growqr_avatar_url?: string | null
          growqr_profile_snapshot?: Json | null
          growqr_profile_url?: string | null
          growqr_rq_score?: number | null
          growqr_user_id?: string | null
          home_town?: string | null
          id?: string
          internal_notes?: string | null
          languages?: string | null
          linkedin?: string | null
          mode?: string | null
          mother_name?: string | null
          phone: string
          portfolio?: string | null
          preferred_role: string
          resume: string
          semester?: string | null
          skills: string
          status?: string
          triage?: string | null
          triage_score?: number | null
          triaged_at?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          why_intern: string
        }
        Update: {
          aadhaar_number?: string | null
          additional_notes?: string | null
          availability?: string
          career_profile_score?: number | null
          college?: string
          college_location?: string | null
          course?: string
          created_at?: string
          current_address?: string | null
          degree_specialization?: string | null
          dob?: string | null
          duration?: string | null
          email?: string
          father_name?: string | null
          full_name?: string
          gender?: string | null
          graduation_year?: string
          growqr_account_email?: string | null
          growqr_avatar_url?: string | null
          growqr_profile_snapshot?: Json | null
          growqr_profile_url?: string | null
          growqr_rq_score?: number | null
          growqr_user_id?: string | null
          home_town?: string | null
          id?: string
          internal_notes?: string | null
          languages?: string | null
          linkedin?: string | null
          mode?: string | null
          mother_name?: string | null
          phone?: string
          portfolio?: string | null
          preferred_role?: string
          resume?: string
          semester?: string | null
          skills?: string
          status?: string
          triage?: string | null
          triage_score?: number | null
          triaged_at?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          why_intern?: string
        }
        Relationships: []
      }
      internship_appointments: {
        Row: {
          application_id: string
          created_at: string
          created_by: string | null
          department: string
          designation: string
          duration: string
          end_date: string | null
          id: string
          issued_at: string | null
          location: string
          reference_no: string
          reporting_manager: string
          signatory_name: string | null
          signatory_title: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          created_by?: string | null
          department: string
          designation: string
          duration: string
          end_date?: string | null
          id?: string
          issued_at?: string | null
          location: string
          reference_no: string
          reporting_manager: string
          signatory_name?: string | null
          signatory_title?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          created_by?: string | null
          department?: string
          designation?: string
          duration?: string
          end_date?: string | null
          id?: string
          issued_at?: string | null
          location?: string
          reference_no?: string
          reporting_manager?: string
          signatory_name?: string | null
          signatory_title?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internship_appointments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "internship_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      internship_emails: {
        Row: {
          application_id: string
          created_at: string
          error: string | null
          id: string
          kind: string
          resend_id: string | null
          sent_by: string | null
          status: string
          subject: string
          to_email: string
        }
        Insert: {
          application_id: string
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          resend_id?: string | null
          sent_by?: string | null
          status?: string
          subject: string
          to_email: string
        }
        Update: {
          application_id?: string
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          resend_id?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "internship_emails_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "internship_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      internship_interviews: {
        Row: {
          application_id: string
          batch_id: string | null
          coaching_notes: string[] | null
          competencies: Json | null
          completed_at: string | null
          created_at: string
          difficulty: string | null
          due_at: string | null
          duration_minutes: number | null
          external_interview_id: string | null
          external_session_id: string | null
          growqr_user_id: string | null
          hr_verdict: string | null
          id: string
          interview_url: string | null
          interviewer: string | null
          invited_at: string | null
          kind: string
          max_score: number
          meeting_url: string | null
          raw: Json | null
          recorded_by: string | null
          round: number
          round_type: string | null
          scheduled_at: string | null
          score: number | null
          source: string
          started_at: string | null
          status: string
          strengths: string[] | null
          summary: string | null
          target_role: string | null
          transcript_url: string | null
          updated_at: string
          weaknesses: string[] | null
        }
        Insert: {
          application_id: string
          batch_id?: string | null
          coaching_notes?: string[] | null
          competencies?: Json | null
          completed_at?: string | null
          created_at?: string
          difficulty?: string | null
          due_at?: string | null
          duration_minutes?: number | null
          external_interview_id?: string | null
          external_session_id?: string | null
          growqr_user_id?: string | null
          hr_verdict?: string | null
          id?: string
          interview_url?: string | null
          interviewer?: string | null
          invited_at?: string | null
          kind?: string
          max_score?: number
          meeting_url?: string | null
          raw?: Json | null
          recorded_by?: string | null
          round?: number
          round_type?: string | null
          scheduled_at?: string | null
          score?: number | null
          source?: string
          started_at?: string | null
          status?: string
          strengths?: string[] | null
          summary?: string | null
          target_role?: string | null
          transcript_url?: string | null
          updated_at?: string
          weaknesses?: string[] | null
        }
        Update: {
          application_id?: string
          batch_id?: string | null
          coaching_notes?: string[] | null
          competencies?: Json | null
          completed_at?: string | null
          created_at?: string
          difficulty?: string | null
          due_at?: string | null
          duration_minutes?: number | null
          external_interview_id?: string | null
          external_session_id?: string | null
          growqr_user_id?: string | null
          hr_verdict?: string | null
          id?: string
          interview_url?: string | null
          interviewer?: string | null
          invited_at?: string | null
          kind?: string
          max_score?: number
          meeting_url?: string | null
          raw?: Json | null
          recorded_by?: string | null
          round?: number
          round_type?: string | null
          scheduled_at?: string | null
          score?: number | null
          source?: string
          started_at?: string | null
          status?: string
          strengths?: string[] | null
          summary?: string | null
          target_role?: string | null
          transcript_url?: string | null
          updated_at?: string
          weaknesses?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "internship_interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "internship_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      internship_settings: {
        Row: {
          auto_advance_enabled: boolean
          auto_assign_enabled: boolean
          default_department: string | null
          default_duration: string
          default_interviewer_email: string | null
          default_interviewer_name: string | null
          default_location: string
          default_reporting_manager: string
          default_signatory_name: string
          default_signatory_title: string
          email_application_received: boolean
          email_auto_selected: boolean
          email_final_round: boolean
          email_interview_invite: boolean
          final_round_calendar_id: string | null
          id: boolean
          interview_pass_score: number
          interview_round_by_role: Json
          interview_round_type: string
          shortlist_min_rq: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_advance_enabled?: boolean
          auto_assign_enabled?: boolean
          default_department?: string | null
          default_duration?: string
          default_interviewer_email?: string | null
          default_interviewer_name?: string | null
          default_location?: string
          default_reporting_manager?: string
          default_signatory_name?: string
          default_signatory_title?: string
          email_application_received?: boolean
          email_auto_selected?: boolean
          email_final_round?: boolean
          email_interview_invite?: boolean
          final_round_calendar_id?: string | null
          id?: boolean
          interview_pass_score?: number
          interview_round_by_role?: Json
          interview_round_type?: string
          shortlist_min_rq?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_advance_enabled?: boolean
          auto_assign_enabled?: boolean
          default_department?: string | null
          default_duration?: string
          default_interviewer_email?: string | null
          default_interviewer_name?: string | null
          default_location?: string
          default_reporting_manager?: string
          default_signatory_name?: string
          default_signatory_title?: string
          email_application_received?: boolean
          email_auto_selected?: boolean
          email_final_round?: boolean
          email_interview_invite?: boolean
          final_round_calendar_id?: string | null
          id?: boolean
          interview_pass_score?: number
          interview_round_by_role?: Json
          interview_round_type?: string
          shortlist_min_rq?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      mentorship_requests: {
        Row: {
          audience_segment: string
          coach_id: string | null
          coach_name: string | null
          created_at: string
          email: string
          full_name: string
          goals: string | null
          id: string
          phone: string
          source_page: string | null
          status: string
        }
        Insert: {
          audience_segment?: string
          coach_id?: string | null
          coach_name?: string | null
          created_at?: string
          email: string
          full_name: string
          goals?: string | null
          id?: string
          phone: string
          source_page?: string | null
          status?: string
        }
        Update: {
          audience_segment?: string
          coach_id?: string | null
          coach_name?: string | null
          created_at?: string
          email?: string
          full_name?: string
          goals?: string | null
          id?: string
          phone?: string
          source_page?: string | null
          status?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          country_code: string | null
          created_at: string | null
          crm_sync_attempts: number
          crm_sync_error: string | null
          crm_sync_status: string
          crm_synced_at: string | null
          email: string
          gclid: string | null
          id: string
          landing_page: string | null
          metadata: Json | null
          name: string | null
          page_path: string | null
          referrer: string | null
          source: string | null
          status: string | null
          subscribed_at: string | null
          unsubscribed_at: string | null
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          zoho_lead_id: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          crm_sync_attempts?: number
          crm_sync_error?: string | null
          crm_sync_status?: string
          crm_synced_at?: string | null
          email: string
          gclid?: string | null
          id?: string
          landing_page?: string | null
          metadata?: Json | null
          name?: string | null
          page_path?: string | null
          referrer?: string | null
          source?: string | null
          status?: string | null
          subscribed_at?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          zoho_lead_id?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          crm_sync_attempts?: number
          crm_sync_error?: string | null
          crm_sync_status?: string
          crm_synced_at?: string | null
          email?: string
          gclid?: string | null
          id?: string
          landing_page?: string | null
          metadata?: Json | null
          name?: string | null
          page_path?: string | null
          referrer?: string | null
          source?: string | null
          status?: string | null
          subscribed_at?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          zoho_lead_id?: string | null
        }
        Relationships: []
      }
      payment_incidents: {
        Row: {
          amount_inr: number | null
          created_at: string
          detail: string | null
          expert_slug: string | null
          id: string
          kind: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          resolved: boolean
          start_time: string | null
          user_email: string | null
          user_name: string | null
        }
        Insert: {
          amount_inr?: number | null
          created_at?: string
          detail?: string | null
          expert_slug?: string | null
          id?: string
          kind: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          resolved?: boolean
          start_time?: string | null
          user_email?: string | null
          user_name?: string | null
        }
        Update: {
          amount_inr?: number | null
          created_at?: string
          detail?: string | null
          expert_slug?: string | null
          id?: string
          kind?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          resolved?: boolean
          start_time?: string | null
          user_email?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      seeker_waitlist: {
        Row: {
          country_code: string | null
          created_at: string
          crm_sync_attempts: number
          crm_sync_error: string | null
          crm_sync_status: string
          crm_synced_at: string | null
          email: string
          gclid: string | null
          id: number
          landing_page: string | null
          page_path: string | null
          referrer: string | null
          source: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          zoho_lead_id: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          crm_sync_attempts?: number
          crm_sync_error?: string | null
          crm_sync_status?: string
          crm_synced_at?: string | null
          email: string
          gclid?: string | null
          id?: never
          landing_page?: string | null
          page_path?: string | null
          referrer?: string | null
          source?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          zoho_lead_id?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string
          crm_sync_attempts?: number
          crm_sync_error?: string | null
          crm_sync_status?: string
          crm_synced_at?: string | null
          email?: string
          gclid?: string | null
          id?: never
          landing_page?: string | null
          page_path?: string | null
          referrer?: string | null
          source?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          zoho_lead_id?: string | null
        }
        Relationships: []
      }
      support_queries: {
        Row: {
          created_at: string | null
          id: number
          query: string
          response: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          query: string
          response: string
        }
        Update: {
          created_at?: string | null
          id?: number
          query?: string
          response?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          contact_no: string | null
          country: string | null
          created_at: string | null
          email: string
          id: number
          name: string
          organization_name: string | null
          point_of_contact: string | null
          role: string | null
          source: string | null
          website: string | null
          work_email: string | null
        }
        Insert: {
          contact_no?: string | null
          country?: string | null
          created_at?: string | null
          email: string
          id?: number
          name: string
          organization_name?: string | null
          point_of_contact?: string | null
          role?: string | null
          source?: string | null
          website?: string | null
          work_email?: string | null
        }
        Update: {
          contact_no?: string | null
          country?: string | null
          created_at?: string | null
          email?: string
          id?: number
          name?: string
          organization_name?: string | null
          point_of_contact?: string | null
          role?: string | null
          source?: string | null
          website?: string | null
          work_email?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      call_booking_stats: {
        Row: {
          bookings: number | null
          cancelled: number | null
          cancelled_pct: number | null
          crm_failed: number | null
          crm_synced: number | null
          day: string | null
          disposable: number | null
          existing_contacts: number | null
          page_path: string | null
          rescheduled: number | null
          source: string | null
          utm_campaign: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_ambassador_status_counts: {
        Args: never
        Returns: {
          status: string
          total: number
        }[]
      }
      admin_event_registration_counts: {
        Args: never
        Returns: {
          event_id: string
          total: number
        }[]
      }
      admin_event_stats: {
        Args: never
        Returns: {
          active: number
          inactive: number
          total: number
          total_registrations: number
        }[]
      }
      admin_internship_status_counts: {
        Args: never
        Returns: {
          status: string
          total: number
        }[]
      }
      admin_internship_triage_counts: {
        Args: never
        Returns: {
          total: number
          triage: string
        }[]
      }
      apply_cal_booking: {
        Args: {
          p_booking: Json
          p_cal_uid: string
          p_event_at: string
          p_supersedes?: string
        }
        Returns: {
          applied: boolean
          booking_id: string
          events_count: number
          is_new: boolean
          status: string
        }[]
      }
      claim_idle_transcripts: {
        Args: { p_idle_minutes?: number; p_limit?: number }
        Returns: {
          conversation_id: string
          lead_id: number
          zoho_lead_id: string
        }[]
      }
      handle_form_submission: {
        Args: {
          p_contact_no: string
          p_country: string
          p_email: string
          p_full_name: string
          p_organisation: string
          p_purpose: string
        }
        Returns: undefined
      }
      resolve_bot_lead: {
        Args: {
          p_avuid?: string
          p_company?: string
          p_conversation_id: string
          p_country_code?: string
          p_designation?: string
          p_email?: string
          p_intent?: string
          p_name?: string
          p_page_path?: string
          p_team_size?: string
          p_use_case?: string
          p_utm_campaign?: string
          p_utm_medium?: string
          p_utm_source?: string
        }
        Returns: {
          lead_id: number
          matched_on: string
          requeued: boolean
          visits: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      touch_bot_visitor: {
        Args: {
          p_avuid: string
          p_conversation_id?: string
          p_country_code?: string
          p_email?: string
          p_page_path?: string
        }
        Returns: {
          visitor_id: number
          visits: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
