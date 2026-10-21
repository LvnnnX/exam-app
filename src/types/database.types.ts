
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admins": {
                  Row: {
                    "created_at": string,"id": string,"rejection_reason": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"role": string,"status": string,"updated_at": string,"user_id": string,"username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"rejection_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"role": string,"status"?: string,"updated_at"?: string,"user_id": string,"username": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"rejection_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"role"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string,"username"?: string
                  }
                  Relationships: [
                    
                  ]
                },"answers": {
                  Row: {
                    "answered_at": string,"id": string,"is_correct": boolean,"player_id": string,"question_id": number,"time_taken": number,"user_answer": string | null,"violation_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "answered_at"?: string,"id"?: string,"is_correct"?: boolean,"player_id": string,"question_id": number,"time_taken"?: number,"user_answer"?: string | null,"violation_count"?: number
                  }
                  Update: {
                    "answered_at"?: string,"id"?: string,"is_correct"?: boolean,"player_id"?: string,"question_id"?: number,"time_taken"?: number,"user_answer"?: string | null,"violation_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "answers_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"chapters": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"slug": string,"sort_order": number,"subject_id": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"slug": string,"sort_order"?: number,"subject_id": string,"visibility"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"slug"?: string,"sort_order"?: number,"subject_id"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chapters_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    }
                  ]
                },"exam_answers": {
                  Row: {
                    "answered_at": string,"id": string,"is_correct": boolean,"is_marked_doubtful": boolean,"order_index": number,"question_id": number,"session_id": string,"time_taken": number,"user_answer": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "answered_at"?: string,"id"?: string,"is_correct"?: boolean,"is_marked_doubtful"?: boolean,"order_index": number,"question_id": number,"session_id": string,"time_taken"?: number,"user_answer"?: string | null
                  }
                  Update: {
                    "answered_at"?: string,"id"?: string,"is_correct"?: boolean,"is_marked_doubtful"?: boolean,"order_index"?: number,"question_id"?: number,"session_id"?: string,"time_taken"?: number,"user_answer"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_answers_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "exam_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"exam_sessions": {
                  Row: {
                    "created_at": string,"current_index": number,"duration_seconds": number | null,"end_time": string | null,"expires_at": string,"id": string,"lives": number,"mode": string,"name": string,"nav_mode": string,"question_order": (number)[],"score": number,"secret_hash": string | null,"selected_categories": NonNullable<Json>,"start_time": string,"status": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"current_index"?: number,"duration_seconds"?: number | null,"end_time"?: string | null,"expires_at"?: string,"id"?: string,"lives"?: number,"mode": string,"name": string,"nav_mode"?: string,"question_order"?: (number)[],"score"?: number,"secret_hash"?: string | null,"selected_categories"?: NonNullable<Json>,"start_time"?: string,"status"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"current_index"?: number,"duration_seconds"?: number | null,"end_time"?: string | null,"expires_at"?: string,"id"?: string,"lives"?: number,"mode"?: string,"name"?: string,"nav_mode"?: string,"question_order"?: (number)[],"score"?: number,"secret_hash"?: string | null,"selected_categories"?: NonNullable<Json>,"start_time"?: string,"status"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"players": {
                  Row: {
                    "current_index": number,"finished_at": string | null,"id": string,"joined_at": string,"name": string,"question_order": (number)[],"quiz_id": string,"score": number,"skin": string | null,"total_time": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "current_index"?: number,"finished_at"?: string | null,"id"?: string,"joined_at"?: string,"name": string,"question_order"?: (number)[],"quiz_id": string,"score"?: number,"skin"?: string | null,"total_time"?: number,"user_id"?: string | null
                  }
                  Update: {
                    "current_index"?: number,"finished_at"?: string | null,"id"?: string,"joined_at"?: string,"name"?: string,"question_order"?: (number)[],"quiz_id"?: string,"score"?: number,"skin"?: string | null,"total_time"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "players_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    }
                  ]
                },"question_topics": {
                  Row: {
                    "created_at": string,"question_id": number,"topic_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"question_id": number,"topic_id": string
                  }
                  Update: {
                    "created_at"?: string,"question_id"?: number,"topic_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_topics_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_topics_topic_id_fkey"
      columns: ["topic_id"]
isOneToOne: false
      referencedRelation: "topics"
      referencedColumns: ["id"]
    }
                  ]
                },"questions": {
                  Row: {
                    "answer_key": string,"archived_at": string | null,"body_html": string,"created_at": string,"created_by": string | null,"explanation_html": string | null,"id": number,"options": NonNullable<Json>,"type": string,"updated_at": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer_key": string,"archived_at"?: string | null,"body_html": string,"created_at"?: string,"created_by"?: string | null,"explanation_html"?: string | null,"id": number,"options"?: NonNullable<Json>,"type": string,"updated_at"?: string,"visibility"?: string
                  }
                  Update: {
                    "answer_key"?: string,"archived_at"?: string | null,"body_html"?: string,"created_at"?: string,"created_by"?: string | null,"explanation_html"?: string | null,"id"?: number,"options"?: NonNullable<Json>,"type"?: string,"updated_at"?: string,"visibility"?: string
                  }
                  Relationships: [
                    
                  ]
                },"quiz_questions": {
                  Row: {
                    "id": string,"order_index": number,"question_id": number,"quiz_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"order_index": number,"question_id": number,"quiz_id": string
                  }
                  Update: {
                    "id"?: string,"order_index"?: number,"question_id"?: number,"quiz_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_questions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_questions_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    }
                  ]
                },"quizzes": {
                  Row: {
                    "code": string,"config": NonNullable<Json>,"created_at": string,"created_by": string | null,"expires_at": string | null,"finished_at": string | null,"id": string,"paused_at": string | null,"scheduled_at": string | null,"started_at": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"config"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"finished_at"?: string | null,"id"?: string,"paused_at"?: string | null,"scheduled_at"?: string | null,"started_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"config"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"finished_at"?: string | null,"id"?: string,"paused_at"?: string | null,"scheduled_at"?: string | null,"started_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"subjects": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"slug": string,"sort_order": number,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"slug": string,"sort_order"?: number,"visibility"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"slug"?: string,"sort_order"?: number,"visibility"?: string
                  }
                  Relationships: [
                    
                  ]
                },"topics": {
                  Row: {
                    "chapter_id": string,"created_at": string,"id": string,"name": string,"slug": string,"sort_order": number,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chapter_id": string,"created_at"?: string,"id"?: string,"name": string,"slug": string,"sort_order"?: number,"visibility"?: string
                  }
                  Update: {
                    "chapter_id"?: string,"created_at"?: string,"id"?: string,"name"?: string,"slug"?: string,"sort_order"?: number,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "topics_chapter_id_fkey"
      columns: ["chapter_id"]
isOneToOne: false
      referencedRelation: "chapters"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "activate_scheduled_exams":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"auto_start_scheduled_quizzes":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"check_admin_login_allowed":
{ Args: { "p_identifier": string,"p_ip_hash": string }; Returns: boolean
                           },
"check_answer":
{ Args: { "p_answer_text": string,"p_question_id": number }; Returns: boolean
                           },
"check_is_active_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"check_is_super_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"check_session_answer":
{ Args: { "p_answer_text": string,"p_index": number,"p_session_id": string }; Returns: boolean
                           },
"cleanup_expired_sessions":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"close_expired_scheduled_exams":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"consume_rate_limit":
{ Args: { "p_key": string,"p_limit": number,"p_window_ms": number }; Returns: boolean
                           },
"create_scheduled_exam":
{ Args: { "p_access_code": string,"p_attempt_mode": string,"p_babs": (string)[],"p_created_by": string,"p_mapels": (string)[],"p_mode": string,"p_nav_mode"?: string,"p_question_count": number,"p_question_ids"?: (number)[],"p_sub_bab_percentages"?: Json,"p_sub_babs": (string)[],"p_time_limit_minutes": number,"p_title": string,"p_window_end": string,"p_window_start": string }; Returns: string
                           },
"current_admin_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"dearmor":
{ Args: { "": string }; Returns: string
                           },
"finalize_scheduled_exam_attempt":
{ Args: { "p_recap": Json,"p_score": number,"p_session_id": string }; Returns: undefined
                           },
"finish_player_quiz_rpc":
{ Args: { "p_player_id": string }; Returns: undefined
                           },
"flag_shared_ip_clusters":
{ Args: { "p_kuis_id": string }; Returns: {
              "ip_hash": string,"player_count": number,"player_ids": (string)[],"player_names": (string)[]
            }[]
                           },
"flag_suspicious_attempts":
{ Args: { "p_min_answers"?: number,"p_threshold_ms"?: number }; Returns: {
              "answers": number,"avg_time_ms": number,"device_fingerprint": string,"ip_hash": string,"kuis_id": string,"player_id": string,"player_name": string,"score": number
            }[]
                           },
"gen_random_uuid":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"gen_salt":
{ Args: { "": string }; Returns: string
                           },
"get_analytics_summary":
{ Args: { "p_end_date": string,"p_mode"?: string,"p_start_date": string }; Returns: Json
                           },
"get_analytics_summary_filtered":
{ Args: { "p_babs"?: (string)[],"p_end_date": string,"p_mapels"?: (string)[],"p_mode"?: string,"p_start_date": string,"p_sub_babs"?: (string)[] }; Returns: Json
                           },
"get_distinct_babs":
{ Args: { "p_mapels"?: (string)[] }; Returns: {
              "value": string
            }[]
                           },
"get_distinct_mapels":
{ Args: Record<PropertyKey, never>; Returns: {
              "value": string
            }[]
                           },
"get_distinct_sub_babs":
{ Args: { "p_babs"?: (string)[] }; Returns: {
              "value": string
            }[]
                           },
"get_horse_skin_options":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"get_live_quiz_question":
{ Args: { "p_index": number,"p_player_id": string }; Returns: Json
                           } |
{ Args: { "p_index": number,"p_player_id": string,"p_secret"?: string }; Returns: Json
                           },
"get_participant_statistics":
{ Args: { "p_end_date": string,"p_mode"?: string,"p_start_date": string }; Returns: {
              "attempts": number,"avg_score": number,"participant_key": string,"participant_name": string,"total_questions_answered": number,"total_questions_wrong": number
            }[]
                           },
"get_player_question_ids_admin":
{ Args: { "p_player_id": string }; Returns: (number)[]
                           },
"get_scheduled_exam":
{ Args: { "p_access_code": string }; Returns: Json
                           },
"get_scheduled_exam_recap":
{ Args: { "p_session_id": string }; Returns: Json
                           },
"get_server_now":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_server_time":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"get_session_question":
{ Args: { "p_index": number,"p_session_id": string }; Returns: {
              "babs": (string)[],"id": number,"mapels": (string)[],"option_a": string,"option_b": string,"option_c": string,"option_d": string,"option_e": string,"question_text": string,"question_type": string,"sub_babs": (string)[]
            }[]
                           },
"get_session_state":
{ Args: { "p_session_id": string }; Returns: {
              "bab": string,"current_index": number,"expires_at": string,"is_finished": boolean,"lives": number,"mode": string,"name": string,"question_count": number,"sub_bab": string,"user_answers": Json
            }[]
                           },
"get_topic_statistics":
{ Args: { "p_end_date": string,"p_limit"?: number,"p_mode"?: string,"p_start_date": string }; Returns: {
              "accuracy": number,"attempts": number,"bab": string,"mapel": string,"sub_bab": string,"total_correct": number,"total_questions": number
            }[]
                           },
"is_admin":
{ Args: { "p_user_id"?: string }; Returns: boolean
                           },
"is_super_admin":
{ Args: { "p_user_id"?: string }; Returns: boolean
                           },
"is_valid_secret":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"join_live_quiz":
{ Args: { "p_name": string,"p_quiz_code": string }; Returns: Json
                           },
"log_admin_action":
{ Args: { "p_action": string,"p_payload"?: Json,"p_target_id"?: string,"p_target_type"?: string }; Returns: number
                           },
"normalize_slug":
{ Args: { "val": string }; Returns: string
                           },
"pgp_armor_headers":
{ Args: { "": string }; Returns: Record<string, unknown>[]
                           },
"pick_available_horse_skin":
{ Args: { "p_kuis_id": string }; Returns: string
                           },
"player_is_mine":
{ Args: { "p_player_id": string }; Returns: boolean
                           },
"publish_scheduled_exam":
{ Args: { "p_exam_id": string }; Returns: boolean
                           },
"purge_admin_login_attempts":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"purge_rate_limit_buckets":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"record_admin_login_attempt":
{ Args: { "p_identifier": string,"p_ip_hash": string,"p_success": boolean }; Returns: undefined
                           },
"refresh_daily_analytics":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"resolve_admin_login_email":
{ Args: { "p_username": string }; Returns: string
                           },
"rpc_finish_quiz_player":
{ Args: { "p_player_id": string }; Returns: Json
                           },
"rpc_get_available_categories":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"rpc_get_exam_question":
{ Args: { "p_index": number,"p_session_id": string }; Returns: Json
                           },
"rpc_get_exam_recap":
{ Args: { "p_session_id": string }; Returns: Json
                           },
"rpc_get_quiz_question":
{ Args: { "p_index": number,"p_player_id": string }; Returns: Json
                           },
"rpc_join_live_quiz":
{ Args: { "p_name": string,"p_quiz_code": string }; Returns: Json
                           },
"rpc_save_exam_answer":
{ Args: { "p_index": number,"p_is_doubtful"?: boolean,"p_session_id": string,"p_time_taken"?: number,"p_user_answer": string }; Returns: Json
                           },
"rpc_set_player_skin":
{ Args: { "p_player_id": string,"p_skin": string }; Returns: Json
                           },
"rpc_start_exam_session":
{ Args: { "p_count"?: number,"p_mode"?: string,"p_name": string,"p_nav_mode"?: string,"p_time_limit_minutes"?: number,"p_topic_ids": (string)[] }; Returns: Json
                           },
"rpc_submit_exam_session":
{ Args: { "p_session_id": string }; Returns: Json
                           },
"rpc_submit_quiz_answer":
{ Args: { "p_index": number,"p_player_id": string,"p_question_id": number,"p_time_taken"?: number,"p_user_answer": string }; Returns: Json
                           },
"save_session_answer":
{ Args: { "p_answer_text": string,"p_index": number,"p_session_id": string }; Returns: Json
                           } |
{ Args: { "p_answer_text": string,"p_index": number,"p_session_id": string,"p_user_agent"?: string }; Returns: Json
                           },
"seal_overdue_scheduled_exams":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"set_player_horse_skin":
{ Args: { "p_horse_skin": string,"p_player_id": string }; Returns: Json
                           },
"start_exam_session":
{ Args: { "p_babs": (string)[],"p_count": number,"p_mapels": (string)[],"p_mode": string,"p_name": string,"p_nav_mode"?: string,"p_secret"?: string,"p_sub_bab_percentages"?: Json,"p_sub_babs": (string)[],"p_time_limit_minutes"?: number,"p_user_agent"?: string }; Returns: Json
                           },
"start_scheduled_exam":
{ Args: { "p_access_code": string,"p_name": string,"p_secret"?: string,"p_user_agent"?: string }; Returns: Json
                           },
"strip_html":
{ Args: { "html_text": string }; Returns: string
                           },
"submit_exam":
{ Args: { "p_answers": Json,"p_category": string,"p_end_time": string,"p_mode": string,"p_name": string,"p_question_count": number,"p_start_time": string }; Returns: number
                           },
"submit_live_quiz_answer_v2":
{ Args: { "p_index": number,"p_player_id": string,"p_question_id": number,"p_secret"?: string,"p_time_taken": number,"p_user_answer": string }; Returns: Json
                           },
"submit_quiz_answer":
{ Args: { "p_player_id": string,"p_question_id": number,"p_time_taken": number,"p_token": string,"p_user_answer": string }; Returns: Json
                           },
"submit_scheduled_exam_attempt":
{ Args: { "p_attempt_id": string,"p_secret"?: string }; Returns: Json
                           },
"submit_session_exam":
{ Args: { "p_answers": Json,"p_finalize_at": string,"p_session_id": string }; Returns: Json
                           } |
{ Args: { "p_end_time": string,"p_session_id": string }; Returns: Json
                           },
"test_assert":
{ Args: { "p_condition": boolean,"p_detail"?: string,"p_name": string }; Returns: undefined
                           },
"uuid_generate_v1":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_generate_v1mc":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_generate_v3":
{ Args: { "name": string,"namespace": string }; Returns: string
                           },
"uuid_generate_v4":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_generate_v5":
{ Args: { "name": string,"namespace": string }; Returns: string
                           },
"uuid_nil":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_ns_dns":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_ns_oid":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_ns_url":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_ns_x500":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"validate_exam_secret":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           } |
{ Args: { "p_secret"?: string }; Returns: boolean
                           }
          }
          Enums: {
            "admin_role": "super_admin"|"admin"|"teacher"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "admin_role": ["super_admin", "admin", "teacher"]
          }
        }
} as const
