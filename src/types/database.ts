export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SkillCategory = "language" | "framework" | "concept" | "tool";
export type SkillStatus = "gap" | "learning" | "mastered";
export type SkillSource = "github" | "jd" | "manual";
export type InternshipStatus =
  | "preparing"
  | "applied"
  | "interview"
  | "offer"
  | "rejected";
export type SkillPriority = "must_have" | "nice_to_have";
export type ResourceSource =
  | "devto"
  | "stackoverflow"
  | "mdn"
  | "wikipedia"
  | "youtube"
  | "github";
export type TrackStatus = "active" | "completed" | "archived";
export type ModuleType =
  | "capstone_feature"
  | "microservice"
  | "language_native";
export type ModuleStatus = "locked" | "in_progress" | "completed";
export type ModuleContentStatus = "pending" | "ready" | "failed";
export type DigestSource = "devto" | "hackernews";
export type QuizSourceType = "note_cloze" | "module_drill";
export type InterviewCardSource = "lab_review" | "skill_gap" | "manual";
export type ConfidenceLevel = "confused" | "partial" | "ready";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          github_username: string | null;
          last_github_sync: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          github_username?: string | null;
          last_github_sync?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          github_username?: string | null;
          last_github_sync?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      skills: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          slug: string;
          category: SkillCategory;
          status: SkillStatus;
          mastery_score: number;
          source: SkillSource;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          slug: string;
          category: SkillCategory;
          status?: SkillStatus;
          mastery_score?: number;
          source: SkillSource;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          slug?: string;
          category?: SkillCategory;
          status?: SkillStatus;
          mastery_score?: number;
          source?: SkillSource;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "skills_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      target_internships: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          company_name: string;
          industry: string;
          raw_input: string;
          jargon_glossary: Json;
          status: InternshipStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          company_name?: string;
          industry?: string;
          raw_input: string;
          jargon_glossary?: Json;
          status?: InternshipStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          company_name?: string;
          industry?: string;
          raw_input?: string;
          jargon_glossary?: Json;
          status?: InternshipStatus;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "target_internships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      internship_skills: {
        Row: {
          internship_id: string;
          skill_id: string;
          priority: SkillPriority;
        };
        Insert: {
          internship_id: string;
          skill_id: string;
          priority: SkillPriority;
        };
        Update: {
          internship_id?: string;
          skill_id?: string;
          priority?: SkillPriority;
        };
        Relationships: [
          {
            foreignKeyName: "internship_skills_internship_id_fkey";
            columns: ["internship_id"];
            isOneToOne: false;
            referencedRelation: "target_internships";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "internship_skills_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
        ];
      };
      curated_resources: {
        Row: {
          id: string;
          skill_id: string;
          source: ResourceSource;
          title: string;
          url: string;
          summary: string;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          skill_id: string;
          source: ResourceSource;
          title: string;
          url: string;
          summary?: string;
          fetched_at?: string;
        };
        Update: {
          id?: string;
          skill_id?: string;
          source?: ResourceSource;
          title?: string;
          url?: string;
          summary?: string;
          fetched_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "curated_resources_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
        ];
      };
      learning_tracks: {
        Row: {
          id: string;
          user_id: string;
          internship_id: string | null;
          capstone_title: string;
          capstone_description: string;
          primary_stack: string;
          architecture_overview: string;
          status: TrackStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          internship_id?: string | null;
          capstone_title: string;
          capstone_description: string;
          primary_stack: string;
          architecture_overview: string;
          status?: TrackStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          internship_id?: string | null;
          capstone_title?: string;
          capstone_description?: string;
          primary_stack?: string;
          architecture_overview?: string;
          status?: TrackStatus;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_tracks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_tracks_internship_id_fkey";
            columns: ["internship_id"];
            isOneToOne: false;
            referencedRelation: "target_internships";
            referencedColumns: ["id"];
          },
        ];
      };
      track_modules: {
        Row: {
          id: string;
          track_id: string;
          skill_id: string;
          order_index: number;
          module_type: ModuleType;
          target_language: string;
          objective: string;
          content_status: ModuleContentStatus;
          concept_brief: Json | null;
          warmup_drills: Json | null;
          hands_on_ticket: Json | null;
          status: ModuleStatus;
        };
        Insert: {
          id?: string;
          track_id: string;
          skill_id: string;
          order_index: number;
          module_type: ModuleType;
          target_language: string;
          objective: string;
          content_status?: ModuleContentStatus;
          concept_brief?: Json | null;
          warmup_drills?: Json | null;
          hands_on_ticket?: Json | null;
          status?: ModuleStatus;
        };
        Update: {
          id?: string;
          track_id?: string;
          skill_id?: string;
          order_index?: number;
          module_type?: ModuleType;
          target_language?: string;
          objective?: string;
          content_status?: ModuleContentStatus;
          concept_brief?: Json | null;
          warmup_drills?: Json | null;
          hands_on_ticket?: Json | null;
          status?: ModuleStatus;
        };
        Relationships: [
          {
            foreignKeyName: "track_modules_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "learning_tracks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "track_modules_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
        ];
      };
      lab_submissions: {
        Row: {
          id: string;
          module_id: string;
          user_id: string;
          code_snippet: string;
          repo_commit_url: string;
          ai_review_feedback: Json;
          generated_interview_qs: Json;
          passed: boolean;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          user_id: string;
          code_snippet?: string;
          repo_commit_url?: string;
          ai_review_feedback: Json;
          generated_interview_qs: Json;
          passed?: boolean;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          module_id?: string;
          user_id?: string;
          code_snippet?: string;
          repo_commit_url?: string;
          ai_review_feedback?: Json;
          generated_interview_qs?: Json;
          passed?: boolean;
          submitted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lab_submissions_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "track_modules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lab_submissions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_digests: {
        Row: {
          id: string;
          user_id: string;
          source: DigestSource;
          external_id: string;
          title: string;
          url: string;
          tags: string[];
          matched_skill_id: string | null;
          is_read: boolean;
          digest_date: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source: DigestSource;
          external_id: string;
          title: string;
          url: string;
          tags?: string[];
          matched_skill_id?: string | null;
          is_read?: boolean;
          digest_date?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source?: DigestSource;
          external_id?: string;
          title?: string;
          url?: string;
          tags?: string[];
          matched_skill_id?: string | null;
          is_read?: boolean;
          digest_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_digests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_digests_matched_skill_id_fkey";
            columns: ["matched_skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
        ];
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          skill_id: string | null;
          title: string;
          content_md: string;
          gist_id: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          skill_id?: string | null;
          title: string;
          content_md?: string;
          gist_id?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          skill_id?: string | null;
          title?: string;
          content_md?: string;
          gist_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notes_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_attempts: {
        Row: {
          id: string;
          user_id: string;
          skill_id: string;
          source_type: QuizSourceType;
          score: number;
          total_questions: number;
          correct_answers: number;
          attempted_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          skill_id: string;
          source_type: QuizSourceType;
          score: number;
          total_questions: number;
          correct_answers: number;
          attempted_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          skill_id?: string;
          source_type?: QuizSourceType;
          score?: number;
          total_questions?: number;
          correct_answers?: number;
          attempted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_attempts_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
        ];
      };
      interview_cards: {
        Row: {
          id: string;
          user_id: string;
          skill_id: string;
          lab_submission_id: string | null;
          question_prompt: string;
          source: InterviewCardSource;
          confidence_level: ConfidenceLevel | null;
          review_count: number;
          next_review_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          skill_id: string;
          lab_submission_id?: string | null;
          question_prompt: string;
          source: InterviewCardSource;
          confidence_level?: ConfidenceLevel | null;
          review_count?: number;
          next_review_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          skill_id?: string;
          lab_submission_id?: string | null;
          question_prompt?: string;
          source?: InterviewCardSource;
          confidence_level?: ConfidenceLevel | null;
          review_count?: number;
          next_review_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interview_cards_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interview_cards_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interview_cards_lab_submission_id_fkey";
            columns: ["lab_submission_id"];
            isOneToOne: false;
            referencedRelation: "lab_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      interview_attempts: {
        Row: {
          id: string;
          card_id: string;
          user_id: string;
          skill_id: string;
          user_notes: string;
          duration_seconds: number;
          confidence_level: ConfidenceLevel;
          attempted_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          user_id: string;
          skill_id: string;
          user_notes?: string;
          duration_seconds: number;
          confidence_level: ConfidenceLevel;
          attempted_at?: string;
        };
        Update: {
          id?: string;
          card_id?: string;
          user_id?: string;
          skill_id?: string;
          user_notes?: string;
          duration_seconds?: number;
          confidence_level?: ConfidenceLevel;
          attempted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interview_attempts_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "interview_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interview_attempts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interview_attempts_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      save_internship_analysis: {
        Args: {
          p_title: string;
          p_company_name: string;
          p_industry: string;
          p_raw_input: string;
          p_jargon_glossary: Json;
          p_skills: Json;
        };
        Returns: string;
      };
      merge_skills: {
        Args: {
          p_source_skill_id: string;
          p_target_skill_id: string;
        };
        Returns: undefined;
      };
      submit_interview_attempt: {
        Args: {
          p_card_id: string;
          p_user_notes: string;
          p_duration_seconds: number;
          p_confidence_level: ConfidenceLevel;
          p_attempted_at: string;
          p_next_review_at: string;
          p_mastery_score: number;
          p_skill_status: SkillStatus;
        };
        Returns: string;
      };
      submit_quiz_attempt: {
        Args: {
          p_skill_id: string;
          p_source_type: QuizSourceType;
          p_score: number;
          p_total_questions: number;
          p_correct_answers: number;
          p_mastery_score: number;
          p_skill_status: SkillStatus;
        };
        Returns: string;
      };
      sync_github_skills: {
        Args: {
          p_github_username: string;
          p_skills: Json;
        };
        Returns: Json;
      };
      create_track_with_modules: {
        Args: {
          p_internship_id: string | null;
          p_capstone_title: string;
          p_capstone_description: string;
          p_primary_stack: string;
          p_architecture_overview: string;
          p_modules: Json;
        };
        Returns: string;
      };
      complete_and_unlock_next_module: {
        Args: {
          p_track_id: string;
          p_module_id: string;
        };
        Returns: Json;
      };
      submit_lab_review: {
        Args: {
          p_track_id: string;
          p_module_id: string;
          p_skill_id: string;
          p_code_snippet: string;
          p_repo_commit_url: string;
          p_ai_review_feedback: Json;
          p_interview_questions: Json;
          p_passed: boolean;
          p_mastery_score: number;
          p_skill_status: SkillStatus;
        };
        Returns: Json;
      };
    };
    Enums: {
      skill_category: SkillCategory;
      skill_status: SkillStatus;
      skill_source: SkillSource;
      internship_status: InternshipStatus;
      skill_priority: SkillPriority;
      resource_source: ResourceSource;
      track_status: TrackStatus;
      module_type: ModuleType;
      module_status: ModuleStatus;
      module_content_status: ModuleContentStatus;
      digest_source: DigestSource;
      quiz_source_type: QuizSourceType;
      interview_card_source: InterviewCardSource;
      confidence_level: ConfidenceLevel;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Skill = Database["public"]["Tables"]["skills"]["Row"];
export type TargetInternship =
  Database["public"]["Tables"]["target_internships"]["Row"];
export type InternshipSkill =
  Database["public"]["Tables"]["internship_skills"]["Row"];
export type CuratedResource =
  Database["public"]["Tables"]["curated_resources"]["Row"];
export type LearningTrack =
  Database["public"]["Tables"]["learning_tracks"]["Row"];
export type TrackModule = Database["public"]["Tables"]["track_modules"]["Row"];
export type LabSubmission =
  Database["public"]["Tables"]["lab_submissions"]["Row"];
export type DailyDigest = Database["public"]["Tables"]["daily_digests"]["Row"];
export type Note = Database["public"]["Tables"]["notes"]["Row"];
export type QuizAttempt = Database["public"]["Tables"]["quiz_attempts"]["Row"];
export type InterviewCard =
  Database["public"]["Tables"]["interview_cards"]["Row"];
export type InterviewAttempt =
  Database["public"]["Tables"]["interview_attempts"]["Row"];

export type LanguageSkillMode = "microservice" | "language_native";

export type CachedCuratedResource = Omit<CuratedResource, "id"> & {
  id?: string;
};
