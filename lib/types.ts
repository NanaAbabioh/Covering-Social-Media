export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          config: Json
          id: number
        }
        Insert: {
          config: Json
          id?: number
        }
        Update: {
          config?: Json
          id?: number
        }
        Relationships: []
      }
      channels: {
        Row: {
          channel_published_at: string | null
          contact_email: string | null
          first_seen: string
          id: string
          name: string | null
          rss_monitored: boolean
          status: string
          subscriber_count: number | null
          upload_frequency: number | null
          url: string | null
          video_count: number | null
          website: string | null
        }
        Insert: {
          channel_published_at?: string | null
          contact_email?: string | null
          first_seen?: string
          id: string
          name?: string | null
          rss_monitored?: boolean
          status?: string
          subscriber_count?: number | null
          upload_frequency?: number | null
          url?: string | null
          video_count?: number | null
          website?: string | null
        }
        Update: {
          channel_published_at?: string | null
          contact_email?: string | null
          first_seen?: string
          id?: string
          name?: string | null
          rss_monitored?: boolean
          status?: string
          subscriber_count?: number | null
          upload_frequency?: number | null
          url?: string | null
          video_count?: number | null
          website?: string | null
        }
        Relationships: []
      }
      outreach: {
        Row: {
          ask_type: string
          asked_at: string | null
          channel_id: string
          created_at: string
          id: string
          notes: string | null
          permission_wording: string | null
          response: string
          response_at: string | null
          video_id: string | null
        }
        Insert: {
          ask_type?: string
          asked_at?: string | null
          channel_id: string
          created_at?: string
          id?: string
          notes?: string | null
          permission_wording?: string | null
          response?: string
          response_at?: string | null
          video_id?: string | null
        }
        Update: {
          ask_type?: string
          asked_at?: string | null
          channel_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          permission_wording?: string | null
          response?: string
          response_at?: string | null
          video_id?: string | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          courtesy_notified: boolean
          created_at: string
          id: string
          outreach_id: string
          platform: string | null
          post_url: string | null
          posted_at: string | null
          video_id: string | null
        }
        Insert: {
          courtesy_notified?: boolean
          created_at?: string
          id?: string
          outreach_id: string
          platform?: string | null
          post_url?: string | null
          posted_at?: string | null
          video_id?: string | null
        }
        Update: {
          courtesy_notified?: boolean
          created_at?: string
          id?: string
          outreach_id?: string
          platform?: string | null
          post_url?: string | null
          posted_at?: string | null
          video_id?: string | null
        }
        Relationships: []
      }
      search_queries: {
        Row: {
          active: boolean
          created_at: string
          id: string
          last_run_at: string | null
          query_text: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          last_run_at?: string | null
          query_text: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          last_run_at?: string | null
          query_text?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          channel_id: string | null
          clip_note: string | null
          clip_timestamp: string | null
          comment_count: number | null
          description: string | null
          discovered_at: string
          discovery_source: string | null
          duration: string | null
          id: string
          published_at: string | null
          score: number | null
          score_signals: Json | null
          status: string
          title: string | null
          view_count: number | null
        }
        Insert: {
          channel_id?: string | null
          clip_note?: string | null
          clip_timestamp?: string | null
          comment_count?: number | null
          description?: string | null
          discovered_at?: string
          discovery_source?: string | null
          duration?: string | null
          id: string
          published_at?: string | null
          score?: number | null
          score_signals?: Json | null
          status?: string
          title?: string | null
          view_count?: number | null
        }
        Update: {
          channel_id?: string | null
          clip_note?: string | null
          clip_timestamp?: string | null
          comment_count?: number | null
          description?: string | null
          discovered_at?: string
          discovery_source?: string | null
          duration?: string | null
          id?: string
          published_at?: string | null
          score?: number | null
          score_signals?: Json | null
          status?: string
          title?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

// Convenience row aliases used across the app.
type PublicTables = Database["public"]["Tables"];
export type Channel = PublicTables["channels"]["Row"];
export type Video = PublicTables["videos"]["Row"];
export type Outreach = PublicTables["outreach"]["Row"];
export type Post = PublicTables["posts"]["Row"];
export type SearchQuery = PublicTables["search_queries"]["Row"];
export type AppSettingsRow = PublicTables["app_settings"]["Row"];
