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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_published: boolean | null
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      competition_matches: {
        Row: {
          competition_id: string
          created_at: string
          group_name: string | null
          id: string
          location: string | null
          match_datetime: string | null
          match_number: number
          next_match_id: string | null
          notes: string | null
          round_number: number
          score1: string | null
          score2: string | null
          status: string
          team1_id: string | null
          team2_id: string | null
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          competition_id: string
          created_at?: string
          group_name?: string | null
          id?: string
          location?: string | null
          match_datetime?: string | null
          match_number?: number
          next_match_id?: string | null
          notes?: string | null
          round_number?: number
          score1?: string | null
          score2?: string | null
          status?: string
          team1_id?: string | null
          team2_id?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          competition_id?: string
          created_at?: string
          group_name?: string | null
          id?: string
          location?: string | null
          match_datetime?: string | null
          match_number?: number
          next_match_id?: string | null
          notes?: string | null
          round_number?: number
          score1?: string | null
          score2?: string | null
          status?: string
          team1_id?: string | null
          team2_id?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_matches_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "event_competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_matches_next_match_id_fkey"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "competition_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_matches_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "competition_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_matches_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "competition_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "competition_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_referees: {
        Row: {
          competition_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_referees_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "event_competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_team_members: {
        Row: {
          created_at: string
          id: string
          is_captain: boolean | null
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_captain?: boolean | null
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_captain?: boolean | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "competition_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_teams: {
        Row: {
          competition_id: string
          created_at: string
          house_id: string | null
          id: string
          is_eliminated: boolean | null
          logo_url: string | null
          name: string
          seed_number: number | null
        }
        Insert: {
          competition_id: string
          created_at?: string
          house_id?: string | null
          id?: string
          is_eliminated?: boolean | null
          logo_url?: string | null
          name: string
          seed_number?: number | null
        }
        Update: {
          competition_id?: string
          created_at?: string
          house_id?: string | null
          id?: string
          is_eliminated?: boolean | null
          logo_url?: string | null
          name?: string
          seed_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "event_competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_teams_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          created_at: string
          description: string
          id: string
          is_public: boolean | null
          responded_at: string | null
          responded_by: string | null
          response: string | null
          status: Database["public"]["Enums"]["complaint_status"] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_public?: boolean | null
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: Database["public"]["Enums"]["complaint_status"] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_public?: boolean | null
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: Database["public"]["Enums"]["complaint_status"] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          description: string | null
          file_type: string | null
          file_url: string
          id: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          order_index: number | null
          phone: string
          platform: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number | null
          phone: string
          platform?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number | null
          phone?: string
          platform?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_competitions: {
        Row: {
          created_at: string
          event_id: string
          format: string
          id: string
          match_type: string
          max_participants: number | null
          participant_type: string
          registration_deadline: string | null
          rules: string | null
          sport_name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          format?: string
          id?: string
          match_type?: string
          max_participants?: number | null
          participant_type?: string
          registration_deadline?: string | null
          rules?: string | null
          sport_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          format?: string
          id?: string
          match_type?: string
          max_participants?: number | null
          participant_type?: string
          registration_deadline?: string | null
          rules?: string | null
          sport_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_competitions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          id: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          author_id: string | null
          created_at: string
          description: string | null
          event_date: string
          event_time: string | null
          id: string
          image_url: string | null
          location: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          description?: string | null
          event_date: string
          event_time?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          description?: string | null
          event_date?: string
          event_time?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_published: boolean | null
          order_index: number | null
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_published?: boolean | null
          order_index?: number | null
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_published?: boolean | null
          order_index?: number | null
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_records: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          id: string
          payment_id: string | null
          recorded_by: string | null
          transaction_date: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description: string
          id?: string
          payment_id?: string | null
          recorded_by?: string | null
          transaction_date?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          payment_id?: string | null
          recorded_by?: string | null
          transaction_date?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_records_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      house_residents: {
        Row: {
          created_at: string
          house_id: string
          id: string
          is_owner: boolean | null
          move_in_date: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          house_id: string
          id?: string
          is_owner?: boolean | null
          move_in_date?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          house_id?: string
          id?: string
          is_owner?: boolean | null
          move_in_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "house_residents_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      houses: {
        Row: {
          block: string
          color: string | null
          created_at: string
          height: number
          id: string
          is_occupied: boolean | null
          number: string
          updated_at: string
          width: number
          x_position: number
          y_position: number
        }
        Insert: {
          block: string
          color?: string | null
          created_at?: string
          height?: number
          id?: string
          is_occupied?: boolean | null
          number: string
          updated_at?: string
          width?: number
          x_position?: number
          y_position?: number
        }
        Update: {
          block?: string
          color?: string | null
          created_at?: string
          height?: number
          id?: string
          is_occupied?: boolean | null
          number?: string
          updated_at?: string
          width?: number
          x_position?: number
          y_position?: number
        }
        Relationships: []
      }
      landing_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      menus: {
        Row: {
          color: string | null
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          order_index: number
          show_in_admin_menu: boolean
          show_in_pengurus_menu: boolean
          show_in_quick_menu: boolean
          show_in_sidebar_admin: boolean
          show_in_sidebar_main: boolean
          show_in_sidebar_pengurus: boolean
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon: string
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          show_in_admin_menu?: boolean
          show_in_pengurus_menu?: boolean
          show_in_quick_menu?: boolean
          show_in_sidebar_admin?: boolean
          show_in_sidebar_main?: boolean
          show_in_sidebar_pengurus?: boolean
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          show_in_admin_menu?: boolean
          show_in_pengurus_menu?: boolean
          show_in_quick_menu?: boolean
          show_in_sidebar_admin?: boolean
          show_in_sidebar_main?: boolean
          show_in_sidebar_pengurus?: boolean
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          house_id: string
          id: string
          month: number
          notes: string | null
          paid_at: string | null
          proof_url: string | null
          status: Database["public"]["Enums"]["payment_status"] | null
          submitted_by: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          year: number
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          house_id: string
          id?: string
          month: number
          notes?: string | null
          paid_at?: string | null
          proof_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          submitted_by?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          house_id?: string
          id?: string
          month?: number
          notes?: string | null
          paid_at?: string | null
          proof_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          submitted_by?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      pengurus_titles: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          has_finance_access: boolean | null
          id: string
          name: string
          order_index: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          has_finance_access?: boolean | null
          id?: string
          name: string
          order_index?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          has_finance_access?: boolean | null
          id?: string
          name?: string
          order_index?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          author_id: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean | null
          options: Json
          title: string
          updated_at: string
          vote_type: Database["public"]["Enums"]["poll_vote_type"]
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          options?: Json
          title: string
          updated_at?: string
          vote_type?: Database["public"]["Enums"]["poll_vote_type"]
        }
        Update: {
          author_id?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          options?: Json
          title?: string
          updated_at?: string
          vote_type?: Database["public"]["Enums"]["poll_vote_type"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          title: Database["public"]["Enums"]["pengurus_title"] | null
          title_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          title?: Database["public"]["Enums"]["pengurus_title"] | null
          title_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          title?: Database["public"]["Enums"]["pengurus_title"] | null
          title_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "pengurus_titles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_competition: {
        Args: { _competition_id: string; _user_id: string }
        Returns: boolean
      }
      get_user_house_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_finance_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      house_has_voted: {
        Args: { _house_id: string; _poll_id: string }
        Returns: boolean
      }
      is_competition_referee: {
        Args: { _competition_id: string; _user_id: string }
        Returns: boolean
      }
      is_event_author: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "pengurus" | "warga"
      complaint_status: "pending" | "in_progress" | "resolved"
      payment_status: "pending" | "paid" | "overdue"
      pengurus_title:
        | "ketua"
        | "wakil_ketua"
        | "sekretaris"
        | "bendahara"
        | "sie_keamanan"
        | "sie_kebersihan"
        | "sie_sosial"
        | "anggota"
      poll_vote_type: "per_account" | "per_house"
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
      app_role: ["admin", "pengurus", "warga"],
      complaint_status: ["pending", "in_progress", "resolved"],
      payment_status: ["pending", "paid", "overdue"],
      pengurus_title: [
        "ketua",
        "wakil_ketua",
        "sekretaris",
        "bendahara",
        "sie_keamanan",
        "sie_kebersihan",
        "sie_sosial",
        "anggota",
      ],
      poll_vote_type: ["per_account", "per_house"],
    },
  },
} as const
