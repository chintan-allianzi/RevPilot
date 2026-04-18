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
      appointments: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string
          description: string | null
          duration_minutes: number
          id: string
          location: string | null
          meeting_link: string | null
          meeting_type: string
          outcome_notes: string | null
          scheduled_at: string
          status: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id: string
          description?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          meeting_link?: string | null
          meeting_type?: string
          outcome_notes?: string | null
          scheduled_at: string
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          meeting_link?: string | null
          meeting_type?: string
          outcome_notes?: string | null
          scheduled_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "saved_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          assigned_to: string | null
          contacts_count: number | null
          created_at: string | null
          id: string
          instantly_campaign_id: string | null
          linkedin_tasks_count: number | null
          metrics: Json | null
          name: string
          settings: Json | null
          status: string | null
          updated_at: string | null
          vertical_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          contacts_count?: number | null
          created_at?: string | null
          id?: string
          instantly_campaign_id?: string | null
          linkedin_tasks_count?: number | null
          metrics?: Json | null
          name: string
          settings?: Json | null
          status?: string | null
          updated_at?: string | null
          vertical_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          contacts_count?: number | null
          created_at?: string | null
          id?: string
          instantly_campaign_id?: string | null
          linkedin_tasks_count?: number | null
          metrics?: Json | null
          name?: string
          settings?: Json | null
          status?: string | null
          updated_at?: string | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          company_address: string | null
          company_name: string | null
          company_website: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          company_address?: string | null
          company_name?: string | null
          company_website?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          company_address?: string | null
          company_name?: string | null
          company_website?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      data_providers: {
        Row: {
          api_key: string | null
          config: Json | null
          created_at: string
          health_status: string
          id: string
          is_active: boolean
          last_health_check: string | null
          priority_order: number
          provider_key: string
          provider_name: string
          provider_type: string[]
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          config?: Json | null
          created_at?: string
          health_status?: string
          id?: string
          is_active?: boolean
          last_health_check?: string | null
          priority_order?: number
          provider_key: string
          provider_name: string
          provider_type?: string[]
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          config?: Json | null
          created_at?: string
          health_status?: string
          id?: string
          is_active?: boolean
          last_health_check?: string | null
          priority_order?: number
          provider_key?: string
          provider_name?: string
          provider_type?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      deal_activities: {
        Row: {
          activity_date: string
          activity_type: string
          created_by: string | null
          deal_id: string
          description: string | null
          id: string
          metadata: Json | null
          subject: string | null
        }
        Insert: {
          activity_date?: string
          activity_type: string
          created_by?: string | null
          deal_id: string
          description?: string | null
          id?: string
          metadata?: Json | null
          subject?: string | null
        }
        Update: {
          activity_date?: string
          activity_type?: string
          created_by?: string | null
          deal_id?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          deal_id: string
          from_stage_id: string | null
          id: string
          notes: string | null
          time_in_previous_stage_hours: number | null
          to_stage_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          deal_id: string
          from_stage_id?: string | null
          id?: string
          notes?: string | null
          time_in_previous_stage_hours?: number | null
          to_stage_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          deal_id?: string
          from_stage_id?: string | null
          id?: string
          notes?: string | null
          time_in_previous_stage_hours?: number | null
          to_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "lead_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "lead_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deal_id: string
          description: string | null
          due_date: string
          id: string
          priority: string
          status: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id: string
          description?: string | null
          due_date: string
          id?: string
          priority?: string
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string
          description?: string | null
          due_date?: string
          id?: string
          priority?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          currency: string
          deal_name: string
          deal_value: number | null
          expected_close_date: string | null
          id: string
          lost_reason: string | null
          notes: string | null
          stage_id: string
          updated_at: string
          vertical_id: string | null
          won_date: string | null
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_name: string
          deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          notes?: string | null
          stage_id: string
          updated_at?: string
          vertical_id?: string | null
          won_date?: string | null
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_name?: string
          deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          notes?: string | null
          stage_id?: string
          updated_at?: string
          vertical_id?: string | null
          won_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "saved_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "saved_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "lead_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          access_token: string | null
          connected_at: string | null
          created_at: string | null
          daily_send_limit: number | null
          display_name: string | null
          email: string
          emails_sent_today: number | null
          id: string
          is_active: boolean | null
          is_primary: boolean
          last_reset_date: string | null
          provider: string | null
          refresh_token: string | null
          token_expires_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          connected_at?: string | null
          created_at?: string | null
          daily_send_limit?: number | null
          display_name?: string | null
          email: string
          emails_sent_today?: number | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean
          last_reset_date?: string | null
          provider?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          connected_at?: string | null
          created_at?: string | null
          daily_send_limit?: number | null
          display_name?: string | null
          email?: string
          emails_sent_today?: number | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean
          last_reset_date?: string | null
          provider?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_optouts: {
        Row: {
          campaign_id: string | null
          contact_id: string | null
          email: string
          id: string
          ip_address: string | null
          opted_out_at: string | null
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          campaign_id?: string | null
          contact_id?: string | null
          email: string
          id?: string
          ip_address?: string | null
          opted_out_at?: string | null
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string | null
          email?: string
          id?: string
          ip_address?: string | null
          opted_out_at?: string | null
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          body: string
          bounced_at: string | null
          campaign_id: string | null
          contact_id: string
          created_at: string | null
          email_account_id: string | null
          error_message: string | null
          gmail_message_id: string | null
          id: string
          opened_at: string | null
          replied_at: string | null
          reply_to_message_id: string | null
          scheduled_at: string
          sent_at: string | null
          sequence_step: number
          status: string | null
          subject: string
          thread_id: string | null
          to_email: string
          to_name: string | null
          updated_at: string | null
        }
        Insert: {
          body: string
          bounced_at?: string | null
          campaign_id?: string | null
          contact_id: string
          created_at?: string | null
          email_account_id?: string | null
          error_message?: string | null
          gmail_message_id?: string | null
          id?: string
          opened_at?: string | null
          replied_at?: string | null
          reply_to_message_id?: string | null
          scheduled_at: string
          sent_at?: string | null
          sequence_step: number
          status?: string | null
          subject: string
          thread_id?: string | null
          to_email: string
          to_name?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string
          bounced_at?: string | null
          campaign_id?: string | null
          contact_id?: string
          created_at?: string | null
          email_account_id?: string | null
          error_message?: string | null
          gmail_message_id?: string | null
          id?: string
          opened_at?: string | null
          replied_at?: string | null
          reply_to_message_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          sequence_step?: number
          status?: string | null
          subject?: string
          thread_id?: string | null
          to_email?: string
          to_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_replies: {
        Row: {
          assigned_to: string | null
          body_html: string | null
          body_text: string | null
          campaign_id: string | null
          contact_id: string | null
          created_at: string | null
          email_queue_id: string | null
          from_email: string
          from_name: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          is_positive: boolean | null
          is_read: boolean | null
          notes: string | null
          received_at: string | null
          sentiment: string | null
          subject: string | null
        }
        Insert: {
          assigned_to?: string | null
          body_html?: string | null
          body_text?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          email_queue_id?: string | null
          from_email: string
          from_name?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          is_positive?: boolean | null
          is_read?: boolean | null
          notes?: string | null
          received_at?: string | null
          sentiment?: string | null
          subject?: string | null
        }
        Update: {
          assigned_to?: string | null
          body_html?: string | null
          body_text?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          email_queue_id?: string | null
          from_email?: string
          from_name?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          is_positive?: boolean | null
          is_read?: boolean | null
          notes?: string | null
          received_at?: string | null
          sentiment?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_replies_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_replies_email_queue_id_fkey"
            columns: ["email_queue_id"]
            isOneToOne: false
            referencedRelation: "email_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_stages: {
        Row: {
          created_at: string
          default_probability: number
          description: string | null
          id: string
          stage_key: string
          stage_name: string
          stage_order: number
          stage_type: string
        }
        Insert: {
          created_at?: string
          default_probability?: number
          description?: string | null
          id?: string
          stage_key: string
          stage_name: string
          stage_order: number
          stage_type: string
        }
        Update: {
          created_at?: string
          default_probability?: number
          description?: string | null
          id?: string
          stage_key?: string
          stage_name?: string
          stage_order?: number
          stage_type?: string
        }
        Relationships: []
      }
      linkedin_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          contact_company: string | null
          contact_id: string | null
          contact_linkedin_url: string | null
          contact_name: string | null
          contact_tier: string | null
          contact_title: string | null
          created_at: string | null
          id: string
          message: string | null
          scheduled_date: string | null
          status: string | null
          task_type: string
          vertical_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          contact_company?: string | null
          contact_id?: string | null
          contact_linkedin_url?: string | null
          contact_name?: string | null
          contact_tier?: string | null
          contact_title?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          scheduled_date?: string | null
          status?: string | null
          task_type: string
          vertical_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          contact_company?: string | null
          contact_id?: string | null
          contact_linkedin_url?: string | null
          contact_name?: string | null
          contact_tier?: string | null
          contact_title?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          scheduled_date?: string | null
          status?: string | null
          task_type?: string
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_tasks_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      nurture_queue: {
        Row: {
          contact_id: string
          created_at: string
          deal_id: string
          email_account_id: string | null
          error_message: string | null
          id: string
          scheduled_at: string
          sent_at: string | null
          status: string
          step_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          deal_id: string
          email_account_id?: string | null
          error_message?: string | null
          id?: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          step_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          deal_id?: string
          email_account_id?: string | null
          error_message?: string | null
          id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nurture_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "saved_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nurture_queue_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nurture_queue_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nurture_queue_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "nurture_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      nurture_sequences: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          name: string
          trigger_stage: string
          vertical_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          name: string
          trigger_stage: string
          vertical_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          name?: string
          trigger_stage?: string
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nurture_sequences_trigger_stage_fkey"
            columns: ["trigger_stage"]
            isOneToOne: false
            referencedRelation: "lead_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nurture_sequences_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      nurture_steps: {
        Row: {
          body_template: string
          channel: string
          created_at: string
          delay_days: number
          id: string
          sequence_id: string
          step_order: number
          subject_template: string | null
        }
        Insert: {
          body_template: string
          channel?: string
          created_at?: string
          delay_days?: number
          id?: string
          sequence_id: string
          step_order: number
          subject_template?: string | null
        }
        Update: {
          body_template?: string
          channel?: string
          created_at?: string
          delay_days?: number
          id?: string
          sequence_id?: string
          step_order?: number
          subject_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nurture_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "nurture_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          calendar_link: string | null
          created_at: string | null
          email: string
          email_signature: string | null
          full_name: string
          id: string
          invited_by: string | null
          is_active: boolean | null
          linkedin_sales_nav_url: string | null
          linkedin_url: string | null
          phone: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          calendar_link?: string | null
          created_at?: string | null
          email: string
          email_signature?: string | null
          full_name: string
          id: string
          invited_by?: string | null
          is_active?: boolean | null
          linkedin_sales_nav_url?: string | null
          linkedin_url?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          calendar_link?: string | null
          created_at?: string | null
          email?: string
          email_signature?: string | null
          full_name?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean | null
          linkedin_sales_nav_url?: string | null
          linkedin_url?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_companies: {
        Row: {
          ai_enrichment: Json | null
          ai_score: number | null
          ai_tier: string | null
          apollo_org_id: string | null
          basic_score: number | null
          basic_tier: string | null
          city: string | null
          country: string | null
          created_at: string | null
          description: string | null
          domain: string | null
          employees: number | null
          enriched_at: string | null
          founded_year: number | null
          growth_12mo: number | null
          growth_24mo: number | null
          id: string
          industry: string | null
          is_enriched: boolean | null
          keywords: string[] | null
          linkedin_url: string | null
          location: string | null
          logo_url: string | null
          name: string
          raw_data: Json | null
          revenue: string | null
          state: string | null
          status: string | null
          tech_stack: string[] | null
          updated_at: string | null
          vertical_id: string | null
          website_url: string | null
        }
        Insert: {
          ai_enrichment?: Json | null
          ai_score?: number | null
          ai_tier?: string | null
          apollo_org_id?: string | null
          basic_score?: number | null
          basic_tier?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          domain?: string | null
          employees?: number | null
          enriched_at?: string | null
          founded_year?: number | null
          growth_12mo?: number | null
          growth_24mo?: number | null
          id?: string
          industry?: string | null
          is_enriched?: boolean | null
          keywords?: string[] | null
          linkedin_url?: string | null
          location?: string | null
          logo_url?: string | null
          name: string
          raw_data?: Json | null
          revenue?: string | null
          state?: string | null
          status?: string | null
          tech_stack?: string[] | null
          updated_at?: string | null
          vertical_id?: string | null
          website_url?: string | null
        }
        Update: {
          ai_enrichment?: Json | null
          ai_score?: number | null
          ai_tier?: string | null
          apollo_org_id?: string | null
          basic_score?: number | null
          basic_tier?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          domain?: string | null
          employees?: number | null
          enriched_at?: string | null
          founded_year?: number | null
          growth_12mo?: number | null
          growth_24mo?: number | null
          id?: string
          industry?: string | null
          is_enriched?: boolean | null
          keywords?: string[] | null
          linkedin_url?: string | null
          location?: string | null
          logo_url?: string | null
          name?: string
          raw_data?: Json | null
          revenue?: string | null
          state?: string | null
          status?: string | null
          tech_stack?: string[] | null
          updated_at?: string | null
          vertical_id?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_companies_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_contacts: {
        Row: {
          ai_enrichment: Json | null
          apollo_person_id: string | null
          company_id: string | null
          created_at: string | null
          email: string | null
          email_body: string | null
          email_status: string | null
          email_subject: string | null
          first_name: string | null
          id: string
          instantly_variables: Json | null
          last_name: string | null
          linkedin_connection: string | null
          linkedin_dm: string | null
          linkedin_url: string | null
          messages_generated: boolean | null
          opted_out: boolean | null
          opted_out_at: string | null
          phone: string | null
          photo_url: string | null
          raw_data: Json | null
          status: string | null
          title: string | null
          updated_at: string | null
          vertical_id: string | null
        }
        Insert: {
          ai_enrichment?: Json | null
          apollo_person_id?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          email_body?: string | null
          email_status?: string | null
          email_subject?: string | null
          first_name?: string | null
          id?: string
          instantly_variables?: Json | null
          last_name?: string | null
          linkedin_connection?: string | null
          linkedin_dm?: string | null
          linkedin_url?: string | null
          messages_generated?: boolean | null
          opted_out?: boolean | null
          opted_out_at?: string | null
          phone?: string | null
          photo_url?: string | null
          raw_data?: Json | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          vertical_id?: string | null
        }
        Update: {
          ai_enrichment?: Json | null
          apollo_person_id?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          email_body?: string | null
          email_status?: string | null
          email_subject?: string | null
          first_name?: string | null
          id?: string
          instantly_variables?: Json | null
          last_name?: string | null
          linkedin_connection?: string | null
          linkedin_dm?: string | null
          linkedin_url?: string | null
          messages_generated?: boolean | null
          opted_out?: boolean | null
          opted_out_at?: string | null
          phone?: string | null
          photo_url?: string | null
          raw_data?: Json | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "saved_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_contacts_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
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
      verticals: {
        Row: {
          buyer_personas: string[] | null
          created_at: string | null
          default_exclude_industries: string[] | null
          default_industries: string[] | null
          default_intent_config: Json | null
          default_locations: string[] | null
          default_max_employees: string | null
          default_max_revenue: string | null
          default_min_employees: string | null
          default_min_revenue: string | null
          description: string | null
          icon: string | null
          id: string
          is_default: boolean | null
          job_titles_to_search: string[] | null
          name: string
          ob_cost_range: string | null
          savings: string | null
          selling_points: string[] | null
          tech_stack: string[] | null
          updated_at: string | null
          us_cost_range: string | null
        }
        Insert: {
          buyer_personas?: string[] | null
          created_at?: string | null
          default_exclude_industries?: string[] | null
          default_industries?: string[] | null
          default_intent_config?: Json | null
          default_locations?: string[] | null
          default_max_employees?: string | null
          default_max_revenue?: string | null
          default_min_employees?: string | null
          default_min_revenue?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          job_titles_to_search?: string[] | null
          name: string
          ob_cost_range?: string | null
          savings?: string | null
          selling_points?: string[] | null
          tech_stack?: string[] | null
          updated_at?: string | null
          us_cost_range?: string | null
        }
        Update: {
          buyer_personas?: string[] | null
          created_at?: string | null
          default_exclude_industries?: string[] | null
          default_industries?: string[] | null
          default_intent_config?: Json | null
          default_locations?: string[] | null
          default_max_employees?: string | null
          default_max_revenue?: string | null
          default_min_employees?: string | null
          default_min_revenue?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          job_titles_to_search?: string[] | null
          name?: string
          ob_cost_range?: string | null
          savings?: string | null
          selling_points?: string[] | null
          tech_stack?: string[] | null
          updated_at?: string | null
          us_cost_range?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrypt_token: {
        Args: { cipher_text: string; encryption_key: string }
        Returns: string
      }
      encrypt_token: {
        Args: { encryption_key: string; plain_text: string }
        Returns: string
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
      app_role: "admin" | "bdm"
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
      app_role: ["admin", "bdm"],
    },
  },
} as const
