/**
 * Monta el reloj de las tareas programadas del asistente (fase 5): un trabajo de
 * pg_cron que cada minuto llama por pg_net a `<sitio>/api/asistente/programador`
 * con el secreto del asistente. El secreto va a Vault (nunca a una tabla ni a este
 * archivo) y el trabajo lo lee de ahí.
 *
 * No es una migración porque lleva la dirección del sitio y el secreto de cada
 * entorno. En pruebas no hace falta: el sitio es localhost y la suite llama a la
 * ruta con el reloj adelantado.
 *
 *   node --env-file=.env.local scripts/asistente/montar-programador.mjs                       # simulacro: dice qué haría
 *   node --env-file=.env.local scripts/asistente/montar-programador.mjs --destino produccion --confirmo [--url https://iberiavenezuela.netlify.app]
 *   node --env-file=.env.local scripts/asistente/montar-programador.mjs --destino produccion --confirmo --quitar
 */
const e = process.env
const argv = process.argv.slice(2)
const valor = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null)
const produccion = valor('--destino') === 'produccion'
const ejecutar = produccion && argv.includes('--confirmo')
const quitar = argv.includes('--quitar')
const REF = produccion ? e.SUPABASE_PROJECT_REF : e.SUPABASE_PRUEBAS_REF
const URL_SITIO = (valor('--url') || 'https://iberiavenezuela.netlify.app').replace(/\/$/, '')
const SECRETO = e.ASISTENTE_SECRETO
if (!e.SUPABASE_ACCESS_TOKEN || !REF) throw new Error('Faltan SUPABASE_ACCESS_TOKEN o el ref del proyecto')
if (!SECRETO || SECRETO.length < 32) throw new Error('Falta ASISTENTE_SECRETO (32 caracteres o más)')
if (!/^https:\/\/[a-z0-9.-]+$/i.test(URL_SITIO)) throw new Error('La URL del sitio tiene que ser https://dominio, sin ruta')

async function sql(q) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${e.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 400)}`)
  return JSON.parse(t)
}
const literal = (s) => `'${String(s).replaceAll("'", "''")}'`

console.log(`${ejecutar ? '⚠️  EJECUCIÓN' : 'SIMULACRO'} · proyecto ${REF} · ${quitar ? 'quitar el reloj' : `llamará a ${URL_SITIO}/api/asistente/programador cada minuto`}`)
const actual = await sql(`select jobname, schedule, active from cron.job where jobname = 'asistente-programador'`).catch(() => [])
console.log('· trabajo actual:', actual.length ? JSON.stringify(actual[0]) : 'ninguno')
if (!ejecutar) {
  console.log('· (simulacro: agrega --destino produccion --confirmo para hacerlo)')
  process.exit(0)
}

if (quitar) {
  await sql(`select cron.unschedule('asistente-programador') where exists (select 1 from cron.job where jobname = 'asistente-programador')`)
  console.log('✓ reloj quitado (las tareas quedan; nada las dispara)')
  process.exit(0)
}

await sql(`create extension if not exists pg_cron; create extension if not exists pg_net;`)
// El secreto, en Vault (se crea o se cambia). El texto viaja en el cuerpo de la petición, no por argv.
await sql(`
  do $$
  declare v_id uuid;
  begin
    select id into v_id from vault.secrets where name = 'asistente_secreto';
    if v_id is null then perform vault.create_secret(${literal(SECRETO)}, 'asistente_secreto', 'Secreto del programador del asistente de IA');
    else perform vault.update_secret(v_id, ${literal(SECRETO)}); end if;
  end $$;`)
await sql(`
  select cron.unschedule('asistente-programador') where exists (select 1 from cron.job where jobname = 'asistente-programador');
  select cron.schedule('asistente-programador', '* * * * *', $cron$
    select net.http_post(
      url := ${literal(`${URL_SITIO}/api/asistente/programador`)},
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-asistente-secreto', (select decrypted_secret from vault.decrypted_secrets where name = 'asistente_secreto')),
      body := '{"accion":"tick"}'::jsonb,
      timeout_milliseconds := 55000
    );
  $cron$);`)
const montado = await sql(`select jobname, schedule, active from cron.job where jobname = 'asistente-programador'`)
console.log('✓ reloj montado:', JSON.stringify(montado[0]))
console.log('· En un par de minutos: select status_code, created from net._http_response order by created desc limit 5;  (200 = la ruta respondió)')
