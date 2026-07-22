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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      cafes: {
        Row: {
          created_at: string
          currency: string
          tagline: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
          phone: string | null
          whatsapp: string | null
          address: string | null
          google_maps_review_url: string | null
          website: string | null
          instagram: string | null
          operating_hours: string | null
          staff_can_manage_specials: boolean
          is_demo_cafe: boolean
        }
        Insert: {
          created_at?: string
          currency?: string
          tagline?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
          phone?: string | null
          whatsapp?: string | null
          address?: string | null
          google_maps_review_url?: string | null
          website?: string | null
          instagram?: string | null
          operating_hours?: string | null
          staff_can_manage_specials?: boolean
          is_demo_cafe?: boolean
        }
        Update: {
          created_at?: string
          currency?: string
          tagline?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
          phone?: string | null
          whatsapp?: string | null
          address?: string | null
          google_maps_review_url?: string | null
          website?: string | null
          instagram?: string | null
          operating_hours?: string | null
          staff_can_manage_specials?: boolean
          is_demo_cafe?: boolean
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          actor_id: string | null
          cafe_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          target_email: string | null
        }
        Insert: {
          actor_id?: string | null
          cafe_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          target_email?: string | null
        }
        Update: {
          actor_id?: string | null
          cafe_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          target_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_order_counters: {
        Row: {
          counter: number
          date: string
        }
        Insert: {
          counter?: number
          date: string
        }
        Update: {
          counter?: number
          date?: string
        }
        Relationships: []
      }
      dining_sessions: {
        Row: {
          closed_at: string | null
          closed_by_staff_id: string | null
          created_at: string
          id: string
          last_activity_at: string
          opened_at: string
          status: string
          table_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by_staff_id?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          opened_at?: string
          status?: string
          table_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by_staff_id?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          opened_at?: string
          status?: string
          table_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dining_sessions_closed_by_staff_id_fkey"
            columns: ["closed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dining_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          cafe_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          cafe_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          cafe_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          cafe_id: string
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price_cents: number
          sort_order: number
          tags: string[] | null
          updated_at: string
          veg_type: Database["public"]["Enums"]["veg_type"]
          station: Database["public"]["Enums"]["prep_station"]
          base_prep_time_minutes: number
        }
        Insert: {
          cafe_id: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price_cents?: number
          sort_order?: number
          tags?: string[] | null
          updated_at?: string
          veg_type?: Database["public"]["Enums"]["veg_type"]
          station?: Database["public"]["Enums"]["prep_station"]
          base_prep_time_minutes?: number
        }
        Update: {
          cafe_id?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price_cents?: number
          sort_order?: number
          tags?: string[] | null
          updated_at?: string
          veg_type?: Database["public"]["Enums"]["veg_type"]
          station?: Database["public"]["Enums"]["prep_station"]
          base_prep_time_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_audits: {
        Row: {
          change_summary: string
          created_at: string
          editor: string
          id: string
          order_id: string
        }
        Insert: {
          change_summary: string
          created_at?: string
          editor: string
          id?: string
          order_id: string
        }
        Update: {
          change_summary?: string
          created_at?: string
          editor?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_audits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor: string
          created_at: string
          dining_session_id: string
          event_type: string
          id: string
          metadata: Json
          order_id: string | null
          service_request_id: string | null
          title: string
        }
        Insert: {
          actor: string
          created_at?: string
          dining_session_id: string
          event_type: string
          id?: string
          metadata?: Json
          order_id?: string | null
          service_request_id?: string | null
          title: string
        }
        Update: {
          actor?: string
          created_at?: string
          dining_session_id?: string
          event_type?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          service_request_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_dining_session_id_fkey"
            columns: ["dining_session_id"]
            isOneToOne: false
            referencedRelation: "dining_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          }
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string | null
          name: string
          note: string | null
          order_id: string
          price_cents: number
          qty: number
          status: Database["public"]["Enums"]["order_item_status"]
          prep_station: Database["public"]["Enums"]["prep_station"]
          base_prep_time_minutes: number
          prep_started_at: string | null
          ready_at: string | null
          served_at: string | null
          predicted_duration_minutes: number | null
          actual_duration_minutes: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name: string
          note?: string | null
          order_id: string
          price_cents: number
          qty?: number
          status?: Database["public"]["Enums"]["order_item_status"]
          prep_station?: Database["public"]["Enums"]["prep_station"]
          base_prep_time_minutes?: number
          prep_started_at?: string | null
          ready_at?: string | null
          served_at?: string | null
          predicted_duration_minutes?: number | null
          actual_duration_minutes?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name?: string
          note?: string | null
          order_id?: string
          price_cents?: number
          qty?: number
          status?: Database["public"]["Enums"]["order_item_status"]
          prep_station?: Database["public"]["Enums"]["prep_station"]
          base_prep_time_minutes?: number
          prep_started_at?: string | null
          ready_at?: string | null
          served_at?: string | null
          predicted_duration_minutes?: number | null
          actual_duration_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cafe_id: string
          created_at: string
          dining_session_id: string | null
          id: string
          last_reviewed_version: number
          last_updated_by: string
          note: string | null
          order_number: number
          previous_items: Json | null
          session_id: string
          status: Database["public"]["Enums"]["order_status"]
          table_id: string
          total_cents: number
          updated_at: string
          version: number
          eta_timestamp: string | null
          eta_calculated_at: string | null
        }
        Insert: {
          cafe_id: string
          created_at?: string
          dining_session_id?: string | null
          id?: string
          last_reviewed_version?: number
          last_updated_by?: string
          note?: string | null
          order_number: number
          previous_items?: Json | null
          session_id: string
          status?: Database["public"]["Enums"]["order_status"]
          table_id: string
          total_cents?: number
          updated_at?: string
          version?: number
          eta_timestamp?: string | null
          eta_calculated_at?: string | null
        }
        Update: {
          cafe_id?: string
          created_at?: string
          dining_session_id?: string | null
          id?: string
          last_reviewed_version?: number
          last_updated_by?: string
          note?: string | null
          order_number?: number
          previous_items?: Json | null
          session_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string
          total_cents?: number
          updated_at?: string
          version?: number
          eta_timestamp?: string | null
          eta_calculated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_dining_session_id_fkey"
            columns: ["dining_session_id"]
            isOneToOne: false
            referencedRelation: "dining_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cafe_id: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          cafe_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          cafe_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      rejected_approvals: {
        Row: {
          id: string
          cafe_id: string | null
          user_id: string
          email: string | null
          rejected_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          cafe_id?: string | null
          user_id: string
          email?: string | null
          rejected_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          cafe_id?: string | null
          user_id?: string
          email?: string | null
          rejected_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rejected_approvals_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          cafe_id: string
          comment: string | null
          created_at: string
          id: string
          order_id: string | null
          rating: number
          session_id: string | null
        }
        Insert: {
          cafe_id: string
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          rating: number
          session_id?: string | null
        }
        Update: {
          cafe_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          rating?: number
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          cafe_id: string
          created_at: string
          dining_session_id: string | null
          id: string
          note: string | null
          browser_session_id: string
          status: Database["public"]["Enums"]["service_request_status"]
          table_id: string
          type: Database["public"]["Enums"]["service_request_type"]
          updated_at: string
        }
        Insert: {
          cafe_id: string
          created_at?: string
          dining_session_id?: string | null
          id?: string
          note?: string | null
          browser_session_id: string
          status?: Database["public"]["Enums"]["service_request_status"]
          table_id: string
          type: Database["public"]["Enums"]["service_request_type"]
          updated_at?: string
        }
        Update: {
          cafe_id?: string
          created_at?: string
          dining_session_id?: string | null
          id?: string
          note?: string | null
          browser_session_id?: string
          status?: Database["public"]["Enums"]["service_request_status"]
          table_id?: string
          type?: Database["public"]["Enums"]["service_request_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_dining_session_id_fkey"
            columns: ["dining_session_id"]
            isOneToOne: false
            referencedRelation: "dining_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invites: {
        Row: {
          cafe_id: string
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string | null
          expires_at: string
          accepted_at: string | null
          revoked_at: string | null
        }
        Insert: {
          cafe_id: string
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          token_hash?: string | null
          expires_at?: string
          accepted_at?: string | null
          revoked_at?: string | null
        }
        Update: {
          cafe_id?: string
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token_hash?: string | null
          expires_at?: string
          accepted_at?: string | null
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_invites_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          active_session_id: string | null
          cafe_id: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          seats: number | null
          status: string
        }
        Insert: {
          active_session_id?: string | null
          cafe_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          seats?: number | null
          status?: string
        }
        Update: {
          active_session_id?: string | null
          cafe_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          seats?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tables_active_session_id_fkey"
            columns: ["active_session_id"]
            isOneToOne: false
            referencedRelation: "dining_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          cafe_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          is_suspended: boolean
        }
        Insert: {
          cafe_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          is_suspended?: boolean
        }
        Update: {
          cafe_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          is_suspended?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_staff_invite: {
        Args: { _token_hash: string }
        Returns: Json
      }
      assign_role_by_email: {
        Args: {
          _cafe_id: string
          _email: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
      bootstrap_restaurant: {
        Args: {
          _currency?: string
          _name: string
          _owner_email: string
          _slug: string
        }
        Returns: Json
      }
      cancel_order: {
        Args: { p_order_id: string; p_session_id: string }
        Returns: undefined
      }
      claim_demo_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      cleanup_expired_browsing_sessions: { Args: never; Returns: undefined }
      free_table: {
        Args: { p_staff_id?: string; p_table_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _cafe_id?: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      review_order_changes: {
        Args: { p_order_id: string; p_version: number }
        Returns: undefined
      }
      revoke_staff_invite: {
        Args: { _invite_id: string }
        Returns: Json
      }
      update_order: {
        Args: {
          p_expected_version: number
          p_items: Json
          p_note: string
          p_order_id: string
          p_session_id: string
          p_total_cents: number
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "staff"
      order_item_status: "pending" | "preparing" | "ready" | "served" | "cancelled"
      order_status: "pending" | "preparing" | "ready" | "served" | "cancelled"
      prep_station: "coffee" | "kitchen" | "other"
      service_request_status: "open" | "acknowledged" | "resolved"
      service_request_type: "water" | "waiter" | "bill" | "help"
      veg_type: "veg" | "non_veg" | "unspecified"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["owner", "staff"],
      order_item_status: ["pending", "preparing", "ready", "served", "cancelled"],
      order_status: ["pending", "preparing", "ready", "served", "cancelled"],
      prep_station: ["coffee", "kitchen", "other"],
      service_request_status: ["open", "acknowledged", "resolved"],
      service_request_type: ["water", "waiter", "bill", "help"],
      veg_type: ["veg", "non_veg", "unspecified"],
    },
  },
} as const
