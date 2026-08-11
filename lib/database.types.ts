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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      archivos: {
        Row: {
          area_id: string | null
          busqueda: unknown
          categoria: string
          confidencial: boolean
          created_at: string
          descripcion: string | null
          entrevista_id: string | null
          fase: number | null
          id: string
          mime_type: string | null
          nombre: string
          storage_path: string
          tamano_bytes: number | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          area_id?: string | null
          busqueda?: unknown
          categoria?: string
          confidencial?: boolean
          created_at?: string
          descripcion?: string | null
          entrevista_id?: string | null
          fase?: number | null
          id?: string
          mime_type?: string | null
          nombre: string
          storage_path: string
          tamano_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          area_id?: string | null
          busqueda?: unknown
          categoria?: string
          confidencial?: boolean
          created_at?: string
          descripcion?: string | null
          entrevista_id?: string | null
          fase?: number | null
          id?: string
          mime_type?: string | null
          nombre?: string
          storage_path?: string
          tamano_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archivos_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archivos_entrevista_id_fkey"
            columns: ["entrevista_id"]
            isOneToOne: false
            referencedRelation: "entrevistas"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          orden: number
          padre_id: string | null
          slug: string
          tipo: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          orden?: number
          padre_id?: string | null
          slug: string
          tipo?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          orden?: number
          padre_id?: string | null
          slug?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_padre_id_fkey"
            columns: ["padre_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      entrevistas: {
        Row: {
          area_id: string | null
          busqueda: unknown
          codigo: string
          created_at: string
          created_by: string | null
          duracion_minutos: number | null
          entrevistado_cargo: string | null
          entrevistado_id: string | null
          entrevistado_nombre: string | null
          entrevistador: string | null
          estado: string
          fecha_entrevista: string | null
          fireflies_meta: Json | null
          fireflies_url: string | null
          id: string
          notas_consultor: string | null
          resumen: string | null
          sede: string | null
          tipo: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          busqueda?: unknown
          codigo: string
          created_at?: string
          created_by?: string | null
          duracion_minutos?: number | null
          entrevistado_cargo?: string | null
          entrevistado_id?: string | null
          entrevistado_nombre?: string | null
          entrevistador?: string | null
          estado?: string
          fecha_entrevista?: string | null
          fireflies_meta?: Json | null
          fireflies_url?: string | null
          id?: string
          notas_consultor?: string | null
          resumen?: string | null
          sede?: string | null
          tipo?: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          busqueda?: unknown
          codigo?: string
          created_at?: string
          created_by?: string | null
          duracion_minutos?: number | null
          entrevistado_cargo?: string | null
          entrevistado_id?: string | null
          entrevistado_nombre?: string | null
          entrevistador?: string | null
          estado?: string
          fecha_entrevista?: string | null
          fireflies_meta?: Json | null
          fireflies_url?: string | null
          id?: string
          notas_consultor?: string | null
          resumen?: string | null
          sede?: string | null
          tipo?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entrevistas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrevistas_entrevistado_id_fkey"
            columns: ["entrevistado_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      hallazgos: {
        Row: {
          area_id: string | null
          cita_textual: string | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          entrevista_id: string | null
          esfuerzo: string | null
          estado: string
          id: string
          impacto: string | null
          segmento_id: number | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          cita_textual?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          entrevista_id?: string | null
          esfuerzo?: string | null
          estado?: string
          id?: string
          impacto?: string | null
          segmento_id?: number | null
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          cita_textual?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          entrevista_id?: string | null
          esfuerzo?: string | null
          estado?: string
          id?: string
          impacto?: string | null
          segmento_id?: number | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hallazgos_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hallazgos_entrevista_id_fkey"
            columns: ["entrevista_id"]
            isOneToOne: false
            referencedRelation: "entrevistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hallazgos_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "transcripcion_segmentos"
            referencedColumns: ["id"]
          },
        ]
      }
      informe_secciones: {
        Row: {
          contenido_md: string | null
          created_at: string
          id: string
          numero: string | null
          orden: number
          parte: string
          publicado: boolean
          slug: string
          subtitulo: string | null
          titulo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contenido_md?: string | null
          created_at?: string
          id?: string
          numero?: string | null
          orden?: number
          parte?: string
          publicado?: boolean
          slug: string
          subtitulo?: string | null
          titulo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contenido_md?: string | null
          created_at?: string
          id?: string
          numero?: string | null
          orden?: number
          parte?: string
          publicado?: boolean
          slug?: string
          subtitulo?: string | null
          titulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      personas: {
        Row: {
          area_id: string | null
          busqueda: unknown
          cargo: string | null
          created_at: string
          email: string | null
          es_lider_programa: boolean
          id: string
          nombre_completo: string
          notas: string | null
          organizacion: string
          sede: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          busqueda?: unknown
          cargo?: string | null
          created_at?: string
          email?: string | null
          es_lider_programa?: boolean
          id?: string
          nombre_completo: string
          notas?: string | null
          organizacion?: string
          sede?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          busqueda?: unknown
          cargo?: string | null
          created_at?: string
          email?: string | null
          es_lider_programa?: boolean
          id?: string
          nombre_completo?: string
          notas?: string | null
          organizacion?: string
          sede?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activo: boolean
          cargo: string | null
          created_at: string
          email: string
          id: string
          nombre_completo: string | null
          organizacion: string
          rol: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          cargo?: string | null
          created_at?: string
          email: string
          id: string
          nombre_completo?: string | null
          organizacion?: string
          rol?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          cargo?: string | null
          created_at?: string
          email?: string
          id?: string
          nombre_completo?: string | null
          organizacion?: string
          rol?: string
          updated_at?: string
        }
        Relationships: []
      }
      sesion_participantes: {
        Row: {
          created_at: string
          entrevista_id: string
          etiqueta_hablante: string | null
          id: string
          persona_id: string
          rol: string
        }
        Insert: {
          created_at?: string
          entrevista_id: string
          etiqueta_hablante?: string | null
          id?: string
          persona_id: string
          rol?: string
        }
        Update: {
          created_at?: string
          entrevista_id?: string
          etiqueta_hablante?: string | null
          id?: string
          persona_id?: string
          rol?: string
        }
        Relationships: [
          {
            foreignKeyName: "sesion_participantes_entrevista_id_fkey"
            columns: ["entrevista_id"]
            isOneToOne: false
            referencedRelation: "entrevistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sesion_participantes_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      transcripcion_segmentos: {
        Row: {
          busqueda: unknown
          entrevista_id: string
          fin_segundos: number | null
          hablante: string | null
          hablante_original: string | null
          id: number
          indice: number
          inicio_segundos: number | null
          texto: string
        }
        Insert: {
          busqueda?: unknown
          entrevista_id: string
          fin_segundos?: number | null
          hablante?: string | null
          hablante_original?: string | null
          id?: never
          indice: number
          inicio_segundos?: number | null
          texto: string
        }
        Update: {
          busqueda?: unknown
          entrevista_id?: string
          fin_segundos?: number | null
          hablante?: string | null
          hablante_original?: string | null
          id?: never
          indice?: number
          inicio_segundos?: number | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcripcion_segmentos_entrevista_id_fkey"
            columns: ["entrevista_id"]
            isOneToOne: false
            referencedRelation: "entrevistas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      es_admin: { Args: never; Returns: boolean }
      es_editor: { Args: never; Returns: boolean }
      mi_rol: { Args: never; Returns: string }
      renombrar_hablante: {
        Args: { p_entrevista: string; p_etiqueta: string; p_nombre: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
