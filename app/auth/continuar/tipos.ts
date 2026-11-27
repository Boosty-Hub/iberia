/** Los tipos de enlace de los correos de Supabase que acepta `/auth/continuar`. Aparte: un módulo 'use server' solo exporta funciones. */
export const TIPOS_ENLACE = ['recovery', 'invite', 'magiclink', 'email', 'email_change', 'signup'] as const
