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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      application_packages: {
        Row: {
          cover_message: string | null
          created_at: string
          custom_note: string | null
          event_id: string | null
          expires_at: string | null
          id: string
          include_bio: boolean | null
          include_headshot: boolean | null
          include_one_sheet: boolean | null
          include_video: boolean | null
          included_assets: string[] | null
          match_id: string | null
          package_title: string
          speaker_id: string
          tracking_code: string
        }
        Insert: {
          cover_message?: string | null
          created_at?: string
          custom_note?: string | null
          event_id?: string | null
          expires_at?: string | null
          id?: string
          include_bio?: boolean | null
          include_headshot?: boolean | null
          include_one_sheet?: boolean | null
          include_video?: boolean | null
          included_assets?: string[] | null
          match_id?: string | null
          package_title: string
          speaker_id: string
          tracking_code: string
        }
        Update: {
          cover_message?: string | null
          created_at?: string
          custom_note?: string | null
          event_id?: string | null
          expires_at?: string | null
          id?: string
          include_bio?: boolean | null
          include_headshot?: boolean | null
          include_one_sheet?: boolean | null
          include_video?: boolean | null
          included_assets?: string[] | null
          match_id?: string | null
          package_title?: string
          speaker_id?: string
          tracking_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_packages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_packages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "opportunity_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_packages_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      applied_logs: {
        Row: {
          applied_at: string
          id: string
          notes: string | null
          opportunity_id: string
          pitch_id: string | null
          status: Database["public"]["Enums"]["application_status"] | null
          user_id: string
        }
        Insert: {
          applied_at?: string
          id?: string
          notes?: string | null
          opportunity_id: string
          pitch_id?: string | null
          status?: Database["public"]["Enums"]["application_status"] | null
          user_id: string
        }
        Update: {
          applied_at?: string
          id?: string
          notes?: string | null
          opportunity_id?: string
          pitch_id?: string | null
          status?: Database["public"]["Enums"]["application_status"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applied_logs_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applied_logs_pitch_id_fkey"
            columns: ["pitch_id"]
            isOneToOne: false
            referencedRelation: "pitches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applied_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_connections: {
        Row: {
          access_token: string
          auto_sync_speaking: boolean
          calendar_id: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          last_sync_at: string | null
          provider: string
          refresh_token: string | null
          show_external_events: boolean
          speaker_id: string
          sync_errors: Json | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          auto_sync_speaking?: boolean
          calendar_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          provider?: string
          refresh_token?: string | null
          show_external_events?: boolean
          speaker_id: string
          sync_errors?: Json | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          auto_sync_speaking?: boolean
          calendar_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          provider?: string
          refresh_token?: string | null
          show_external_events?: boolean
          speaker_id?: string
          sync_errors?: Json | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      coach_conversations: {
        Row: {
          created_at: string
          id: string
          is_favorite: boolean
          messages: Json
          mode: string | null
          speaker_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_favorite?: boolean
          messages?: Json
          mode?: string | null
          speaker_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_favorite?: boolean
          messages?: Json
          mode?: string | null
          speaker_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_conversations_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_usage: {
        Row: {
          created_at: string
          id: string
          message_count: number
          speaker_id: string
          updated_at: string
          year_month: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_count?: number
          speaker_id: string
          updated_at?: string
          year_month: string
        }
        Update: {
          created_at?: string
          id?: string
          message_count?: number
          speaker_id?: string
          updated_at?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_usage_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      confirmed_bookings: {
        Row: {
          amount_paid: number
          confirmed_fee: number
          created_at: string
          event_date: string | null
          event_id: string | null
          event_name: string
          expenses: number | null
          fee_currency: string
          id: string
          match_id: string | null
          net_revenue: number | null
          notes: string | null
          payment_date: string | null
          payment_status: string
          speaker_id: string
        }
        Insert: {
          amount_paid?: number
          confirmed_fee?: number
          created_at?: string
          event_date?: string | null
          event_id?: string | null
          event_name: string
          expenses?: number | null
          fee_currency?: string
          id?: string
          match_id?: string | null
          net_revenue?: number | null
          notes?: string | null
          payment_date?: string | null
          payment_status?: string
          speaker_id: string
        }
        Update: {
          amount_paid?: number
          confirmed_fee?: number
          created_at?: string
          event_date?: string | null
          event_id?: string | null
          event_name?: string
          expenses?: number | null
          fee_currency?: string
          id?: string
          match_id?: string | null
          net_revenue?: number | null
          notes?: string | null
          payment_date?: string | null
          payment_status?: string
          speaker_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company: string | null
          contact_type: string
          created_at: string
          email: string | null
          id: string
          industry: string | null
          last_contact_date: string | null
          linkedin_url: string | null
          name: string
          notes: string | null
          phone: string | null
          speaker_id: string
          title: string | null
          total_revenue: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          company?: string | null
          contact_type?: string
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          last_contact_date?: string | null
          linkedin_url?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          speaker_id: string
          title?: string | null
          total_revenue?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          company?: string | null
          contact_type?: string
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          last_contact_date?: string | null
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          speaker_id?: string
          title?: string | null
          total_revenue?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      email_digest_logs: {
        Row: {
          clicked_at: string | null
          created_at: string
          deadlines_count: number | null
          email_id: string | null
          follow_ups_count: number | null
          id: string
          opened_at: string | null
          opportunities_count: number | null
          sent_at: string
          speaker_id: string
        }
        Insert: {
          clicked_at?: string | null
          created_at?: string
          deadlines_count?: number | null
          email_id?: string | null
          follow_ups_count?: number | null
          id?: string
          opened_at?: string | null
          opportunities_count?: number | null
          sent_at?: string
          speaker_id: string
        }
        Update: {
          clicked_at?: string | null
          created_at?: string
          deadlines_count?: number | null
          email_id?: string | null
          follow_ups_count?: number | null
          id?: string
          opened_at?: string | null
          opportunities_count?: number | null
          sent_at?: string
          speaker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_digest_logs_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_digest_preferences: {
        Row: {
          created_at: string
          id: string
          include_deadlines: boolean
          include_follow_ups: boolean
          include_market_insights: boolean
          include_new_matches: boolean
          include_pipeline_summary: boolean
          include_revenue_update: boolean
          is_enabled: boolean
          send_day: string
          send_time: string
          speaker_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          include_deadlines?: boolean
          include_follow_ups?: boolean
          include_market_insights?: boolean
          include_new_matches?: boolean
          include_pipeline_summary?: boolean
          include_revenue_update?: boolean
          is_enabled?: boolean
          send_day?: string
          send_time?: string
          speaker_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          include_deadlines?: boolean
          include_follow_ups?: boolean
          include_market_insights?: boolean
          include_new_matches?: boolean
          include_pipeline_summary?: boolean
          include_revenue_update?: boolean
          is_enabled?: boolean
          send_day?: string
          send_time?: string
          speaker_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_digest_preferences_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          body_preview: string | null
          created_at: string
          error_message: string | null
          id: string
          recipient_email: string
          related_id: string | null
          related_type: string | null
          resend_id: string | null
          sent_at: string | null
          speaker_id: string
          status: string
          subject: string
        }
        Insert: {
          body_preview?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_email: string
          related_id?: string | null
          related_type?: string | null
          resend_id?: string | null
          sent_at?: string | null
          speaker_id: string
          status?: string
          subject: string
        }
        Update: {
          body_preview?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          related_id?: string | null
          related_type?: string | null
          resend_id?: string | null
          sent_at?: string | null
          speaker_id?: string
          status?: string
          subject?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_template: string
          category: string
          created_at: string
          id: string
          is_default: boolean | null
          last_used_at: string | null
          name: string
          speaker_id: string
          subject_template: string
          times_used: number | null
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          body_template: string
          category?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          last_used_at?: string | null
          name: string
          speaker_id: string
          subject_template: string
          times_used?: number | null
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          body_template?: string
          category?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          last_used_at?: string | null
          name?: string
          speaker_id?: string
          subject_template?: string
          times_used?: number | null
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_feedback: {
        Row: {
          booking_id: string | null
          can_use_as_testimonial: boolean | null
          content_rating: number | null
          created_at: string
          delivery_rating: number | null
          engagement_rating: number | null
          event_date: string | null
          event_name: string
          feedback_token: string
          id: string
          overall_rating: number | null
          respondent_email: string | null
          respondent_name: string | null
          respondent_role: string | null
          speaker_id: string
          submitted_at: string | null
          testimonial_quote: string | null
          what_to_improve: string | null
          what_worked_well: string | null
          would_recommend: boolean | null
        }
        Insert: {
          booking_id?: string | null
          can_use_as_testimonial?: boolean | null
          content_rating?: number | null
          created_at?: string
          delivery_rating?: number | null
          engagement_rating?: number | null
          event_date?: string | null
          event_name: string
          feedback_token: string
          id?: string
          overall_rating?: number | null
          respondent_email?: string | null
          respondent_name?: string | null
          respondent_role?: string | null
          speaker_id: string
          submitted_at?: string | null
          testimonial_quote?: string | null
          what_to_improve?: string | null
          what_worked_well?: string | null
          would_recommend?: boolean | null
        }
        Update: {
          booking_id?: string | null
          can_use_as_testimonial?: boolean | null
          content_rating?: number | null
          created_at?: string
          delivery_rating?: number | null
          engagement_rating?: number | null
          event_date?: string | null
          event_name?: string
          feedback_token?: string
          id?: string
          overall_rating?: number | null
          respondent_email?: string | null
          respondent_name?: string | null
          respondent_role?: string | null
          speaker_id?: string
          submitted_at?: string | null
          testimonial_quote?: string | null
          what_to_improve?: string | null
          what_worked_well?: string | null
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "event_feedback_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "confirmed_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_benchmarks: {
        Row: {
          audience_size_bucket: string | null
          data_points: number | null
          event_type: Database["public"]["Enums"]["event_type"]
          experience_level: Database["public"]["Enums"]["experience_level"]
          fee_median: number | null
          fee_p25: number | null
          fee_p75: number | null
          fee_p90: number | null
          id: string
          last_updated: string
          region: string | null
          topic_category: string | null
        }
        Insert: {
          audience_size_bucket?: string | null
          data_points?: number | null
          event_type: Database["public"]["Enums"]["event_type"]
          experience_level: Database["public"]["Enums"]["experience_level"]
          fee_median?: number | null
          fee_p25?: number | null
          fee_p75?: number | null
          fee_p90?: number | null
          id?: string
          last_updated?: string
          region?: string | null
          topic_category?: string | null
        }
        Update: {
          audience_size_bucket?: string | null
          data_points?: number | null
          event_type?: Database["public"]["Enums"]["event_type"]
          experience_level?: Database["public"]["Enums"]["experience_level"]
          fee_median?: number | null
          fee_p25?: number | null
          fee_p75?: number | null
          fee_p90?: number | null
          id?: string
          last_updated?: string
          region?: string | null
          topic_category?: string | null
        }
        Relationships: []
      }
      feedback_requests: {
        Row: {
          booking_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          opened_at: string | null
          recipient_email: string
          recipient_name: string | null
          reminder_sent_at: string | null
          sent_at: string | null
          speaker_id: string
          status: string | null
          token: string
        }
        Insert: {
          booking_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string | null
          recipient_email: string
          recipient_name?: string | null
          reminder_sent_at?: string | null
          sent_at?: string | null
          speaker_id: string
          status?: string | null
          token: string
        }
        Update: {
          booking_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string | null
          recipient_email?: string
          recipient_name?: string | null
          reminder_sent_at?: string | null
          sent_at?: string | null
          speaker_id?: string
          status?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "confirmed_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_reminders: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string
          id: string
          is_completed: boolean
          match_id: string
          reminder_type: string
          speaker_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date: string
          id?: string
          is_completed?: boolean
          match_id: string
          reminder_type: string
          speaker_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          is_completed?: boolean
          match_id?: string
          reminder_type?: string
          speaker_id?: string
        }
        Relationships: []
      }
      inbound_leads: {
        Row: {
          budget_range: string | null
          company: string | null
          created_at: string
          email: string
          estimated_audience: string | null
          event_date: string | null
          event_name: string | null
          event_type: string | null
          id: string
          message: string | null
          name: string
          notes: string | null
          phone: string | null
          source: string
          speaker_id: string
          status: string
        }
        Insert: {
          budget_range?: string | null
          company?: string | null
          created_at?: string
          email: string
          estimated_audience?: string | null
          event_date?: string | null
          event_name?: string | null
          event_type?: string | null
          id?: string
          message?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          source?: string
          speaker_id: string
          status?: string
        }
        Update: {
          budget_range?: string | null
          company?: string | null
          created_at?: string
          email?: string
          estimated_audience?: string | null
          event_date?: string | null
          event_name?: string | null
          event_type?: string | null
          id?: string
          message?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string
          speaker_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_leads_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          booking_id: string | null
          contact_id: string | null
          created_at: string
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          line_items: Json
          notes: string | null
          paid_at: string | null
          payment_instructions: string | null
          pdf_url: string | null
          sent_at: string | null
          speaker_id: string
          status: string
          subtotal: number
          tax_amount: number | null
          tax_rate: number | null
          total: number
        }
        Insert: {
          booking_id?: string | null
          contact_id?: string | null
          created_at?: string
          due_date: string
          id?: string
          invoice_number: string
          issue_date?: string
          line_items?: Json
          notes?: string | null
          paid_at?: string | null
          payment_instructions?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          speaker_id: string
          status?: string
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number
        }
        Update: {
          booking_id?: string | null
          contact_id?: string | null
          created_at?: string
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          line_items?: Json
          notes?: string | null
          paid_at?: string | null
          payment_instructions?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          speaker_id?: string
          status?: string
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number
        }
        Relationships: []
      }
      onboarding_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number
          dismissed_at: string | null
          id: string
          steps_completed: Json
          tour_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          dismissed_at?: string | null
          id?: string
          steps_completed?: Json
          tour_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          dismissed_at?: string | null
          id?: string
          steps_completed?: Json
          tour_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          audience_size: number | null
          covers_accommodation: boolean | null
          covers_travel: boolean | null
          created_at: string
          deadline: string | null
          description: string | null
          event_date: string | null
          event_end_date: string | null
          event_name: string
          event_url: string | null
          fee_estimate_max: number | null
          fee_estimate_min: number | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          is_verified: boolean | null
          karma_awarded: boolean | null
          location: string | null
          location_venue: string | null
          organization_website: string | null
          organizer_email: string | null
          organizer_linkedin: string | null
          organizer_name: string | null
          organizer_phone: string | null
          raw_data: Json | null
          scraped_at: string
          seniority_level: string | null
          source: string | null
          submitted_by: string | null
          timezone: string | null
        }
        Insert: {
          audience_size?: number | null
          covers_accommodation?: boolean | null
          covers_travel?: boolean | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          event_date?: string | null
          event_end_date?: string | null
          event_name: string
          event_url?: string | null
          fee_estimate_max?: number | null
          fee_estimate_min?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_verified?: boolean | null
          karma_awarded?: boolean | null
          location?: string | null
          location_venue?: string | null
          organization_website?: string | null
          organizer_email?: string | null
          organizer_linkedin?: string | null
          organizer_name?: string | null
          organizer_phone?: string | null
          raw_data?: Json | null
          scraped_at?: string
          seniority_level?: string | null
          source?: string | null
          submitted_by?: string | null
          timezone?: string | null
        }
        Update: {
          audience_size?: number | null
          covers_accommodation?: boolean | null
          covers_travel?: boolean | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          event_date?: string | null
          event_end_date?: string | null
          event_name?: string
          event_url?: string | null
          fee_estimate_max?: number | null
          fee_estimate_min?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_verified?: boolean | null
          karma_awarded?: boolean | null
          location?: string | null
          location_venue?: string | null
          organization_website?: string | null
          organizer_email?: string | null
          organizer_linkedin?: string | null
          organizer_name?: string | null
          organizer_phone?: string | null
          raw_data?: Json | null
          scraped_at?: string
          seniority_level?: string | null
          source?: string | null
          submitted_by?: string | null
          timezone?: string | null
        }
        Relationships: []
      }
      opportunity_karma: {
        Row: {
          action: string
          created_at: string
          id: string
          opportunity_id: string | null
          points: number
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          opportunity_id?: string | null
          points?: number
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          opportunity_id?: string | null
          points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_karma_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_scores: {
        Row: {
          accepted_at: string | null
          ai_reason: string | null
          ai_score: number | null
          calculated_at: string
          completed_at: string | null
          deadline_urgency_score: number | null
          fee_alignment_score: number | null
          id: string
          interested_at: string | null
          opportunity_id: string
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"] | null
          rejected_at: string | null
          rejection_reason: string | null
          response_received_at: string | null
          shared_at: string | null
          shared_by: string | null
          topic_match_score: number | null
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          ai_reason?: string | null
          ai_score?: number | null
          calculated_at?: string
          completed_at?: string | null
          deadline_urgency_score?: number | null
          fee_alignment_score?: number | null
          id?: string
          interested_at?: string | null
          opportunity_id: string
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          rejected_at?: string | null
          rejection_reason?: string | null
          response_received_at?: string | null
          shared_at?: string | null
          shared_by?: string | null
          topic_match_score?: number | null
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          ai_reason?: string | null
          ai_score?: number | null
          calculated_at?: string
          completed_at?: string | null
          deadline_urgency_score?: number | null
          fee_alignment_score?: number | null
          id?: string
          interested_at?: string | null
          opportunity_id?: string
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          rejected_at?: string | null
          rejection_reason?: string | null
          response_received_at?: string | null
          shared_at?: string | null
          shared_by?: string | null
          topic_match_score?: number | null
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_scores_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_topics: {
        Row: {
          id: string
          opportunity_id: string
          relevance_score: number | null
          topic_id: string
        }
        Insert: {
          id?: string
          opportunity_id: string
          relevance_score?: number | null
          topic_id: string
        }
        Update: {
          id?: string
          opportunity_id?: string
          relevance_score?: number | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_topics_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      organizers: {
        Row: {
          created_at: string
          email: string | null
          events_organized: number | null
          id: string
          last_booking_date: string | null
          linkedin_url: string | null
          name: string
          notes: string | null
          organization_name: string | null
          organization_type:
            | Database["public"]["Enums"]["organization_type"]
            | null
          organization_website: string | null
          phone: string | null
          speakers_booked_last_year: number | null
          topics: string[] | null
          typical_fee_max: number | null
          typical_fee_min: number | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          events_organized?: number | null
          id?: string
          last_booking_date?: string | null
          linkedin_url?: string | null
          name: string
          notes?: string | null
          organization_name?: string | null
          organization_type?:
            | Database["public"]["Enums"]["organization_type"]
            | null
          organization_website?: string | null
          phone?: string | null
          speakers_booked_last_year?: number | null
          topics?: string[] | null
          typical_fee_max?: number | null
          typical_fee_min?: number | null
        }
        Update: {
          created_at?: string
          email?: string | null
          events_organized?: number | null
          id?: string
          last_booking_date?: string | null
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          organization_name?: string | null
          organization_type?:
            | Database["public"]["Enums"]["organization_type"]
            | null
          organization_website?: string | null
          phone?: string | null
          speakers_booked_last_year?: number | null
          topics?: string[] | null
          typical_fee_max?: number | null
          typical_fee_min?: number | null
        }
        Relationships: []
      }
      outreach_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          body: string | null
          created_at: string
          email_clicked_at: string | null
          email_message_id: string | null
          email_opened_at: string | null
          email_replied_at: string | null
          email_sent_at: string | null
          follow_up_completed: boolean | null
          follow_up_date: string | null
          id: string
          match_id: string | null
          notes: string | null
          speaker_id: string
          subject: string | null
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          body?: string | null
          created_at?: string
          email_clicked_at?: string | null
          email_message_id?: string | null
          email_opened_at?: string | null
          email_replied_at?: string | null
          email_sent_at?: string | null
          follow_up_completed?: boolean | null
          follow_up_date?: string | null
          id?: string
          match_id?: string | null
          notes?: string | null
          speaker_id: string
          subject?: string | null
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          body?: string | null
          created_at?: string
          email_clicked_at?: string | null
          email_message_id?: string | null
          email_opened_at?: string | null
          email_replied_at?: string | null
          email_sent_at?: string | null
          follow_up_completed?: boolean | null
          follow_up_date?: string | null
          id?: string
          match_id?: string | null
          notes?: string | null
          speaker_id?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_activities_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "opportunity_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_activities_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      package_views: {
        Row: {
          event_type: string
          id: string
          package_id: string
          timestamp: string
          user_agent: string | null
          viewer_city: string | null
          viewer_country: string | null
          viewer_ip: string | null
        }
        Insert: {
          event_type: string
          id?: string
          package_id: string
          timestamp?: string
          user_agent?: string | null
          viewer_city?: string | null
          viewer_country?: string | null
          viewer_ip?: string | null
        }
        Update: {
          event_type?: string
          id?: string
          package_id?: string
          timestamp?: string
          user_agent?: string | null
          viewer_city?: string | null
          viewer_country?: string | null
          viewer_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_views_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "application_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      past_talks: {
        Row: {
          audience_size: number | null
          created_at: string
          event_date: string | null
          event_name: string | null
          id: string
          slides_url: string | null
          speaker_id: string
          testimonial: string | null
          testimonial_author: string | null
          testimonial_role: string | null
          title: string
          video_url: string | null
        }
        Insert: {
          audience_size?: number | null
          created_at?: string
          event_date?: string | null
          event_name?: string | null
          id?: string
          slides_url?: string | null
          speaker_id: string
          testimonial?: string | null
          testimonial_author?: string | null
          testimonial_role?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
          audience_size?: number | null
          created_at?: string
          event_date?: string | null
          event_name?: string | null
          id?: string
          slides_url?: string | null
          speaker_id?: string
          testimonial?: string | null
          testimonial_author?: string | null
          testimonial_role?: string | null
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "past_talks_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          reference_number: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_metrics: {
        Row: {
          audience_responsiveness: number | null
          audience_size_actual: number | null
          booking_id: string | null
          created_at: string
          energy_level: number | null
          engagement_score: number | null
          id: string
          leads_generated: number | null
          notes_for_next_time: string | null
          personal_learnings: string | null
          products_sold: number | null
          qa_questions_count: number | null
          social_mentions: number | null
          speaker_id: string
          speaker_notes: string | null
          standing_ovation: boolean | null
          what_to_improve: string | null
          what_went_well: string | null
        }
        Insert: {
          audience_responsiveness?: number | null
          audience_size_actual?: number | null
          booking_id?: string | null
          created_at?: string
          energy_level?: number | null
          engagement_score?: number | null
          id?: string
          leads_generated?: number | null
          notes_for_next_time?: string | null
          personal_learnings?: string | null
          products_sold?: number | null
          qa_questions_count?: number | null
          social_mentions?: number | null
          speaker_id: string
          speaker_notes?: string | null
          standing_ovation?: boolean | null
          what_to_improve?: string | null
          what_went_well?: string | null
        }
        Update: {
          audience_responsiveness?: number | null
          audience_size_actual?: number | null
          booking_id?: string | null
          created_at?: string
          energy_level?: number | null
          engagement_score?: number | null
          id?: string
          leads_generated?: number | null
          notes_for_next_time?: string | null
          personal_learnings?: string | null
          products_sold?: number | null
          qa_questions_count?: number | null
          social_mentions?: number | null
          speaker_id?: string
          speaker_notes?: string | null
          standing_ovation?: boolean | null
          what_to_improve?: string | null
          what_went_well?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_metrics_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "confirmed_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      pitches: {
        Row: {
          edited: boolean | null
          email_body: string
          generated_at: string
          id: string
          opportunity_id: string
          subject_line: string
          tone: string | null
          user_id: string
          variant: string | null
        }
        Insert: {
          edited?: boolean | null
          email_body: string
          generated_at?: string
          id?: string
          opportunity_id: string
          subject_line: string
          tone?: string | null
          user_id: string
          variant?: string | null
        }
        Update: {
          edited?: boolean | null
          email_body?: string
          generated_at?: string
          id?: string
          opportunity_id?: string
          subject_line?: string
          tone?: string | null
          user_id?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pitches_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          annual_revenue_goal: number | null
          audience_types: string[] | null
          bio: string | null
          created_at: string
          custom_topics: string[] | null
          default_invoice_terms: string | null
          default_payment_instructions: string | null
          default_tax_rate: number | null
          email_bcc_self: boolean | null
          email_reply_to: string | null
          email_signature: string | null
          fee_range_max: number | null
          fee_range_min: number | null
          follow_up_interval_1: number | null
          follow_up_interval_2: number | null
          follow_up_interval_3: number | null
          headline: string | null
          id: string
          industries: string[] | null
          invoice_logo_url: string | null
          is_public: boolean | null
          linkedin_url: string | null
          location_city: string | null
          location_country: string | null
          name: string | null
          notable_clients: string[] | null
          one_sheet_url: string | null
          past_talks: string[] | null
          revenue_goal_year: number | null
          slug: string | null
          speaker_reel_url: string | null
          total_talks_given: number | null
          tracking_keywords: string[] | null
          travel_regions: string[] | null
          twitter_url: string | null
          updated_at: string
          weekly_digest: boolean | null
          widget_settings: Json | null
          willing_to_travel: boolean | null
          years_speaking: number | null
          youtube_url: string | null
        }
        Insert: {
          annual_revenue_goal?: number | null
          audience_types?: string[] | null
          bio?: string | null
          created_at?: string
          custom_topics?: string[] | null
          default_invoice_terms?: string | null
          default_payment_instructions?: string | null
          default_tax_rate?: number | null
          email_bcc_self?: boolean | null
          email_reply_to?: string | null
          email_signature?: string | null
          fee_range_max?: number | null
          fee_range_min?: number | null
          follow_up_interval_1?: number | null
          follow_up_interval_2?: number | null
          follow_up_interval_3?: number | null
          headline?: string | null
          id: string
          industries?: string[] | null
          invoice_logo_url?: string | null
          is_public?: boolean | null
          linkedin_url?: string | null
          location_city?: string | null
          location_country?: string | null
          name?: string | null
          notable_clients?: string[] | null
          one_sheet_url?: string | null
          past_talks?: string[] | null
          revenue_goal_year?: number | null
          slug?: string | null
          speaker_reel_url?: string | null
          total_talks_given?: number | null
          tracking_keywords?: string[] | null
          travel_regions?: string[] | null
          twitter_url?: string | null
          updated_at?: string
          weekly_digest?: boolean | null
          widget_settings?: Json | null
          willing_to_travel?: boolean | null
          years_speaking?: number | null
          youtube_url?: string | null
        }
        Update: {
          annual_revenue_goal?: number | null
          audience_types?: string[] | null
          bio?: string | null
          created_at?: string
          custom_topics?: string[] | null
          default_invoice_terms?: string | null
          default_payment_instructions?: string | null
          default_tax_rate?: number | null
          email_bcc_self?: boolean | null
          email_reply_to?: string | null
          email_signature?: string | null
          fee_range_max?: number | null
          fee_range_min?: number | null
          follow_up_interval_1?: number | null
          follow_up_interval_2?: number | null
          follow_up_interval_3?: number | null
          headline?: string | null
          id?: string
          industries?: string[] | null
          invoice_logo_url?: string | null
          is_public?: boolean | null
          linkedin_url?: string | null
          location_city?: string | null
          location_country?: string | null
          name?: string | null
          notable_clients?: string[] | null
          one_sheet_url?: string | null
          past_talks?: string[] | null
          revenue_goal_year?: number | null
          slug?: string | null
          speaker_reel_url?: string | null
          total_talks_given?: number | null
          tracking_keywords?: string[] | null
          travel_regions?: string[] | null
          twitter_url?: string | null
          updated_at?: string
          weekly_digest?: boolean | null
          widget_settings?: Json | null
          willing_to_travel?: boolean | null
          years_speaking?: number | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      quote_library: {
        Row: {
          attribution: string | null
          created_at: string
          id: string
          quote_text: string
          source: string | null
          speaker_id: string
          tags: string[] | null
        }
        Insert: {
          attribution?: string | null
          created_at?: string
          id?: string
          quote_text: string
          source?: string | null
          speaker_id: string
          tags?: string[] | null
        }
        Update: {
          attribution?: string | null
          created_at?: string
          id?: string
          quote_text?: string
          source?: string | null
          speaker_id?: string
          tags?: string[] | null
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          color: string | null
          created_at: string
          filters: Json
          icon: string | null
          id: string
          last_notified_at: string | null
          last_viewed_at: string | null
          name: string
          notify_new_matches: boolean
          results_count: number | null
          sort_order: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          filters?: Json
          icon?: string | null
          id?: string
          last_notified_at?: string | null
          last_viewed_at?: string | null
          name: string
          notify_new_matches?: boolean
          results_count?: number | null
          sort_order?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          filters?: Json
          icon?: string | null
          id?: string
          last_notified_at?: string | null
          last_viewed_at?: string | null
          name?: string
          notify_new_matches?: boolean
          results_count?: number | null
          sort_order?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scraping_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          last_page_scraped: number | null
          opportunities_found: number | null
          opportunities_inserted: number | null
          opportunities_updated: number | null
          source: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          last_page_scraped?: number | null
          opportunities_found?: number | null
          opportunities_inserted?: number | null
          opportunities_updated?: number | null
          source: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          last_page_scraped?: number | null
          opportunities_found?: number | null
          opportunities_inserted?: number | null
          opportunities_updated?: number | null
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      speaker_assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at: string
          description: string | null
          download_count: number | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          is_primary: boolean | null
          mime_type: string | null
          speaker_id: string
          title: string | null
          view_count: number | null
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          description?: string | null
          download_count?: number | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          is_primary?: boolean | null
          mime_type?: string | null
          speaker_id: string
          title?: string | null
          view_count?: number | null
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          description?: string | null
          download_count?: number | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          is_primary?: boolean | null
          mime_type?: string | null
          speaker_id?: string
          title?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "speaker_assets_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      speaker_bookings: {
        Row: {
          booking_announced_date: string | null
          created_at: string
          event_date: string | null
          event_id: string | null
          event_name: string
          id: string
          organization_name: string | null
          organizer_name: string | null
          source_type: string | null
          source_url: string | null
          speaker_linkedin: string | null
          speaker_name: string
          speaker_profile_id: string | null
          speaker_website: string | null
        }
        Insert: {
          booking_announced_date?: string | null
          created_at?: string
          event_date?: string | null
          event_id?: string | null
          event_name: string
          id?: string
          organization_name?: string | null
          organizer_name?: string | null
          source_type?: string | null
          source_url?: string | null
          speaker_linkedin?: string | null
          speaker_name: string
          speaker_profile_id?: string | null
          speaker_website?: string | null
        }
        Update: {
          booking_announced_date?: string | null
          created_at?: string
          event_date?: string | null
          event_id?: string | null
          event_name?: string
          id?: string
          organization_name?: string | null
          organizer_name?: string | null
          source_type?: string | null
          source_url?: string | null
          speaker_linkedin?: string | null
          speaker_name?: string
          speaker_profile_id?: string | null
          speaker_website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "speaker_bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaker_bookings_speaker_profile_id_fkey"
            columns: ["speaker_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      speaker_calendar: {
        Row: {
          all_day: boolean | null
          color: string | null
          created_at: string
          end_date: string | null
          end_time: string | null
          entry_type: Database["public"]["Enums"]["calendar_entry_type"]
          event_id: string | null
          external_source: string | null
          google_calendar_id: string | null
          id: string
          is_virtual: boolean | null
          location: string | null
          match_id: string | null
          meeting_url: string | null
          notes: string | null
          reminder_days_before: number | null
          speaker_id: string
          start_date: string
          start_time: string | null
          sync_error: string | null
          sync_status: string | null
          title: string
        }
        Insert: {
          all_day?: boolean | null
          color?: string | null
          created_at?: string
          end_date?: string | null
          end_time?: string | null
          entry_type?: Database["public"]["Enums"]["calendar_entry_type"]
          event_id?: string | null
          external_source?: string | null
          google_calendar_id?: string | null
          id?: string
          is_virtual?: boolean | null
          location?: string | null
          match_id?: string | null
          meeting_url?: string | null
          notes?: string | null
          reminder_days_before?: number | null
          speaker_id: string
          start_date: string
          start_time?: string | null
          sync_error?: string | null
          sync_status?: string | null
          title: string
        }
        Update: {
          all_day?: boolean | null
          color?: string | null
          created_at?: string
          end_date?: string | null
          end_time?: string | null
          entry_type?: Database["public"]["Enums"]["calendar_entry_type"]
          event_id?: string | null
          external_source?: string | null
          google_calendar_id?: string | null
          id?: string
          is_virtual?: boolean | null
          location?: string | null
          match_id?: string | null
          meeting_url?: string | null
          notes?: string | null
          reminder_days_before?: number | null
          speaker_id?: string
          start_date?: string
          start_time?: string | null
          sync_error?: string | null
          sync_status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "speaker_calendar_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaker_calendar_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "opportunity_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaker_calendar_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      speeches: {
        Row: {
          created_at: string
          desired_outcome: string | null
          duration_minutes: number | null
          estimated_duration: number | null
          full_script: string | null
          id: string
          industry_context: string | null
          key_message: string | null
          outline: Json | null
          selected_template: string | null
          speaker_id: string
          speech_type: string | null
          status: string | null
          talking_points: Json | null
          target_audience: string | null
          title: string | null
          topic: string | null
          updated_at: string
          word_count: number | null
        }
        Insert: {
          created_at?: string
          desired_outcome?: string | null
          duration_minutes?: number | null
          estimated_duration?: number | null
          full_script?: string | null
          id?: string
          industry_context?: string | null
          key_message?: string | null
          outline?: Json | null
          selected_template?: string | null
          speaker_id: string
          speech_type?: string | null
          status?: string | null
          talking_points?: Json | null
          target_audience?: string | null
          title?: string | null
          topic?: string | null
          updated_at?: string
          word_count?: number | null
        }
        Update: {
          created_at?: string
          desired_outcome?: string | null
          duration_minutes?: number | null
          estimated_duration?: number | null
          full_script?: string | null
          id?: string
          industry_context?: string | null
          key_message?: string | null
          outline?: Json | null
          selected_template?: string | null
          speaker_id?: string
          speech_type?: string | null
          status?: string | null
          talking_points?: Json | null
          target_audience?: string | null
          title?: string | null
          topic?: string | null
          updated_at?: string
          word_count?: number | null
        }
        Relationships: []
      }
      story_bank: {
        Row: {
          created_at: string
          id: string
          speaker_id: string
          story_text: string
          tags: string[] | null
          times_used: number | null
          title: string
          used_in_speeches: string[] | null
        }
        Insert: {
          created_at?: string
          id?: string
          speaker_id: string
          story_text: string
          tags?: string[] | null
          times_used?: number | null
          title: string
          used_in_speeches?: string[] | null
        }
        Update: {
          created_at?: string
          id?: string
          speaker_id?: string
          story_text?: string
          tags?: string[] | null
          times_used?: number | null
          title?: string
          used_in_speeches?: string[] | null
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          author_company: string | null
          author_email: string | null
          author_name: string
          author_photo_url: string | null
          author_title: string | null
          created_at: string
          event_date: string | null
          event_name: string | null
          id: string
          is_featured: boolean | null
          quote: string
          rating: number | null
          received_at: string | null
          request_opened_at: string | null
          request_sent_at: string | null
          request_token: string | null
          source: string
          speaker_id: string
        }
        Insert: {
          author_company?: string | null
          author_email?: string | null
          author_name: string
          author_photo_url?: string | null
          author_title?: string | null
          created_at?: string
          event_date?: string | null
          event_name?: string | null
          id?: string
          is_featured?: boolean | null
          quote: string
          rating?: number | null
          received_at?: string | null
          request_opened_at?: string | null
          request_sent_at?: string | null
          request_token?: string | null
          source?: string
          speaker_id: string
        }
        Update: {
          author_company?: string | null
          author_email?: string | null
          author_name?: string
          author_photo_url?: string | null
          author_title?: string | null
          created_at?: string
          event_date?: string | null
          event_name?: string | null
          id?: string
          is_featured?: boolean | null
          quote?: string
          rating?: number | null
          received_at?: string | null
          request_opened_at?: string | null
          request_sent_at?: string | null
          request_token?: string | null
          source?: string
          speaker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_topics: {
        Row: {
          created_at: string
          id: string
          proficiency_level:
            | Database["public"]["Enums"]["proficiency_level"]
            | null
          topic_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          proficiency_level?:
            | Database["public"]["Enums"]["proficiency_level"]
            | null
          topic_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          proficiency_level?:
            | Database["public"]["Enums"]["proficiency_level"]
            | null
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_topics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          referral_code: string | null
          referred_by: string | null
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          referral_code?: string | null
          referred_by?: string | null
          source?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          referral_code?: string | null
          referred_by?: string | null
          source?: string
        }
        Relationships: []
      }
      watched_speaker_bookings: {
        Row: {
          discovered_at: string
          event_date: string | null
          event_name: string
          id: string
          organization_name: string | null
          source_url: string | null
          watched_speaker_id: string
        }
        Insert: {
          discovered_at?: string
          event_date?: string | null
          event_name: string
          id?: string
          organization_name?: string | null
          source_url?: string | null
          watched_speaker_id: string
        }
        Update: {
          discovered_at?: string
          event_date?: string | null
          event_name?: string
          id?: string
          organization_name?: string | null
          source_url?: string | null
          watched_speaker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watched_speaker_bookings_watched_speaker_id_fkey"
            columns: ["watched_speaker_id"]
            isOneToOne: false
            referencedRelation: "watched_speakers"
            referencedColumns: ["id"]
          },
        ]
      }
      watched_speakers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          speaker_id: string
          watched_linkedin_url: string | null
          watched_name: string
          watched_topics: string[] | null
          watched_website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          speaker_id: string
          watched_linkedin_url?: string | null
          watched_name: string
          watched_topics?: string[] | null
          watched_website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          speaker_id?: string
          watched_linkedin_url?: string | null
          watched_name?: string
          watched_topics?: string[] | null
          watched_website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "watched_speakers_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_feedback_by_token: {
        Args: { p_token: string }
        Returns: {
          event_date: string
          event_name: string
          feedback_token: string
          id: string
          speaker_id: string
          speaker_name: string
          submitted_at: string
        }[]
      }
      get_public_testimonial: {
        Args: { p_token: string }
        Returns: {
          author_company: string
          author_name: string
          author_photo_url: string
          author_title: string
          event_date: string
          event_name: string
          id: string
          quote: string
          rating: number
          speaker_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      activity_type:
        | "email_sent"
        | "email_received"
        | "call"
        | "meeting"
        | "note"
        | "follow_up"
        | "social_interaction"
      app_role: "admin" | "user"
      application_status:
        | "applied"
        | "replied"
        | "booked"
        | "declined"
        | "pending"
      asset_type:
        | "headshot"
        | "speaker_reel"
        | "one_sheet"
        | "slide_deck"
        | "video"
        | "audio"
        | "document"
        | "other"
      calendar_entry_type:
        | "speaking_engagement"
        | "travel"
        | "prep"
        | "meeting"
        | "follow_up"
        | "blocked"
        | "other"
      event_type:
        | "conference"
        | "corporate_keynote"
        | "workshop"
        | "webinar"
        | "panel"
        | "podcast"
        | "training"
        | "other"
      experience_level:
        | "emerging"
        | "established"
        | "professional"
        | "celebrity"
      organization_type:
        | "conference"
        | "corporate"
        | "association"
        | "university"
        | "nonprofit"
        | "government"
        | "media"
        | "other"
      pipeline_stage:
        | "new"
        | "researching"
        | "interested"
        | "pitched"
        | "negotiating"
        | "accepted"
        | "rejected"
        | "completed"
      proficiency_level: "beginner" | "intermediate" | "expert"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: [
        "email_sent",
        "email_received",
        "call",
        "meeting",
        "note",
        "follow_up",
        "social_interaction",
      ],
      app_role: ["admin", "user"],
      application_status: [
        "applied",
        "replied",
        "booked",
        "declined",
        "pending",
      ],
      asset_type: [
        "headshot",
        "speaker_reel",
        "one_sheet",
        "slide_deck",
        "video",
        "audio",
        "document",
        "other",
      ],
      calendar_entry_type: [
        "speaking_engagement",
        "travel",
        "prep",
        "meeting",
        "follow_up",
        "blocked",
        "other",
      ],
      event_type: [
        "conference",
        "corporate_keynote",
        "workshop",
        "webinar",
        "panel",
        "podcast",
        "training",
        "other",
      ],
      experience_level: [
        "emerging",
        "established",
        "professional",
        "celebrity",
      ],
      organization_type: [
        "conference",
        "corporate",
        "association",
        "university",
        "nonprofit",
        "government",
        "media",
        "other",
      ],
      pipeline_stage: [
        "new",
        "researching",
        "interested",
        "pitched",
        "negotiating",
        "accepted",
        "rejected",
        "completed",
      ],
      proficiency_level: ["beginner", "intermediate", "expert"],
    },
  },
} as const
