// GENERATED FILE — do not edit by hand.
// Regenerate with: npm run gen:types  (see scripts/gen-types.mjs)
// Source: public schema of "electrobtechoms".

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          value: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      aptitude: {
        Row: {
          id: string
          apt_key: string | null
          lead_ref: string | null
          name: string
          phone: string | null
          email: string | null
          college: string | null
          cgpa: string | null
          goal: string | null
          round: string
          mode: string | null
          venue: string | null
          apt_date: string | null
          source: string | null
          bd: string | null
          status: string
          result: string | null
          score: number | null
          next_action: string | null
          remarks: string | null
          invite_sent: boolean
          payment_done: boolean
          payment_amt: number
          payment_mode: string | null
          payment_txn: string | null
          payment_date: string | null
          payment_verified_ai: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          apt_key?: string | null
          lead_ref?: string | null
          name: string
          phone?: string | null
          email?: string | null
          college?: string | null
          cgpa?: string | null
          goal?: string | null
          round?: string
          mode?: string | null
          venue?: string | null
          apt_date?: string | null
          source?: string | null
          bd?: string | null
          status?: string
          result?: string | null
          score?: number | null
          next_action?: string | null
          remarks?: string | null
          invite_sent?: boolean
          payment_done?: boolean
          payment_amt?: number
          payment_mode?: string | null
          payment_txn?: string | null
          payment_date?: string | null
          payment_verified_ai?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          apt_key?: string | null
          lead_ref?: string | null
          name?: string
          phone?: string | null
          email?: string | null
          college?: string | null
          cgpa?: string | null
          goal?: string | null
          round?: string
          mode?: string | null
          venue?: string | null
          apt_date?: string | null
          source?: string | null
          bd?: string | null
          status?: string
          result?: string | null
          score?: number | null
          next_action?: string | null
          remarks?: string | null
          invite_sent?: boolean
          payment_done?: boolean
          payment_amt?: number
          payment_mode?: string | null
          payment_txn?: string | null
          payment_date?: string | null
          payment_verified_ai?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      aptitude_shares: {
        Row: {
          id: string
          lead_id: string | null
          student_id: string | null
          shared_by: string | null
          shared_at: string
          status: string
          score: number | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          lead_id?: string | null
          student_id?: string | null
          shared_by?: string | null
          shared_at?: string
          status?: string
          score?: number | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          lead_id?: string | null
          student_id?: string | null
          shared_by?: string | null
          shared_at?: string
          status?: string
          score?: number | null
          deleted_at?: string | null
        }
        Relationships: []
      }
      assessment_results: {
        Row: {
          id: string
          assessment_id: string
          student_id: string
          score: number | null
          status: Database['public']['Enums']['submission_status']
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          assessment_id: string
          student_id: string
          score?: number | null
          status?: Database['public']['Enums']['submission_status']
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          assessment_id?: string
          student_id?: string
          score?: number | null
          status?: Database['public']['Enums']['submission_status']
          created_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      assessments: {
        Row: {
          id: string
          batch_id: string | null
          title: string
          type: Database['public']['Enums']['assessment_type']
          total_marks: number | null
          scheduled_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          passing_marks: number | null
          duration_minutes: number | null
          topic: string | null
          description: string | null
        }
        Insert: {
          id?: string
          batch_id?: string | null
          title: string
          type?: Database['public']['Enums']['assessment_type']
          total_marks?: number | null
          scheduled_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          passing_marks?: number | null
          duration_minutes?: number | null
          topic?: string | null
          description?: string | null
        }
        Update: {
          id?: string
          batch_id?: string | null
          title?: string
          type?: Database['public']['Enums']['assessment_type']
          total_marks?: number | null
          scheduled_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          passing_marks?: number | null
          duration_minutes?: number | null
          topic?: string | null
          description?: string | null
        }
        Relationships: []
      }
      assignment_submissions: {
        Row: {
          id: string
          assignment_id: string
          student_id: string
          submitted_at: string | null
          score: number | null
          status: Database['public']['Enums']['submission_status']
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          assignment_id: string
          student_id: string
          submitted_at?: string | null
          score?: number | null
          status?: Database['public']['Enums']['submission_status']
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          assignment_id?: string
          student_id?: string
          submitted_at?: string | null
          score?: number | null
          status?: Database['public']['Enums']['submission_status']
          created_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      assignments: {
        Row: {
          id: string
          batch_id: string
          title: string
          description: string | null
          due_date: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          topic_id: string | null
        }
        Insert: {
          id?: string
          batch_id: string
          title: string
          description?: string | null
          due_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          topic_id?: string | null
        }
        Update: {
          id?: string
          batch_id?: string
          title?: string
          description?: string | null
          due_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          topic_id?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          id: string
          batch_id: string
          student_id: string
          date: string
          status: Database['public']['Enums']['attendance_status']
          marked_by: string | null
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          batch_id: string
          student_id: string
          date?: string
          status?: Database['public']['Enums']['attendance_status']
          marked_by?: string | null
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          batch_id?: string
          student_id?: string
          date?: string
          status?: Database['public']['Enums']['attendance_status']
          marked_by?: string | null
          created_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: string
          actor_id: string | null
          module: string | null
          action: string
          detail: string | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          module?: string | null
          action: string
          detail?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          module?: string | null
          action?: string
          detail?: string | null
          created_at?: string
        }
        Relationships: []
      }
      batches: {
        Row: {
          id: string
          course_id: string
          name: string
          trainer_id: string | null
          start_date: string | null
          end_date: string | null
          capacity: number | null
          progress: number
          status: Database['public']['Enums']['batch_status']
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          course_id: string
          name: string
          trainer_id?: string | null
          start_date?: string | null
          end_date?: string | null
          capacity?: number | null
          progress?: number
          status?: Database['public']['Enums']['batch_status']
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          course_id?: string
          name?: string
          trainer_id?: string | null
          start_date?: string | null
          end_date?: string | null
          capacity?: number | null
          progress?: number
          status?: Database['public']['Enums']['batch_status']
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          id: string
          date: string
          title: string
          time: string | null
          end_time: string | null
          type: string | null
          batch: string | null
          notes: string | null
          trainer_id: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          date: string
          title: string
          time?: string | null
          end_time?: string | null
          type?: string | null
          batch?: string | null
          notes?: string | null
          trainer_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          date?: string
          title?: string
          time?: string | null
          end_time?: string | null
          type?: string | null
          batch?: string | null
          notes?: string | null
          trainer_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      cert_requests: {
        Row: {
          id: string
          student_id: string
          type: string
          request_date: string
          status: string
          sent_date: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          batch_id: string | null
          notes: string | null
          certificate_id: string | null
          reviewed_by: string | null
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          student_id: string
          type: string
          request_date?: string
          status?: string
          sent_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          batch_id?: string | null
          notes?: string | null
          certificate_id?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          type?: string
          request_date?: string
          status?: string
          sent_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          batch_id?: string | null
          notes?: string | null
          certificate_id?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Relationships: []
      }
      courses: {
        Row: {
          id: string
          name: string
          code: string | null
          domain: string | null
          fee: number
          duration_weeks: number | null
          status: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          code?: string | null
          domain?: string | null
          fee?: number
          duration_weeks?: number | null
          status?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          code?: string | null
          domain?: string | null
          fee?: number
          duration_weeks?: number | null
          status?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          id: string
          name: string
          type: string | null
          owner_id: string | null
          related_type: string | null
          related_id: string | null
          file_url: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          type?: string | null
          owner_id?: string | null
          related_type?: string | null
          related_id?: string | null
          file_url?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          type?: string | null
          owner_id?: string | null
          related_type?: string | null
          related_id?: string | null
          file_url?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          id: string
          student_id: string
          batch_id: string
          status: Database['public']['Enums']['enrollment_status']
          progress: number
          enrolled_at: string | null
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          student_id: string
          batch_id: string
          status?: Database['public']['Enums']['enrollment_status']
          progress?: number
          enrolled_at?: string | null
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          batch_id?: string
          status?: Database['public']['Enums']['enrollment_status']
          progress?: number
          enrolled_at?: string | null
          created_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          id: string
          category: string
          amount: number
          spent_on: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          category: string
          amount?: number
          spent_on?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          category?: string
          amount?: number
          spent_on?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      followups: {
        Row: {
          id: string
          lead_id: string
          bd_id: string | null
          type: string | null
          outcome: string | null
          next_action: string | null
          scheduled_at: string
          status: Database['public']['Enums']['task_status']
          notes: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          lead_id: string
          bd_id?: string | null
          type?: string | null
          outcome?: string | null
          next_action?: string | null
          scheduled_at: string
          status?: Database['public']['Enums']['task_status']
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          lead_id?: string
          bd_id?: string | null
          type?: string | null
          outcome?: string | null
          next_action?: string | null
          scheduled_at?: string
          status?: Database['public']['Enums']['task_status']
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      internships: {
        Row: {
          id: string
          student_id: string
          company: string | null
          role: string | null
          mentor_id: string | null
          start_date: string | null
          end_date: string | null
          stipend: number | null
          status: Database['public']['Enums']['internship_status']
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          student_id: string
          company?: string | null
          role?: string | null
          mentor_id?: string | null
          start_date?: string | null
          end_date?: string | null
          stipend?: number | null
          status?: Database['public']['Enums']['internship_status']
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          company?: string | null
          role?: string | null
          mentor_id?: string | null
          start_date?: string | null
          end_date?: string | null
          stipend?: number | null
          status?: Database['public']['Enums']['internship_status']
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          invoice_no: string
          student_id: string | null
          project_id: string | null
          customer_name: string | null
          customer_phone: string | null
          amount: number
          status: Database['public']['Enums']['invoice_status']
          issued_date: string | null
          due_date: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          invoice_no: string
          student_id?: string | null
          project_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          amount?: number
          status?: Database['public']['Enums']['invoice_status']
          issued_date?: string | null
          due_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          invoice_no?: string
          student_id?: string | null
          project_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          amount?: number
          status?: Database['public']['Enums']['invoice_status']
          issued_date?: string | null
          due_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          id: string
          name: string
          mobile: string | null
          email: string | null
          college: string | null
          source: Database['public']['Enums']['lead_source']
          source_detail: string | null
          category: string | null
          type: string | null
          course_interest: string | null
          status: Database['public']['Enums']['lead_status']
          temperature: string | null
          assigned_bd: string | null
          next_followup_at: string | null
          enquiry_date: string | null
          interested_at: string | null
          demo_scheduled_at: string | null
          aptitude_shared_at: string | null
          enrolled_at: string | null
          notes: string | null
          remarks: string | null
          plan: string | null
          pathway: string | null
          pathway_details: Json
          fu_count: number
          place_city: string | null
          branch: string | null
          degree: string | null
          cgpa: number | null
          year_of_passing: number | null
          dob: string | null
          current_location: string | null
          graduation_status: string | null
          delete_requested: boolean
          delete_requested_by: string | null
          delete_requested_at: string | null
          updated_by: string | null
          updated_by_name: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          mobile?: string | null
          email?: string | null
          college?: string | null
          source?: Database['public']['Enums']['lead_source']
          source_detail?: string | null
          category?: string | null
          type?: string | null
          course_interest?: string | null
          status?: Database['public']['Enums']['lead_status']
          temperature?: string | null
          assigned_bd?: string | null
          next_followup_at?: string | null
          enquiry_date?: string | null
          interested_at?: string | null
          demo_scheduled_at?: string | null
          aptitude_shared_at?: string | null
          enrolled_at?: string | null
          notes?: string | null
          remarks?: string | null
          plan?: string | null
          pathway?: string | null
          pathway_details?: Json
          fu_count?: number
          place_city?: string | null
          branch?: string | null
          degree?: string | null
          cgpa?: number | null
          year_of_passing?: number | null
          dob?: string | null
          current_location?: string | null
          graduation_status?: string | null
          delete_requested?: boolean
          delete_requested_by?: string | null
          delete_requested_at?: string | null
          updated_by?: string | null
          updated_by_name?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          mobile?: string | null
          email?: string | null
          college?: string | null
          source?: Database['public']['Enums']['lead_source']
          source_detail?: string | null
          category?: string | null
          type?: string | null
          course_interest?: string | null
          status?: Database['public']['Enums']['lead_status']
          temperature?: string | null
          assigned_bd?: string | null
          next_followup_at?: string | null
          enquiry_date?: string | null
          interested_at?: string | null
          demo_scheduled_at?: string | null
          aptitude_shared_at?: string | null
          enrolled_at?: string | null
          notes?: string | null
          remarks?: string | null
          plan?: string | null
          pathway?: string | null
          pathway_details?: Json
          fu_count?: number
          place_city?: string | null
          branch?: string | null
          degree?: string | null
          cgpa?: number | null
          year_of_passing?: number | null
          dob?: string | null
          current_location?: string | null
          graduation_status?: string | null
          delete_requested?: boolean
          delete_requested_by?: string | null
          delete_requested_at?: string | null
          updated_by?: string | null
          updated_by_name?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      material_batches: {
        Row: {
          material_id: string
          batch_id: string
          created_at: string
        }
        Insert: {
          material_id: string
          batch_id: string
          created_at?: string
        }
        Update: {
          material_id?: string
          batch_id?: string
          created_at?: string
        }
        Relationships: []
      }
      material_views: {
        Row: {
          id: string
          material_id: string
          profile_id: string
          views: number
          downloads: number
          first_at: string
          last_at: string
        }
        Insert: {
          id?: string
          material_id: string
          profile_id: string
          views?: number
          downloads?: number
          first_at?: string
          last_at?: string
        }
        Update: {
          id?: string
          material_id?: string
          profile_id?: string
          views?: number
          downloads?: number
          first_at?: string
          last_at?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          id: string
          course_id: string | null
          batch_id: string | null
          title: string
          type: string | null
          file_url: string | null
          uploaded_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          topic_id: string | null
          file_size: number | null
          description: string | null
        }
        Insert: {
          id?: string
          course_id?: string | null
          batch_id?: string | null
          title: string
          type?: string | null
          file_url?: string | null
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          topic_id?: string | null
          file_size?: number | null
          description?: string | null
        }
        Update: {
          id?: string
          course_id?: string | null
          batch_id?: string | null
          title?: string
          type?: string | null
          file_url?: string | null
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          topic_id?: string | null
          file_size?: number | null
          description?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          body: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          body?: string | null
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          body?: string | null
          read?: boolean
          created_at?: string
        }
        Relationships: []
      }
      onboarding: {
        Row: {
          id: string
          student_id: string | null
          intern_name: string
          intern_id: string | null
          college: string | null
          role: string | null
          university_reg_no: string | null
          branch: string | null
          semester: string | null
          start_date: string | null
          end_date: string | null
          duration: string | null
          stipend: string | null
          reporting_manager: string | null
          acceptance_deadline: string | null
          token: string
          status: string
          accepted_name: string | null
          accepted_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          student_id?: string | null
          intern_name: string
          intern_id?: string | null
          college?: string | null
          role?: string | null
          university_reg_no?: string | null
          branch?: string | null
          semester?: string | null
          start_date?: string | null
          end_date?: string | null
          duration?: string | null
          stipend?: string | null
          reporting_manager?: string | null
          acceptance_deadline?: string | null
          token: string
          status?: string
          accepted_name?: string | null
          accepted_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          student_id?: string | null
          intern_name?: string
          intern_id?: string | null
          college?: string | null
          role?: string | null
          university_reg_no?: string | null
          branch?: string | null
          semester?: string | null
          start_date?: string | null
          end_date?: string | null
          duration?: string | null
          stipend?: string | null
          reporting_manager?: string | null
          acceptance_deadline?: string | null
          token?: string
          status?: string
          accepted_name?: string | null
          accepted_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      placements: {
        Row: {
          id: string
          student_id: string
          company: string | null
          role: string | null
          package: number | null
          ctc: number | null
          offer_date: string | null
          join_date: string | null
          status: Database['public']['Enums']['placement_status']
          placed_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          student_id: string
          company?: string | null
          role?: string | null
          package?: number | null
          ctc?: number | null
          offer_date?: string | null
          join_date?: string | null
          status?: Database['public']['Enums']['placement_status']
          placed_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          company?: string | null
          role?: string | null
          package?: number | null
          ctc?: number | null
          offer_date?: string | null
          join_date?: string | null
          status?: Database['public']['Enums']['placement_status']
          placed_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          role: Database['public']['Enums']['user_role']
          role_key: string | null
          department: string | null
          phone: string | null
          avatar_url: string | null
          employee_id: string | null
          place: string | null
          bio: string | null
          status: string
          last_login_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          full_name: string
          email: string
          role?: Database['public']['Enums']['user_role']
          role_key?: string | null
          department?: string | null
          phone?: string | null
          avatar_url?: string | null
          employee_id?: string | null
          place?: string | null
          bio?: string | null
          status?: string
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          role?: Database['public']['Enums']['user_role']
          role_key?: string | null
          department?: string | null
          phone?: string | null
          avatar_url?: string | null
          employee_id?: string | null
          place?: string | null
          bio?: string | null
          status?: string
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          key: string
          label: string
          base: string
          is_builtin: boolean
          sort: number
          created_at: string
        }
        Insert: {
          key: string
          label: string
          base: string
          is_builtin?: boolean
          sort?: number
          created_at?: string
        }
        Update: {
          key?: string
          label?: string
          base?: string
          is_builtin?: boolean
          sort?: number
          created_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          name: string
          client: string | null
          status: string
          notes: string | null
          owner_id: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          entry_date: string | null
          source: string | null
          category: string | null
          mobile: string | null
          department: string | null
          college: string | null
          response: string | null
          remarks: string | null
          vendor_name: string | null
          vendor_cost: number | null
          vendor2_name: string | null
          vendor2_cost: number | null
          company_cost: number | null
          project_name: string | null
          amount_paid: number | null
          delete_requested: boolean
          delete_requested_by: string | null
          delete_requested_at: string | null
          referral_deduction: number | null
          temperature: string | null
          updated_by: string | null
          updated_by_name: string | null
        }
        Insert: {
          id?: string
          name: string
          client?: string | null
          status?: string
          notes?: string | null
          owner_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          entry_date?: string | null
          source?: string | null
          category?: string | null
          mobile?: string | null
          department?: string | null
          college?: string | null
          response?: string | null
          remarks?: string | null
          vendor_name?: string | null
          vendor_cost?: number | null
          vendor2_name?: string | null
          vendor2_cost?: number | null
          company_cost?: number | null
          project_name?: string | null
          amount_paid?: number | null
          delete_requested?: boolean
          delete_requested_by?: string | null
          delete_requested_at?: string | null
          referral_deduction?: number | null
          temperature?: string | null
          updated_by?: string | null
          updated_by_name?: string | null
        }
        Update: {
          id?: string
          name?: string
          client?: string | null
          status?: string
          notes?: string | null
          owner_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          entry_date?: string | null
          source?: string | null
          category?: string | null
          mobile?: string | null
          department?: string | null
          college?: string | null
          response?: string | null
          remarks?: string | null
          vendor_name?: string | null
          vendor_cost?: number | null
          vendor2_name?: string | null
          vendor2_cost?: number | null
          company_cost?: number | null
          project_name?: string | null
          amount_paid?: number | null
          delete_requested?: boolean
          delete_requested_by?: string | null
          delete_requested_at?: string | null
          referral_deduction?: number | null
          temperature?: string | null
          updated_by?: string | null
          updated_by_name?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          id: string
          name: string
          type: string
          batch_id: string | null
          date_from: string | null
          date_to: string | null
          generated_by: string | null
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          type: string
          batch_id?: string | null
          date_from?: string | null
          date_to?: string | null
          generated_by?: string | null
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          type?: string
          batch_id?: string | null
          date_from?: string | null
          date_to?: string | null
          generated_by?: string | null
          created_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      revenue: {
        Row: {
          id: string
          rev_key: string
          apt_key: string | null
          student_id: string | null
          txn_id: string | null
          txn: string | null
          inv_no: string | null
          no_invoice: boolean
          plan: string | null
          date: string
          payment_date: string | null
          due_date: string | null
          name: string
          phone: string | null
          email: string | null
          college: string | null
          program: string | null
          amt: number
          total_amt: number
          received_amount: number
          pending_amount: number
          pending_amt: number
          deductions: number
          base: number
          gst: number
          mode: string | null
          src: string | null
          status: string | null
          bd: string | null
          verified: string
          fingerprint: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          rev_key: string
          apt_key?: string | null
          student_id?: string | null
          txn_id?: string | null
          txn?: string | null
          inv_no?: string | null
          no_invoice?: boolean
          plan?: string | null
          date?: string
          payment_date?: string | null
          due_date?: string | null
          name: string
          phone?: string | null
          email?: string | null
          college?: string | null
          program?: string | null
          amt?: number
          total_amt?: number
          received_amount?: number
          pending_amount?: number
          pending_amt?: number
          deductions?: number
          base?: number
          gst?: number
          mode?: string | null
          src?: string | null
          status?: string | null
          bd?: string | null
          verified?: string
          fingerprint?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          rev_key?: string
          apt_key?: string | null
          student_id?: string | null
          txn_id?: string | null
          txn?: string | null
          inv_no?: string | null
          no_invoice?: boolean
          plan?: string | null
          date?: string
          payment_date?: string | null
          due_date?: string | null
          name?: string
          phone?: string | null
          email?: string | null
          college?: string | null
          program?: string | null
          amt?: number
          total_amt?: number
          received_amount?: number
          pending_amount?: number
          pending_amt?: number
          deductions?: number
          base?: number
          gst?: number
          mode?: string | null
          src?: string | null
          status?: string | null
          bd?: string | null
          verified?: string
          fingerprint?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      storage_objects: {
        Row: {
          bucket: string
          key: string
          mime: string
          size: number
          data: string
          created_at: string
          updated_at: string
        }
        Insert: {
          bucket: string
          key: string
          mime?: string
          size: number
          data: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          bucket?: string
          key?: string
          mime?: string
          size?: number
          data?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_assessments: {
        Row: {
          id: string
          student_id: string
          date: string
          topic: string | null
          score: number | null
          result: string | null
          remarks: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          student_id: string
          date?: string
          topic?: string | null
          score?: number | null
          result?: string | null
          remarks?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          date?: string
          topic?: string | null
          score?: number | null
          result?: string | null
          remarks?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      student_notes: {
        Row: {
          id: string
          student_id: string
          note: string
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          student_id: string
          note: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          note?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          id: string
          profile_id: string | null
          source_lead: string | null
          full_name: string
          email: string | null
          mobile: string | null
          primary_course: string | null
          track: string | null
          program: string | null
          batch_name: string | null
          trainer_name: string | null
          intern_id: string | null
          college: string | null
          semester: string | null
          status: string
          avatar_url: string | null
          joined_at: string | null
          dob: string | null
          degree: string | null
          branch: string | null
          cgpa: number | null
          passing_year: number | null
          year_of_passing: number | null
          place_city: string | null
          current_location: string | null
          permanent_location: string | null
          graduation_status: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          guardian_name: string | null
          guardian_mobile: string | null
          about: string | null
        }
        Insert: {
          id?: string
          profile_id?: string | null
          source_lead?: string | null
          full_name: string
          email?: string | null
          mobile?: string | null
          primary_course?: string | null
          track?: string | null
          program?: string | null
          batch_name?: string | null
          trainer_name?: string | null
          intern_id?: string | null
          college?: string | null
          semester?: string | null
          status?: string
          avatar_url?: string | null
          joined_at?: string | null
          dob?: string | null
          degree?: string | null
          branch?: string | null
          cgpa?: number | null
          passing_year?: number | null
          year_of_passing?: number | null
          place_city?: string | null
          current_location?: string | null
          permanent_location?: string | null
          graduation_status?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          guardian_name?: string | null
          guardian_mobile?: string | null
          about?: string | null
        }
        Update: {
          id?: string
          profile_id?: string | null
          source_lead?: string | null
          full_name?: string
          email?: string | null
          mobile?: string | null
          primary_course?: string | null
          track?: string | null
          program?: string | null
          batch_name?: string | null
          trainer_name?: string | null
          intern_id?: string | null
          college?: string | null
          semester?: string | null
          status?: string
          avatar_url?: string | null
          joined_at?: string | null
          dob?: string | null
          degree?: string | null
          branch?: string | null
          cgpa?: number | null
          passing_year?: number | null
          year_of_passing?: number | null
          place_city?: string | null
          current_location?: string | null
          permanent_location?: string | null
          graduation_status?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          guardian_name?: string | null
          guardian_mobile?: string | null
          about?: string | null
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          id: string
          actor_id: string | null
          action: string
          entity: string | null
          entity_id: string | null
          meta: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          action: string
          entity?: string | null
          entity_id?: string | null
          meta?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          action?: string
          entity?: string | null
          entity_id?: string | null
          meta?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      marketing_business_units: {
        Row: { key: string; label: string; active: boolean; sort: number; created_at: string }
        Insert: { key: string; label: string; active?: boolean; sort?: number; created_at?: string }
        Update: { key?: string; label?: string; active?: boolean; sort?: number; created_at?: string }
        Relationships: []
      }
      marketing_platforms: {
        Row: { key: string; label: string; active: boolean; sort: number; created_at: string }
        Insert: { key: string; label: string; active?: boolean; sort?: number; created_at?: string }
        Update: { key?: string; label?: string; active?: boolean; sort?: number; created_at?: string }
        Relationships: []
      }
      marketing_task_files: {
        Row: { id: string; task_id: string; file_url: string; file_name: string; mime_type: string | null; file_size: number | null; uploaded_by: string | null; created_at: string; deleted_at: string | null }
        Insert: { id?: string; task_id: string; file_url: string; file_name: string; mime_type?: string | null; file_size?: number | null; uploaded_by?: string | null; created_at?: string; deleted_at?: string | null }
        Update: { id?: string; task_id?: string; file_url?: string; file_name?: string; mime_type?: string | null; file_size?: number | null; uploaded_by?: string | null; created_at?: string; deleted_at?: string | null }
        Relationships: []
      }
      marketing_task_activity: {
        Row: { id: string; task_id: string; actor_id: string | null; action: string; from_status: string | null; to_status: string | null; details: string | null; created_at: string }
        Insert: { id?: string; task_id: string; actor_id?: string | null; action: string; from_status?: string | null; to_status?: string | null; details?: string | null; created_at?: string }
        Update: { id?: string; task_id?: string; actor_id?: string | null; action?: string; from_status?: string | null; to_status?: string | null; details?: string | null; created_at?: string }
        Relationships: []
      }
      marketing_social_snapshots: {
        Row: { id: string; employee_id: string; platform: string; business_unit: string | null; snapshot_date: string; follower_count: number; community_count: number; notes: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; employee_id: string; platform: string; business_unit?: string | null; snapshot_date: string; follower_count: number; community_count?: number; notes?: string | null; created_by?: string | null; created_at?: string }
        Update: { id?: string; employee_id?: string; platform?: string; business_unit?: string | null; snapshot_date?: string; follower_count?: number; community_count?: number; notes?: string | null; created_by?: string | null; created_at?: string }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          title: string
          marketing_type: string | null
          marketing_status: string
          business_unit: string | null
          platform: string | null
          campaign_name: string | null
          work_url: string | null
          proof_file_url: string | null
          proof_file_name: string | null
          deliverable_count: number
          follower_start: number | null
          follower_end: number | null
          target_value: number | null
          actual_value: number | null
          budget: number | null
          notes: string | null
          assigned_at: string
          submitted_at: string | null
          approved_at: string | null
          published_at: string | null
          approved_by: string | null
          assigned_to: string | null
          related_type: string | null
          related_id: string | null
          batch_id: string | null
          due_date: string | null
          status: Database['public']['Enums']['task_status']
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          description: string | null
          priority: Database['public']['Enums']['task_priority']
        }
        Insert: {
          id?: string
          title: string
          marketing_type?: string | null
          marketing_status?: string
          business_unit?: string | null
          platform?: string | null
          campaign_name?: string | null
          work_url?: string | null
          proof_file_url?: string | null
          proof_file_name?: string | null
          deliverable_count?: number
          follower_start?: number | null
          follower_end?: number | null
          target_value?: number | null
          actual_value?: number | null
          budget?: number | null
          notes?: string | null
          assigned_at?: string
          submitted_at?: string | null
          approved_at?: string | null
          published_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          related_type?: string | null
          related_id?: string | null
          batch_id?: string | null
          due_date?: string | null
          status?: Database['public']['Enums']['task_status']
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          description?: string | null
          priority?: Database['public']['Enums']['task_priority']
        }
        Update: {
          id?: string
          title?: string
          marketing_type?: string | null
          marketing_status?: string
          business_unit?: string | null
          platform?: string | null
          campaign_name?: string | null
          work_url?: string | null
          proof_file_url?: string | null
          proof_file_name?: string | null
          deliverable_count?: number
          follower_start?: number | null
          follower_end?: number | null
          target_value?: number | null
          actual_value?: number | null
          budget?: number | null
          notes?: string | null
          assigned_at?: string
          submitted_at?: string | null
          approved_at?: string | null
          published_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          related_type?: string | null
          related_id?: string | null
          batch_id?: string | null
          due_date?: string | null
          status?: Database['public']['Enums']['task_status']
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          description?: string | null
          priority?: Database['public']['Enums']['task_priority']
        }
        Relationships: []
      }
      topics: {
        Row: {
          id: string
          date: string
          topic: string
          description: string | null
          batch: string | null
          trainer_id: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          batch_id: string | null
          covered: string[] | null
          notes: string | null
          status: string
        }
        Insert: {
          id?: string
          date?: string
          topic: string
          description?: string | null
          batch?: string | null
          trainer_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          batch_id?: string | null
          covered?: string[] | null
          notes?: string | null
          status?: string
        }
        Update: {
          id?: string
          date?: string
          topic?: string
          description?: string | null
          batch?: string | null
          trainer_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          batch_id?: string | null
          covered?: string[] | null
          notes?: string | null
          status?: string
        }
        Relationships: []
      }
      trainer_assignments: {
        Row: {
          id: string
          student_id: string
          course_id: string | null
          trainer_id: string | null
          trainer_name: string | null
          assigned_by: string | null
          assigned_at: string | null
          start_date: string | null
          end_date: string | null
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          student_id: string
          course_id?: string | null
          trainer_id?: string | null
          trainer_name?: string | null
          assigned_by?: string | null
          assigned_at?: string | null
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          course_id?: string | null
          trainer_id?: string | null
          trainer_name?: string | null
          assigned_by?: string | null
          assigned_at?: string | null
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      user_activity: {
        Row: {
          id: string
          user_id: string
          day: string
          status: string
          login_at: string
          last_seen: string
          active_ms: number
          idle_ms: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          day?: string
          status?: string
          login_at?: string
          last_seen?: string
          active_ms?: number
          idle_ms?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          day?: string
          status?: string
          login_at?: string
          last_seen?: string
          active_ms?: number
          idle_ms?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      admin_create_role: {
        Args: { p_key: string; p_label: string; p_base: string }
        Returns: Database['public']['Tables']['roles']['Row']
      }
      admin_delete_role: {
        Args: { p_key: string }
        Returns: undefined
      }
      armor: {
        Args: Record<string, never>
        Returns: string
      }
      auth_consume_refresh_token: {
        Args: { p_token: string }
        Returns: Json
      }
      auth_create_user: {
        Args: { p_email: string; p_password: string; p_full_name: string; p_role: string }
        Returns: Json
      }
      auth_delete_user: {
        Args: { p_id: string }
        Returns: boolean
      }
      auth_get_user: {
        Args: { p_id: string }
        Returns: Json
      }
      auth_issue_refresh_token: {
        Args: { p_user: string }
        Returns: string
      }
      auth_revoke_user_tokens: {
        Args: { p_user: string }
        Returns: number
      }
      auth_role: {
        Args: Record<string, never>
        Returns: Database['public']['Enums']['user_role']
      }
      auth_set_password: {
        Args: { p_email: string; p_password: string }
        Returns: boolean
      }
      auth_sign_in: {
        Args: { p_email: string; p_password: string }
        Returns: Json
      }
      auth_user_json: {
        Args: { u: unknown }
        Returns: Json
      }
      citext: {
        Args: Record<string, never>
        Returns: string
      }
      citext_cmp: {
        Args: Record<string, never>
        Returns: number
      }
      citext_eq: {
        Args: Record<string, never>
        Returns: boolean
      }
      citext_ge: {
        Args: Record<string, never>
        Returns: boolean
      }
      citext_gt: {
        Args: Record<string, never>
        Returns: boolean
      }
      citext_hash: {
        Args: Record<string, never>
        Returns: number
      }
      citext_hash_extended: {
        Args: Record<string, never>
        Returns: number
      }
      citext_larger: {
        Args: Record<string, never>
        Returns: string
      }
      citext_le: {
        Args: Record<string, never>
        Returns: boolean
      }
      citext_lt: {
        Args: Record<string, never>
        Returns: boolean
      }
      citext_ne: {
        Args: Record<string, never>
        Returns: boolean
      }
      citext_pattern_cmp: {
        Args: Record<string, never>
        Returns: number
      }
      citext_pattern_ge: {
        Args: Record<string, never>
        Returns: boolean
      }
      citext_pattern_gt: {
        Args: Record<string, never>
        Returns: boolean
      }
      citext_pattern_le: {
        Args: Record<string, never>
        Returns: boolean
      }
      citext_pattern_lt: {
        Args: Record<string, never>
        Returns: boolean
      }
      citext_smaller: {
        Args: Record<string, never>
        Returns: string
      }
      citextin: {
        Args: Record<string, never>
        Returns: string
      }
      citextout: {
        Args: Record<string, never>
        Returns: unknown
      }
      citextrecv: {
        Args: Record<string, never>
        Returns: string
      }
      citextsend: {
        Args: Record<string, never>
        Returns: string
      }
      crypt: {
        Args: Record<string, never>
        Returns: string
      }
      dearmor: {
        Args: Record<string, never>
        Returns: string
      }
      decrypt: {
        Args: Record<string, never>
        Returns: string
      }
      decrypt_iv: {
        Args: Record<string, never>
        Returns: string
      }
      digest: {
        Args: Record<string, never>
        Returns: string
      }
      encrypt: {
        Args: Record<string, never>
        Returns: string
      }
      encrypt_iv: {
        Args: Record<string, never>
        Returns: string
      }
      fips_mode: {
        Args: Record<string, never>
        Returns: boolean
      }
      gen_random_bytes: {
        Args: Record<string, never>
        Returns: string
      }
      gen_random_uuid: {
        Args: Record<string, never>
        Returns: string
      }
      gen_salt: {
        Args: Record<string, never>
        Returns: string
      }
      handle_new_user: {
        Args: Record<string, never>
        Returns: unknown
      }
      hmac: {
        Args: Record<string, never>
        Returns: string
      }
      is_staff: {
        Args: Record<string, never>
        Returns: boolean
      }
      lead_stats: {
        Args: { p_bd: string }
        Returns: Json
      }
      owns_assessment: {
        Args: { p_assessment: string }
        Returns: boolean
      }
      owns_assignment: {
        Args: { p_assignment: string }
        Returns: boolean
      }
      owns_batch: {
        Args: { p_batch: string }
        Returns: boolean
      }
      owns_student: {
        Args: { p_student: string }
        Returns: boolean
      }
      pgp_armor_headers: {
        Args: Record<string, never>
        Returns: unknown
      }
      pgp_key_id: {
        Args: Record<string, never>
        Returns: string
      }
      pgp_pub_decrypt: {
        Args: Record<string, never>
        Returns: string
      }
      pgp_pub_decrypt_bytea: {
        Args: Record<string, never>
        Returns: string
      }
      pgp_pub_encrypt: {
        Args: Record<string, never>
        Returns: string
      }
      pgp_pub_encrypt_bytea: {
        Args: Record<string, never>
        Returns: string
      }
      pgp_sym_decrypt: {
        Args: Record<string, never>
        Returns: string
      }
      pgp_sym_decrypt_bytea: {
        Args: Record<string, never>
        Returns: string
      }
      pgp_sym_encrypt: {
        Args: Record<string, never>
        Returns: string
      }
      pgp_sym_encrypt_bytea: {
        Args: Record<string, never>
        Returns: string
      }
      record_material_view: {
        Args: { p_material: string; p_kind: string }
        Returns: unknown
      }
      regexp_match: {
        Args: { string: string; pattern: string }
        Returns: string[]
      }
      regexp_matches: {
        Args: { string: string; pattern: string; flags: string }
        Returns: string[]
      }
      regexp_replace: {
        Args: { string: string; pattern: string; replacement: string; flags: string }
        Returns: string
      }
      regexp_split_to_array: {
        Args: { string: string; pattern: string }
        Returns: string[]
      }
      regexp_split_to_table: {
        Args: { string: string; pattern: string }
        Returns: string
      }
      replace: {
        Args: Record<string, never>
        Returns: string
      }
      split_part: {
        Args: Record<string, never>
        Returns: string
      }
      strpos: {
        Args: Record<string, never>
        Returns: number
      }
      sync_lead_fu_count: {
        Args: Record<string, never>
        Returns: unknown
      }
      texticlike: {
        Args: Record<string, never>
        Returns: boolean
      }
      texticnlike: {
        Args: Record<string, never>
        Returns: boolean
      }
      texticregexeq: {
        Args: Record<string, never>
        Returns: boolean
      }
      texticregexne: {
        Args: Record<string, never>
        Returns: boolean
      }
      touch_updated_at: {
        Args: Record<string, never>
        Returns: unknown
      }
      translate: {
        Args: Record<string, never>
        Returns: string
      }
    }
    Enums: {
      assessment_type: 'quiz' | 'assignment' | 'mock_test' | 'exam' | 'aptitude'
      attendance_status: 'present' | 'absent' | 'late' | 'not_marked'
      batch_status: 'planned' | 'active' | 'completed' | 'cancelled'
      enrollment_status: 'active' | 'completed' | 'dropped'
      internship_status: 'ongoing' | 'completed' | 'dropped'
      invoice_status: 'paid' | 'pending' | 'overdue' | 'cancelled'
      lead_source: 'website' | 'college' | 'referral' | 'social_media' | 'walk_in' | 'just_dial' | 'skillfinity'
      lead_status: 'new' | 'contacted' | 'no_response' | 'interested' | 'demo_scheduled' | 'aptitude_shared' | 'passed' | 'enrolled' | 'irrelevant' | 'not_interested' | 'lost'
      placement_status: 'in_process' | 'offered' | 'placed' | 'declined'
      submission_status: 'pending' | 'submitted' | 'graded' | 'late'
      task_priority: 'low' | 'medium' | 'high'
      task_status: 'pending' | 'in_progress' | 'done' | 'cancelled'
      user_role: 'super_admin' | 'admin' | 'bd' | 'counsellor' | 'trainer' | 'student'
    }
    CompositeTypes: Record<string, never>
  }
}

/** Row shape of a table, e.g. Row<'projects'>. */
export type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Insert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Update<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
/** A database enum's allowed values, e.g. Enum<'lead_status'>. */
export type Enum<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
