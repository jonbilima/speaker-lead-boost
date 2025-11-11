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
      opportunities: {
        Row: {
          audience_size: number | null
          created_at: string
          deadline: string | null
          description: string | null
          event_date: string | null
          event_name: string
          event_url: string | null
          fee_estimate_max: number | null
          fee_estimate_min: number | null
          id: string
          is_active: boolean | null
          location: string | null
          organizer_email: string | null
          organizer_name: string | null
          scraped_at: string
          source: string | null
        }
        Insert: {
          audience_size?: number | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          event_date?: string | null
          event_name: string
          event_url?: string | null
          fee_estimate_max?: number | null
          fee_estimate_min?: number | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          organizer_email?: string | null
          organizer_name?: string | null
          scraped_at?: string
          source?: string | null
        }
        Update: {
          audience_size?: number | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          event_date?: string | null
          event_name?: string
          event_url?: string | null
          fee_estimate_max?: number | null
          fee_estimate_min?: number | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          organizer_email?: string | null
          organizer_name?: string | null
          scraped_at?: string
          source?: string | null
        }
        Relationships: []
      }
      opportunity_scores: {
        Row: {
          ai_reason: string | null
          ai_score: number | null
          calculated_at: string
          deadline_urgency_score: number | null
          fee_alignment_score: number | null
          id: string
          opportunity_id: string
          topic_match_score: number | null
          user_id: string
        }
        Insert: {
          ai_reason?: string | null
          ai_score?: number | null
          calculated_at?: string
          deadline_urgency_score?: number | null
          fee_alignment_score?: number | null
          id?: string
          opportunity_id: string
          topic_match_score?: number | null
          user_id: string
        }
        Update: {
          ai_reason?: string | null
          ai_score?: number | null
          calculated_at?: string
          deadline_urgency_score?: number | null
          fee_alignment_score?: number | null
          id?: string
          opportunity_id?: string
          topic_match_score?: number | null
          user_id?: string
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
          bio: string | null
          created_at: string
          fee_range_max: number | null
          fee_range_min: number | null
          id: string
          linkedin_url: string | null
          name: string | null
          past_talks: string[] | null
          twitter_url: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          fee_range_max?: number | null
          fee_range_min?: number | null
          id: string
          linkedin_url?: string | null
          name?: string | null
          past_talks?: string[] | null
          twitter_url?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          fee_range_max?: number | null
          fee_range_min?: number | null
          id?: string
          linkedin_url?: string | null
          name?: string | null
          past_talks?: string[] | null
          twitter_url?: string | null
          updated_at?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      application_status:
        | "applied"
        | "replied"
        | "booked"
        | "declined"
        | "pending"
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
      app_role: ["admin", "user"],
      application_status: [
        "applied",
        "replied",
        "booked",
        "declined",
        "pending",
      ],
      proficiency_level: ["beginner", "intermediate", "expert"],
    },
  },
} as const
