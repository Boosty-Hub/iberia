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
      accesos: {
        Row: {
          canal: string
          created_at: string
          empleado_id: string
          enviado_en: string | null
          expira_en: string
          id: string
          mensaje: string | null
          motivo: string
          publicacion_id: string | null
          token_hash: string
          ultimo_uso: string | null
          usado_en: string | null
          usos: number
        }
        Insert: {
          canal?: string
          created_at?: string
          empleado_id: string
          enviado_en?: string | null
          expira_en: string
          id?: string
          mensaje?: string | null
          motivo?: string
          publicacion_id?: string | null
          token_hash: string
          ultimo_uso?: string | null
          usado_en?: string | null
          usos?: number
        }
        Update: {
          canal?: string
          created_at?: string
          empleado_id?: string
          enviado_en?: string | null
          expira_en?: string
          id?: string
          mensaje?: string | null
          motivo?: string
          publicacion_id?: string | null
          token_hash?: string
          ultimo_uso?: string | null
          usado_en?: string | null
          usos?: number
        }
        Relationships: [
          {
            foreignKeyName: "accesos_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accesos_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accesos_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
          },
          {
            foreignKeyName: "accesos_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "publicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      ajustes_whatsapp: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          id: boolean
          id_numero: string | null
          numero_visible: string | null
          plantilla: string | null
          probado_detalle: string | null
          probado_en: string | null
          probado_ok: boolean | null
          token: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          id?: boolean
          id_numero?: string | null
          numero_visible?: string | null
          plantilla?: string | null
          probado_detalle?: string | null
          probado_en?: string | null
          probado_ok?: boolean | null
          token?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          id?: boolean
          id_numero?: string | null
          numero_visible?: string | null
          plantilla?: string | null
          probado_detalle?: string | null
          probado_en?: string | null
          probado_ok?: boolean | null
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ajustes_whatsapp_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      avances: {
        Row: {
          completada_en: string | null
          estado: string
          id: string
          iniciada_en: string
          leccion_id: string
          matricula_id: string
          paso: number
        }
        Insert: {
          completada_en?: string | null
          estado?: string
          id?: string
          iniciada_en?: string
          leccion_id: string
          matricula_id: string
          paso?: number
        }
        Update: {
          completada_en?: string | null
          estado?: string
          id?: string
          iniciada_en?: string
          leccion_id?: string
          matricula_id?: string
          paso?: number
        }
        Relationships: [
          {
            foreignKeyName: "avances_leccion_id_fkey"
            columns: ["leccion_id"]
            isOneToOne: false
            referencedRelation: "lecciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avances_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avances_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "avances_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["matricula_id"]
          },
        ]
      }
      certificados: {
        Row: {
          area_nombre: string | null
          cargo: string | null
          cedula: string
          codigo: string
          created_at: string
          emitido_en: string
          entregado_en: string | null
          id: string
          matricula_id: string
          nombre_completo: string
        }
        Insert: {
          area_nombre?: string | null
          cargo?: string | null
          cedula: string
          codigo: string
          created_at?: string
          emitido_en?: string
          entregado_en?: string | null
          id?: string
          matricula_id: string
          nombre_completo: string
        }
        Update: {
          area_nombre?: string | null
          cargo?: string | null
          cedula?: string
          codigo?: string
          created_at?: string
          emitido_en?: string
          entregado_en?: string | null
          id?: string
          matricula_id?: string
          nombre_completo?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificados_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: true
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificados_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: true
            referencedRelation: "padron_estado"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "certificados_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: true
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["matricula_id"]
          },
        ]
      }
      comentarios: {
        Row: {
          created_at: string
          empleado_id: string
          estado: string
          id: string
          moderado_por: string | null
          publicacion_id: string
          texto: string
        }
        Insert: {
          created_at?: string
          empleado_id: string
          estado?: string
          id?: string
          moderado_por?: string | null
          publicacion_id: string
          texto: string
        }
        Update: {
          created_at?: string
          empleado_id?: string
          estado?: string
          id?: string
          moderado_por?: string | null
          publicacion_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
          },
          {
            foreignKeyName: "comentarios_moderado_por_fkey"
            columns: ["moderado_por"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_moderado_por_fkey"
            columns: ["moderado_por"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_moderado_por_fkey"
            columns: ["moderado_por"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
          },
          {
            foreignKeyName: "comentarios_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "publicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      conexiones: {
        Row: {
          created_at: string
          estado: string
          id: string
          recibe_id: string
          resuelta_en: string | null
          solicita_id: string
        }
        Insert: {
          created_at?: string
          estado?: string
          id?: string
          recibe_id: string
          resuelta_en?: string | null
          solicita_id: string
        }
        Update: {
          created_at?: string
          estado?: string
          id?: string
          recibe_id?: string
          resuelta_en?: string | null
          solicita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conexiones_recibe_id_fkey"
            columns: ["recibe_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conexiones_recibe_id_fkey"
            columns: ["recibe_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conexiones_recibe_id_fkey"
            columns: ["recibe_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
          },
          {
            foreignKeyName: "conexiones_solicita_id_fkey"
            columns: ["solicita_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conexiones_solicita_id_fkey"
            columns: ["solicita_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conexiones_solicita_id_fkey"
            columns: ["solicita_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
          },
        ]
      }
      conversacion_participantes: {
        Row: {
          conversacion_id: string
          empleado_id: string
          id: string
          silenciado: boolean
          visto_en: string | null
        }
        Insert: {
          conversacion_id: string
          empleado_id: string
          id?: string
          silenciado?: boolean
          visto_en?: string | null
        }
        Update: {
          conversacion_id?: string
          empleado_id?: string
          id?: string
          silenciado?: boolean
          visto_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversacion_participantes_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversacion_participantes_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversacion_participantes_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversacion_participantes_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
          },
        ]
      }
      conversaciones: {
        Row: {
          created_at: string
          grupo_id: string | null
          id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          grupo_id?: string | null
          id?: string
          tipo: string
        }
        Update: {
          created_at?: string
          grupo_id?: string | null
          id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversaciones_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos: {
        Row: {
          abierto: boolean
          asistente_libre_activo: boolean
          clave: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          abierto?: boolean
          asistente_libre_activo?: boolean
          clave: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          abierto?: boolean
          asistente_libre_activo?: boolean
          clave?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      empleados: {
        Row: {
          activo: boolean
          area_id: string | null
          busqueda: unknown
          cargo: string | null
          cedula: string
          created_at: string
          email: string | null
          es_moderador: boolean
          familia_oficio: string
          fecha_ingreso: string | null
          foto_url: string | null
          id: string
          nivel: string
          nombre_completo: string
          perfil_id: string | null
          puede_publicar: boolean
          sede: string | null
          telefono: string | null
          tipo_nomina: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          area_id?: string | null
          busqueda?: unknown
          cargo?: string | null
          cedula: string
          created_at?: string
          email?: string | null
          es_moderador?: boolean
          familia_oficio?: string
          fecha_ingreso?: string | null
          foto_url?: string | null
          id?: string
          nivel?: string
          nombre_completo: string
          perfil_id?: string | null
          puede_publicar?: boolean
          sede?: string | null
          telefono?: string | null
          tipo_nomina?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          area_id?: string | null
          busqueda?: unknown
          cargo?: string | null
          cedula?: string
          created_at?: string
          email?: string | null
          es_moderador?: boolean
          familia_oficio?: string
          fecha_ingreso?: string | null
          foto_url?: string | null
          id?: string
          nivel?: string
          nombre_completo?: string
          perfil_id?: string | null
          puede_publicar?: boolean
          sede?: string | null
          telefono?: string | null
          tipo_nomina?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empleados_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleados_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      grupo_miembros: {
        Row: {
          created_at: string
          empleado_id: string
          grupo_id: string
          id: string
          rol: string
        }
        Insert: {
          created_at?: string
          empleado_id: string
          grupo_id: string
          id?: string
          rol?: string
        }
        Update: {
          created_at?: string
          empleado_id?: string
          grupo_id?: string
          id?: string
          rol?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupo_miembros_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupo_miembros_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupo_miembros_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
          },
          {
            foreignKeyName: "grupo_miembros_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos: {
        Row: {
          activo: boolean
          area_id: string | null
          creador_id: string | null
          created_at: string
          id: string
          nombre: string
          proposito: string | null
          tipo: string
        }
        Insert: {
          activo?: boolean
          area_id?: string | null
          creador_id?: string | null
          created_at?: string
          id?: string
          nombre: string
          proposito?: string | null
          tipo?: string
        }
        Update: {
          activo?: boolean
          area_id?: string | null
          creador_id?: string | null
          created_at?: string
          id?: string
          nombre?: string
          proposito?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupos_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupos_creador_id_fkey"
            columns: ["creador_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupos_creador_id_fkey"
            columns: ["creador_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupos_creador_id_fkey"
            columns: ["creador_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
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
      lecciones: {
        Row: {
          activa: boolean
          clave: string
          created_at: string
          curso_id: string
          forma: string
          id: string
          minutos: number
          numero: number
          resumen: string | null
          titulo: string
        }
        Insert: {
          activa?: boolean
          clave: string
          created_at?: string
          curso_id: string
          forma: string
          id?: string
          minutos?: number
          numero: number
          resumen?: string | null
          titulo: string
        }
        Update: {
          activa?: boolean
          clave?: string
          created_at?: string
          curso_id?: string
          forma?: string
          id?: string
          minutos?: number
          numero?: number
          resumen?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "lecciones_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      matriculas: {
        Row: {
          completado_en: string | null
          created_at: string
          curso_id: string
          empleado_id: string
          empujones: number
          estado: string
          familia_oficio: string
          id: string
          iniciado_en: string | null
          nombre_corto: string | null
          ultimo_empujon: string | null
          ultimo_toque: string | null
        }
        Insert: {
          completado_en?: string | null
          created_at?: string
          curso_id: string
          empleado_id: string
          empujones?: number
          estado?: string
          familia_oficio?: string
          id?: string
          iniciado_en?: string | null
          nombre_corto?: string | null
          ultimo_empujon?: string | null
          ultimo_toque?: string | null
        }
        Update: {
          completado_en?: string | null
          created_at?: string
          curso_id?: string
          empleado_id?: string
          empujones?: number
          estado?: string
          familia_oficio?: string
          id?: string
          iniciado_en?: string | null
          nombre_corto?: string | null
          ultimo_empujon?: string | null
          ultimo_toque?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
          },
        ]
      }
      mensajes: {
        Row: {
          autor_id: string
          conversacion_id: string
          created_at: string
          estado: string
          id: string
          texto: string
        }
        Insert: {
          autor_id: string
          conversacion_id: string
          created_at?: string
          estado?: string
          id?: string
          texto: string
        }
        Update: {
          autor_id?: string
          conversacion_id?: string
          created_at?: string
          estado?: string
          id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
          },
          {
            foreignKeyName: "mensajes_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
        ]
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
      publicacion_lecturas: {
        Row: {
          empleado_id: string
          id: string
          leido_en: string
          origen: string | null
          publicacion_id: string
        }
        Insert: {
          empleado_id: string
          id?: string
          leido_en?: string
          origen?: string | null
          publicacion_id: string
        }
        Update: {
          empleado_id?: string
          id?: string
          leido_en?: string
          origen?: string | null
          publicacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publicacion_lecturas_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicacion_lecturas_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicacion_lecturas_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
          },
          {
            foreignKeyName: "publicacion_lecturas_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "publicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      publicaciones: {
        Row: {
          audiencia: string
          audiencia_area_id: string | null
          autor_id: string | null
          bajada: string | null
          busqueda: unknown
          created_at: string
          cuerpo_md: string | null
          estado: string
          fijado: boolean
          id: string
          imagen_url: string | null
          oficial: boolean
          permite_comentarios: boolean
          publicado_en: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          audiencia?: string
          audiencia_area_id?: string | null
          autor_id?: string | null
          bajada?: string | null
          busqueda?: unknown
          created_at?: string
          cuerpo_md?: string | null
          estado?: string
          fijado?: boolean
          id?: string
          imagen_url?: string | null
          oficial?: boolean
          permite_comentarios?: boolean
          publicado_en?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          audiencia?: string
          audiencia_area_id?: string | null
          autor_id?: string | null
          bajada?: string | null
          busqueda?: unknown
          created_at?: string
          cuerpo_md?: string | null
          estado?: string
          fijado?: boolean
          id?: string
          imagen_url?: string | null
          oficial?: boolean
          permite_comentarios?: boolean
          publicado_en?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publicaciones_audiencia_area_id_fkey"
            columns: ["audiencia_area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicaciones_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicaciones_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicaciones_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
          },
        ]
      }
      reacciones: {
        Row: {
          created_at: string
          empleado_id: string
          id: string
          publicacion_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          empleado_id: string
          id?: string
          publicacion_id: string
          tipo?: string
        }
        Update: {
          created_at?: string
          empleado_id?: string
          id?: string
          publicacion_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "reacciones_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reacciones_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reacciones_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
          },
          {
            foreignKeyName: "reacciones_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "publicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      recordatorios: {
        Row: {
          created_at: string
          detalle: string | null
          enviado_en: string | null
          escalon: number
          estado: string
          id: string
          matricula_id: string
          mensaje: string
          via: string
        }
        Insert: {
          created_at?: string
          detalle?: string | null
          enviado_en?: string | null
          escalon: number
          estado?: string
          id?: string
          matricula_id: string
          mensaje: string
          via?: string
        }
        Update: {
          created_at?: string
          detalle?: string | null
          enviado_en?: string | null
          escalon?: number
          estado?: string
          id?: string
          matricula_id?: string
          mensaje?: string
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordatorios_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recordatorios_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "recordatorios_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["matricula_id"]
          },
        ]
      }
      respuestas: {
        Row: {
          area_id: string | null
          clave_paso: string
          created_at: string
          devolucion: string | null
          devolucion_audio: string | null
          devolucion_en: string | null
          entrada: string
          es_pregunta_campo: boolean
          familia_oficio: string
          hallazgo_id: string | null
          id: string
          leccion_id: string
          matricula_id: string
          media_url: string | null
          texto: string | null
          transcripcion_cruda: string | null
        }
        Insert: {
          area_id?: string | null
          clave_paso: string
          created_at?: string
          devolucion?: string | null
          devolucion_audio?: string | null
          devolucion_en?: string | null
          entrada?: string
          es_pregunta_campo?: boolean
          familia_oficio?: string
          hallazgo_id?: string | null
          id?: string
          leccion_id: string
          matricula_id: string
          media_url?: string | null
          texto?: string | null
          transcripcion_cruda?: string | null
        }
        Update: {
          area_id?: string | null
          clave_paso?: string
          created_at?: string
          devolucion?: string | null
          devolucion_audio?: string | null
          devolucion_en?: string | null
          entrada?: string
          es_pregunta_campo?: boolean
          familia_oficio?: string
          hallazgo_id?: string | null
          id?: string
          leccion_id?: string
          matricula_id?: string
          media_url?: string | null
          texto?: string | null
          transcripcion_cruda?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "respuestas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respuestas_hallazgo_id_fkey"
            columns: ["hallazgo_id"]
            isOneToOne: false
            referencedRelation: "hallazgos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respuestas_leccion_id_fkey"
            columns: ["leccion_id"]
            isOneToOne: false
            referencedRelation: "lecciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respuestas_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respuestas_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "respuestas_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["matricula_id"]
          },
        ]
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
      accesos_estado: {
        Row: {
          canal: string | null
          created_at: string | null
          empleado_id: string | null
          enviado_en: string | null
          expira_en: string | null
          id: string | null
          mensaje: string | null
          motivo: string | null
          ultimo_uso: string | null
          usado_en: string | null
          usos: number | null
          vigente: boolean | null
        }
        Insert: {
          canal?: string | null
          created_at?: string | null
          empleado_id?: string | null
          enviado_en?: string | null
          expira_en?: string | null
          id?: string | null
          mensaje?: string | null
          motivo?: string | null
          ultimo_uso?: string | null
          usado_en?: string | null
          usos?: number | null
          vigente?: never
        }
        Update: {
          canal?: string | null
          created_at?: string | null
          empleado_id?: string | null
          enviado_en?: string | null
          expira_en?: string | null
          id?: string | null
          mensaje?: string | null
          motivo?: string | null
          ultimo_uso?: string | null
          usado_en?: string | null
          usos?: number | null
          vigente?: never
        }
        Relationships: [
          {
            foreignKeyName: "accesos_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accesos_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accesos_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
          },
        ]
      }
      adiestramiento_avance: {
        Row: {
          area_id: string | null
          area_nombre: string | null
          completados: number | null
          curso_id: string | null
          en_curso: number | null
          familia_oficio: string | null
          lecciones_promedio: number | null
          matriculados: number | null
          sin_empezar: number | null
        }
        Relationships: [
          {
            foreignKeyName: "empleados_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      padron_estado: {
        Row: {
          acceso_enviado: string | null
          acceso_expira: string | null
          acceso_usos: number | null
          activo: boolean | null
          area_id: string | null
          area_nombre: string | null
          cargo: string | null
          cedula: string | null
          email: string | null
          estado_matricula: string | null
          familia_oficio: string | null
          id: string | null
          lecciones_hechas: number | null
          matricula_id: string | null
          nivel: string | null
          nombre_completo: string | null
          sede: string | null
          telefono: string | null
          tiene_cuenta: boolean | null
          tipo_nomina: string | null
          ultimo_toque: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empleados_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      recordatorios_pendientes: {
        Row: {
          area_nombre: string | null
          callado_desde: string | null
          cargo: string | null
          curso_id: string | null
          dias: number | null
          empleado_id: string | null
          estado: string | null
          familia_oficio: string | null
          lecciones_hechas: number | null
          matricula_id: string | null
          nombre_completo: string | null
          nombre_corto: string | null
          telefono: string | null
          ultimo_escalon: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cabe_otro_participante: { Args: { conv: string }; Returns: boolean }
      coordino_grupo: { Args: { grupo: string }; Returns: boolean }
      emitir_mi_certificado: {
        Args: { p_matricula: string }
        Returns: {
          area_nombre: string | null
          cargo: string | null
          cedula: string
          codigo: string
          created_at: string
          emitido_en: string
          entregado_en: string | null
          id: string
          matricula_id: string
          nombre_completo: string
        }
        SetofOptions: {
          from: "*"
          to: "certificados"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      es_admin: { Args: never; Returns: boolean }
      es_editor: { Args: never; Returns: boolean }
      matricula_mia: { Args: { matricula: string }; Returns: boolean }
      matricular_pendientes: { Args: { curso_clave: string }; Returns: number }
      mensajes_sin_leer: { Args: never; Returns: number }
      mi_empleado: { Args: never; Returns: string }
      mi_matricula: { Args: { curso: string }; Returns: string }
      mi_rol: { Args: never; Returns: string }
      participo_en: { Args: { conv: string }; Returns: boolean }
      puede_publicar: { Args: never; Returns: boolean }
      renombrar_hablante: {
        Args: { p_entrevista: string; p_etiqueta: string; p_nombre: string }
        Returns: number
      }
      soy_miembro: { Args: { grupo: string }; Returns: boolean }
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
