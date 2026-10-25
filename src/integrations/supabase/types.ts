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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      assignments: {
        Row: {
          created_at: string
          created_by: string
          due_at: string | null
          id: string
          instructions: string | null
          subject_id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          due_at?: string | null
          id?: string
          instructions?: string | null
          subject_id: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          due_at?: string | null
          id?: string
          instructions?: string | null
          subject_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          duration_minutes: number
          id: string
          meeting_url: string | null
          scheduled_at: string
          subject_id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          duration_minutes?: number
          id?: string
          meeting_url?: string | null
          scheduled_at: string
          subject_id: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          meeting_url?: string | null
          scheduled_at?: string
          subject_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_completions: {
        Row: {
          completed_at: string
          lesson_id: string
          student_id: string
        }
        Insert: {
          completed_at?: string
          lesson_id: string
          student_id: string
        }
        Update: {
          completed_at?: string
          lesson_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_completions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          notes: string | null
          order_index: number
          subject_id: string
          title: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          notes?: string | null
          order_index?: number
          subject_id: string
          title: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          notes?: string | null
          order_index?: number
          subject_id?: string
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      parent_links: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          student_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          grade: number | null
          id: string
          invite_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          grade?: number | null
          id: string
          invite_code?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          grade?: number | null
          id?: string
          invite_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json
          id: string
          quiz_id: string
          score: number
          student_id: string
          submitted_at: string
          total_points: number
        }
        Insert: {
          answers: Json
          id?: string
          quiz_id: string
          score: number
          student_id: string
          submitted_at?: string
          total_points: number
        }
        Update: {
          answers?: Json
          id?: string
          quiz_id?: string
          score?: number
          student_id?: string
          submitted_at?: string
          total_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_index: number
          id: string
          options: Json
          order_index: number
          points: number
          question_text: string
          quiz_id: string
        }
        Insert: {
          correct_index: number
          id?: string
          options: Json
          order_index?: number
          points?: number
          question_text: string
          quiz_id: string
        }
        Update: {
          correct_index?: number
          id?: string
          options?: Json
          order_index?: number
          points?: number
          question_text?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          due_at: string | null
          id: string
          subject_id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          due_at?: string | null
          id?: string
          subject_id: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          due_at?: string | null
          id?: string
          subject_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          grade: number
          id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          grade: number
          id?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          grade?: number
          id?: string
          title?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          assignment_id: string
          content: string | null
          feedback: string | null
          file_path: string | null
          id: string
          reviewed_at: string | null
          score: number | null
          status: string
          student_id: string
          submitted_at: string
        }
        Insert: {
          assignment_id: string
          content?: string | null
          feedback?: string | null
          file_path?: string | null
          id?: string
          reviewed_at?: string | null
          score?: number | null
          status?: string
          student_id: string
          submitted_at?: string
        }
        Update: {
          assignment_id?: string
          content?: string | null
          feedback?: string | null
          file_path?: string | null
          id?: string
          reviewed_at?: string | null
          score?: number | null
          status?: string
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_quiz_questions: {
        Args: { _quiz_id: string }
        Returns: {
          id: string
          options: Json
          order_index: number
          points: number
          question_text: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_parent_by_code: { Args: { _code: string }; Returns: string }
    }
    Enums: {
      app_role: "student" | "teacher" | "admin" | "parent"
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
    Enums: {
      app_role: ["student", "teacher", "admin", "parent"],
    },
  },
} as const
