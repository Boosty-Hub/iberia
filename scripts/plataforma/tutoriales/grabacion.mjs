// El estudio de los tutoriales: graba una pestaña con la app real (contra el proyecto de PRUEBAS) y dibuja dentro de
// la página lo que un video de Playwright no trae: un cursor visible que se desliza a cada clic, un pulso al hacer
// clic, la franja de subtítulos abajo, la portada y el resaltado. Lo que se ve es lo que se grabó: no hay que
// sincronizar subtítulos con ffmpeg. (Mismo método que los tutoriales de Security Solution, 31-oct-2026.)
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { narrar } from './voz.mjs'

export const ANCHO = 1440
export const ALTO = 900
export const FRANJA = 84

export const UI = `
(() => {
  if (window.__tutUI) return; window.__tutUI = true;
  const css = document.createElement('style');
  css.textContent = \`
    #tut-franja { position: fixed; left: 0; right: 0; bottom: 0; height: ${FRANJA}px; z-index: 2147483646;
      background: #2b2a28; color: #fff; display: flex; align-items: center; justify-content: center; padding: 0 72px;
      font: 600 21px/1.35 'DM Sans', system-ui, sans-serif; text-align: center; box-sizing: border-box; transition: opacity .25s;
      border-top: 4px solid #D4332C; }
    #tut-franja small { display: block; font-weight: 600; font-size: 13px; color: #FFD036; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 3px; }
    #tut-cursor { position: fixed; z-index: 2147483647; width: 22px; height: 26px; margin: -3px 0 0 -3px; pointer-events: none; }
    #tut-cursor svg { filter: drop-shadow(0 1px 2px rgba(0,0,0,.45)); }
    .tut-pulso { position: fixed; z-index: 2147483645; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
      border: 3px solid #D4332C; pointer-events: none; animation: tutPulso .55s ease-out forwards; }
    @keyframes tutPulso { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
    #tut-portada { position: fixed; inset: 0; z-index: 2147483647; display: flex; flex-direction: column; align-items: center;
      justify-content: center; text-align: center; color: #fff; background: radial-gradient(120% 120% at 20% 10%, #3a3735 0%, #2b2a28 55%, #1c1b1a 100%);
      font-family: 'DM Sans', system-ui, sans-serif; transition: opacity .5s; }
    #tut-portada .b { width: 72px; height: 6px; border-radius: 3px; background: #D4332C; margin-bottom: 22px; }
    #tut-portada .k { color: #FFD036; font-weight: 700; letter-spacing: .2em; font-size: 16px; margin-bottom: 16px; }
    #tut-portada .t { font-weight: 800; font-size: 50px; margin: 0 80px; line-height: 1.1; }
    #tut-portada .d { font-size: 21px; opacity: .85; margin: 18px 140px 0; line-height: 1.45; }
    #tut-resaltar { position: fixed; z-index: 2147483644; border: 3px solid #D4332C; border-radius: 12px; pointer-events: none;
      box-shadow: 0 0 0 4000px rgba(28,27,26,.22); transition: all .25s; }
  \`;
  const franja = document.createElement('div'); franja.id = 'tut-franja'; franja.style.opacity = '0';
  const cur = document.createElement('div'); cur.id = 'tut-cursor';
  cur.innerHTML = '<svg width="22" height="26" viewBox="0 0 22 26"><path d="M2 2 L2 21 L7 16 L11 24 L14 22.5 L10 14.8 L17 14.8 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  cur.style.left = '720px'; cur.style.top = '420px';
  const montar = () => { document.head.appendChild(css); document.body.appendChild(franja); document.body.appendChild(cur); };
  if (document.body) montar(); else document.addEventListener('DOMContentLoaded', montar);
  addEventListener('mousemove', e => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', e => { const p = document.createElement('div'); p.className = 'tut-pulso';
    p.style.left = e.clientX + 'px'; p.style.top = e.clientY + 'px'; document.body.appendChild(p); setTimeout(() => p.remove(), 600); }, true);
  window.__tut = {
    sub(txt, etiqueta) { franja.innerHTML = (etiqueta ? '<div><small>' + etiqueta + '</small>' : '<div>') + txt + '</div>'; franja.style.opacity = txt ? '1' : '0'; },
    portada(k, t, d) { let p = document.getElementById('tut-portada'); if (!p) { p = document.createElement('div'); p.id = 'tut-portada'; document.body.appendChild(p); }
      p.style.opacity = '1'; p.innerHTML = '<div class="b"></div><div class="k">' + k + '</div><div class="t">' + t + '</div>' + (d ? '<div class="d">' + d + '</div>' : ''); },
    quitarPortada() { const p = document.getElementById('tut-portada'); if (p) { p.style.opacity = '0'; setTimeout(() => p.remove(), 600); } },
    resaltar(r) { let h = document.getElementById('tut-resaltar'); if (!r) { if (h) h.remove(); return; }
      if (!h) { h = document.createElement('div'); h.id = 'tut-resaltar'; document.body.appendChild(h); }
      Object.assign(h.style, { left: (r.x - 6) + 'px', top: (r.y - 6) + 'px', width: (r.width + 12) + 'px', height: (r.height + 12) + 'px' }); },
  };
})();`

// ── Acciones que se ven en el video ──
// Con `voz`, cada subtítulo (y la portada) se narra con Sebastián: se anota en qué segundo empieza (`pistas`, para
// mezclarlo después con ffmpeg) y el siguiente subtítulo espera a que termine de hablar el anterior.
export function acciones(page, { voz = false, t0 = Date.now(), pistas = [], alMostrarPortada } = {}) {
  let pos = { x: 720, y: 420 }
  let hablaHasta = 0
  const pausa = (ms) => page.waitForTimeout(ms)
  const esperarVoz = async () => {
    const falta = hablaHasta - Date.now()
    if (falta > 0) await pausa(falta)
  }
  /** Narra un texto desde ahora; devuelve cuánto dura (ms). */
  const decir = async (texto) => {
    if (!voz || !texto) return 0
    const n = await narrar(texto)
    pistas.push({ t: (Date.now() - t0) / 1000, archivo: n.archivo })
    const ms = Math.round(n.duracion * 1000)
    hablaHasta = Date.now() + ms + 250
    return ms
  }
  const moverA = async (x, y) => {
    const pasos = Math.max(8, Math.min(32, Math.round(Math.hypot(x - pos.x, y - pos.y) / 22)))
    await page.mouse.move(x, y, { steps: pasos })
    pos = { x, y }
  }
  // Lo que se va a señalar se trae al centro de lo visible, por encima de la franja de subtítulos.
  const caja = async (loc) => {
    const l = loc.first()
    await l.waitFor({ state: 'visible', timeout: 15000 })
    await l.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' })).catch(() => {})
    await pausa(250)
    return l.boundingBox()
  }
  const a = {
    pausa,
    sub: async (txt, ms = 0, etiqueta) => {
      await esperarVoz()
      if (voz && txt) await narrar(txt) // se sintetiza antes de mostrarlo: subtítulo y voz salen juntos
      await page.evaluate(([t, e]) => window.__tut.sub(t, e), [txt, etiqueta || null])
      const habla = await decir(txt)
      // El tiempo de lectura sale del largo del texto (unas 15 letras por segundo), con un piso; con voz, lo que dure
      // la frase. Con `ms` explícito, la acción siguiente corre mientras habla (y el próximo subtítulo la espera).
      if (ms !== null) await pausa(ms || Math.max(2200, Math.round((txt || '').length * 62), habla + 300))
    },
    portada: async (k, t, d, ms = 3200) => {
      if (voz) await narrar(`${t}. ${d || ''}`)
      await page.evaluate(([k, t, d]) => window.__tut.portada(k, t, d), [k, t, d || ''])
      alMostrarPortada?.()
      const habla = await decir(`${t}. ${d || ''}`)
      await pausa(Math.max(ms, habla + 400))
    },
    esperarVoz,
    quitarPortada: async () => {
      await page.evaluate(() => window.__tut.quitarPortada())
      await pausa(700)
    },
    resaltar: async (loc, ms = 2200) => {
      const b = await caja(loc)
      await page.evaluate((r) => window.__tut.resaltar(r), b)
      await pausa(ms)
      await page.evaluate(() => window.__tut.resaltar(null))
    },
    señalar: async (loc, ms = 900) => {
      const b = await caja(loc)
      await moverA(b.x + b.width / 2, b.y + b.height / 2)
      await pausa(ms)
    },
    clic: async (loc, ms = 900, opciones = {}) => {
      const b = await caja(loc)
      await moverA(b.x + Math.min(b.width / 2, 70), b.y + b.height / 2)
      await pausa(250)
      if (opciones.doble) await loc.first().dblclick({ timeout: 5000 })
      else await loc.first().click({ timeout: 5000 }).catch(() => loc.first().click({ force: true }))
      await pausa(ms)
    },
    escribir: async (loc, texto, ms = 600) => {
      const b = await caja(loc)
      await moverA(b.x + Math.min(b.width / 2, 80), b.y + b.height / 2)
      await loc.first().click()
      await loc.first().fill('')
      await loc.first().pressSequentially(String(texto), { delay: 55 })
      await pausa(ms)
    },
    tecla: async (k, ms = 600) => {
      await page.keyboard.press(k)
      await pausa(ms)
    },
    arriba: async (ms = 500) => {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
      await pausa(ms)
    },
  }
  return a
}

// ── La sesión de prueba (cuenta de administración del proyecto de PRUEBAS) ──
export async function sesionDePrueba(base, email = 'admin.pruebas@plataforma.local') {
  const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
  if (!URL_SUPA || URL_SUPA === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Faltan las SUPABASE_PRUEBAS_* (o apuntan a producción): se graba contra pruebas')
  const admin = createClient(URL_SUPA, process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } })
  const anon = createClient(URL_SUPA, process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  const { data: e, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw error
  const { data: v } = await anon.auth.verifyOtp({ token_hash: e.properties.hashed_token, type: 'magiclink' })
  const nombre = `sb-${new URL(URL_SUPA).hostname.split('.')[0]}-auth-token`
  const valor = 'base64-' + Buffer.from(JSON.stringify(v.session)).toString('base64url')
  const L = 3180
  const partes = valor.length <= L ? [{ name: nombre, value: valor }] : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `${nombre}.${i}`, value: valor.slice(i * L, (i + 1) * L) }))
  return partes.map((p) => ({ ...p, domain: new URL(base).hostname, path: '/' }))
}

// ── Grabar un capítulo ──
export async function grabarCapitulo({ base, cookies, ruta, guion, dir, headed = false, voz = false, viewport }) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const nav = await chromium.launch({ headless: !headed })
  const v = viewport ?? { width: ANCHO, height: ALTO }
  const ctx = await nav.newContext({ viewport: v, recordVideo: { dir, size: v }, locale: 'es-VE', timezoneId: 'America/Caracas', bypassCSP: true })
  await ctx.addCookies(cookies)
  await ctx.addInitScript(UI)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errores.push(m.text()))
  const t0 = Date.now()
  let inicio = 0
  let fallo = null
  const pistas = []
  try {
    await page.goto(base + ruta, { waitUntil: 'networkidle', timeout: 90000 })
    await page.waitForFunction(() => !!window.__tut, null, { timeout: 30000 })
    await page.waitForTimeout(800)
    // Con voz, el video arranca cuando sale la portada (no mientras se sintetiza su frase).
    let portadaVista = false
    const alMostrarPortada = () => {
      if (voz && !portadaVista) inicio = (Date.now() - t0) / 1000
      portadaVista = true
    }
    const a = acciones(page, { voz, t0, pistas, alMostrarPortada })
    await guion(page, a, { marcarInicio: () => (inicio = (Date.now() - t0) / 1000) })
    await a.esperarVoz()
    await page.waitForTimeout(400)
  } catch (err) {
    fallo = err
    await page.screenshot({ path: dir + '/fallo.png' }).catch(() => {})
  }
  const video = page.video()
  await ctx.close()
  await nav.close()
  const webm = video ? await video.path() : null
  return { webm, inicio, errores, fallo, pistas }
}

// webm → mp4 H.264 desde la portada (1280 de ancho: se lee igual y pesa menos) + póster.
export function convertir({ webm, inicio, mp4, poster }) {
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(Math.max(0, inicio - 0.1)), '-i', webm,
    '-vf', 'fps=25,scale=1280:-2:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-movflags', '+faststart', '-an', mp4])
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', '1.0', '-i', mp4, '-frames:v', '1', '-q:v', '4', poster])
  const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString())
  return { duracion: dur, bytes: fs.statSync(mp4).size }
}
