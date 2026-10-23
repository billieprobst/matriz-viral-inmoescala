#!/usr/bin/env node
// Matriz Viral Inmoescala
// Lee datos públicos de cuentas públicas con la cuenta de Apify del usuario
// y calcula qué videos funcionaron mejor que el promedio de cada cuenta.
// No necesita instalar nada: solo Node 18 o superior.
//
// Uso:
//   node scripts/matriz.mjs costo    --ig cuenta1,cuenta2 --tt cuenta3 [--videos 20]
//   node scripts/matriz.mjs leer     --ig cuenta1,cuenta2 --tt cuenta3 [--videos 20] [--simulado]
//   node scripts/matriz.mjs link     <url de perfil o video> [--videos 20] [--simulado] [--solo-costo]
//   node scripts/matriz.mjs analizar
//   node scripts/matriz.mjs llave

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATOS = path.join(RAIZ, 'mi-matriz', 'datos');
const CONFIG = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config.json'), 'utf8'));
const API = 'https://api.apify.com/v2';

// ---------- utilidades ----------

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) out[k] = true;
      else { out[k] = v; i++; }
    } else out._.push(a);
  }
  return out;
}

function lista(v) {
  if (!v || v === true) return [];
  return String(v).split(',').map(limpiarCuenta).filter(Boolean);
}

function limpiarCuenta(c) {
  return c.trim().replace(/^@/, '').replace(/\/$/, '');
}

function usd(n) {
  return `US$${n.toFixed(2)}`;
}

function mediana(nums) {
  const v = nums.filter((n) => typeof n === 'number' && !Number.isNaN(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function pct(n) {
  return `${Math.round(n * 100)}%`;
}

class Aviso extends Error {}

// Corta la ejecución con un mensaje claro para el usuario.
function fallar(msg) {
  throw new Aviso(msg);
}

function leerToken() {
  if (process.env.APIFY_TOKEN) return process.env.APIFY_TOKEN.trim();
  const archivo = path.join(RAIZ, '.env');
  if (!fs.existsSync(archivo)) return null;
  const linea = fs.readFileSync(archivo, 'utf8').split(/\r?\n/).find((l) => l.startsWith('APIFY_TOKEN='));
  const token = linea ? linea.slice('APIFY_TOKEN='.length).trim().replace(/^["']|["']$/g, '') : '';
  return token || null;
}

// Quita lo que podría identificar a terceros: menciones, correos y teléfonos.
function limpiarTexto(t) {
  if (!t) return '';
  return String(t)
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[correo]')
    .replace(/@[\w.]+/g, '@usuario')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[teléfono]')
    .slice(0, 400);
}

// ---------- costo ----------

function estimar(plan) {
  let total = 0;
  const lineas = [];
  for (const [plataforma, p] of Object.entries(plan)) {
    const items = p.cuentas.length * p.videos + p.links.length;
    if (!items) continue;
    const a = CONFIG.actores[plataforma];
    const costo = a.usd_por_corrida + items * a.usd_por_video;
    total += costo;
    lineas.push({ plataforma, items, costo });
  }
  return { total, lineas };
}

function mostrarCosto(est) {
  console.log('\nCosto estimado en tu cuenta de Apify:');
  for (const l of est.lineas) console.log(`  ${l.plataforma}: ${l.items} ${l.items === 1 ? 'video' : 'videos'} ≈ ${usd(l.costo)}`);
  console.log(`  Total ≈ ${usd(est.total)}  (tope por corrida: ${usd(CONFIG.tope_usd_por_corrida)})`);
  console.log('  El plan gratis de Apify trae US$5 de crédito al mes.\n');
}

function armarPlan(o) {
  const videos = Math.min(Number(o.videos) || CONFIG.videos_por_cuenta, 50);
  const plan = {
    instagram: { cuentas: lista(o.ig), links: [], videos },
    tiktok: { cuentas: lista(o.tt), links: [], videos },
  };
  const n = plan.instagram.cuentas.length + plan.tiktok.cuentas.length;
  if (n > CONFIG.max_cuentas) fallar(`Máximo ${CONFIG.max_cuentas} cuentas por corrida. Elige las más parecidas a ti.`);
  return plan;
}

// ---------- links ----------

function leerLink(url) {
  let u;
  try { u = new URL(url.trim()); } catch { fallar('Ese link no parece válido. Cópialo completo desde el navegador o la app.'); }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  const partes = u.pathname.split('/').filter(Boolean);
  if (host === 'instagram.com') {
    if (['reel', 'reels', 'p', 'tv'].includes(partes[0]) && partes[1]) {
      return { plataforma: 'instagram', tipo: 'video', url: `https://www.instagram.com/reel/${partes[1]}/` };
    }
    if (partes[0]) return { plataforma: 'instagram', tipo: 'perfil', cuenta: limpiarCuenta(partes[0]) };
  }
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    if (host.startsWith('vm.') || host.startsWith('vt.')) {
      fallar('Ese es un link corto de TikTok. Ábrelo en el navegador y copia el link largo (el que dice /@cuenta/video/...).');
    }
    const cuenta = partes[0]?.startsWith('@') ? limpiarCuenta(partes[0]) : null;
    if (cuenta && partes[1] === 'video') return { plataforma: 'tiktok', tipo: 'video', cuenta, url: `https://www.tiktok.com/@${cuenta}/video/${partes[2]}` };
    if (cuenta) return { plataforma: 'tiktok', tipo: 'perfil', cuenta };
  }
  fallar('Por ahora leo links de Instagram (perfil o reel) y TikTok (perfil o video).');
}

// ---------- Apify ----------

async function apify(ruta, token, opciones = {}) {
  const r = await fetch(`${API}${ruta}`, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  if (r.status === 401) fallar('Apify no reconoce tu llave. Revisa que la copiaste completa en el archivo .env.');
  if (r.status === 402) fallar('Tu cuenta de Apify no tiene crédito suficiente. Revisa tu saldo en console.apify.com.');
  if (!r.ok) fallar(`Apify respondió con error ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

async function correrActor(plataforma, input, maxItems, topeUsd) {
  const token = leerToken();
  if (!token) fallar('No encuentro tu llave de Apify. Pégala en el archivo .env (APIFY_TOKEN=...) y vuelve a intentar.');
  const id = CONFIG.actores[plataforma].id;
  const q = `maxItems=${maxItems}&maxTotalChargeUsd=${topeUsd.toFixed(2)}`;
  const { data: run } = await apify(`/acts/${id}/runs?${q}`, token, { method: 'POST', body: JSON.stringify(input) });
  process.stdout.write(`Leyendo ${plataforma}`);
  let estado = run;
  const limite = Date.now() + 9 * 60 * 1000;
  while (['READY', 'RUNNING'].includes(estado.status)) {
    if (Date.now() > limite) fallar(`La lectura tarda demasiado. Puedes verla en console.apify.com (corrida ${run.id}).`);
    await new Promise((r) => setTimeout(r, 5000));
    process.stdout.write('.');
    ({ data: estado } = await apify(`/actor-runs/${run.id}`, token));
  }
  console.log(` ${estado.status === 'SUCCEEDED' ? 'listo' : estado.status}`);
  const items = await apify(`/datasets/${estado.defaultDatasetId}/items?clean=true`, token);
  return { items, costoReal: estado.usageTotalUsd ?? null };
}

function inputDe(plataforma, p) {
  if (plataforma === 'instagram') {
    return { username: [...p.cuentas, ...p.links], resultsLimit: p.videos };
  }
  return {
    profiles: p.cuentas,
    postURLs: p.links,
    resultsPerPage: p.videos,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
  };
}

// ---------- normalizar (solo métricas públicas, sin datos personales) ----------

function num(v) {
  return typeof v === 'number' && v >= 0 ? v : null;
}

function normalizar(plataforma, it) {
  if (it.error || it.errorDescription) return null;
  if (plataforma === 'instagram') {
    if (!it.videoDuration && !it.videoPlayCount && !it.videoViewCount) return null;
    return {
      plataforma,
      cuenta: it.ownerUsername,
      url: it.url || (it.shortCode ? `https://www.instagram.com/reel/${it.shortCode}/` : null),
      fecha: it.timestamp ?? null,
      duracion_s: it.videoDuration ? Math.round(it.videoDuration) : null,
      vistas: num(it.videoPlayCount) ?? num(it.videoViewCount),
      likes: num(it.likesCount),
      comentarios: num(it.commentsCount),
      compartidos: num(it.sharesCount),
      texto: limpiarTexto(it.caption),
    };
  }
  return {
    plataforma,
    cuenta: it.authorMeta?.name ?? null,
    url: it.webVideoUrl ?? null,
    fecha: it.createTimeISO ?? (it.createTime ? new Date(it.createTime * 1000).toISOString() : null),
    duracion_s: it.videoMeta?.duration ?? null,
    vistas: num(it.playCount),
    likes: num(it.diggCount),
    comentarios: num(it.commentCount),
    compartidos: num(it.shareCount),
    texto: limpiarTexto(it.text),
  };
}

function guardar(videos, simulado) {
  fs.mkdirSync(DATOS, { recursive: true });
  const nombre = `${simulado ? 'simulado' : 'corrida'}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  fs.writeFileSync(path.join(DATOS, nombre), JSON.stringify(videos, null, 2));
  return nombre;
}

// ---------- análisis ----------

const TRAMOS = [[0, 15, 'menos de 15 s'], [15, 30, '15 a 30 s'], [30, 60, '30 a 60 s'], [60, 90, '60 a 90 s'], [90, Infinity, 'más de 90 s']];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function primeraLinea(t) {
  return (t || '').split(/\n|(?<=[.!?¿¡])\s/)[0].trim().slice(0, 140);
}

function analizar(videos) {
  const porCuenta = {};
  for (const v of videos) (porCuenta[`${v.plataforma}:${v.cuenta}`] ||= []).push(v);

  const cuentas = [];
  const evaluados = [];
  for (const [clave, vs] of Object.entries(porCuenta)) {
    const med = mediana(vs.map((v) => v.vistas));
    cuentas.push({ cuenta: clave, videos: vs.length, mediana_vistas: med, pocos_datos: vs.length < 8 });
    for (const v of vs) {
      const inter = v.vistas ? ((v.likes || 0) + (v.comentarios || 0) + (v.compartidos || 0)) / v.vistas : null;
      evaluados.push({ ...v, multiplicador: med && v.vistas != null ? +(v.vistas / med).toFixed(2) : null, interaccion: inter != null ? +inter.toFixed(4) : null });
    }
  }

  const ordenados = evaluados.filter((v) => v.multiplicador != null).sort((a, b) => b.multiplicador - a.multiplicador);
  let ganadores = ordenados.filter((v) => v.multiplicador >= 2);
  if (ganadores.length < 5) ganadores = ordenados.slice(0, Math.max(3, Math.ceil(ordenados.length * 0.2)));
  const enGanadores = new Set(ganadores);
  const resto = ordenados.filter((v) => !enGanadores.has(v));

  const proporcion = (grupo, f) => (grupo.length ? grupo.filter(f).length / grupo.length : 0);
  const rasgos = {
    'gancho con pregunta': (v) => /[?¿]/.test(primeraLinea(v.texto)),
    'gancho con número o cifra': (v) => /\d/.test(primeraLinea(v.texto)),
    'gancho corto (10 palabras o menos)': (v) => primeraLinea(v.texto).split(/\s+/).filter(Boolean).length <= 10,
    'texto pide comentar una palabra': (v) => /coment[ae]/i.test(v.texto),
    'texto pide guardar o compartir': (v) => /gu[aá]rd|comp[aá]rt|env[ií]a/i.test(v.texto),
    'texto invita a escribir por mensaje': (v) => /\bdm\b|mensaje|escr[ií]beme|whats/i.test(v.texto),
  };

  const duracion = TRAMOS.map(([min, max, nombre]) => {
    const vs = ordenados.filter((v) => v.duracion_s != null && v.duracion_s >= min && v.duracion_s < max);
    return { tramo: nombre, videos: vs.length, ganadores: vs.filter((v) => enGanadores.has(v)).length, mediana_multiplicador: mediana(vs.map((v) => v.multiplicador)) };
  }).filter((d) => d.videos);

  const dias = DIAS.map((dia, i) => {
    const vs = ordenados.filter((v) => v.fecha && new Date(v.fecha).getDay() === i);
    return { dia, videos: vs.length, mediana_multiplicador: mediana(vs.map((v) => v.multiplicador)) };
  }).filter((d) => d.videos);

  return {
    generado: new Date().toISOString(),
    total_videos: evaluados.length,
    cuentas,
    ganadores: ganadores.slice(0, 15).map((v) => ({ ...v, gancho_texto: primeraLinea(v.texto) })),
    rasgos: Object.entries(rasgos).map(([rasgo, f]) => ({ rasgo, en_ganadores: proporcion(ganadores, f), en_el_resto: proporcion(resto, f) })),
    duracion,
    dias,
    duracion_mediana: { ganadores: mediana(ganadores.map((v) => v.duracion_s)), resto: mediana(resto.map((v) => v.duracion_s)) },
  };
}

function imprimir(r) {
  console.log(`\n=== Resumen de ${r.total_videos} videos ===\n`);
  for (const c of r.cuentas) {
    console.log(`  ${c.cuenta}: ${c.videos} videos, vistas típicas ${Math.round(c.mediana_vistas ?? 0).toLocaleString('es')}${c.pocos_datos ? '  (pocos datos, tómalo con cautela)' : ''}`);
  }
  console.log('\nVideos que más superaron el promedio de su propia cuenta:');
  r.ganadores.forEach((v, i) => {
    console.log(`  ${i + 1}. ${v.multiplicador}x | ${v.duracion_s ?? '?'} s | ${v.cuenta} | "${v.gancho_texto}"`);
    console.log(`     ${v.url}`);
  });
  console.log('\nRasgos (ganadores vs. el resto):');
  for (const x of r.rasgos) console.log(`  ${x.rasgo}: ${pct(x.en_ganadores)} vs ${pct(x.en_el_resto)}`);
  console.log(`\nDuración típica: ganadores ${r.duracion_mediana.ganadores ?? '?'} s, resto ${r.duracion_mediana.resto ?? '?'} s`);
  for (const d of r.duracion) console.log(`  ${d.tramo}: ${d.videos} videos, ${d.ganadores} ganadores, multiplicador típico ${d.mediana_multiplicador?.toFixed(2) ?? '?'}x`);
  console.log('\nResumen completo guardado en mi-matriz/datos/resumen.json\n');
}

function analizarTodo() {
  if (!fs.existsSync(DATOS)) fallar('Todavía no hay datos. Primero lee algunas cuentas.');
  const archivos = fs.readdirSync(DATOS).filter((f) => /^(corrida|simulado)-.*\.json$/.test(f));
  const reales = archivos.filter((f) => f.startsWith('corrida-'));
  // Si ya hay datos reales, los simulados no se mezclan.
  const usar = reales.length ? reales : archivos;
  if (!usar.length) fallar('Todavía no hay datos. Primero lee algunas cuentas.');
  const vistos = new Map();
  for (const f of usar) for (const v of JSON.parse(fs.readFileSync(path.join(DATOS, f), 'utf8'))) if (v.url) vistos.set(v.url, v);
  const r = analizar([...vistos.values()]);
  r.simulado = !reales.length;
  fs.writeFileSync(path.join(DATOS, 'resumen.json'), JSON.stringify(r, null, 2));
  if (r.simulado) console.log('\n⚠️  MODO SIMULADO: son datos inventados para probar el flujo.');
  imprimir(r);
}

// ---------- corrida ----------

async function ejecutar(plan, o, extra = {}) {
  const est = estimar(plan);
  mostrarCosto(est);
  if (o['solo-costo']) return;
  if (est.total > CONFIG.tope_usd_por_corrida) {
    fallar(`Esta corrida supera tu tope de ${usd(CONFIG.tope_usd_por_corrida)}. Baja la cantidad de videos o de cuentas, o sube el tope en config.json.`);
  }

  let videos = [];
  if (o.simulado) {
    console.log('⚠️  MODO SIMULADO: uso datos inventados de ejemplo, no se cobra nada.\n');
    const demo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'ejemplos', 'datos-simulados.json'), 'utf8'));
    for (const plataforma of Object.keys(plan)) {
      if (!plan[plataforma].cuentas.length && !plan[plataforma].links.length) continue;
      videos.push(...demo[plataforma].map((it) => normalizar(plataforma, it)).filter(Boolean));
    }
  } else {
    let costoTotal = 0;
    for (const l of est.lineas) {
      const p = plan[l.plataforma];
      const tope = Math.min(CONFIG.tope_usd_por_corrida, l.costo * 1.5);
      const { items, costoReal } = await correrActor(l.plataforma, inputDe(l.plataforma, p), l.items, tope);
      const buenos = items.map((it) => normalizar(l.plataforma, it)).filter(Boolean);
      const fallidos = items.length - buenos.length;
      if (fallidos) console.log(`  ${fallidos} resultados sin datos de video (cuenta privada, inexistente o publicación sin video).`);
      videos.push(...buenos);
      if (costoReal != null) costoTotal += costoReal;
    }
    console.log(`Costo real según Apify: ${usd(costoTotal)}`);
  }

  if (extra.urlFoco) {
    const foco = videos.find((v) => v.url && v.url.includes(extra.urlFoco.split('/').filter(Boolean).pop()));
    if (foco) console.log(`\nVideo que pegaste: ${foco.vistas?.toLocaleString('es') ?? '?'} vistas, ${foco.duracion_s ?? '?'} s, gancho: "${primeraLinea(foco.texto)}"`);
  }
  if (!videos.length) fallar('No llegaron videos. Revisa que las cuentas sean públicas y estén bien escritas.');
  console.log(`Guardé ${videos.length} videos en mi-matriz/datos/${guardar(videos, o.simulado)}`);
  analizarTodo();
}

async function main() {
  const o = args(process.argv.slice(2));
  const cmd = o._[0];

  if (cmd === 'llave') {
    console.log(leerToken() ? 'Llave de Apify encontrada.' : 'No hay llave de Apify en .env todavía.');
    return;
  }
  if (cmd === 'analizar') return analizarTodo();
  if (cmd === 'costo') return mostrarCosto(estimar(armarPlan(o)));
  if (cmd === 'leer') {
    const plan = armarPlan(o);
    if (!plan.instagram.cuentas.length && !plan.tiktok.cuentas.length) fallar('Indica al menos una cuenta con --ig o --tt.');
    return ejecutar(plan, o);
  }
  if (cmd === 'link') {
    if (!o._[1]) fallar('Pega el link después de la palabra link.');
    const l = leerLink(o._[1]);
    const plan = armarPlan({ videos: o.videos });
    const p = plan[l.plataforma];
    if (l.tipo === 'perfil') p.cuentas.push(l.cuenta);
    else {
      p.links.push(l.url);
      // Leer también el perfil da contexto: cuánto rindió ese video frente a lo normal de la cuenta.
      if (l.cuenta) p.cuentas.push(l.cuenta);
    }
    return ejecutar(plan, o, { urlFoco: l.url });
  }
  console.log('Comandos: costo, leer, link, analizar, llave. Lee el encabezado de este archivo para ver ejemplos.');
}

main().catch((e) => {
  console.error(e instanceof Aviso ? `
✋ ${e.message}
` : `
✋ Algo falló: ${e.message}
`);
  process.exitCode = 1;
});
