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
  asistente: {
    Tables: {
      alcance_rol: {
        Row: {
          fuente: string
          permitido: boolean
          rol_id: string
        }
        Insert: {
          fuente: string
          permitido?: boolean
          rol_id: string
        }
        Update: {
          fuente?: string
          permitido?: boolean
          rol_id?: string
        }
        Relationships: []
      }
      alcance_usuario: {
        Row: {
          fuente: string
          perfil_id: string
          permitido: boolean
        }
        Insert: {
          fuente: string
          perfil_id: string
          permitido: boolean
        }
        Update: {
          fuente?: string
          perfil_id?: string
          permitido?: boolean
        }
        Relationships: []
      }
      archivo: {
        Row: {
          anthropic_file_id: string | null
          anthropic_usado_en: string | null
          aviso: string | null
          bucket: string
          bytes: number
          carpeta_id: string | null
          chat_id: string | null
          creado_en: string
          dueno: string
          estado: string
          fuente_id: string | null
          huella: string | null
          id: string
          mensaje_id: string | null
          mime: string
          ms_enlace: string | null
          ms_item: string | null
          ms_modificado: string | null
          nombre: string
          origen: string
          proyecto_id: string | null
          ruta: string
        }
        Insert: {
          anthropic_file_id?: string | null
          anthropic_usado_en?: string | null
          aviso?: string | null
          bucket?: string
          bytes?: number
          carpeta_id?: string | null
          chat_id?: string | null
          creado_en?: string
          dueno?: string
          estado?: string
          fuente_id?: string | null
          huella?: string | null
          id?: string
          mensaje_id?: string | null
          mime?: string
          ms_enlace?: string | null
          ms_item?: string | null
          ms_modificado?: string | null
          nombre: string
          origen: string
          proyecto_id?: string | null
          ruta: string
        }
        Update: {
          anthropic_file_id?: string | null
          anthropic_usado_en?: string | null
          aviso?: string | null
          bucket?: string
          bytes?: number
          carpeta_id?: string | null
          chat_id?: string | null
          creado_en?: string
          dueno?: string
          estado?: string
          fuente_id?: string | null
          huella?: string | null
          id?: string
          mensaje_id?: string | null
          mime?: string
          ms_enlace?: string | null
          ms_item?: string | null
          ms_modificado?: string | null
          nombre?: string
          origen?: string
          proyecto_id?: string | null
          ruta?: string
        }
        Relationships: [
          {
            foreignKeyName: "archivo_carpeta_id_fkey"
            columns: ["carpeta_id"]
            isOneToOne: false
            referencedRelation: "carpeta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archivo_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archivo_fuente_id_fkey"
            columns: ["fuente_id"]
            isOneToOne: false
            referencedRelation: "archivo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archivo_mensaje_id_fkey"
            columns: ["mensaje_id"]
            isOneToOne: false
            referencedRelation: "mensaje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archivo_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyecto"
            referencedColumns: ["id"]
          },
        ]
      }
      atajo: {
        Row: {
          actualizado_en: string
          comando: string
          creado_en: string
          creado_por: string | null
          dueno: string | null
          esfuerzo: string | null
          id: string
          instruccion: string
          modelo: string | null
          titulo: string
        }
        Insert: {
          actualizado_en?: string
          comando: string
          creado_en?: string
          creado_por?: string | null
          dueno?: string | null
          esfuerzo?: string | null
          id?: string
          instruccion: string
          modelo?: string | null
          titulo: string
        }
        Update: {
          actualizado_en?: string
          comando?: string
          creado_en?: string
          creado_por?: string | null
          dueno?: string | null
          esfuerzo?: string | null
          id?: string
          instruccion?: string
          modelo?: string | null
          titulo?: string
        }
        Relationships: []
      }
      aviso_renovacion: {
        Row: {
          creado_en: string
          motivo: string
          perfil_id: string
          renueva: string
        }
        Insert: {
          creado_en?: string
          motivo: string
          perfil_id: string
          renueva: string
        }
        Update: {
          creado_en?: string
          motivo?: string
          perfil_id?: string
          renueva?: string
        }
        Relationships: []
      }
      capacidad_motor: {
        Row: {
          capacidad: string
          disponible: boolean
          motivo: string | null
          motor: string
          orden: number
          solo_hibrido: boolean
        }
        Insert: {
          capacidad: string
          disponible: boolean
          motivo?: string | null
          motor: string
          orden?: number
          solo_hibrido?: boolean
        }
        Update: {
          capacidad?: string
          disponible?: boolean
          motivo?: string | null
          motor?: string
          orden?: number
          solo_hibrido?: boolean
        }
        Relationships: []
      }
      carpeta: {
        Row: {
          creado_en: string
          dueno: string
          id: string
          nombre: string
          padre_id: string | null
        }
        Insert: {
          creado_en?: string
          dueno?: string
          id?: string
          nombre: string
          padre_id?: string | null
        }
        Update: {
          creado_en?: string
          dueno?: string
          id?: string
          nombre?: string
          padre_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carpeta_padre_id_fkey"
            columns: ["padre_id"]
            isOneToOne: false
            referencedRelation: "carpeta"
            referencedColumns: ["id"]
          },
        ]
      }
      chat: {
        Row: {
          actualizado_en: string
          archivado: boolean
          compartido: boolean
          contenedor_id: string | null
          contenedor_usado_en: string | null
          creado_en: string
          dueno: string
          esfuerzo: string | null
          id: string
          modelo: string | null
          motor: string | null
          proyecto_id: string | null
          resumen: string | null
          resumen_hasta: string | null
          resumen_mensajes: number
          tarea_id: string | null
          titulo: string
          titulo_auto: boolean
        }
        Insert: {
          actualizado_en?: string
          archivado?: boolean
          compartido?: boolean
          contenedor_id?: string | null
          contenedor_usado_en?: string | null
          creado_en?: string
          dueno?: string
          esfuerzo?: string | null
          id?: string
          modelo?: string | null
          motor?: string | null
          proyecto_id?: string | null
          resumen?: string | null
          resumen_hasta?: string | null
          resumen_mensajes?: number
          tarea_id?: string | null
          titulo?: string
          titulo_auto?: boolean
        }
        Update: {
          actualizado_en?: string
          archivado?: boolean
          compartido?: boolean
          contenedor_id?: string | null
          contenedor_usado_en?: string | null
          creado_en?: string
          dueno?: string
          esfuerzo?: string | null
          id?: string
          modelo?: string | null
          motor?: string | null
          proyecto_id?: string | null
          resumen?: string | null
          resumen_hasta?: string | null
          resumen_mensajes?: number
          tarea_id?: string | null
          titulo?: string
          titulo_auto?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "chat_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyecto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_tarea_id_fkey"
            columns: ["tarea_id"]
            isOneToOne: false
            referencedRelation: "tarea"
            referencedColumns: ["id"]
          },
        ]
      }
      compartido: {
        Row: {
          con: string
          creado_en: string
          id: string
          linaje: string[]
          objeto_id: string
          por: string
          tipo: string
        }
        Insert: {
          con: string
          creado_en?: string
          id?: string
          linaje?: string[]
          objeto_id: string
          por: string
          tipo: string
        }
        Update: {
          con?: string
          creado_en?: string
          id?: string
          linaje?: string[]
          objeto_id?: string
          por?: string
          tipo?: string
        }
        Relationships: []
      }
      conexion_microsoft: {
        Row: {
          conectado_en: string
          cuenta: string
          nombre: string | null
          perfil_id: string
          renovado_en: string | null
          secreto_id: string
          usado_en: string | null
        }
        Insert: {
          conectado_en?: string
          cuenta: string
          nombre?: string | null
          perfil_id: string
          renovado_en?: string | null
          secreto_id: string
          usado_en?: string | null
        }
        Update: {
          conectado_en?: string
          cuenta?: string
          nombre?: string | null
          perfil_id?: string
          renovado_en?: string | null
          secreto_id?: string
          usado_en?: string | null
        }
        Relationships: []
      }
      config: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          correo_nombre: string
          correo_remitente: string | null
          cuota_mb: number
          encendido: boolean
          esfuerzo_defecto: string
          esfuerzo_max: string
          frecuencia_min_min: number
          habilidades: string[]
          id: boolean
          instrucciones_empresa: string
          local_modo: string
          local_url: string | null
          max_tareas: number
          microsoft_cliente: string | null
          microsoft_tenant: string | null
          modelo_anthropic: string
          modelo_openai: string
          motor: string
          programador_pausado: boolean
          tope_diario_usd: number
          tope_investigacion_usd: number
          tope_mensual_empresa_usd: number
          tope_mensual_usd: number
          ventanas_por_dia: number
          whatsapp_plantilla: string | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          correo_nombre?: string
          correo_remitente?: string | null
          cuota_mb?: number
          encendido?: boolean
          esfuerzo_defecto?: string
          esfuerzo_max?: string
          frecuencia_min_min?: number
          habilidades?: string[]
          id?: boolean
          instrucciones_empresa?: string
          local_modo?: string
          local_url?: string | null
          max_tareas?: number
          microsoft_cliente?: string | null
          microsoft_tenant?: string | null
          modelo_anthropic?: string
          modelo_openai?: string
          motor?: string
          programador_pausado?: boolean
          tope_diario_usd?: number
          tope_investigacion_usd?: number
          tope_mensual_empresa_usd?: number
          tope_mensual_usd?: number
          ventanas_por_dia?: number
          whatsapp_plantilla?: string | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          correo_nombre?: string
          correo_remitente?: string | null
          cuota_mb?: number
          encendido?: boolean
          esfuerzo_defecto?: string
          esfuerzo_max?: string
          frecuencia_min_min?: number
          habilidades?: string[]
          id?: boolean
          instrucciones_empresa?: string
          local_modo?: string
          local_url?: string | null
          max_tareas?: number
          microsoft_cliente?: string | null
          microsoft_tenant?: string | null
          modelo_anthropic?: string
          modelo_openai?: string
          motor?: string
          programador_pausado?: boolean
          tope_diario_usd?: number
          tope_investigacion_usd?: number
          tope_mensual_empresa_usd?: number
          tope_mensual_usd?: number
          ventanas_por_dia?: number
          whatsapp_plantilla?: string | null
        }
        Relationships: []
      }
      consulta_fuente: {
        Row: {
          creado_en: string
          filas: number
          fuente: string
          id: string
          parametros: Json
          perfil_id: string
          turno_id: string | null
        }
        Insert: {
          creado_en?: string
          filas?: number
          fuente: string
          id?: string
          parametros?: Json
          perfil_id: string
          turno_id?: string | null
        }
        Update: {
          creado_en?: string
          filas?: number
          fuente?: string
          id?: string
          parametros?: Json
          perfil_id?: string
          turno_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consulta_fuente_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "turno"
            referencedColumns: ["id"]
          },
        ]
      }
      corrida: {
        Row: {
          chat_id: string | null
          creado_en: string
          dueno: string
          empezado_en: string | null
          entregas: Json
          error: string | null
          estado: string
          id: string
          intento: number
          manual: boolean
          programada_para: string
          reintentar_en: string | null
          tarea_id: string
          terminado_en: string | null
          turno_id: string | null
        }
        Insert: {
          chat_id?: string | null
          creado_en?: string
          dueno: string
          empezado_en?: string | null
          entregas?: Json
          error?: string | null
          estado?: string
          id?: string
          intento?: number
          manual?: boolean
          programada_para: string
          reintentar_en?: string | null
          tarea_id: string
          terminado_en?: string | null
          turno_id?: string | null
        }
        Update: {
          chat_id?: string | null
          creado_en?: string
          dueno?: string
          empezado_en?: string | null
          entregas?: Json
          error?: string | null
          estado?: string
          id?: string
          intento?: number
          manual?: boolean
          programada_para?: string
          reintentar_en?: string | null
          tarea_id?: string
          terminado_en?: string | null
          turno_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corrida_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrida_tarea_id_fkey"
            columns: ["tarea_id"]
            isOneToOne: false
            referencedRelation: "tarea"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrida_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "turno"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_pagina: {
        Row: {
          archivo_id: string
          documento_id: string
          pagina: number
          texto: string
          vector: unknown
        }
        Insert: {
          archivo_id: string
          documento_id: string
          pagina: number
          texto: string
          vector?: unknown
        }
        Update: {
          archivo_id?: string
          documento_id?: string
          pagina?: number
          texto?: string
          vector?: unknown
        }
        Relationships: []
      }
      fuente: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          clave: string
          encendida: boolean
          nota: string | null
          sensible: boolean
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          clave: string
          encendida?: boolean
          nota?: string | null
          sensible?: boolean
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          clave?: string
          encendida?: boolean
          nota?: string | null
          sensible?: boolean
        }
        Relationships: []
      }
      html: {
        Row: {
          bytes: number
          chat_id: string | null
          creado_en: string
          dueno: string
          grupo: string
          id: string
          mensaje_id: string | null
          ruta: string
          tipo: string
          titulo: string
          version: number
        }
        Insert: {
          bytes?: number
          chat_id?: string | null
          creado_en?: string
          dueno: string
          grupo?: string
          id?: string
          mensaje_id?: string | null
          ruta: string
          tipo?: string
          titulo: string
          version?: number
        }
        Update: {
          bytes?: number
          chat_id?: string | null
          creado_en?: string
          dueno?: string
          grupo?: string
          id?: string
          mensaje_id?: string | null
          ruta?: string
          tipo?: string
          titulo?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "html_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "html_mensaje_id_fkey"
            columns: ["mensaje_id"]
            isOneToOne: false
            referencedRelation: "mensaje"
            referencedColumns: ["id"]
          },
        ]
      }
      lectura_soporte: {
        Row: {
          chat_id: string
          creado_en: string
          id: string
          lector: string
          motivo: string
          ticket: string | null
        }
        Insert: {
          chat_id: string
          creado_en?: string
          id?: string
          lector: string
          motivo: string
          ticket?: string | null
        }
        Update: {
          chat_id?: string
          creado_en?: string
          id?: string
          lector?: string
          motivo?: string
          ticket?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lectura_soporte_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chat"
            referencedColumns: ["id"]
          },
        ]
      }
      memoria: {
        Row: {
          aprendido: boolean
          creado_en: string
          dueno: string
          id: string
          origen_chat: string | null
          texto: string
          usado_en: string
        }
        Insert: {
          aprendido?: boolean
          creado_en?: string
          dueno?: string
          id?: string
          origen_chat?: string | null
          texto: string
          usado_en?: string
        }
        Update: {
          aprendido?: boolean
          creado_en?: string
          dueno?: string
          id?: string
          origen_chat?: string | null
          texto?: string
          usado_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "memoria_origen_chat_fkey"
            columns: ["origen_chat"]
            isOneToOne: false
            referencedRelation: "chat"
            referencedColumns: ["id"]
          },
        ]
      }
      mensaje: {
        Row: {
          adjuntos: string[]
          autor: string | null
          bloques: Json
          calificacion: number | null
          calificacion_nota: string | null
          chat_id: string
          creado_en: string
          id: string
          rol: string
          texto: string
          turno_id: string | null
        }
        Insert: {
          adjuntos?: string[]
          autor?: string | null
          bloques?: Json
          calificacion?: number | null
          calificacion_nota?: string | null
          chat_id: string
          creado_en?: string
          id?: string
          rol: string
          texto?: string
          turno_id?: string | null
        }
        Update: {
          adjuntos?: string[]
          autor?: string | null
          bloques?: Json
          calificacion?: number | null
          calificacion_nota?: string | null
          chat_id?: string
          creado_en?: string
          id?: string
          rol?: string
          texto?: string
          turno_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensaje_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensaje_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "turno"
            referencedColumns: ["id"]
          },
        ]
      }
      microsoft_estado: {
        Row: {
          creado_en: string
          estado: string
          perfil_id: string
          verificador: string
        }
        Insert: {
          creado_en?: string
          estado: string
          perfil_id: string
          verificador: string
        }
        Update: {
          creado_en?: string
          estado?: string
          perfil_id?: string
          verificador?: string
        }
        Relationships: []
      }
      modelo: {
        Row: {
          descripcion: string
          encendido: boolean
          esfuerzos: string[]
          id: string
          nombre: string
          nombre_api: string | null
          orden: number
          precio_cache_escribe: number
          precio_cache_lee: number
          precio_entrada: number
          precio_salida: number
          proveedor: string
          verificado_en: string
          vision: boolean
        }
        Insert: {
          descripcion?: string
          encendido?: boolean
          esfuerzos?: string[]
          id: string
          nombre: string
          nombre_api?: string | null
          orden?: number
          precio_cache_escribe?: number
          precio_cache_lee?: number
          precio_entrada: number
          precio_salida: number
          proveedor: string
          verificado_en: string
          vision?: boolean
        }
        Update: {
          descripcion?: string
          encendido?: boolean
          esfuerzos?: string[]
          id?: string
          nombre?: string
          nombre_api?: string | null
          orden?: number
          precio_cache_escribe?: number
          precio_cache_lee?: number
          precio_entrada?: number
          precio_salida?: number
          proveedor?: string
          verificado_en?: string
          vision?: boolean
        }
        Relationships: []
      }
      participante: {
        Row: {
          chat_id: string
          desde: string
          perfil_id: string
          rol: string
        }
        Insert: {
          chat_id: string
          desde?: string
          perfil_id: string
          rol?: string
        }
        Update: {
          chat_id?: string
          desde?: string
          perfil_id?: string
          rol?: string
        }
        Relationships: [
          {
            foreignKeyName: "participante_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chat"
            referencedColumns: ["id"]
          },
        ]
      }
      politica_rol: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          cuota_mb: number | null
          esfuerzo_max: string | null
          frecuencia_min_min: number | null
          max_tareas: number | null
          modelos: string[] | null
          puede_compartir: boolean | null
          puede_programar: boolean | null
          rol_id: string
          tope_diario_usd: number | null
          tope_mensual_usd: number | null
          ventanas_por_dia: number | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          cuota_mb?: number | null
          esfuerzo_max?: string | null
          frecuencia_min_min?: number | null
          max_tareas?: number | null
          modelos?: string[] | null
          puede_compartir?: boolean | null
          puede_programar?: boolean | null
          rol_id: string
          tope_diario_usd?: number | null
          tope_mensual_usd?: number | null
          ventanas_por_dia?: number | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          cuota_mb?: number | null
          esfuerzo_max?: string | null
          frecuencia_min_min?: number | null
          max_tareas?: number | null
          modelos?: string[] | null
          puede_compartir?: boolean | null
          puede_programar?: boolean | null
          rol_id?: string
          tope_diario_usd?: number | null
          tope_mensual_usd?: number | null
          ventanas_por_dia?: number | null
        }
        Relationships: []
      }
      politica_usuario: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          cuota_mb: number | null
          esfuerzo_max: string | null
          frecuencia_min_min: number | null
          habilitado: boolean | null
          max_tareas: number | null
          modelos: string[] | null
          nota: string | null
          perfil_id: string
          puede_compartir: boolean | null
          puede_programar: boolean | null
          tope_diario_usd: number | null
          tope_mensual_usd: number | null
          ventanas_por_dia: number | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          cuota_mb?: number | null
          esfuerzo_max?: string | null
          frecuencia_min_min?: number | null
          habilitado?: boolean | null
          max_tareas?: number | null
          modelos?: string[] | null
          nota?: string | null
          perfil_id: string
          puede_compartir?: boolean | null
          puede_programar?: boolean | null
          tope_diario_usd?: number | null
          tope_mensual_usd?: number | null
          ventanas_por_dia?: number | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          cuota_mb?: number | null
          esfuerzo_max?: string | null
          frecuencia_min_min?: number | null
          habilitado?: boolean | null
          max_tareas?: number | null
          modelos?: string[] | null
          nota?: string | null
          perfil_id?: string
          puede_compartir?: boolean | null
          puede_programar?: boolean | null
          tope_diario_usd?: number | null
          tope_mensual_usd?: number | null
          ventanas_por_dia?: number | null
        }
        Relationships: []
      }
      preferencia: {
        Row: {
          actualizado_en: string
          memoria: boolean
          perfil_id: string
        }
        Insert: {
          actualizado_en?: string
          memoria?: boolean
          perfil_id?: string
        }
        Update: {
          actualizado_en?: string
          memoria?: boolean
          perfil_id?: string
        }
        Relationships: []
      }
      proyecto: {
        Row: {
          actualizado_en: string
          creado_en: string
          dueno: string
          id: string
          instrucciones: string
          nombre: string
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          dueno?: string
          id?: string
          instrucciones?: string
          nombre: string
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          dueno?: string
          id?: string
          instrucciones?: string
          nombre?: string
        }
        Relationships: []
      }
      tarea: {
        Row: {
          actualizado_en: string
          cada_horas: number | null
          canales: string[]
          creado_en: string
          destinatarios: string[]
          dia_mes: number | null
          dias: number[]
          dueno: string
          en_mi_dia: boolean
          esfuerzo: string | null
          estado: string
          fallas_seguidas: number
          frecuencia: string
          fuentes_usadas: string[]
          hora: string
          html_grupo: string | null
          id: string
          instruccion: string
          modelo: string | null
          nombre: string
          origen_chat: string | null
          origen_mensaje: string | null
          pausada_motivo: string | null
          proxima_en: string | null
          proyecto_id: string | null
          tipo: string
          ultima_en: string | null
        }
        Insert: {
          actualizado_en?: string
          cada_horas?: number | null
          canales?: string[]
          creado_en?: string
          destinatarios?: string[]
          dia_mes?: number | null
          dias?: number[]
          dueno?: string
          en_mi_dia?: boolean
          esfuerzo?: string | null
          estado?: string
          fallas_seguidas?: number
          frecuencia: string
          fuentes_usadas?: string[]
          hora?: string
          html_grupo?: string | null
          id?: string
          instruccion: string
          modelo?: string | null
          nombre: string
          origen_chat?: string | null
          origen_mensaje?: string | null
          pausada_motivo?: string | null
          proxima_en?: string | null
          proyecto_id?: string | null
          tipo?: string
          ultima_en?: string | null
        }
        Update: {
          actualizado_en?: string
          cada_horas?: number | null
          canales?: string[]
          creado_en?: string
          destinatarios?: string[]
          dia_mes?: number | null
          dias?: number[]
          dueno?: string
          en_mi_dia?: boolean
          esfuerzo?: string | null
          estado?: string
          fallas_seguidas?: number
          frecuencia?: string
          fuentes_usadas?: string[]
          hora?: string
          html_grupo?: string | null
          id?: string
          instruccion?: string
          modelo?: string | null
          nombre?: string
          origen_chat?: string | null
          origen_mensaje?: string | null
          pausada_motivo?: string | null
          proxima_en?: string | null
          proyecto_id?: string | null
          tipo?: string
          ultima_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarea_origen_chat_fkey"
            columns: ["origen_chat"]
            isOneToOne: false
            referencedRelation: "chat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarea_origen_mensaje_fkey"
            columns: ["origen_mensaje"]
            isOneToOne: false
            referencedRelation: "mensaje"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarea_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyecto"
            referencedColumns: ["id"]
          },
        ]
      }
      turno: {
        Row: {
          busquedas: number
          categoria: string | null
          chat_id: string
          continuacion: Json | null
          corrida_id: string | null
          costo_usd: number
          creado_en: string
          detener: boolean
          duracion_ms: number | null
          empezado_en: string | null
          error: string | null
          esfuerzo: string
          estado: string
          id: string
          latido: string | null
          modelo: string
          modo: string
          motor: string
          primer_token_ms: number | null
          reserva_usd: number
          segundos_contenedor: number
          solicitante: string
          terminado_en: string | null
          tokens_cache_escribe: number
          tokens_cache_lee: number
          tokens_entrada: number
          tokens_salida: number
          tramos: number
        }
        Insert: {
          busquedas?: number
          categoria?: string | null
          chat_id: string
          continuacion?: Json | null
          corrida_id?: string | null
          costo_usd?: number
          creado_en?: string
          detener?: boolean
          duracion_ms?: number | null
          empezado_en?: string | null
          error?: string | null
          esfuerzo: string
          estado?: string
          id?: string
          latido?: string | null
          modelo: string
          modo?: string
          motor: string
          primer_token_ms?: number | null
          reserva_usd?: number
          segundos_contenedor?: number
          solicitante?: string
          terminado_en?: string | null
          tokens_cache_escribe?: number
          tokens_cache_lee?: number
          tokens_entrada?: number
          tokens_salida?: number
          tramos?: number
        }
        Update: {
          busquedas?: number
          categoria?: string | null
          chat_id?: string
          continuacion?: Json | null
          corrida_id?: string | null
          costo_usd?: number
          creado_en?: string
          detener?: boolean
          duracion_ms?: number | null
          empezado_en?: string | null
          error?: string | null
          esfuerzo?: string
          estado?: string
          id?: string
          latido?: string | null
          modelo?: string
          modo?: string
          motor?: string
          primer_token_ms?: number | null
          reserva_usd?: number
          segundos_contenedor?: number
          solicitante?: string
          terminado_en?: string | null
          tokens_cache_escribe?: number
          tokens_cache_lee?: number
          tokens_entrada?: number
          tokens_salida?: number
          tramos?: number
        }
        Relationships: [
          {
            foreignKeyName: "turno_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turno_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corrida"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anotar_tope: {
        Args: { p_motivo: string; p_renueva: string }
        Returns: undefined
      }
      avisos_renovados: {
        Args: { p_ahora?: string }
        Returns: {
          motivo: string
          perfil_id: string
        }[]
      }
      borrar_microsoft: { Args: { p_perfil: string }; Returns: undefined }
      buscar_documentos: {
        Args: { p_consulta: string; p_limite?: number }
        Returns: {
          archivo: string
          archivo_id: string
          codigo: string
          documento_id: string
          estado: string
          extracto: string
          pagina: number
          rango: number
          titulo: string
        }[]
      }
      buscar_en_chats: {
        Args: {
          p_excluir?: string
          p_limite?: number
          p_perfil: string
          p_texto: string
        }
        Returns: {
          chat_id: string
          fecha: string
          fragmento: string
          titulo: string
        }[]
      }
      capacidades: { Args: { p_motor?: string }; Returns: Json }
      consumo: {
        Args: { p_desde: string; p_hasta?: string }
        Returns: {
          a_favor: number
          costo_usd: number
          en_contra: number
          fallidos: number
          nombre: string
          perfil_id: string
          primer_token_p90_ms: number
          tokens_entrada: number
          tokens_salida: number
          turnos: number
        }[]
      }
      consumo_por: {
        Args: { p_desde: string; p_eje: string }
        Returns: {
          clave: string
          costo_usd: number
          primer_token_p90_ms: number
          turnos: number
        }[]
      }
      correr_ahora: { Args: { p_tarea: string }; Returns: string }
      credencial_microsoft: { Args: never; Returns: Json }
      desconectar_microsoft: { Args: never; Returns: undefined }
      fuentes_del_chat: {
        Args: { p_chat: string }
        Returns: {
          fuente: string
          veces: number
        }[]
      }
      guardar_credencial_microsoft: {
        Args: { p_certificado: string; p_clave: string }
        Returns: undefined
      }
      guardar_microsoft: {
        Args: {
          p_cuenta: string
          p_nombre: string
          p_perfil: string
          p_renovacion: string
        }
        Returns: undefined
      }
      invitar: {
        Args: { p_chat: string; p_perfil: string }
        Returns: undefined
      }
      leer_para_soporte: {
        Args: { p_chat: string; p_motivo: string; p_ticket?: string }
        Returns: {
          adjuntos: string[]
          autor: string | null
          bloques: Json
          calificacion: number | null
          calificacion_nota: string | null
          chat_id: string
          creado_en: string
          id: string
          rol: string
          texto: string
          turno_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "mensaje"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mi_alcance: {
        Args: never
        Returns: {
          fuente: string
          sensible: boolean
        }[]
      }
      mi_excepcion: { Args: never; Returns: boolean }
      mi_politica: { Args: never; Returns: Json }
      participantes: {
        Args: { p_chat: string }
        Returns: {
          nombre: string
          perfil_id: string
          rol: string
        }[]
      }
      personas_con_archivos: {
        Args: never
        Returns: {
          nombre: string
          perfil_id: string
        }[]
      }
      personas_con_asistente: {
        Args: never
        Returns: {
          nombre: string
          perfil_id: string
        }[]
      }
      plano: { Args: { t: string }; Returns: string }
      politica_de: { Args: { p_perfil: string }; Returns: Json }
      proxima_ejecucion: {
        Args: {
          p_desde: string
          t: Database["asistente"]["Tables"]["tarea"]["Row"]
        }
        Returns: string
      }
      renovacion_microsoft: { Args: { p_perfil: string }; Returns: string }
      reservar_turno: {
        Args: { p_reserva_usd: number; p_turno: string }
        Returns: string
      }
      tareas_resumen: { Args: never; Returns: Json }
      tiene_archivos: { Args: { p_perfil: string }; Returns: boolean }
      tomar_vencidas: {
        Args: { p_ahora?: string; p_limite?: number }
        Returns: {
          chat_id: string | null
          creado_en: string
          dueno: string
          empezado_en: string | null
          entregas: Json
          error: string | null
          estado: string
          id: string
          intento: number
          manual: boolean
          programada_para: string
          reintentar_en: string | null
          tarea_id: string
          terminado_en: string | null
          turno_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "corrida"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      ventana_de: {
        Args: { p_ahora?: string; p_perfil: string }
        Returns: {
          gastado: number
          inicio: string
          renueva: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  control: {
    Tables: {
      auditoria: {
        Row: {
          accion: string
          actor: string | null
          actor_es_ia: boolean
          antes: Json | null
          despues: Json | null
          en: string
          esquema: string
          hash: string
          hash_previo: string | null
          id: number
          registro_id: string
          tabla: string
        }
        Insert: {
          accion: string
          actor?: string | null
          actor_es_ia?: boolean
          antes?: Json | null
          despues?: Json | null
          en?: string
          esquema: string
          hash: string
          hash_previo?: string | null
          id?: never
          registro_id: string
          tabla: string
        }
        Update: {
          accion?: string
          actor?: string | null
          actor_es_ia?: boolean
          antes?: Json | null
          despues?: Json | null
          en?: string
          esquema?: string
          hash?: string
          hash_previo?: string | null
          id?: never
          registro_id?: string
          tabla?: string
        }
        Relationships: []
      }
      catalogo: {
        Row: {
          activo: boolean
          clave: string
          descripcion: string | null
          etiqueta: string
          orden: number
          tipo: string
        }
        Insert: {
          activo?: boolean
          clave: string
          descripcion?: string | null
          etiqueta: string
          orden?: number
          tipo: string
        }
        Update: {
          activo?: boolean
          clave?: string
          descripcion?: string | null
          etiqueta?: string
          orden?: number
          tipo?: string
        }
        Relationships: []
      }
      conciliacion: {
        Row: {
          creado_en: string
          descripcion: string
          estado: string
          fuente: string | null
          id: string
          modulo: string
          objeto: string | null
          resolucion: string | null
          responsable: string | null
          resuelto_en: string | null
          resuelto_por: string | null
          tipo: string
        }
        Insert: {
          creado_en?: string
          descripcion: string
          estado?: string
          fuente?: string | null
          id?: string
          modulo: string
          objeto?: string | null
          resolucion?: string | null
          responsable?: string | null
          resuelto_en?: string | null
          resuelto_por?: string | null
          tipo: string
        }
        Update: {
          creado_en?: string
          descripcion?: string
          estado?: string
          fuente?: string | null
          id?: string
          modulo?: string
          objeto?: string | null
          resolucion?: string | null
          responsable?: string | null
          resuelto_en?: string | null
          resuelto_por?: string | null
          tipo?: string
        }
        Relationships: []
      }
      decision_plataforma: {
        Row: {
          actualizado_en: string
          antes_de: string | null
          codigo: string
          decidida_en: string | null
          decision: string | null
          estado: string
          fecha_limite: string | null
          id: string
          opcion_por_defecto: string | null
          opciones: string | null
          orden: number
          pregunta: string
          solo_equipo: boolean
        }
        Insert: {
          actualizado_en?: string
          antes_de?: string | null
          codigo: string
          decidida_en?: string | null
          decision?: string | null
          estado?: string
          fecha_limite?: string | null
          id?: string
          opcion_por_defecto?: string | null
          opciones?: string | null
          orden?: number
          pregunta: string
          solo_equipo?: boolean
        }
        Update: {
          actualizado_en?: string
          antes_de?: string | null
          codigo?: string
          decidida_en?: string | null
          decision?: string | null
          estado?: string
          fecha_limite?: string | null
          id?: string
          opcion_por_defecto?: string | null
          opciones?: string | null
          orden?: number
          pregunta?: string
          solo_equipo?: boolean
        }
        Relationships: []
      }
      fase_plataforma: {
        Row: {
          actual: boolean
          actualizado_en: string
          clave: string
          contiene: string | null
          contratada: boolean
          criterio_salida: string | null
          estado: string
          fin: string | null
          id: string
          inicio: string | null
          nombre: string
          orden: number
          periodo_texto: string | null
          situacion: string | null
        }
        Insert: {
          actual?: boolean
          actualizado_en?: string
          clave: string
          contiene?: string | null
          contratada?: boolean
          criterio_salida?: string | null
          estado?: string
          fin?: string | null
          id?: string
          inicio?: string | null
          nombre: string
          orden?: number
          periodo_texto?: string | null
          situacion?: string | null
        }
        Update: {
          actual?: boolean
          actualizado_en?: string
          clave?: string
          contiene?: string | null
          contratada?: boolean
          criterio_salida?: string | null
          estado?: string
          fin?: string | null
          id?: string
          inicio?: string | null
          nombre?: string
          orden?: number
          periodo_texto?: string | null
          situacion?: string | null
        }
        Relationships: []
      }
      hito_plataforma: {
        Row: {
          actualizado_en: string
          clave: string
          dueno: string | null
          estado: string
          fase: string | null
          fecha: string | null
          id: string
          nota_interna: string | null
          orden: number
          titulo: string
        }
        Insert: {
          actualizado_en?: string
          clave: string
          dueno?: string | null
          estado?: string
          fase?: string | null
          fecha?: string | null
          id?: string
          nota_interna?: string | null
          orden?: number
          titulo: string
        }
        Update: {
          actualizado_en?: string
          clave?: string
          dueno?: string | null
          estado?: string
          fase?: string | null
          fecha?: string | null
          id?: string
          nota_interna?: string | null
          orden?: number
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "hito_plataforma_fase_fkey"
            columns: ["fase"]
            isOneToOne: false
            referencedRelation: "fase_plataforma"
            referencedColumns: ["clave"]
          },
        ]
      }
      lectura_paralelo: {
        Row: {
          dia: string
          perfil_id: string
          primera: string
        }
        Insert: {
          dia?: string
          perfil_id: string
          primera?: string
        }
        Update: {
          dia?: string
          perfil_id?: string
          primera?: string
        }
        Relationships: []
      }
      modulo: {
        Row: {
          codigo: string
          construido: string | null
          descripcion: string | null
          dominio: string
          dueno: string | null
          en_plan: boolean
          estado: string
          fase: string | null
          fase_clave: string | null
          frontera: string | null
          nombre: string
          orden: number
          recurso: string | null
          ref: string
          ruta: string | null
        }
        Insert: {
          codigo: string
          construido?: string | null
          descripcion?: string | null
          dominio: string
          dueno?: string | null
          en_plan?: boolean
          estado?: string
          fase?: string | null
          fase_clave?: string | null
          frontera?: string | null
          nombre: string
          orden?: number
          recurso?: string | null
          ref?: string
          ruta?: string | null
        }
        Update: {
          codigo?: string
          construido?: string | null
          descripcion?: string | null
          dominio?: string
          dueno?: string | null
          en_plan?: boolean
          estado?: string
          fase?: string | null
          fase_clave?: string | null
          frontera?: string | null
          nombre?: string
          orden?: number
          recurso?: string | null
          ref?: string
          ruta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modulo_fase_clave_fkey"
            columns: ["fase_clave"]
            isOneToOne: false
            referencedRelation: "fase_plataforma"
            referencedColumns: ["clave"]
          },
        ]
      }
      parametro: {
        Row: {
          clave: string
          fuente: string | null
          id: string
          nombre: string
          por_confirmar: boolean
          unidad: string
          valor: number
          vigencia: unknown
        }
        Insert: {
          clave: string
          fuente?: string | null
          id?: string
          nombre: string
          por_confirmar?: boolean
          unidad: string
          valor: number
          vigencia?: unknown
        }
        Update: {
          clave?: string
          fuente?: string | null
          id?: string
          nombre?: string
          por_confirmar?: boolean
          unidad?: string
          valor?: number
          vigencia?: unknown
        }
        Relationships: []
      }
      pendiente_plataforma: {
        Row: {
          actualizado_en: string
          bloquea: string | null
          clave: string
          detalle: string | null
          dueno_cargo: string | null
          dueno_tipo: string
          estado: string
          fecha_limite: string | null
          fecha_texto: string | null
          id: string
          orden: number
          origen: string | null
          resuelto_en: string | null
          solo_equipo: boolean
          titulo: string
        }
        Insert: {
          actualizado_en?: string
          bloquea?: string | null
          clave: string
          detalle?: string | null
          dueno_cargo?: string | null
          dueno_tipo: string
          estado?: string
          fecha_limite?: string | null
          fecha_texto?: string | null
          id?: string
          orden?: number
          origen?: string | null
          resuelto_en?: string | null
          solo_equipo?: boolean
          titulo: string
        }
        Update: {
          actualizado_en?: string
          bloquea?: string | null
          clave?: string
          detalle?: string | null
          dueno_cargo?: string | null
          dueno_tipo?: string
          estado?: string
          fecha_limite?: string | null
          fecha_texto?: string | null
          id?: string
          orden?: number
          origen?: string | null
          resuelto_en?: string | null
          solo_equipo?: boolean
          titulo?: string
        }
        Relationships: []
      }
      tasa_cambio: {
        Row: {
          capturada_en: string
          creado_por: string | null
          estado: string
          fecha_valor: string
          fuente: string
          id: number
          lado: string
          metodo: string
          moneda: string
          motivo: string | null
          payload: Json | null
          publicada_en: string | null
          reemplaza_id: number | null
          tasa: number
          tipo: string
          verificada_con: string | null
        }
        Insert: {
          capturada_en?: string
          creado_por?: string | null
          estado?: string
          fecha_valor: string
          fuente: string
          id?: never
          lado?: string
          metodo: string
          moneda: string
          motivo?: string | null
          payload?: Json | null
          publicada_en?: string | null
          reemplaza_id?: number | null
          tasa: number
          tipo: string
          verificada_con?: string | null
        }
        Update: {
          capturada_en?: string
          creado_por?: string | null
          estado?: string
          fecha_valor?: string
          fuente?: string
          id?: never
          lado?: string
          metodo?: string
          moneda?: string
          motivo?: string | null
          payload?: Json | null
          publicada_en?: string | null
          reemplaza_id?: number | null
          tasa?: number
          tipo?: string
          verificada_con?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasa_cambio_reemplaza_id_fkey"
            columns: ["reemplaza_id"]
            isOneToOne: false
            referencedRelation: "tasa_cambio"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cargar_tasa_manual: {
        Args: {
          p_fecha_valor: string
          p_moneda: string
          p_motivo: string
          p_tasa: number
          p_tipo: string
        }
        Returns: number
      }
      historial_tasas: {
        Args: never
        Returns: {
          capturada_en: string
          creado_por: string | null
          estado: string
          fecha_valor: string
          fuente: string
          id: number
          lado: string
          metodo: string
          moneda: string
          motivo: string | null
          payload: Json | null
          publicada_en: string | null
          reemplaza_id: number | null
          tasa: number
          tipo: string
          verificada_con: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "tasa_cambio"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      notas_hitos: {
        Args: never
        Returns: {
          id: string
          nota_interna: string
        }[]
      }
      puede_conciliar: { Args: { p_modulo: string }; Returns: boolean }
      resolver_conciliacion: {
        Args: { p_estado: string; p_id: string; p_resolucion?: string }
        Returns: undefined
      }
      serie_tasas: {
        Args: { p_desde: string; p_hasta?: string }
        Returns: {
          brecha: number
          dia: string
          eur: number
          paralelo: number
          usd: number
          usd_fecha_valor: string
        }[]
      }
      tasas_del_dia: { Args: { p_dia?: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  flujo: {
    Tables: {
      paso: {
        Row: {
          accion: string
          aprobador_perfil: string | null
          aprobador_plaza_ref: string | null
          comentario: string | null
          decidido_en: string | null
          decidido_por: string | null
          decision: string
          hito: boolean
          id: string
          nombre: string
          orden: number
          por_suplencia: boolean
          regla: Json | null
          solicitud_id: string
          ve_costos: boolean
        }
        Insert: {
          accion: string
          aprobador_perfil?: string | null
          aprobador_plaza_ref?: string | null
          comentario?: string | null
          decidido_en?: string | null
          decidido_por?: string | null
          decision?: string
          hito?: boolean
          id?: string
          nombre: string
          orden: number
          por_suplencia?: boolean
          regla?: Json | null
          solicitud_id: string
          ve_costos?: boolean
        }
        Update: {
          accion?: string
          aprobador_perfil?: string | null
          aprobador_plaza_ref?: string | null
          comentario?: string | null
          decidido_en?: string | null
          decidido_por?: string | null
          decision?: string
          hito?: boolean
          id?: string
          nombre?: string
          orden?: number
          por_suplencia?: boolean
          regla?: Json | null
          solicitud_id?: string
          ve_costos?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "paso_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitud"
            referencedColumns: ["id"]
          },
        ]
      }
      ruta: {
        Row: {
          activa: boolean
          descripcion: string | null
          id: string
          nombre: string
          permite_suplencia_repetida: boolean
          tipo_objeto: string
          vigencia: unknown
        }
        Insert: {
          activa?: boolean
          descripcion?: string | null
          id?: string
          nombre: string
          permite_suplencia_repetida?: boolean
          tipo_objeto: string
          vigencia?: unknown
        }
        Update: {
          activa?: boolean
          descripcion?: string | null
          id?: string
          nombre?: string
          permite_suplencia_repetida?: boolean
          tipo_objeto?: string
          vigencia?: unknown
        }
        Relationships: []
      }
      ruta_paso: {
        Row: {
          accion: string
          cargo_id: string | null
          condicion: Json | null
          hito: boolean
          id: string
          nombre: string
          orden: number
          permiso: string | null
          plaza_ref: string | null
          resolutor: string
          rol_id: string | null
          ruta_id: string
          ve_costos: boolean
        }
        Insert: {
          accion?: string
          cargo_id?: string | null
          condicion?: Json | null
          hito?: boolean
          id?: string
          nombre: string
          orden: number
          permiso?: string | null
          plaza_ref?: string | null
          resolutor: string
          rol_id?: string | null
          ruta_id: string
          ve_costos?: boolean
        }
        Update: {
          accion?: string
          cargo_id?: string | null
          condicion?: Json | null
          hito?: boolean
          id?: string
          nombre?: string
          orden?: number
          permiso?: string | null
          plaza_ref?: string | null
          resolutor?: string
          rol_id?: string | null
          ruta_id?: string
          ve_costos?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ruta_paso_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "ruta"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitud: {
        Row: {
          cerrado_en: string | null
          creado_en: string
          creado_por: string | null
          estado: string
          id: string
          objeto_id: string
          paso_actual: number | null
          ruta_id: string
          tipo_objeto: string
          titulo: string
        }
        Insert: {
          cerrado_en?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: string
          id?: string
          objeto_id: string
          paso_actual?: number | null
          ruta_id: string
          tipo_objeto: string
          titulo: string
        }
        Update: {
          cerrado_en?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: string
          id?: string
          objeto_id?: string
          paso_actual?: number | null
          ruta_id?: string
          tipo_objeto?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitud_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "ruta"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      al_decidir: {
        Args: {
          p_accion: string
          p_decision: string
          p_estado_solicitud: string
          p_hito: boolean
          p_objeto: string
          p_tipo: string
        }
        Returns: undefined
      }
      bandeja: {
        Args: never
        Returns: {
          accion: string
          aprobador_perfil: string
          aprobador_plaza_ref: string
          esperando_desde: string
          hito: boolean
          objeto_id: string
          orden: number
          paso: string
          paso_id: string
          pedido_en: string
          pedido_por: string
          pedido_por_nombre: string
          regla: Json
          solicitud_id: string
          tipo_objeto: string
          titulo: string
          ve_costos: boolean
        }[]
      }
      decidir: {
        Args: { p_comentario?: string; p_decision: string; p_paso: string }
        Returns: string
      }
      firmo_en: { Args: { p_solicitud: string }; Returns: boolean }
      firmo_objeto: { Args: { p_objeto: string }; Returns: boolean }
      iniciar: {
        Args: {
          p_contexto?: Json
          p_objeto: string
          p_tipo: string
          p_titulo: string
          p_unidad: string
        }
        Returns: string
      }
      nombres: {
        Args: { p_ids: string[] }
        Returns: {
          id: string
          nombre: string
        }[]
      }
      pedi_yo: { Args: { p_solicitud: string }; Returns: boolean }
      puede_decidir: { Args: { p_paso: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  ia: {
    Tables: {
      actividad: {
        Row: {
          accion: string
          actor_es_ia: boolean
          aprobado_por: string | null
          capacidad: string | null
          costo_tokens: number | null
          costo_usd: number
          creado_en: string
          evidencia: Json
          id: string
          latencia_ms: number | null
          modelo: string | null
          nivel: string | null
          objeto_id: string | null
          objeto_tipo: string | null
          pedido_por: string | null
          propuesta_id: string | null
          resumen: string
          tokens_entrada: number
          tokens_salida: number
        }
        Insert: {
          accion: string
          actor_es_ia?: boolean
          aprobado_por?: string | null
          capacidad?: string | null
          costo_tokens?: number | null
          costo_usd?: number
          creado_en?: string
          evidencia?: Json
          id?: string
          latencia_ms?: number | null
          modelo?: string | null
          nivel?: string | null
          objeto_id?: string | null
          objeto_tipo?: string | null
          pedido_por?: string | null
          propuesta_id?: string | null
          resumen: string
          tokens_entrada?: number
          tokens_salida?: number
        }
        Update: {
          accion?: string
          actor_es_ia?: boolean
          aprobado_por?: string | null
          capacidad?: string | null
          costo_tokens?: number | null
          costo_usd?: number
          creado_en?: string
          evidencia?: Json
          id?: string
          latencia_ms?: number | null
          modelo?: string | null
          nivel?: string | null
          objeto_id?: string | null
          objeto_tipo?: string | null
          pedido_por?: string | null
          propuesta_id?: string | null
          resumen?: string
          tokens_entrada?: number
          tokens_salida?: number
        }
        Relationships: [
          {
            foreignKeyName: "actividad_capacidad_fkey"
            columns: ["capacidad"]
            isOneToOne: false
            referencedRelation: "capacidad"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "actividad_propuesta_id_fkey"
            columns: ["propuesta_id"]
            isOneToOne: false
            referencedRelation: "propuesta"
            referencedColumns: ["id"]
          },
        ]
      }
      cambio_nivel: {
        Row: {
          a: string
          capacidad: string
          cerrado_en: string | null
          de: string
          estado: string
          evidencia: string | null
          id: string
          motivo: string
          pedido_en: string
          pedido_por: string
          solicitud_id: string | null
        }
        Insert: {
          a: string
          capacidad: string
          cerrado_en?: string | null
          de: string
          estado?: string
          evidencia?: string | null
          id?: string
          motivo: string
          pedido_en?: string
          pedido_por?: string
          solicitud_id?: string | null
        }
        Update: {
          a?: string
          capacidad?: string
          cerrado_en?: string | null
          de?: string
          estado?: string
          evidencia?: string | null
          id?: string
          motivo?: string
          pedido_en?: string
          pedido_por?: string
          solicitud_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cambio_nivel_capacidad_fkey"
            columns: ["capacidad"]
            isOneToOne: false
            referencedRelation: "capacidad"
            referencedColumns: ["codigo"]
          },
        ]
      }
      capacidad: {
        Row: {
          absorbida_por: string | null
          actualizado_en: string
          codigo: string
          creado_en: string
          dueno_cargo: string
          encendida: boolean
          evidencia_para_subir: string | null
          modulo: string
          nivel_actual: string
          nombre: string
          nota: string | null
          objeto_tipos: string[]
          perimetro: boolean
          que_hace: string
          techo: string
          uso: string
        }
        Insert: {
          absorbida_por?: string | null
          actualizado_en?: string
          codigo: string
          creado_en?: string
          dueno_cargo: string
          encendida?: boolean
          evidencia_para_subir?: string | null
          modulo: string
          nivel_actual?: string
          nombre: string
          nota?: string | null
          objeto_tipos?: string[]
          perimetro?: boolean
          que_hace: string
          techo: string
          uso: string
        }
        Update: {
          absorbida_por?: string | null
          actualizado_en?: string
          codigo?: string
          creado_en?: string
          dueno_cargo?: string
          encendida?: boolean
          evidencia_para_subir?: string | null
          modulo?: string
          nivel_actual?: string
          nombre?: string
          nota?: string | null
          objeto_tipos?: string[]
          perimetro?: boolean
          que_hace?: string
          techo?: string
          uso?: string
        }
        Relationships: [
          {
            foreignKeyName: "capacidad_absorbida_por_fkey"
            columns: ["absorbida_por"]
            isOneToOne: false
            referencedRelation: "capacidad"
            referencedColumns: ["codigo"]
          },
        ]
      }
      interruptor_general: {
        Row: {
          cambiado_en: string
          cambiado_por: string | null
          encendido: boolean
          id: boolean
          motivo: string | null
        }
        Insert: {
          cambiado_en?: string
          cambiado_por?: string | null
          encendido?: boolean
          id?: boolean
          motivo?: string | null
        }
        Update: {
          cambiado_en?: string
          cambiado_por?: string | null
          encendido?: boolean
          id?: boolean
          motivo?: string | null
        }
        Relationships: []
      }
      propuesta: {
        Row: {
          capacidad: string
          creado_en: string
          cuerpo: string
          decidido_en: string | null
          decidido_por: string | null
          deshacer_hasta: string | null
          estado: string
          evidencia: Json
          explicacion: string | null
          id: string
          motivo: string | null
          nivel: string
          objeto_id: string
          objeto_tipo: string
          payload: Json
          pedido_por: string | null
          regla: string
          titulo: string
        }
        Insert: {
          capacidad: string
          creado_en?: string
          cuerpo: string
          decidido_en?: string | null
          decidido_por?: string | null
          deshacer_hasta?: string | null
          estado?: string
          evidencia?: Json
          explicacion?: string | null
          id?: string
          motivo?: string | null
          nivel: string
          objeto_id: string
          objeto_tipo: string
          payload?: Json
          pedido_por?: string | null
          regla: string
          titulo: string
        }
        Update: {
          capacidad?: string
          creado_en?: string
          cuerpo?: string
          decidido_en?: string | null
          decidido_por?: string | null
          deshacer_hasta?: string | null
          estado?: string
          evidencia?: Json
          explicacion?: string | null
          id?: string
          motivo?: string | null
          nivel?: string
          objeto_id?: string
          objeto_tipo?: string
          payload?: Json
          pedido_por?: string | null
          regla?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "propuesta_capacidad_fkey"
            columns: ["capacidad"]
            isOneToOne: false
            referencedRelation: "capacidad"
            referencedColumns: ["codigo"]
          },
        ]
      }
      reserva: {
        Row: {
          capacidad: string
          creado_en: string
          id: string
          monto_usd: number
          perfil: string
        }
        Insert: {
          capacidad: string
          creado_en?: string
          id?: string
          monto_usd: number
          perfil: string
        }
        Update: {
          capacidad?: string
          creado_en?: string
          id?: string
          monto_usd?: number
          perfil?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      al_decidir_nivel: {
        Args: {
          p_cambio: string
          p_decision: string
          p_estado_solicitud: string
        }
        Returns: undefined
      }
      aplicar_metadatos: {
        Args: { p_cambios: Json; p_doc: string }
        Returns: undefined
      }
      candidatos_clasificacion: {
        Args: { p_limite?: number }
        Returns: {
          codigo: string
          estado: string
          evidencia_estado: string
          familia: string
          fecha: string
          id: string
          proceso: string
          proceso_ref: string
          proceso_xx: string
          tipo_yy: string
          titulo: string
          version: string
        }[]
      }
      decidir_propuesta: {
        Args: {
          p_cambios?: Json
          p_decision: string
          p_id: string
          p_motivo?: string
        }
        Returns: string
      }
      deshacer: { Args: { p_id: string; p_motivo?: string }; Returns: string }
      encender: {
        Args: { p_codigo: string; p_encendida: boolean; p_motivo?: string }
        Returns: boolean
      }
      estado: { Args: never; Returns: Json }
      explicar_propuestas: { Args: { p_items: Json }; Returns: number }
      explicar_propuestas_servicio: {
        Args: { p_items: Json; p_perfil: string }
        Returns: number
      }
      fijar_interruptor: {
        Args: { p_encendido: boolean; p_motivo?: string }
        Returns: boolean
      }
      fijar_tope: { Args: { p_motivo: string; p_usd: number }; Returns: number }
      gastado_hoy: { Args: never; Returns: number }
      liberar_reserva_servicio: {
        Args: { p_perfil: string; p_reserva: string }
        Returns: undefined
      }
      mis_propuestas: {
        Args: { p_limite?: number }
        Returns: {
          capacidad: string
          creado_en: string
          id: string
          nivel: string
          objeto: string
          objeto_id: string
          objeto_tipo: string
          titulo: string
          total: number
        }[]
      }
      motivo_bloqueo: { Args: { p_codigo: string }; Returns: string }
      n: { Args: { p: string }; Returns: number }
      pedir_cambio_nivel: {
        Args: {
          p_codigo: string
          p_evidencia?: string
          p_motivo: string
          p_nivel: string
        }
        Returns: string
      }
      proponer_clasificacion: {
        Args: { p_items: Json }
        Returns: {
          documento: string
          estado: string
          id: string
          nivel: string
          titulo: string
        }[]
      }
      puede_decidir_tipo: { Args: { p_tipo: string }; Returns: boolean }
      registrar_llamada: {
        Args: {
          p_accion: string
          p_capacidad: string
          p_costo_usd: number
          p_evidencia: Json
          p_latencia_ms: number
          p_modelo: string
          p_objeto_id?: string
          p_objeto_tipo?: string
          p_resumen: string
          p_tokens_entrada: number
          p_tokens_salida: number
        }
        Returns: string
      }
      registrar_llamada_servicio: {
        Args: {
          p_accion: string
          p_capacidad: string
          p_costo_usd: number
          p_evidencia: Json
          p_latencia_ms: number
          p_modelo: string
          p_objeto_id?: string
          p_objeto_tipo?: string
          p_perfil: string
          p_reserva: string
          p_resumen: string
          p_tokens_entrada: number
          p_tokens_salida: number
        }
        Returns: string
      }
      reservar_llamada_servicio: {
        Args: {
          p_capacidad: string
          p_perfil: string
          p_reserva_usd?: number
          p_tope_persona?: number
        }
        Returns: string
      }
      revisar_plazas: {
        Args: never
        Returns: {
          cuerpo: string
          evidencia: Json
          id: string
          objeto_id: string
          regla: string
          titulo: string
        }[]
      }
      tablero: { Args: never; Returns: Json }
      tope_diario: { Args: never; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  nucleo: {
    Tables: {
      evento: {
        Row: {
          actor_es_ia: boolean
          autor: string | null
          capacidad_ia: string | null
          creado_en: string
          datos: Json
          editado_en: string | null
          id: string
          nivel_ia: string | null
          objeto_id: string
          objeto_tipo: string
          oculto: boolean
          padre_id: string | null
          texto: string | null
          tipo: string
        }
        Insert: {
          actor_es_ia?: boolean
          autor?: string | null
          capacidad_ia?: string | null
          creado_en?: string
          datos?: Json
          editado_en?: string | null
          id?: string
          nivel_ia?: string | null
          objeto_id: string
          objeto_tipo: string
          oculto?: boolean
          padre_id?: string | null
          texto?: string | null
          tipo: string
        }
        Update: {
          actor_es_ia?: boolean
          autor?: string | null
          capacidad_ia?: string | null
          creado_en?: string
          datos?: Json
          editado_en?: string | null
          id?: string
          nivel_ia?: string | null
          objeto_id?: string
          objeto_tipo?: string
          oculto?: boolean
          padre_id?: string | null
          texto?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "evento_padre_id_fkey"
            columns: ["padre_id"]
            isOneToOne: false
            referencedRelation: "evento"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacion: {
        Row: {
          actor: string | null
          creado_en: string
          destinatario: string
          detalle: string | null
          enlace: string | null
          evento_id: string | null
          id: string
          leida_en: string | null
          objeto_id: string | null
          objeto_tipo: string | null
          texto: string
          tipo: string
        }
        Insert: {
          actor?: string | null
          creado_en?: string
          destinatario: string
          detalle?: string | null
          enlace?: string | null
          evento_id?: string | null
          id?: string
          leida_en?: string | null
          objeto_id?: string | null
          objeto_tipo?: string | null
          texto: string
          tipo: string
        }
        Update: {
          actor?: string | null
          creado_en?: string
          destinatario?: string
          detalle?: string | null
          enlace?: string | null
          evento_id?: string | null
          id?: string
          leida_en?: string | null
          objeto_id?: string | null
          objeto_tipo?: string | null
          texto?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacion_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "evento"
            referencedColumns: ["id"]
          },
        ]
      }
      seguimiento: {
        Row: {
          creado_en: string
          objeto_id: string
          objeto_tipo: string
          perfil: string
        }
        Insert: {
          creado_en?: string
          objeto_id: string
          objeto_tipo: string
          perfil: string
        }
        Update: {
          creado_en?: string
          objeto_id?: string
          objeto_tipo?: string
          perfil?: string
        }
        Relationships: []
      }
      tarea: {
        Row: {
          asignada_a: string
          cerrada_en: string | null
          creada_por: string
          creado_en: string
          detalle: string | null
          estado: string
          id: string
          objeto_id: string | null
          objeto_tipo: string | null
          titulo: string
          vence: string | null
        }
        Insert: {
          asignada_a: string
          cerrada_en?: string | null
          creada_por?: string
          creado_en?: string
          detalle?: string | null
          estado?: string
          id?: string
          objeto_id?: string | null
          objeto_tipo?: string | null
          titulo: string
          vence?: string | null
        }
        Update: {
          asignada_a?: string
          cerrada_en?: string | null
          creada_por?: string
          creado_en?: string
          detalle?: string | null
          estado?: string
          id?: string
          objeto_id?: string | null
          objeto_tipo?: string | null
          titulo?: string
          vence?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cambios: {
        Args: { p_id: string; p_limite?: number; p_tipo: string }
        Returns: {
          accion: string
          actor: string
          actor_nombre: string
          cambios: Json
          en: string
          extra: Json
          id: number
          tabla: string
        }[]
      }
      comentar: {
        Args: {
          p_id: string
          p_menciones?: string[]
          p_padre?: string
          p_texto: string
          p_tipo: string
        }
        Returns: string
      }
      marcar_leidas: { Args: { p_ids?: string[] }; Returns: number }
      mencionables: {
        Args: { p_id: string; p_q?: string; p_tipo: string }
        Returns: {
          cargo: string
          id: string
          nombre: string
        }[]
      }
      mi_cargo: { Args: never; Returns: Json }
      mis_documentos: {
        Args: never
        Returns: {
          codigo: string
          fecha: string
          id: string
          proceso: string
          relacion: string
          titulo: string
          version: string
        }[]
      }
      mis_procesos: {
        Args: never
        Returns: {
          codigo: string
          dueno: string
          nivel: number
          nivel_nombre: string
          nombre: string
          objetivo: string
          ref: string
          relacion: string
        }[]
      }
      no_leidas: { Args: never; Returns: number }
      nombres: {
        Args: { p_ids: string[] }
        Returns: {
          id: string
          nombre: string
        }[]
      }
      personas: {
        Args: { p_q?: string }
        Returns: {
          cargo: string
          id: string
          nombre: string
        }[]
      }
      puede_ver_objeto: {
        Args: { p_id: string; p_tipo: string }
        Returns: boolean
      }
      titulos_objetos: {
        Args: { p_ids: string[]; p_tipos: string[] }
        Returns: {
          id: string
          tipo: string
          titulo: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  org: {
    Tables: {
      cambio: {
        Row: {
          args: Json
          creado_en: string
          descripcion: string
          escenario_id: string
          funcion: string
          id: string
          objeto: string | null
          objeto_ref: string | null
          orden: number
          parche: Json | null
        }
        Insert: {
          args?: Json
          creado_en?: string
          descripcion: string
          escenario_id: string
          funcion: string
          id?: string
          objeto?: string | null
          objeto_ref?: string | null
          orden?: never
          parche?: Json | null
        }
        Update: {
          args?: Json
          creado_en?: string
          descripcion?: string
          escenario_id?: string
          funcion?: string
          id?: string
          objeto?: string | null
          objeto_ref?: string | null
          orden?: never
          parche?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "cambio_escenario_id_fkey"
            columns: ["escenario_id"]
            isOneToOne: false
            referencedRelation: "escenario"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo: {
        Row: {
          activo: boolean
          clave: string
          creado_en: string
          familia: string | null
          familia_cat: string | null
          id: string
          nivel: number | null
          nombre: string
          proposito: string | null
          sinonimos: string[]
        }
        Insert: {
          activo?: boolean
          clave: string
          creado_en?: string
          familia?: string | null
          familia_cat?: string | null
          id?: string
          nivel?: number | null
          nombre: string
          proposito?: string | null
          sinonimos?: string[]
        }
        Update: {
          activo?: boolean
          clave?: string
          creado_en?: string
          familia?: string | null
          familia_cat?: string | null
          id?: string
          nivel?: number | null
          nombre?: string
          proposito?: string | null
          sinonimos?: string[]
        }
        Relationships: []
      }
      componente_costo: {
        Row: {
          aplica_a: string
          base: string
          base_legal: string | null
          forma: string
          fuente: string | null
          id: string
          moneda: string | null
          nombre: string
          nota: string | null
          orden: number
          piso_parametro: string | null
          por_confirmar: boolean
          tope_salarios_minimos: number | null
          valor: number
          vigencia: unknown
        }
        Insert: {
          aplica_a?: string
          base?: string
          base_legal?: string | null
          forma: string
          fuente?: string | null
          id?: string
          moneda?: string | null
          nombre: string
          nota?: string | null
          orden?: number
          piso_parametro?: string | null
          por_confirmar?: boolean
          tope_salarios_minimos?: number | null
          valor: number
          vigencia?: unknown
        }
        Update: {
          aplica_a?: string
          base?: string
          base_legal?: string | null
          forma?: string
          fuente?: string | null
          id?: string
          moneda?: string | null
          nombre?: string
          nota?: string | null
          orden?: number
          piso_parametro?: string | null
          por_confirmar?: boolean
          tope_salarios_minimos?: number | null
          valor?: number
          vigencia?: unknown
        }
        Relationships: []
      }
      costo_referencia: {
        Row: {
          bonos_usd_mensual: number
          cargo_id: string
          fuente: string | null
          id: string
          moneda: string
          salario_mensual: number
          vigencia: unknown
        }
        Insert: {
          bonos_usd_mensual?: number
          cargo_id: string
          fuente?: string | null
          id?: string
          moneda?: string
          salario_mensual: number
          vigencia?: unknown
        }
        Update: {
          bonos_usd_mensual?: number
          cargo_id?: string
          fuente?: string | null
          id?: string
          moneda?: string
          salario_mensual?: number
          vigencia?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "costo_referencia_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargo"
            referencedColumns: ["id"]
          },
        ]
      }
      escenario: {
        Row: {
          alcance: string
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          estado: string
          fecha_base: string
          id: string
          nombre: string
          proceso_raiz_ref: string | null
          publicado_en: string | null
          tipo: string
          vigente_desde: string | null
        }
        Insert: {
          alcance: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          estado?: string
          fecha_base?: string
          id?: string
          nombre: string
          proceso_raiz_ref?: string | null
          publicado_en?: string | null
          tipo?: string
          vigente_desde?: string | null
        }
        Update: {
          alcance?: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          estado?: string
          fecha_base?: string
          id?: string
          nombre?: string
          proceso_raiz_ref?: string | null
          publicado_en?: string | null
          tipo?: string
          vigente_desde?: string | null
        }
        Relationships: []
      }
      ocupacion: {
        Row: {
          certeza: string
          creado_en: string
          empleado_id: string
          excede_dotacion: boolean
          id: string
          motivo: string | null
          plaza_ref: string
          tipo: string
          tipo_cat: string | null
          vigencia: unknown
        }
        Insert: {
          certeza?: string
          creado_en?: string
          empleado_id: string
          excede_dotacion?: boolean
          id?: string
          motivo?: string | null
          plaza_ref: string
          tipo?: string
          tipo_cat?: string | null
          vigencia?: unknown
        }
        Update: {
          certeza?: string
          creado_en?: string
          empleado_id?: string
          excede_dotacion?: boolean
          id?: string
          motivo?: string | null
          plaza_ref?: string
          tipo?: string
          tipo_cat?: string | null
          vigencia?: unknown
        }
        Relationships: []
      }
      plan_dotacion: {
        Row: {
          anio: number
          aprobado_en: string | null
          aprobado_por: string | null
          estado: string
          id: string
          nota: string | null
          version: number
        }
        Insert: {
          anio: number
          aprobado_en?: string | null
          aprobado_por?: string | null
          estado?: string
          id?: string
          nota?: string | null
          version?: number
        }
        Update: {
          anio?: number
          aprobado_en?: string | null
          aprobado_por?: string | null
          estado?: string
          id?: string
          nota?: string | null
          version?: number
        }
        Relationships: []
      }
      plan_dotacion_linea: {
        Row: {
          cantidad: number
          cargo_id: string
          id: string
          nota: string | null
          plan_id: string
          unidad_ref: string
        }
        Insert: {
          cantidad: number
          cargo_id: string
          id?: string
          nota?: string | null
          plan_id: string
          unidad_ref: string
        }
        Update: {
          cantidad?: number
          cargo_id?: string
          id?: string
          nota?: string | null
          plan_id?: string
          unidad_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_dotacion_linea_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_dotacion_linea_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plan_dotacion"
            referencedColumns: ["id"]
          },
        ]
      }
      plaza: {
        Row: {
          cargo_id: string
          certeza: string
          dotacion: number
          esc: string | null
          escenario_id: string | null
          estado: string
          estado_cat: string | null
          fuente: string | null
          id: string
          nomina_cat: string | null
          nota: string | null
          ref: string
          reporta_a_ref: string | null
          sede: string | null
          sede_cat: string | null
          tipo_nomina: string | null
          unidad_ref: string
          vigencia: unknown
        }
        Insert: {
          cargo_id: string
          certeza?: string
          dotacion?: number
          esc?: string | null
          escenario_id?: string | null
          estado?: string
          estado_cat?: string | null
          fuente?: string | null
          id?: string
          nomina_cat?: string | null
          nota?: string | null
          ref?: string
          reporta_a_ref?: string | null
          sede?: string | null
          sede_cat?: string | null
          tipo_nomina?: string | null
          unidad_ref: string
          vigencia?: unknown
        }
        Update: {
          cargo_id?: string
          certeza?: string
          dotacion?: number
          esc?: string | null
          escenario_id?: string | null
          estado?: string
          estado_cat?: string | null
          fuente?: string | null
          id?: string
          nomina_cat?: string | null
          nota?: string | null
          ref?: string
          reporta_a_ref?: string | null
          sede?: string | null
          sede_cat?: string | null
          tipo_nomina?: string | null
          unidad_ref?: string
          vigencia?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "plaza_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaza_escenario_id_fkey"
            columns: ["escenario_id"]
            isOneToOne: false
            referencedRelation: "escenario"
            referencedColumns: ["id"]
          },
        ]
      }
      requisicion: {
        Row: {
          candidato: string | null
          cantidad: number
          cargo_id: string
          condiciones: Json
          creado_en: string
          creado_por: string | null
          estado: string
          fecha_deseada: string | null
          fecha_ingreso: string | null
          id: string
          impacto: Json | null
          justificacion: string
          motivo_contrato: string | null
          nomina_cat: string | null
          numero: number
          origen: string
          origen_cat: string | null
          perfil: Json
          plaza_ref: string | null
          reemplaza_empleado_id: string | null
          solicitud_id: string | null
          tiempo_contrato: string | null
          tipo_nomina: string | null
          unidad_ref: string
        }
        Insert: {
          candidato?: string | null
          cantidad?: number
          cargo_id: string
          condiciones?: Json
          creado_en?: string
          creado_por?: string | null
          estado?: string
          fecha_deseada?: string | null
          fecha_ingreso?: string | null
          id?: string
          impacto?: Json | null
          justificacion: string
          motivo_contrato?: string | null
          nomina_cat?: string | null
          numero?: never
          origen: string
          origen_cat?: string | null
          perfil?: Json
          plaza_ref?: string | null
          reemplaza_empleado_id?: string | null
          solicitud_id?: string | null
          tiempo_contrato?: string | null
          tipo_nomina?: string | null
          unidad_ref: string
        }
        Update: {
          candidato?: string | null
          cantidad?: number
          cargo_id?: string
          condiciones?: Json
          creado_en?: string
          creado_por?: string | null
          estado?: string
          fecha_deseada?: string | null
          fecha_ingreso?: string | null
          id?: string
          impacto?: Json | null
          justificacion?: string
          motivo_contrato?: string | null
          nomina_cat?: string | null
          numero?: never
          origen?: string
          origen_cat?: string | null
          perfil?: Json
          plaza_ref?: string | null
          reemplaza_empleado_id?: string | null
          solicitud_id?: string | null
          tiempo_contrato?: string | null
          tipo_nomina?: string | null
          unidad_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisicion_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargo"
            referencedColumns: ["id"]
          },
        ]
      }
      requisicion_costo: {
        Row: {
          bonos_usd: number | null
          impacto_costo: Json | null
          moneda: string | null
          nota: string | null
          requisicion_id: string
          salario_propuesto: number | null
        }
        Insert: {
          bonos_usd?: number | null
          impacto_costo?: Json | null
          moneda?: string | null
          nota?: string | null
          requisicion_id: string
          salario_propuesto?: number | null
        }
        Update: {
          bonos_usd?: number | null
          impacto_costo?: Json | null
          moneda?: string | null
          nota?: string | null
          requisicion_id?: string
          salario_propuesto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "requisicion_costo_requisicion_id_fkey"
            columns: ["requisicion_id"]
            isOneToOne: true
            referencedRelation: "requisicion"
            referencedColumns: ["id"]
          },
        ]
      }
      tasa_cambio: {
        Row: {
          fecha: string
          fuente: string
          ves_por_usd: number
        }
        Insert: {
          fecha: string
          fuente?: string
          ves_por_usd: number
        }
        Update: {
          fecha?: string
          fuente?: string
          ves_por_usd?: number
        }
        Relationships: []
      }
      unidad: {
        Row: {
          area_id: string | null
          certeza: string
          clave: string
          codigo_organigrama: string | null
          esc: string | null
          escenario_id: string | null
          fuente: string | null
          id: string
          nombre: string
          nota: string | null
          orden: number
          padre_ref: string | null
          ref: string
          sede: string | null
          sede_cat: string | null
          tipo: string
          tipo_cat: string | null
          vigencia: unknown
        }
        Insert: {
          area_id?: string | null
          certeza?: string
          clave: string
          codigo_organigrama?: string | null
          esc?: string | null
          escenario_id?: string | null
          fuente?: string | null
          id?: string
          nombre: string
          nota?: string | null
          orden?: number
          padre_ref?: string | null
          ref?: string
          sede?: string | null
          sede_cat?: string | null
          tipo: string
          tipo_cat?: string | null
          vigencia?: unknown
        }
        Update: {
          area_id?: string | null
          certeza?: string
          clave?: string
          codigo_organigrama?: string | null
          esc?: string | null
          escenario_id?: string | null
          fuente?: string | null
          id?: string
          nombre?: string
          nota?: string | null
          orden?: number
          padre_ref?: string | null
          ref?: string
          sede?: string | null
          sede_cat?: string | null
          tipo?: string
          tipo_cat?: string | null
          vigencia?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "unidad_escenario_id_fkey"
            columns: ["escenario_id"]
            isOneToOne: false
            referencedRelation: "escenario"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aplicar_requisicion: { Args: { p_req: string }; Returns: undefined }
      aprobar_plan_dotacion: { Args: { p_plan: string }; Returns: undefined }
      asignar_ocupacion: {
        Args: {
          p_empleado_id: string
          p_excede?: boolean
          p_fecha: string
          p_motivo?: string
          p_plaza_ref: string
          p_tipo: string
        }
        Returns: string
      }
      cancelar_requisicion: {
        Args: { p_motivo?: string; p_req: string }
        Returns: undefined
      }
      cerrada_en: {
        Args: { p_fecha: string; p_vigencia: unknown }
        Returns: unknown
      }
      cerrar_plaza: {
        Args: { p_fecha: string; p_motivo: string; p_ref: string }
        Returns: undefined
      }
      cerrar_unidad: {
        Args: { p_fecha: string; p_motivo: string; p_ref: string }
        Returns: undefined
      }
      choques_escenario: {
        Args: { p_esc: string; p_fecha: string }
        Returns: string[]
      }
      clave_cargo_libre: { Args: { p_nombre: string }; Returns: string }
      comparar_escenario: {
        Args: { p_escenario: string }
        Returns: {
          antes: Json
          cambio: string
          despues: Json
          objeto: string
          ref: string
        }[]
      }
      costo_cargos: {
        Args: { p_fecha?: string }
        Returns: {
          cargo_id: string
          costo: Json
        }[]
      }
      costo_mensual: {
        Args: { p_cargo: string; p_fecha?: string; p_tasa?: number }
        Returns: Json
      }
      costo_mensual_servicio: { Args: { p_cargo: string }; Returns: Json }
      crear_cargo: {
        Args: {
          p_familia: string
          p_nivel: string
          p_nombre: string
          p_proposito: string
          p_sinonimos: string[]
        }
        Returns: string
      }
      crear_cargo_de_requisicion: {
        Args: { p_familia: string; p_nombre: string }
        Returns: string
      }
      crear_componente_costo: {
        Args: {
          p_aplica_a: string
          p_base: string
          p_base_legal: string
          p_fecha: string
          p_forma: string
          p_fuente: string
          p_moneda: string
          p_nombre: string
          p_nota?: string
          p_piso: string
          p_por_confirmar: boolean
          p_tope: number
          p_valor: number
        }
        Returns: string
      }
      crear_escenario_estructura: {
        Args: { p_descripcion?: string; p_fecha?: string; p_nombre: string }
        Returns: string
      }
      crear_plaza: {
        Args: {
          p_cargo_id: string
          p_dotacion: number
          p_estado: string
          p_fecha: string
          p_nota?: string
          p_reporta_a_ref: string
          p_sede: string
          p_tipo_nomina: string
          p_unidad_ref: string
        }
        Returns: string
      }
      crear_unidad: {
        Args: {
          p_clave: string
          p_codigo?: string
          p_fecha: string
          p_nombre: string
          p_nota?: string
          p_padre_ref: string
          p_sede: string
          p_tipo: string
        }
        Returns: string
      }
      cubrir_requisicion: {
        Args: { p_empleado: string; p_fecha: string; p_req: string }
        Returns: string
      }
      dependencias: {
        Args: { p_cargo: string; p_plaza?: string }
        Returns: Json
      }
      descartar_cambios: { Args: { p_esc: string }; Returns: undefined }
      describir_plazas: {
        Args: { p_refs: string[] }
        Returns: {
          cargo: string
          ref: string
          unidad: string
        }[]
      }
      devolver_cambios: { Args: { p_esc: string }; Returns: undefined }
      direccion_de: {
        Args: { p_fecha?: string; p_unidad: string }
        Returns: string
      }
      editar_cargo: {
        Args: { p_campo: string; p_id: string; p_valor: string }
        Returns: undefined
      }
      editar_componente_costo: {
        Args: {
          p_aplica_a: string
          p_base: string
          p_base_legal: string
          p_fecha: string
          p_forma: string
          p_fuente: string
          p_id: string
          p_moneda: string
          p_nota?: string
          p_piso: string
          p_por_confirmar: boolean
          p_tope: number
          p_valor: number
        }
        Returns: string
      }
      editar_plaza: {
        Args: {
          p_certeza?: string
          p_dotacion: number
          p_estado: string
          p_fecha: string
          p_nota?: string
          p_ref: string
          p_reporta_a_ref: string
          p_sede: string
          p_tipo_nomina: string
          p_unidad_ref?: string
        }
        Returns: Json
      }
      editar_unidad: {
        Args: {
          p_certeza?: string
          p_codigo?: string
          p_fecha: string
          p_nombre: string
          p_nota?: string
          p_padre_ref: string
          p_ref: string
          p_sede: string
          p_tipo: string
        }
        Returns: string
      }
      ejecutar_cambio: {
        Args: { c: Database["org"]["Tables"]["cambio"]["Row"]; d: string }
        Returns: undefined
      }
      enviar_cambios: {
        Args: { p_esc: string; p_nota?: string; p_vigente_desde: string }
        Returns: string
      }
      enviar_escenario: {
        Args: { p_esc: string; p_vigente_desde: string }
        Returns: string
      }
      enviar_requisicion: { Args: { p_req: string }; Returns: string }
      escenario_en_borrador: { Args: { p_esc: string }; Returns: boolean }
      estructura_al: {
        Args: { p_escenario?: string; p_fecha?: string }
        Returns: {
          cargo: string
          cargo_id: string
          dotacion: number
          estado: string
          familia: string
          ocupadas: number
          orden: number
          padre_ref: string
          plaza_ref: string
          reporta_a_ref: string
          sede: string
          tipo: string
          tipo_nomina: string
          unidad: string
          unidad_clave: string
          unidad_ref: string
        }[]
      }
      exigir_fecha: { Args: { p_fecha: string }; Returns: undefined }
      exigir_permiso: {
        Args: { p_accion: string; p_mensaje: string; p_recurso: string }
        Returns: undefined
      }
      fijar_costo_referencia: {
        Args: {
          p_bonos_usd: number
          p_cargo: string
          p_fecha: string
          p_fuente?: string
          p_moneda: string
          p_salario: number
        }
        Returns: string
      }
      fijar_parametro: {
        Args: {
          p_clave: string
          p_fecha: string
          p_fuente?: string
          p_por_confirmar?: boolean
          p_valor: number
        }
        Returns: string
      }
      guardar_lineas_plan: {
        Args: { p_lineas: Json; p_plan: string }
        Returns: number
      }
      hoy: { Args: never; Returns: string }
      impacto_requisicion: { Args: { p_req: string }; Returns: Json }
      lienzo: {
        Args: { p_escenario?: string; p_fecha?: string }
        Returns: {
          antes: Json
          aprob: number
          clase: string
          codigo: string
          costo_usd: number
          costo_ves: number
          diff: string
          estado: string
          excede: number
          id: string
          inferido: boolean
          nombre: string
          ocu: number
          orden: number
          padre: string
          personas: string[]
          ref: string
          sede: string
          tipo: string
          vacantes: number
        }[]
      }
      mover_ocupacion: {
        Args: {
          p_excede?: boolean
          p_fecha: string
          p_id: string
          p_motivo?: string
          p_plaza_destino: string
          p_tipo?: string
        }
        Returns: string
      }
      nuevo_plan_dotacion: {
        Args: { p_anio: number; p_nota?: string }
        Returns: string
      }
      ocupantes_de_unidad: {
        Args: { p_unidad: string }
        Returns: {
          cargo: string
          cargo_id: string
          empleado_id: string
          nombre: string
          plaza_ref: string
          tipo: string
        }[]
      }
      paso_actual_requisicion: {
        Args: { p_req: string }
        Returns: {
          desde: string
          paso: string
          quien: string
        }[]
      }
      perfil_de_plaza: {
        Args: { p_fecha?: string; p_plaza: string }
        Returns: string
      }
      plaza_jefe_de: {
        Args: { p_fecha?: string; p_unidad: string }
        Returns: string
      }
      proponer_cambio: {
        Args: {
          p_args: Json
          p_descripcion: string
          p_funcion: string
          p_objeto?: string
          p_objeto_ref?: string
          p_parche?: Json
        }
        Returns: Json
      }
      publicar_cambios: { Args: { p_esc: string }; Returns: undefined }
      publicar_escenario: { Args: { p_esc: string }; Returns: undefined }
      quitar_cambio: { Args: { p_id: string }; Returns: undefined }
      registrar_candidato: {
        Args: { p_candidato: string; p_fecha: string; p_req: string }
        Returns: undefined
      }
      retirar_componente_costo: {
        Args: { p_fecha: string; p_id: string }
        Returns: undefined
      }
      simular_cambios: {
        Args: {
          p_esc: string
          p_fecha: string
          p_nuevo: Database["org"]["Tables"]["cambio"]["Row"]
        }
        Returns: string
      }
      tasa_bcv: {
        Args: { p_fecha?: string }
        Returns: {
          fecha_valor: string
          fuente: string
          tasa: number
        }[]
      }
      terminar_ocupacion: {
        Args: { p_fecha: string; p_id: string; p_motivo?: string }
        Returns: undefined
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
          oidos: string[]
          paso: number
        }
        Insert: {
          completada_en?: string | null
          estado?: string
          id?: string
          iniciada_en?: string
          leccion_id: string
          matricula_id: string
          oidos?: string[]
          paso?: number
        }
        Update: {
          completada_en?: string | null
          estado?: string
          id?: string
          iniciada_en?: string
          leccion_id?: string
          matricula_id?: string
          oidos?: string[]
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
      bloqueos: {
        Row: {
          bloqueado_id: string
          bloqueador_id: string
          created_at: string
          id: string
        }
        Insert: {
          bloqueado_id: string
          bloqueador_id: string
          created_at?: string
          id?: string
        }
        Update: {
          bloqueado_id?: string
          bloqueador_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bloqueos_bloqueado_id_fkey"
            columns: ["bloqueado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloqueos_bloqueado_id_fkey"
            columns: ["bloqueado_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloqueos_bloqueado_id_fkey"
            columns: ["bloqueado_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
          },
          {
            foreignKeyName: "bloqueos_bloqueador_id_fkey"
            columns: ["bloqueador_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloqueos_bloqueador_id_fkey"
            columns: ["bloqueador_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloqueos_bloqueador_id_fkey"
            columns: ["bloqueador_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
          },
        ]
      }
      calendario_actividades: {
        Row: {
          detalle: string
          estado: string
          fecha_confirmada: string | null
          fin: string | null
          frente: string
          id: string
          inicio: string
          nota: string
          orden: number
          participantes: string
          ref: string
          responsable: string
          tipo: string
          titulo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          detalle?: string
          estado?: string
          fecha_confirmada?: string | null
          fin?: string | null
          frente: string
          id: string
          inicio: string
          nota?: string
          orden?: number
          participantes?: string
          ref?: string
          responsable?: string
          tipo?: string
          titulo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          detalle?: string
          estado?: string
          fecha_confirmada?: string | null
          fin?: string | null
          frente?: string
          id?: string
          inicio?: string
          nota?: string
          orden?: number
          participantes?: string
          ref?: string
          responsable?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      canal_grupo_lecturas: {
        Row: {
          grupo_id: string
          id: number
          leido_en: string
          leido_por: string
        }
        Insert: {
          grupo_id: string
          id?: never
          leido_en?: string
          leido_por: string
        }
        Update: {
          grupo_id?: string
          id?: never
          leido_en?: string
          leido_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "canal_grupo_lecturas_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      canal_modulos: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          clave: string
          descripcion: string | null
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          clave: string
          descripcion?: string | null
          nombre: string
          orden?: number
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          clave?: string
          descripcion?: string | null
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      certificados: {
        Row: {
          area_nombre: string | null
          cargo: string | null
          cedula: string | null
          codigo: string
          created_at: string
          emitido_en: string
          entregado_en: string | null
          ficha: string | null
          id: string
          matricula_id: string
          nombre_completo: string
        }
        Insert: {
          area_nombre?: string | null
          cargo?: string | null
          cedula?: string | null
          codigo: string
          created_at?: string
          emitido_en?: string
          entregado_en?: string | null
          ficha?: string | null
          id?: string
          matricula_id: string
          nombre_completo: string
        }
        Update: {
          area_nombre?: string | null
          cargo?: string | null
          cedula?: string | null
          codigo?: string
          created_at?: string
          emitido_en?: string
          entregado_en?: string | null
          ficha?: string | null
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
      charla_mensajes: {
        Row: {
          audio: string | null
          charla_id: string
          created_at: string
          de: string
          dibujo_veredicto: string | null
          entrada: string
          fallo_en: string | null
          id: string
          matricula_id: string
          media_url: string | null
          pedido_dibujo: string | null
          texto: string | null
        }
        Insert: {
          audio?: string | null
          charla_id: string
          created_at?: string
          de: string
          dibujo_veredicto?: string | null
          entrada?: string
          fallo_en?: string | null
          id?: string
          matricula_id: string
          media_url?: string | null
          pedido_dibujo?: string | null
          texto?: string | null
        }
        Update: {
          audio?: string | null
          charla_id?: string
          created_at?: string
          de?: string
          dibujo_veredicto?: string | null
          entrada?: string
          fallo_en?: string | null
          id?: string
          matricula_id?: string
          media_url?: string | null
          pedido_dibujo?: string | null
          texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charla_mensajes_charla_id_fkey"
            columns: ["charla_id"]
            isOneToOne: false
            referencedRelation: "charlas_ajito"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charla_mensajes_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charla_mensajes_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "charla_mensajes_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["matricula_id"]
          },
        ]
      }
      charlas_ajito: {
        Row: {
          actualizada_en: string
          created_at: string
          id: string
          matricula_id: string
          titulo: string
        }
        Insert: {
          actualizada_en?: string
          created_at?: string
          id?: string
          matricula_id: string
          titulo?: string
        }
        Update: {
          actualizada_en?: string
          created_at?: string
          id?: string
          matricula_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "charlas_ajito_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charlas_ajito_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["matricula_id"]
          },
          {
            foreignKeyName: "charlas_ajito_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
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
      correcciones_padron: {
        Row: {
          area: string | null
          area_padron: string | null
          cargo_padron: string | null
          created_at: string
          empleado_id: string
          id: string
          nombre: string
          nombre_padron: string
          resuelta_en: string | null
          resuelta_por: string | null
        }
        Insert: {
          area?: string | null
          area_padron?: string | null
          cargo_padron?: string | null
          created_at?: string
          empleado_id: string
          id?: string
          nombre: string
          nombre_padron?: string
          resuelta_en?: string | null
          resuelta_por?: string | null
        }
        Update: {
          area?: string | null
          area_padron?: string | null
          cargo_padron?: string | null
          created_at?: string
          empleado_id?: string
          id?: string
          nombre?: string
          nombre_padron?: string
          resuelta_en?: string | null
          resuelta_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "correcciones_padron_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correcciones_padron_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correcciones_padron_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
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
      dispositivos: {
        Row: {
          created_at: string
          id: string
          perfil_id: string
          plataforma: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          perfil_id: string
          plataforma?: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          perfil_id?: string
          plataforma?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispositivos_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      empleados: {
        Row: {
          activo: boolean
          area_id: string | null
          busqueda: unknown
          cargo: string | null
          cedula: string | null
          created_at: string
          email: string | null
          es_moderador: boolean
          familia_oficio: string
          fecha_ingreso: string | null
          ficha: string | null
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
          cedula?: string | null
          created_at?: string
          email?: string | null
          es_moderador?: boolean
          familia_oficio?: string
          fecha_ingreso?: string | null
          ficha?: string | null
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
          cedula?: string | null
          created_at?: string
          email?: string | null
          es_moderador?: boolean
          familia_oficio?: string
          fecha_ingreso?: string | null
          ficha?: string | null
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
      hitos: {
        Row: {
          created_at: string
          created_by: string | null
          descripcion: string | null
          entregable: string | null
          estado: string
          fecha: string
          id: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          entregable?: string | null
          estado?: string
          fecha: string
          id?: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          entregable?: string | null
          estado?: string
          fecha?: string
          id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      informe_circuito_puntos: {
        Row: {
          centro: string | null
          cifras: Json
          circuito: string
          destapes: Json
          donde: string | null
          fase: string | null
          id: string
          numero: number
          pos_x: number
          pos_y: number
          que_pasa: string
          sistemas: string[]
          tipo: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          centro?: string | null
          cifras?: Json
          circuito: string
          destapes?: Json
          donde?: string | null
          fase?: string | null
          id: string
          numero: number
          pos_x: number
          pos_y: number
          que_pasa: string
          sistemas?: string[]
          tipo?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          centro?: string | null
          cifras?: Json
          circuito?: string
          destapes?: Json
          donde?: string | null
          fase?: string | null
          id?: string
          numero?: number
          pos_x?: number
          pos_y?: number
          que_pasa?: string
          sistemas?: string[]
          tipo?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      informe_circuito_textos: {
        Row: {
          clave: string
          contenido: Json
          updated_at: string
        }
        Insert: {
          clave: string
          contenido: Json
          updated_at?: string
        }
        Update: {
          clave?: string
          contenido?: Json
          updated_at?: string
        }
        Relationships: []
      }
      informe_hallazgos: {
        Row: {
          codigo: string
          nivel: string
          orden: number
          patron: string
          punto: string | null
          sistema: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          codigo: string
          nivel: string
          orden: number
          patron: string
          punto?: string | null
          sistema?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          codigo?: string
          nivel?: string
          orden?: number
          patron?: string
          punto?: string | null
          sistema?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "informe_hallazgos_punto_fkey"
            columns: ["punto"]
            isOneToOne: false
            referencedRelation: "informe_circuito_puntos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "informe_hallazgos_sistema_fkey"
            columns: ["sistema"]
            isOneToOne: false
            referencedRelation: "informe_circuito_puntos"
            referencedColumns: ["id"]
          },
        ]
      }
      informe_modulos: {
        Row: {
          cifras: Json
          cubre: Json
          deja_atras: string
          destapa: string[]
          dispositivo: string
          id: string
          lee: string
          nombre: string[]
          nota: string | null
          numero: number
          ola: string
          pos_x: number
          postea: string
          titulo: string
          updated_at: string
        }
        Insert: {
          cifras?: Json
          cubre?: Json
          deja_atras: string
          destapa?: string[]
          dispositivo: string
          id: string
          lee: string
          nombre: string[]
          nota?: string | null
          numero: number
          ola: string
          pos_x: number
          postea: string
          titulo: string
          updated_at?: string
        }
        Update: {
          cifras?: Json
          cubre?: Json
          deja_atras?: string
          destapa?: string[]
          dispositivo?: string
          id?: string
          lee?: string
          nombre?: string[]
          nota?: string | null
          numero?: number
          ola?: string
          pos_x?: number
          postea?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
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
      macroprocesos: {
        Row: {
          created_at: string
          id: string
          nivel: string
          nombre: string
          nuevo: boolean
          numero: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nivel: string
          nombre: string
          nuevo?: boolean
          numero: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nivel?: string
          nombre?: string
          nuevo?: boolean
          numero?: number
          updated_at?: string
        }
        Relationships: []
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
          voz: string
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
          voz?: string
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
          voz?: string
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
      procesos: {
        Row: {
          area: string | null
          created_at: string
          dueno_corregido: boolean
          estado: string
          id: string
          macroproceso_id: string
          nombre: string
          observacion: string | null
          orden: number
        }
        Insert: {
          area?: string | null
          created_at?: string
          dueno_corregido?: boolean
          estado: string
          id?: string
          macroproceso_id: string
          nombre: string
          observacion?: string | null
          orden: number
        }
        Update: {
          area?: string | null
          created_at?: string
          dueno_corregido?: boolean
          estado?: string
          id?: string
          macroproceso_id?: string
          nombre?: string
          observacion?: string | null
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "procesos_macroproceso_id_fkey"
            columns: ["macroproceso_id"]
            isOneToOne: false
            referencedRelation: "macroprocesos"
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
          rol_id: string
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
          rol_id: string
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
          rol_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
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
          certificado_id: string | null
          created_at: string
          cuerpo_md: string | null
          estado: string
          fijado: boolean
          id: string
          imagen_ruta: string | null
          imagen_url: string | null
          oficial: boolean
          permite_comentarios: boolean
          publicado_en: string | null
          respuesta_id: string | null
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
          certificado_id?: string | null
          created_at?: string
          cuerpo_md?: string | null
          estado?: string
          fijado?: boolean
          id?: string
          imagen_ruta?: string | null
          imagen_url?: string | null
          oficial?: boolean
          permite_comentarios?: boolean
          publicado_en?: string | null
          respuesta_id?: string | null
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
          certificado_id?: string | null
          created_at?: string
          cuerpo_md?: string | null
          estado?: string
          fijado?: boolean
          id?: string
          imagen_ruta?: string | null
          imagen_url?: string | null
          oficial?: boolean
          permite_comentarios?: boolean
          publicado_en?: string | null
          respuesta_id?: string | null
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
          {
            foreignKeyName: "publicaciones_certificado_id_fkey"
            columns: ["certificado_id"]
            isOneToOne: false
            referencedRelation: "certificados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicaciones_respuesta_id_fkey"
            columns: ["respuesta_id"]
            isOneToOne: false
            referencedRelation: "respuestas"
            referencedColumns: ["id"]
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
      registros_horas: {
        Row: {
          created_at: string
          created_by: string | null
          descripcion: string
          entregable: string
          entrevista_id: string | null
          fecha: string
          hito_id: string | null
          horas: number
          id: string
          imputacion: string
          perfil: string
          persona: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descripcion: string
          entregable?: string
          entrevista_id?: string | null
          fecha: string
          hito_id?: string | null
          horas: number
          id?: string
          imputacion?: string
          perfil: string
          persona?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descripcion?: string
          entregable?: string
          entrevista_id?: string | null
          fecha?: string
          hito_id?: string | null
          horas?: number
          id?: string
          imputacion?: string
          perfil?: string
          persona?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_horas_entrevista_id_fkey"
            columns: ["entrevista_id"]
            isOneToOne: false
            referencedRelation: "entrevistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_horas_hito_id_fkey"
            columns: ["hito_id"]
            isOneToOne: false
            referencedRelation: "hitos"
            referencedColumns: ["id"]
          },
        ]
      }
      reportes: {
        Row: {
          autor_id: string | null
          contenido_id: string
          contexto: string
          created_at: string
          detalle: string | null
          estado: string
          extracto: string
          id: string
          motivo: string
          oculto: boolean
          reportante_id: string
          revisado_en: string | null
          revisado_por: string | null
          tipo: string
        }
        Insert: {
          autor_id?: string | null
          contenido_id: string
          contexto?: string
          created_at?: string
          detalle?: string | null
          estado?: string
          extracto?: string
          id?: string
          motivo: string
          oculto?: boolean
          reportante_id: string
          revisado_en?: string | null
          revisado_por?: string | null
          tipo: string
        }
        Update: {
          autor_id?: string | null
          contenido_id?: string
          contexto?: string
          created_at?: string
          detalle?: string | null
          estado?: string
          extracto?: string
          id?: string
          motivo?: string
          oculto?: boolean
          reportante_id?: string
          revisado_en?: string | null
          revisado_por?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "reportes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reportes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reportes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
          },
          {
            foreignKeyName: "reportes_reportante_id_fkey"
            columns: ["reportante_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reportes_reportante_id_fkey"
            columns: ["reportante_id"]
            isOneToOne: false
            referencedRelation: "padron_estado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reportes_reportante_id_fkey"
            columns: ["reportante_id"]
            isOneToOne: false
            referencedRelation: "recordatorios_pendientes"
            referencedColumns: ["empleado_id"]
          },
          {
            foreignKeyName: "reportes_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
          dibujo: string | null
          dibujo_veredicto: string | null
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
          dibujo?: string | null
          dibujo_veredicto?: string | null
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
          dibujo?: string | null
          dibujo_veredicto?: string | null
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
      rol_permisos: {
        Row: {
          crear: boolean
          editar: boolean
          eliminar: boolean
          recurso: string
          rol_id: string
          ver: boolean
        }
        Insert: {
          crear?: boolean
          editar?: boolean
          eliminar?: boolean
          recurso: string
          rol_id: string
          ver?: boolean
        }
        Update: {
          crear?: boolean
          editar?: boolean
          eliminar?: boolean
          recurso?: string
          rol_id?: string
          ver?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "rol_permisos_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          clave: string
          created_at: string
          descripcion: string | null
          id: string
          nivel: string
          nombre: string
          sistema: boolean
          updated_at: string
        }
        Insert: {
          clave: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nivel: string
          nombre: string
          sistema?: boolean
          updated_at?: string
        }
        Update: {
          clave?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nivel?: string
          nombre?: string
          sistema?: boolean
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
      consumo_mensual: {
        Row: {
          horas: number | null
          imputacion: string | null
          mes: string | null
          perfil: string | null
        }
        Relationships: []
      }
      linea_de_tiempo: {
        Row: {
          descripcion: string | null
          duracion_minutos: number | null
          entregable: string | null
          estado: string | null
          fecha: string | null
          id: string | null
          origen: string | null
          tipo: string | null
          titulo: string | null
        }
        Relationships: []
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
          cuenta_email: string | null
          email: string | null
          estado_matricula: string | null
          familia_oficio: string | null
          ficha: string | null
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
      canal_autorizar: {
        Args: {
          p_empleado: string
          p_es_moderador: boolean
          p_puede_publicar: boolean
        }
        Returns: undefined
      }
      canal_moderar_publicacion: {
        Args: { p_accion: string; p_publicacion: string }
        Returns: undefined
      }
      cedulas_certificados: {
        Args: { p_ids: string[] }
        Returns: {
          cedula: string
          id: string
        }[]
      }
      contacto_empleados: {
        Args: { p_ids?: string[] }
        Returns: {
          cedula: string
          email: string
          empleado_id: string
          telefono: string
        }[]
      }
      coordino_grupo: { Args: { grupo: string }; Returns: boolean }
      cuenta_entrevistas: { Args: never; Returns: number }
      descartar_dispositivo: { Args: { p_token: string }; Returns: undefined }
      dispositivos_de_conversacion: {
        Args: { p_conversacion: string }
        Returns: {
          plataforma: string
          token: string
        }[]
      }
      dispositivos_de_recordatorios: {
        Args: { p_recordatorios: string[] }
        Returns: {
          leccion: number
          plataforma: string
          recordatorio_id: string
          token: string
        }[]
      }
      emitir_mi_certificado: {
        Args: { p_matricula: string }
        Returns: {
          area_nombre: string | null
          cargo: string | null
          cedula: string | null
          codigo: string
          created_at: string
          emitido_en: string
          entregado_en: string | null
          ficha: string | null
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
      entrevistas_internas: {
        Args: { p_ids: string[] }
        Returns: {
          fireflies_url: string
          id: string
          notas_consultor: string
        }[]
      }
      es_admin: { Args: never; Returns: boolean }
      es_editor: { Args: never; Returns: boolean }
      hallazgos_por_estado: {
        Args: { p_entrevista: string }
        Returns: {
          estado: string
          n: number
        }[]
      }
      hallazgos_validados: { Args: never; Returns: number }
      he_bloqueado: { Args: { p_otro: string }; Returns: boolean }
      marcar_oido: {
        Args: { p_leccion: string; p_matricula: string; p_pieza: string }
        Returns: undefined
      }
      matricula_mia: { Args: { matricula: string }; Returns: boolean }
      matricular_pendientes: { Args: { curso_clave: string }; Returns: number }
      matricularme: { Args: { p_curso: string }; Returns: string }
      mensajes_sin_leer: { Args: never; Returns: number }
      mi_empleado: { Args: never; Returns: string }
      mi_matricula: { Args: { curso: string }; Returns: string }
      mi_rol: { Args: never; Returns: string }
      mis_permisos: {
        Args: never
        Returns: {
          crear: boolean
          editar: boolean
          eliminar: boolean
          recurso: string
          ver: boolean
        }[]
      }
      ocultar_contenido_reportado: {
        Args: { p_ocultar: boolean; p_reporte: string }
        Returns: undefined
      }
      participo_en: { Args: { conv: string }; Returns: boolean }
      publicar_mi_certificado: {
        Args: { p_imagen_ruta: string }
        Returns: string
      }
      publicar_mi_escudo: {
        Args: { p_imagen_ruta: string; p_respuesta: string }
        Returns: string
      }
      puede: { Args: { p_accion: string; p_recurso: string }; Returns: boolean }
      puede_publicar: { Args: never; Returns: boolean }
      registrar_dispositivo: {
        Args: { p_plataforma: string; p_token: string }
        Returns: undefined
      }
      reportar_contenido: {
        Args: {
          p_contenido: string
          p_detalle?: string
          p_motivo: string
          p_tipo: string
        }
        Returns: undefined
      }
      revisar_reporte: {
        Args: { p_reporte: string; p_revisado: boolean }
        Returns: undefined
      }
      sesiones_linea: {
        Args: never
        Returns: {
          descripcion: string
          duracion_minutos: number
          estado: string
          fecha: string
          id: string
          tipo: string
          titulo: string
        }[]
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
  sgc: {
    Tables: {
      documento: {
        Row: {
          alias: string[]
          archivos: string[]
          codigo: string
          creado_en: string
          datos_sensibles: boolean
          destino: string | null
          estado: string
          evidencia_estado: string | null
          familia: string | null
          fecha: string | null
          id: string
          nota: string | null
          perim_cat: string | null
          perimetro: string
          proceso_ref: string | null
          proceso_xx: string | null
          tipo_yy: string | null
          titulo: string
          version: string | null
        }
        Insert: {
          alias?: string[]
          archivos?: string[]
          codigo: string
          creado_en?: string
          datos_sensibles?: boolean
          destino?: string | null
          estado: string
          evidencia_estado?: string | null
          familia?: string | null
          fecha?: string | null
          id?: string
          nota?: string | null
          perim_cat?: string | null
          perimetro?: string
          proceso_ref?: string | null
          proceso_xx?: string | null
          tipo_yy?: string | null
          titulo: string
          version?: string | null
        }
        Update: {
          alias?: string[]
          archivos?: string[]
          codigo?: string
          creado_en?: string
          datos_sensibles?: boolean
          destino?: string | null
          estado?: string
          evidencia_estado?: string | null
          familia?: string | null
          fecha?: string | null
          id?: string
          nota?: string | null
          perim_cat?: string | null
          perimetro?: string
          proceso_ref?: string | null
          proceso_xx?: string | null
          tipo_yy?: string | null
          titulo?: string
          version?: string | null
        }
        Relationships: []
      }
      documento_archivo: {
        Row: {
          actualizado_en: string
          documento_id: string
          estado: string
          formato: string
          huella: string
          id: string
          nombre: string
          orden: number
          original_ruta: string | null
          paginas: number | null
          pdf_ruta: string | null
          pdf_tamano: number | null
          tamano_original: number | null
        }
        Insert: {
          actualizado_en?: string
          documento_id: string
          estado: string
          formato: string
          huella: string
          id?: string
          nombre: string
          orden?: number
          original_ruta?: string | null
          paginas?: number | null
          pdf_ruta?: string | null
          pdf_tamano?: number | null
          tamano_original?: number | null
        }
        Update: {
          actualizado_en?: string
          documento_id?: string
          estado?: string
          formato?: string
          huella?: string
          id?: string
          nombre?: string
          orden?: number
          original_ruta?: string | null
          paginas?: number | null
          pdf_ruta?: string | null
          pdf_tamano?: number | null
          tamano_original?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documento_archivo_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documento"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_conciliacion: {
        Row: {
          decidido_en: string
          decidido_por: string
          documento_id: string
          id: string
          motivo: string
          resolucion: string
        }
        Insert: {
          decidido_en?: string
          decidido_por?: string
          documento_id: string
          id?: string
          motivo: string
          resolucion: string
        }
        Update: {
          decidido_en?: string
          decidido_por?: string
          documento_id?: string
          id?: string
          motivo?: string
          resolucion?: string
        }
        Relationships: [
          {
            foreignKeyName: "documento_conciliacion_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documento"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_proceso: {
        Row: {
          confianza: string | null
          creado_en: string
          decidido_en: string | null
          decidido_por: string | null
          documento_id: string
          estado: string
          id: string
          origen: string
          proceso_ref: string
          razon: string | null
          rol: string
        }
        Insert: {
          confianza?: string | null
          creado_en?: string
          decidido_en?: string | null
          decidido_por?: string | null
          documento_id: string
          estado?: string
          id?: string
          origen?: string
          proceso_ref: string
          razon?: string | null
          rol?: string
        }
        Update: {
          confianza?: string | null
          creado_en?: string
          decidido_en?: string | null
          decidido_por?: string | null
          documento_id?: string
          estado?: string
          id?: string
          origen?: string
          proceso_ref?: string
          razon?: string | null
          rol?: string
        }
        Relationships: [
          {
            foreignKeyName: "documento_proceso_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documento"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_registro: {
        Row: {
          archivo_ruta: string | null
          contenido: Json
          creado_en: string
          creado_por: string | null
          documento_id: string
          editado_en: string | null
          editado_por: string | null
          fecha: string | null
          id: string
          nota: string | null
          origen: string
          titulo: string
        }
        Insert: {
          archivo_ruta?: string | null
          contenido?: Json
          creado_en?: string
          creado_por?: string | null
          documento_id: string
          editado_en?: string | null
          editado_por?: string | null
          fecha?: string | null
          id?: string
          nota?: string | null
          origen?: string
          titulo: string
        }
        Update: {
          archivo_ruta?: string | null
          contenido?: Json
          creado_en?: string
          creado_por?: string | null
          documento_id?: string
          editado_en?: string | null
          editado_por?: string | null
          fecha?: string | null
          id?: string
          nota?: string | null
          origen?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "documento_registro_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documento"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_version: {
        Row: {
          archivo_ruta: string | null
          contenido: Json
          creado_en: string
          creado_por: string | null
          documento_id: string
          estado: string
          etiqueta: string | null
          fecha: string | null
          id: string
          motivo: string | null
          numero: number
          origen: string
          reemplazada_en: string | null
          vigente_desde: string | null
        }
        Insert: {
          archivo_ruta?: string | null
          contenido?: Json
          creado_en?: string
          creado_por?: string | null
          documento_id: string
          estado: string
          etiqueta?: string | null
          fecha?: string | null
          id?: string
          motivo?: string | null
          numero: number
          origen?: string
          reemplazada_en?: string | null
          vigente_desde?: string | null
        }
        Update: {
          archivo_ruta?: string | null
          contenido?: Json
          creado_en?: string
          creado_por?: string | null
          documento_id?: string
          estado?: string
          etiqueta?: string | null
          fecha?: string | null
          id?: string
          motivo?: string | null
          numero?: number
          origen?: string
          reemplazada_en?: string | null
          vigente_desde?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documento_version_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documento"
            referencedColumns: ["id"]
          },
        ]
      }
      proceso: {
        Row: {
          area_texto: string | null
          clave: string
          codigo_informe: string | null
          codigo_sgc: string | null
          creado_en: string
          creado_por: string | null
          dueno_plaza_ref: string | null
          dueno_texto: string | null
          esc: string | null
          escenario_id: string | null
          estado: string
          estado_cat: string | null
          estado_operativo: string
          ficha: Json
          fuente: string[]
          generacion: string | null
          id: string
          nivel: number
          nombre: string
          nota: string | null
          orden: number
          padre_ref: string | null
          ref: string
          tipo: string | null
          tipo_cat: string | null
          version: number
          vigencia: unknown
        }
        Insert: {
          area_texto?: string | null
          clave: string
          codigo_informe?: string | null
          codigo_sgc?: string | null
          creado_en?: string
          creado_por?: string | null
          dueno_plaza_ref?: string | null
          dueno_texto?: string | null
          esc?: string | null
          escenario_id?: string | null
          estado?: string
          estado_cat?: string | null
          estado_operativo?: string
          ficha?: Json
          fuente?: string[]
          generacion?: string | null
          id?: string
          nivel: number
          nombre: string
          nota?: string | null
          orden?: number
          padre_ref?: string | null
          ref?: string
          tipo?: string | null
          tipo_cat?: string | null
          version?: number
          vigencia?: unknown
        }
        Update: {
          area_texto?: string | null
          clave?: string
          codigo_informe?: string | null
          codigo_sgc?: string | null
          creado_en?: string
          creado_por?: string | null
          dueno_plaza_ref?: string | null
          dueno_texto?: string | null
          esc?: string | null
          escenario_id?: string | null
          estado?: string
          estado_cat?: string | null
          estado_operativo?: string
          ficha?: Json
          fuente?: string[]
          generacion?: string | null
          id?: string
          nivel?: number
          nombre?: string
          nota?: string | null
          orden?: number
          padre_ref?: string | null
          ref?: string
          tipo?: string | null
          tipo_cat?: string | null
          version?: number
          vigencia?: unknown
        }
        Relationships: []
      }
      proceso_cruce: {
        Row: {
          codigo_sgc: string | null
          confirmado: boolean
          id: string
          informe_macro_id: string | null
          informe_proceso_id: string | null
          nota: string | null
          proceso_ref: string
          tipo: string
        }
        Insert: {
          codigo_sgc?: string | null
          confirmado?: boolean
          id?: string
          informe_macro_id?: string | null
          informe_proceso_id?: string | null
          nota?: string | null
          proceso_ref: string
          tipo: string
        }
        Update: {
          codigo_sgc?: string | null
          confirmado?: boolean
          id?: string
          informe_macro_id?: string | null
          informe_proceso_id?: string | null
          nota?: string | null
          proceso_ref?: string
          tipo?: string
        }
        Relationships: []
      }
      tipo_documento: {
        Row: {
          generacion: string
          nivel: number | null
          nombre: string
          yy: string
        }
        Insert: {
          generacion: string
          nivel?: number | null
          nombre: string
          yy: string
        }
        Update: {
          generacion?: string
          nivel?: number | null
          nombre?: string
          yy?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activar_programados: { Args: never; Returns: number }
      buscar_documentos: {
        Args: {
          p_desde?: number
          p_estado?: string
          p_familia?: string
          p_limite?: number
          p_perimetro?: string
          p_proceso?: string
          p_texto?: string
          p_xx?: string
          p_yy?: string
        }
        Returns: {
          alias: string[]
          codigo: string
          datos_sensibles: boolean
          estado: string
          familia: string
          fecha: string
          id: string
          perimetro: string
          proceso_ref: string
          proceso_xx: string
          tipo_yy: string
          titulo: string
          total: number
          version: string
        }[]
      }
      comparar_escenario_procesos: {
        Args: { p_escenario: string }
        Returns: {
          antes: Json
          borrador_abierto: boolean
          cambio: string
          campos: string[]
          despues: Json
          nivel: number
          nombre: string
          ref: string
        }[]
      }
      confirmar_enlace: {
        Args: { p_id: string; p_proceso?: string }
        Returns: undefined
      }
      confirmar_enlaces_proceso: {
        Args: { p_proceso: string }
        Returns: number
      }
      conteo_documentos: {
        Args: never
        Returns: {
          proceso_ref: string
          total: number
          vigentes: number
        }[]
      }
      crear_escenario_procesos: {
        Args: { p_descripcion?: string; p_nombre: string; p_raiz?: string }
        Returns: string
      }
      descartar_borrador_documento: {
        Args: { p_version: string }
        Returns: undefined
      }
      descartar_enlace: { Args: { p_id: string }; Returns: undefined }
      editar_cruce: {
        Args: { p_campo: string; p_id: string; p_valor: string }
        Returns: undefined
      }
      editar_registro: {
        Args: {
          p_bloques: Json
          p_id: string
          p_seccion: number
          p_titulo: string
        }
        Returns: undefined
      }
      enviar_documento: {
        Args: { p_motivo?: string; p_version: string }
        Returns: string
      }
      enviar_escenario_procesos: {
        Args: { p_esc: string; p_vigente_desde: string }
        Returns: string
      }
      enviar_proceso: { Args: { p_id: string }; Returns: string }
      ficha_llena: { Args: { p_ficha: Json }; Returns: boolean }
      guardar_seccion_documento: {
        Args: {
          p_bloques: Json
          p_documento: string
          p_motivo?: string
          p_seccion: number
          p_titulo: string
        }
        Returns: string
      }
      lienzo: {
        Args: { p_escenario?: string; p_fecha?: string }
        Returns: {
          antes: Json
          codigo_informe: string
          codigo_sgc: string
          diff: string
          docs_total: number
          docs_vigentes: number
          dueno: string
          dueno_estado: string
          dueno_plaza_ref: string
          estado_operativo: string
          id: string
          nivel: number
          nombre: string
          orden: number
          padre: string
          ref: string
          revision_abierta: boolean
          salud: string
          tiene_ficha: boolean
          tipo: string
          version: number
        }[]
      }
      nuevo_borrador: { Args: { p_ref: string }; Returns: string }
      opciones_documentos: {
        Args: never
        Returns: {
          campo: string
          total: number
          valor: string
        }[]
      }
      plano: { Args: { p: string }; Returns: string }
      publicar_documento_version: { Args: { p_id: string }; Returns: undefined }
      publicar_escenario_procesos: {
        Args: { p_esc: string }
        Returns: undefined
      }
      publicar_proceso: { Args: { p_id: string }; Returns: undefined }
      xx: { Args: { p: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  ui: {
    Tables: {
      metrica: {
        Row: {
          accion: string
          actualizado_en: string
          clave: string
          con_escenario: boolean
          con_fecha: boolean
          consulta: string
          definicion: string
          dueno: string | null
          estado: string
          fuente: string
          href: string | null
          modulo: string | null
          nombre: string
          orden: number
          recurso: string
          unidad: string
          version: number
        }
        Insert: {
          accion?: string
          actualizado_en?: string
          clave: string
          con_escenario?: boolean
          con_fecha?: boolean
          consulta: string
          definicion: string
          dueno?: string | null
          estado?: string
          fuente: string
          href?: string | null
          modulo?: string | null
          nombre: string
          orden?: number
          recurso: string
          unidad: string
          version?: number
        }
        Update: {
          accion?: string
          actualizado_en?: string
          clave?: string
          con_escenario?: boolean
          con_fecha?: boolean
          consulta?: string
          definicion?: string
          dueno?: string | null
          estado?: string
          fuente?: string
          href?: string | null
          modulo?: string | null
          nombre?: string
          orden?: number
          recurso?: string
          unidad?: string
          version?: number
        }
        Relationships: []
      }
      portada_rol: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          metricas: string[]
          orden: number
          rol_id: string
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          metricas?: string[]
          orden?: number
          rol_id: string
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          metricas?: string[]
          orden?: number
          rol_id?: string
        }
        Relationships: []
      }
      reciente: {
        Row: {
          abierto_en: string
          detalle: string | null
          objeto_id: string
          perfil: string
          tipo: string
          titulo: string
        }
        Insert: {
          abierto_en?: string
          detalle?: string | null
          objeto_id: string
          perfil?: string
          tipo: string
          titulo: string
        }
        Update: {
          abierto_en?: string
          detalle?: string | null
          objeto_id?: string
          perfil?: string
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      tutorial: {
        Row: {
          actualizado_en: string
          archivo: string
          descripcion: string | null
          duracion_seg: number | null
          modulo: string
          orden: number
          poster: string | null
          recurso: string
          ruta: string
          titulo: string
        }
        Insert: {
          actualizado_en?: string
          archivo: string
          descripcion?: string | null
          duracion_seg?: number | null
          modulo: string
          orden?: number
          poster?: string | null
          recurso: string
          ruta: string
          titulo: string
        }
        Update: {
          actualizado_en?: string
          archivo?: string
          descripcion?: string | null
          duracion_seg?: number | null
          modulo?: string
          orden?: number
          poster?: string | null
          recurso?: string
          ruta?: string
          titulo?: string
        }
        Relationships: []
      }
      vista: {
        Row: {
          actualizado_en: string
          alcance: string
          creado_en: string
          id: string
          modulo: string | null
          nombre: string
          parametros: Json
          propietario: string
          recurso: string | null
          ruta: string
          tabla: string
        }
        Insert: {
          actualizado_en?: string
          alcance?: string
          creado_en?: string
          id?: string
          modulo?: string | null
          nombre: string
          parametros?: Json
          propietario?: string
          recurso?: string | null
          ruta: string
          tabla: string
        }
        Update: {
          actualizado_en?: string
          alcance?: string
          creado_en?: string
          id?: string
          modulo?: string | null
          nombre?: string
          parametros?: Json
          propietario?: string
          recurso?: string | null
          ruta?: string
          tabla?: string
        }
        Relationships: []
      }
    }
    Views: {
      programa_archivos: {
        Row: {
          acciones: string | null
          area: string | null
          area_id: string | null
          busqueda: string | null
          categoria: string | null
          confidencial: boolean | null
          descripcion: string | null
          entrevista: string | null
          entrevista_id: string | null
          extension: string | null
          fase: number | null
          id: string | null
          mime_type: string | null
          nombre: string | null
          subido_en: string | null
          tamano_bytes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "archivos_entrevista_id_fkey"
            columns: ["entrevista_id"]
            isOneToOne: false
            referencedRelation: "programa_entrevistas"
            referencedColumns: ["id"]
          },
        ]
      }
      programa_entrevistas: {
        Row: {
          area: string | null
          area_id: string | null
          busqueda: string | null
          codigo: string | null
          con_transcripcion: boolean | null
          duracion_minutos: number | null
          entrevistado_cargo: string | null
          entrevistado_nombre: string | null
          entrevistador: string | null
          estado: string | null
          fecha: string | null
          hallazgos: number | null
          id: string | null
          participantes: number | null
          sede: string | null
          serie: string | null
          tipo: string | null
          titulo: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      alertas_organizacion: { Args: { p_al?: string }; Returns: Json }
      buscar: {
        Args: {
          p_desde?: number
          p_limite?: number
          p_q: string
          p_tipo?: string
        }
        Returns: {
          codigo: string
          detalle: string
          href: string
          id: string
          rango: number
          tipo: string
          titulo: string
          total: number
        }[]
      }
      campo_legible: { Args: { p: string }; Returns: string }
      campos_cambiados: {
        Args: { p_antes: Json; p_despues: Json }
        Returns: string
      }
      canal_comentario_estado: {
        Args: { p_comentario: string; p_estado: string }
        Returns: undefined
      }
      canal_comentarios: {
        Args: never
        Returns: {
          autor: string
          busqueda: string
          creado_en: string
          estado: string
          id: string
          publicacion: string
          publicacion_id: string
          reportes: number
          texto: string
        }[]
      }
      canal_grupo: {
        Args: { p_con_mensajes?: boolean; p_grupo: string }
        Returns: Json
      }
      canal_grupo_editar: {
        Args: {
          p_activo: boolean
          p_grupo: string
          p_nombre: string
          p_proposito: string
          p_tipo: string
        }
        Returns: undefined
      }
      canal_grupo_miembro: {
        Args: { p_accion: string; p_empleado: string; p_grupo: string }
        Returns: undefined
      }
      canal_grupos: {
        Args: never
        Returns: {
          acciones: string
          activo: boolean
          area: string
          busqueda: string
          coordinadores: string
          creado_en: string
          id: string
          mensajes_30d: number
          miembros: number
          nombre: string
          proposito: string
          tipo: string
          ultimo_mensaje: string
        }[]
      }
      canal_modulo_activar: {
        Args: { p_activo: boolean; p_clave: string }
        Returns: undefined
      }
      canal_personas: {
        Args: { p_buscar?: string }
        Returns: {
          area: string
          cargo: string
          id: string
          nombre: string
        }[]
      }
      canal_publicacion_comentarios: {
        Args: { p_permite: boolean; p_publicacion: string }
        Returns: undefined
      }
      canal_publicaciones: {
        Args: never
        Returns: {
          area: string
          audiencia: string
          autor: string
          autor_cargo: string
          bajada: string
          comentarios: number
          creado_en: string
          estado: string
          fijado: boolean
          id: string
          lecturas: number
          oficial: boolean
          publicado_en: string
          reacciones: number
          reportes_abiertos: number
          tipo: string
          titulo: string
        }[]
      }
      canal_publicaciones_permiten: {
        Args: never
        Returns: {
          id: string
          permite_comentarios: boolean
        }[]
      }
      canal_uso: {
        Args: { p_al?: string }
        Returns: {
          activas_30d: number
          adopcion: number
          area: string
          busqueda: string
          clave: string
          con_cuenta: number
          en_padron: number
          entraron: number
          lecturas_30d: number
          mensajes_30d: number
          nivel: string
          nivel_nombre: string
          sede: string
          sede_nombre: string
        }[]
      }
      cargos: {
        Args: { p_al?: string }
        Returns: {
          activo: string
          busqueda: string
          clave: string
          dotacion: number
          familia: string
          familia_nombre: string
          id: string
          n_sinonimos: number
          nivel: number
          nombre: string
          ocupantes: number
          plazas: number
          sinonimos: string
          vacantes: number
        }[]
      }
      componentes_costo: {
        Args: { p_fecha?: string }
        Returns: {
          aplica_a: string
          base: string
          base_legal: string
          desde: string
          forma: string
          fuente: string
          hasta: string
          id: string
          moneda: string
          nombre: string
          nota: string
          orden: number
          piso: string
          por_confirmar: string
          tope: number
          valor: number
        }[]
      }
      conciliacion: {
        Args: never
        Returns: {
          busqueda: string
          creado_en: string
          descripcion: string
          dias: number
          estado: string
          fuente: string
          id: string
          modulo: string
          objeto: string
          resolucion: string
          responsable: string
          resuelto_en: string
          resuelto_por: string
          tipo: string
        }[]
      }
      conciliacion_documentos: {
        Args: never
        Returns: {
          acciones: string
          busqueda: string
          clave: string
          codigo: string
          decidido_en: string
          decidido_por: string
          detalle: string
          estado: string
          id: string
          motivo: string
          perimetro: string
          perimetro_nombre: string
          prioridad: number
          proceso: string
          resolucion: string
          situacion: string
          titulo: string
        }[]
      }
      costo_unidades: {
        Args: { p_fecha?: string }
        Returns: {
          busqueda: string
          costo_usd: number
          costo_ves: number
          direccion: string
          dotacion: number
          dotacion_sin_costo: number
          plazas: number
          plazas_sin_costo: number
          tasa: number
          tasa_fecha: string
          unidad: string
          unidad_ref: string
        }[]
      }
      costos_cargo: {
        Args: { p_fecha?: string }
        Returns: {
          bonos_usd: number
          busqueda: string
          cargo: string
          cargo_id: string
          costo_id: string
          desde: string
          dotacion: number
          estado: string
          familia: string
          fuente: string
          hasta: string
          moneda: string
          plazas: number
          por_confirmar: string
          salario: number
          tasa: number
          tasa_fecha: string
          total_usd: number
          total_ves: number
        }[]
      }
      cruce_procesos: {
        Args: never
        Returns: {
          busqueda: string
          codigo_sgc: string
          confirmado: boolean
          id: string
          informe: string
          informe_area: string
          informe_codigo: string
          informe_estado: string
          informe_macro: string
          nivel: number
          nota: string
          proceso: string
          proceso_ref: string
          tipo: string
        }[]
      }
      diff_legible: {
        Args: { p_accion: string; p_antes: Json; p_despues: Json }
        Returns: string
      }
      documentos: {
        Args: never
        Returns: {
          alias_texto: string
          busqueda: string
          codigo: string
          codigo_repetido: boolean
          datos_sensibles: boolean
          destino: string
          estado: string
          familia: string
          fecha: string
          id: string
          macro: string
          macro_ref: string
          n_alias: number
          n_archivos: number
          pendientes: number
          perimetro: string
          perimetro_nombre: string
          proceso: string
          proceso_ref: string
          proceso_xx: string
          proceso_xx_etiqueta: string
          tipo_etiqueta: string
          tipo_nombre: string
          tipo_yy: string
          titulo: string
          version: string
        }[]
      }
      dotacion: {
        Args: { p_al?: string; p_anio?: number }
        Returns: {
          aprobada: number
          busqueda: string
          cargo: string
          cargo_id: string
          clave: string
          diferencia: number
          direccion: string
          direccion_ref: string
          en_requisicion: number
          estado_plan: string
          familia: string
          ocupada: number
          plan: number
          plan_borrador: number
          por_encima: number
          unidad: string
          unidad_ref: string
          vacantes: number
        }[]
      }
      dotacion_base: {
        Args: { p_al: string; p_escenario: string }
        Returns: {
          aprobada: number
          ocupada: number
          plazas: number
          plazas_por_encima: number
          plazas_vacias: number
          por_encima: number
          vacantes: number
        }[]
      }
      escenarios: {
        Args: never
        Returns: {
          altas: number
          bajas: number
          busqueda: string
          cambios: number
          creado_en: string
          creado_por: string
          delta_dotacion: number
          descripcion: string
          estado: string
          fecha_base: string
          id: string
          nombre: string
          publicado_en: string
          vigente_desde: string
        }[]
      }
      escenarios_procesos: {
        Args: never
        Returns: {
          acciones: string
          altas: number
          bajas: number
          borradores_abiertos: number
          busqueda: string
          cambios: number
          creado_en: string
          descripcion: string
          estado: string
          fecha_base: string
          id: string
          nombre: string
          publicado_en: string
          raiz: string
          total: number
          vigente_desde: string
        }[]
      }
      etiqueta: { Args: { p_clave: string; p_tipo: string }; Returns: string }
      formacion_avance: {
        Args: never
        Returns: {
          area: string
          area_id: string
          avance: number
          busqueda: string
          completados: number
          en_curso: number
          familia: string
          id: string
          lecciones_promedio: number
          matriculados: number
          sin_empezar: number
        }[]
      }
      formacion_base: {
        Args: never
        Returns: {
          actualizado_en: string
          completados: number
          elegibles: number
          en_curso: number
          hechas: number
          lecciones: number
          matriculados: number
          por_leccion: Json
          sin_empezar: number
        }[]
      }
      formacion_certificados: {
        Args: never
        Returns: {
          area: string
          busqueda: string
          cargo: string
          codigo: string
          emitido_en: string
          entregado: string
          entregado_en: string
          ficha: string
          id: string
          nombre: string
          por_entregar: boolean
        }[]
      }
      formacion_personas: {
        Args: never
        Returns: {
          area: string
          busqueda: string
          cargo: string
          certificado: string
          dias_callado: number
          empleado_id: string
          estado: string
          familia: string
          ficha: string
          id: string
          l0: string
          l1: string
          l2: string
          l3: string
          l4: string
          l5: string
          l6: string
          l7: string
          l8: string
          lecciones_hechas: number
          nombre: string
          ultimo_toque: string
        }[]
      }
      fuente_legible: { Args: { p: string }; Returns: string }
      historial_documentos: {
        Args: never
        Returns: {
          accion: string
          busqueda: string
          cambios: string
          codigo: string
          documento_id: string
          en: string
          estado: string
          id: number
          objeto: string
          objeto_tipo: string
          quien: string
        }[]
      }
      historial_org: {
        Args: never
        Returns: {
          accion: string
          actor: string
          busqueda: string
          cambios: string
          en: string
          id: number
          objeto: string
          perimetro: string
          registro_id: string
          tabla: string
          tabla_nombre: string
        }[]
      }
      historial_procesos: {
        Args: never
        Returns: {
          accion: string
          busqueda: string
          cambios: string
          codigo: string
          en: string
          estado: string
          id: number
          objeto: string
          objeto_tipo: string
          quien: string
          ref: string
          version: number
        }[]
      }
      m_asistente_gasto_mes: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_asistente_primera_palabra: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_asistente_turnos_mes: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_asistente_usuarios_activos: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_brecha_cambiaria: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_canal_grupos: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_canal_mensajes_mes: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_canal_personas_activas: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_canal_publicaciones_mes: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_canal_reportes_abiertos: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_documentos_en_conciliacion: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_documentos_inventario: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_documentos_vigentes: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_dotacion_aprobada: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_dotacion_en_requisicion: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_dotacion_ocupada: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_dotacion_por_encima: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_dotacion_vacantes: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_formacion_avance: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_formacion_certificados: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_formacion_completaron: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_formacion_matriculados: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_levantamiento_archivos: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_levantamiento_entrevistas: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_mis_requisiciones: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_mis_tareas: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_plataforma_hitos: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_plataforma_modulos: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_plataforma_pendientes: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_por_decidir: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_procesos_catalogo: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_procesos_con_dueno: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_procesos_con_ficha: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_procesos_en_revision: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_procesos_sin_documentar: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_procesos_validados: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_programa_entregables: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_programa_horas_mes: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_programa_sesiones: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_requisiciones_abiertas: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_tasa_bcv_eur: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_tasa_bcv_usd: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      m_tasa_paralelo: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          calculado_en: string
          detalle: Json
          total: number
          valor: number
        }[]
      }
      metrica: {
        Args: { p_al?: string; p_clave: string; p_escenario?: string }
        Returns: Json
      }
      metricas: {
        Args: { p_al?: string; p_claves?: string[]; p_escenario?: string }
        Returns: Json[]
      }
      parametros_costo: {
        Args: { p_fecha?: string }
        Returns: {
          clave: string
          desde: string
          fuente: string
          id: string
          nombre: string
          por_confirmar: string
          unidad: string
          valor: number
        }[]
      }
      personas: {
        Args: { p_al?: string }
        Returns: {
          busqueda: string
          cargo: string
          cargo_id: string
          certeza: string
          desde: string
          direccion: string
          empleado_id: string
          excede: string
          ficha: string
          hasta: string
          id: string
          nombre: string
          plaza_ref: string
          tipo: string
          tipo_nombre: string
          unidad: string
          unidad_ref: string
        }[]
      }
      plano: { Args: { p: string }; Returns: string }
      plazas: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          busqueda: string
          cargo: string
          cargo_id: string
          certeza: string
          dotacion: number
          estado: string
          exceso: number
          familia: string
          nomina: string
          ocupadas: number
          ref: string
          sede: string
          sede_nombre: string
          tipo_nomina: string
          unidad: string
          unidad_ref: string
          unidad_tipo: string
          vacantes: number
        }[]
      }
      procesos: {
        Args: { p_al?: string; p_escenario?: string }
        Returns: {
          acciones: string
          alerta_sin_indicadores: boolean
          alerta_vacante: boolean
          area: string
          busqueda: string
          ciclo: string
          ciclo_version: number
          codigo: string
          codigo_dudoso: boolean
          codigo_informe: string
          codigo_sgc: string
          con_nota_ficha: boolean
          diff: string
          docs_total: number
          docs_vigentes: number
          dueno: string
          dueno_estado: string
          dueno_ficha_difiere: boolean
          dueno_plaza_ref: string
          estado_operativo: string
          estado_operativo_nombre: string
          indicadores: number
          macro: string
          macro_ref: string
          motivo_codigo: string
          nivel: number
          nivel_nombre: string
          nombre: string
          nombre_arbol: string
          padre: string
          padre_ref: string
          ref: string
          ruta: string
          salud: string
          tiene_ficha: boolean
          tipo: string
          tipo_nombre: string
          version: number
        }[]
      }
      procesos_base: {
        Args: { p_al: string; p_escenario: string }
        Returns: {
          dueno_estado: string
          nivel: number
          ref: string
          salud: string
          tiene_ficha: boolean
          version: number
        }[]
      }
      recientes: {
        Args: { p_limite?: number }
        Returns: {
          abierto_en: string
          detalle: string
          id: string
          tipo: string
          titulo: string
        }[]
      }
      registrar_reciente: {
        Args: {
          p_detalle?: string
          p_id: string
          p_tipo: string
          p_titulo: string
        }
        Returns: undefined
      }
      requisiciones: {
        Args: never
        Returns: {
          busqueda: string
          cantidad: number
          cargo: string
          cargo_id: string
          creado_en: string
          dias: number
          esperando_desde: string
          estado: string
          fecha_deseada: string
          fuera_de_plan: string
          id: string
          mia: string
          numero: number
          origen: string
          origen_nombre: string
          paso: string
          pedida_por: string
          quien: string
          unidad: string
          unidad_ref: string
        }[]
      }
      tasa_estado: {
        Args: { p_al: string; p_fecha_valor: string }
        Returns: string
      }
      ultimo_cambio: {
        Args: { p_esquema: string; p_tablas: string[] }
        Returns: string
      }
      validacion_procesos: {
        Args: never
        Returns: {
          aprobadas: number
          avance: number
          borradores: number
          busqueda: string
          codigo: string
          con_ficha: number
          dueno: string
          en_revision: number
          espera_dias: number
          etapa: string
          macro: string
          macro_ref: string
          procesos: number
          siguiente: string
          sin_ficha: number
          solicitudes: number
          tipo: string
          tipo_nombre: string
          validados: number
        }[]
      }
      valor_legible: {
        Args: { p_campo: string; p_valor: Json }
        Returns: string
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
  asistente: {
    Enums: {},
  },
  control: {
    Enums: {},
  },
  flujo: {
    Enums: {},
  },
  ia: {
    Enums: {},
  },
  nucleo: {
    Enums: {},
  },
  org: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  sgc: {
    Enums: {},
  },
  ui: {
    Enums: {},
  },
} as const
