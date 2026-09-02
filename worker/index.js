// ════════════════════════════════════════════════════════════
//  LIVES WORKER — Momentum
//  Sobe um ffmpeg por sessão ativa, em loop, empurrando pro RTMP
//  do Instagram. Coordenado pelo Supabase (sem servidor HTTP).
//
//  Fluxo (espelha o painel lives.html):
//    live_sessions.status: starting -> live -> ending/ended | error
//  Regras:
//    - corte automático aos AUTO_CUTOFF_SECONDS (3h50)
//    - watchdog: ffmpeg cai -> tenta religar ate MAX_RESTARTS -> error
//    - reconciliacao no boot: live "fantasma" sem processo -> error
//    - NUNCA logar a stream_key
// ════════════════════════════════════════════════════════════
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync, statSync, renameSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// ── Trava de instância única ──
//  Evita 2+ workers polando o mesmo banco (eles brigam e derrubam lives).
const LOCK = join(dirname(fileURLToPath(import.meta.url)), 'worker.lock');
function pidAlive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }
if (existsSync(LOCK)) {
  const old = parseInt(readFileSync(LOCK, 'utf8').trim(), 10);
  if (old && old !== process.pid && pidAlive(old)) {
    console.log(`[lock] Ja existe um worker rodando (PID ${old}). Esta instancia vai sair.`);
    process.exit(0);
  }
}
writeFileSync(LOCK, String(process.pid));
function releaseLock() { try { if (existsSync(LOCK) && readFileSync(LOCK,'utf8').trim() === String(process.pid)) unlinkSync(LOCK); } catch {} }

// ── Config ──
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_ROLE  = process.env.SUPABASE_SERVICE_ROLE;
const RTMP_URL      = process.env.INSTAGRAM_RTMP_URL || 'rtmps://live-upload.instagram.com:443/rtmp/';
const AUTO_CUTOFF   = Number(process.env.AUTO_CUTOFF_SECONDS || 13800);
const POLL_MS       = Number(process.env.POLL_MS || 3000);
const MAX_RESTARTS  = Number(process.env.MAX_RESTARTS || 3);
const FFMPEG        = process.env.FFMPEG_PATH || 'ffmpeg';
const V_BITRATE     = process.env.VIDEO_BITRATE  || '3000k';
const V_MAXRATE     = process.env.VIDEO_MAXRATE  || '3500k';
const V_BUFSIZE     = process.env.VIDEO_BUFSIZE  || '6000k';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('[FATAL] Faltam SUPABASE_URL ou SUPABASE_SERVICE_ROLE no .env. Copie .env.example -> .env e preencha.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// ── Estado em memoria: sessionId -> processo ──
//  { proc, restarts, stopping, cutoffTimer, orgId, copy }
const running = new Map();

// ── Transcode (Fase 2b): materiais em conversao ──
const transcoding = new Set();
const TMP = join(dirname(fileURLToPath(import.meta.url)), 'tmp');
mkdirSync(TMP, { recursive: true });

// ── Log helper (NUNCA imprime stream_key) ──
const ts = () => new Date().toISOString().slice(11, 19);
function log(sid, msg)  { console.log(`[${ts()}] [${String(sid).slice(0, 8)}] ${msg}`); }
function warn(sid, msg) { console.warn(`[${ts()}] [${String(sid).slice(0, 8)}] ${msg}`); }

const IMG_RE = /\.(jpg|jpeg|png|webp|gif|bmp)(\?|$)/i;
const isPhoto = (url) => IMG_RE.test(url || '');

// ════════════════════════════════════════════════
//  Cache local de materiais.
//  ffmpeg com -stream_loop/-loop sobre URL re-baixa o arquivo do CDN a cada
//  volta do loop (live de 3h50 com video de 15s = ~915 downloads -> estourou
//  o egress do Supabase). Baixamos 1x pro tmp/ e streamamos do disco.
// ════════════════════════════════════════════════
const extOf = (url) => { const m = String(url).split('?')[0].match(/\.[a-z0-9]+$/i); return m ? m[0] : '.mp4'; };

// ── Bucket privado (Fase 6 do hub) ──
//  No projeto antigo `materials` era publico e `source_url`/`file_url` traziam
//  URL inteira. No hub o bucket e privado e a coluna guarda o CAMINHO
//  (`<org>/ready/x.mp4`) — link publico ali nao abriria. Toda leitura passa por
//  URL assinada. Valor que ainda venha como http:// e aceito para nao quebrar
//  material antigo.
const ehCaminho = (v) => typeof v === 'string' && !/^https?:\/\//i.test(v);
async function urlDeLeitura(valor, segundos = 3600) {
  if (!ehCaminho(valor)) return valor;
  const { data, error } = await sb.storage.from('materials').createSignedUrl(valor, segundos);
  if (error || !data?.signedUrl) throw new Error(`assinatura falhou: ${error?.message || 'sem URL'}`);
  return data.signedUrl;
}

async function ensureLocalCopy(matId, origem) {
  const dest = join(TMP, `stream-${matId}${extOf(origem)}`);
  if (existsSync(dest) && statSync(dest).size > 0) return dest;
  const res = await fetch(await urlDeLeitura(origem));
  if (!res.ok) throw new Error(`download falhou (HTTP ${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest + '.part', buf);   // escreve inteiro e so entao renomeia:
  renameSync(dest + '.part', dest);     // nunca fica .mp4 pela metade no cache
  return dest;
}
// limpeza no boot: cache de material parado ha 30+ dias sai do disco
function pruneCache() {
  const cutoff = Date.now() - 30 * 864e5;
  for (const f of readdirSync(TMP)) {
    if (!/^stream-/.test(f) && !/\.part$/.test(f)) continue;
    const p = join(TMP, f);
    try { if (statSync(p).mtimeMs < cutoff || /\.part$/.test(f)) unlinkSync(p); } catch {}
  }
}

// ════════════════════════════════════════════════
//  Args do ffmpeg pra TRANSMITIR.
//   - copy=true: material ja foi transcodado (Fase 2b) -> so copia (CPU ~0)
//   - copy=false: fallback -> re-encoda ao vivo (foto antiga ou material cru)
// ════════════════════════════════════════════════
function ffmpegStreamArgs(inputUrl, rtmpTarget, copy) {
  if (copy) {
    return [
      '-re', '-fflags', '+genpts', '-stream_loop', '-1', '-i', inputUrl,
      '-c', 'copy', '-f', 'flv', rtmpTarget
    ];
  }
  const vOut = [
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-b:v', V_BITRATE, '-maxrate', V_MAXRATE, '-bufsize', V_BUFSIZE,
    '-r', '30', '-g', '60'
  ];
  const aOut = ['-c:a', 'aac', '-b:a', '128k', '-ar', '44100'];
  if (isPhoto(inputUrl)) {
    return [
      '-re', '-loop', '1', '-framerate', '30', '-i', inputUrl,
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-map', '0:v', '-map', '1:a',
      ...vOut, ...aOut, '-f', 'flv', rtmpTarget
    ];
  }
  return [
    '-re', '-stream_loop', '-1', '-i', inputUrl,
    ...vOut, ...aOut, '-f', 'flv', rtmpTarget
  ];
}

// ════════════════════════════════════════════════
//  Args do ffmpeg pra CONVERTER (transcode no upload).
//  Normaliza tudo pro formato do Instagram (H.264 High/yuv420p/30fps/GOP 2s + AAC).
//  Foto vira um clip curto (loopavel). Saida sempre .mp4 copiavel depois.
// ════════════════════════════════════════════════
function transcodeArgs(sourceUrl, outPath, photo) {
  // Spec live da Meta (1080p@30): 3.000-6.000 Kbps, H.264 Level 4.1, GOP <=2s,
  // AAC-LC 128k estereo. CRF sem teto estourava a faixa (~8 Mbps) -> IG degradava
  // a entrega. maxrate/bufsize seguram o pico dentro da spec.
  const v = ['-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.1', '-preset', 'slow', '-crf', '19',
             '-maxrate', '5000k', '-bufsize', '10000k',
             '-pix_fmt', 'yuv420p', '-r', '30', '-g', '60', '-keyint_min', '60', '-sc_threshold', '0'];
  const a = ['-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2'];
  const scale = ['-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2'];
  if (photo) {
    return ['-y', '-loop', '1', '-framerate', '30', '-t', '5', '-i', sourceUrl,
            '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
            '-map', '0:v', '-map', '1:a', ...v, ...a, ...scale, '-movflags', '+faststart', outPath];
  }
  return ['-y', '-i', sourceUrl, ...v, ...a, ...scale, '-movflags', '+faststart', outPath];
}

// converte um material 'processing' -> 'ready' (um por vez)
async function transcodeMaterial(mat) {
  if (transcoding.has(mat.id)) return;
  transcoding.add(mat.id);
  const src = mat.source_url;
  if (!src) { return finishTranscodeError(mat, 'material sem source_url'); }
  const photo = isPhoto(src);
  const outPath = join(TMP, mat.id + '.mp4');
  log(mat.id, `convertendo (${photo ? 'foto' : 'video'}: ${mat.label})...`);

  // O ffmpeg le da URL assinada; o bucket e privado.
  let entrada;
  try {
    entrada = await urlDeLeitura(src, 6 * 3600);
  } catch (e) {
    return finishTranscodeError(mat, 'assinar material: ' + e.message);
  }

  const proc = spawn(FFMPEG, transcodeArgs(entrada, outPath, photo), { windowsHide: true });
  let lastErr = '';
  proc.stderr.on('data', (d) => { lastErr = String(d).split('\n').filter(Boolean).pop() || lastErr; });
  proc.on('error', (e) => finishTranscodeError(mat, 'spawn ffmpeg: ' + e.message));
  proc.on('close', async (code) => {
    try {
      if (code !== 0 || !existsSync(outPath)) return finishTranscodeError(mat, `ffmpeg code ${code}: ${sanitize(lastErr)}`);
      const buf = readFileSync(outPath);
      const path = `${mat.org_id}/ready/${mat.id}.mp4`;
      const { error: upErr } = await sb.storage.from('materials').upload(path, buf, { contentType: 'video/mp4', upsert: true, cacheControl: '31536000' });
      if (upErr) return finishTranscodeError(mat, 'upload: ' + upErr.message);
      // Guarda o caminho, nao a URL: com bucket privado a URL nasce expirando.
      await sb.from('live_materials').update({ file_url: path, status: 'ready' }).eq('id', mat.id);
      log(mat.id, 'convertido -> ready');
    } catch (e) {
      await finishTranscodeError(mat, 'pos-transcode: ' + (e && e.message));
    } finally {
      try { if (existsSync(outPath)) unlinkSync(outPath); } catch {}
      transcoding.delete(mat.id);
    }
  });
}
async function finishTranscodeError(mat, msg) {
  warn(mat.id, 'conversao falhou: ' + msg);
  try { await sb.from('live_materials').update({ status: 'error' }).eq('id', mat.id); } catch {}
  transcoding.delete(mat.id);
}

// ════════════════════════════════════════════════
//  Inicia uma sessao (status starting -> live)
// ════════════════════════════════════════════════
async function startSession(session) {
  const sid = session.id;
  if (running.has(sid)) return;

  // busca o material
  const { data: mat, error } = await sb
    .from('live_materials').select('*').eq('id', session.material_id).single();
  if (error || !mat) {
    warn(sid, 'material nao encontrado -> error');
    return markError(session, 'Material nao encontrado.');
  }
  // exige material convertido (Fase 2b): so inicia se estiver 'ready'
  if (mat.status && mat.status !== 'ready') return markError(session, 'Material ainda em conversao.');
  const inputUrl = mat.file_url || mat.source_url;
  if (!inputUrl) return markError(session, 'Material sem arquivo.');

  // material transcodado (arquivo em /ready/) -> stream-copy (CPU ~0);
  // senao (foto antiga / material cru) -> re-encode ao vivo.
  const copy = /\/ready\//.test(inputUrl);

  // baixa 1x pro disco — streamar direto da URL re-baixa a cada loop (egress!)
  let localInput;
  try {
    localInput = await ensureLocalCopy(mat.id, inputUrl);
    log(sid, `material em cache local (${(statSync(localInput).size / 1048576).toFixed(1)} MB)`);
  } catch (e) {
    warn(sid, 'download do material falhou: ' + e.message);
    return markError(session, 'Falha ao baixar material: ' + e.message);
  }

  // servidor vem da sessão (Live Producer dá um edge dinâmico por transmissão);
  // cai no RTMP_URL fixo só se a sessão não trouxe URL.
  const server = (session.stream_url && session.stream_url.trim()) || RTMP_URL;
  const rtmpTarget = server + session.stream_key; // NUNCA logar isto
  const entry = { proc: null, restarts: 0, stopping: false, cutoffTimer: null, orgId: session.org_id, copy };
  running.set(sid, entry);

  spawnFfmpeg(session, localInput, rtmpTarget, entry);

  // marca live + horarios
  const startedAt = new Date();
  const cutoffAt  = new Date(startedAt.getTime() + AUTO_CUTOFF * 1000);
  await sb.from('live_sessions').update({
    status: 'live', started_at: startedAt.toISOString(), auto_cutoff_at: cutoffAt.toISOString(), error_message: null
  }).eq('id', sid);

  // timer de corte automatico
  entry.cutoffTimer = setTimeout(() => {
    log(sid, 'corte automatico (3h50)');
    stopSession(sid, 'ended');
  }, AUTO_CUTOFF * 1000);

  log(sid, `live iniciada (${copy ? 'copy' : 're-encode'}: ${mat.label})`);
}

function spawnFfmpeg(session, inputUrl, rtmpTarget, entry) {
  const sid = session.id;
  const proc = spawn(FFMPEG, ffmpegStreamArgs(inputUrl, rtmpTarget, entry.copy), { windowsHide: true });
  entry.proc = proc;

  // ffmpeg fala no stderr; guardamos so a ultima linha p/ diagnostico (sem a chave)
  let lastErr = '';
  proc.stderr.on('data', (d) => { lastErr = String(d).split('\n').filter(Boolean).pop() || lastErr; });

  proc.on('error', (e) => warn(sid, 'falha ao spawnar ffmpeg: ' + e.message));

  proc.on('close', (code) => {
    if (entry.stopping) return;                 // encerramento intencional, ok
    // queda inesperada -> watchdog
    warn(sid, `ffmpeg caiu (code ${code}). ultima linha: ${sanitize(lastErr)}`);
    if (entry.restarts < MAX_RESTARTS) {
      entry.restarts++;
      warn(sid, `religando (${entry.restarts}/${MAX_RESTARTS})...`);
      setTimeout(() => { if (running.has(sid) && !entry.stopping) spawnFfmpeg(session, inputUrl, rtmpTarget, entry); }, 2000);
    } else {
      warn(sid, 'estourou MAX_RESTARTS -> error');
      cleanup(sid);
      markError(session, 'Conexao RTMP caiu e nao voltou (' + sanitize(lastErr) + ').');
    }
  });
}

// remove qualquer rastro da chave de mensagens de erro do ffmpeg
function sanitize(s) { return String(s || '').replace(/rtmps?:\/\/\S+/gi, 'rtmp://***'); }

// ════════════════════════════════════════════════
//  Encerra uma sessao (manual ou corte) -> ended
// ════════════════════════════════════════════════
async function stopSession(sid, finalStatus) {
  const entry = running.get(sid);
  if (entry) {
    entry.stopping = true;
    if (entry.cutoffTimer) clearTimeout(entry.cutoffTimer);
    try { entry.proc && entry.proc.kill('SIGKILL'); } catch {}
    running.delete(sid);
  }
  await sb.from('live_sessions').update({
    status: finalStatus || 'ended', ended_at: new Date().toISOString()
  }).eq('id', sid);
  log(sid, 'encerrada (' + (finalStatus || 'ended') + ')');
}

function cleanup(sid) {
  const entry = running.get(sid);
  if (entry) { if (entry.cutoffTimer) clearTimeout(entry.cutoffTimer); running.delete(sid); }
}

async function markError(session, message) {
  cleanup(session.id);
  await sb.from('live_sessions').update({
    status: 'error', error_message: message, ended_at: new Date().toISOString()
  }).eq('id', session.id);
}

// ════════════════════════════════════════════════
//  Reconciliacao no boot
//   - 'live'/'starting' orfaos (sem processo) -> error
//   - 'ending' -> finaliza ended
// ════════════════════════════════════════════════
async function reconcile() {
  const { data, error } = await sb.from('live_sessions').select('*').in('status', ['live', 'starting', 'ending']);
  if (error) { console.error('[boot] erro ao reconciliar:', error.message); return; }
  for (const s of (data || [])) {
    if (s.status === 'ending') {
      await sb.from('live_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', s.id);
    } else {
      await sb.from('live_sessions').update({
        status: 'error', error_message: 'Worker reiniciou — transmissao anterior interrompida.', ended_at: new Date().toISOString()
      }).eq('id', s.id);
    }
  }
  if (data && data.length) console.log(`[boot] reconciliadas ${data.length} sessao(oes) orfas.`);
}

// ════════════════════════════════════════════════
//  Loop principal — le o banco e age
//  (nunca lanca: erro -> loga e continua. ref: feedback-scripts-loop)
// ════════════════════════════════════════════════
async function tick() {
  try {
    const { data, error } = await sb.from('live_sessions').select('*').in('status', ['starting', 'live', 'ending']);
    if (error) { console.error('[tick] erro de leitura:', error.message); return; }
    const sessions = data || [];

    for (const s of sessions) {
      if (s.status === 'starting' && !running.has(s.id)) {
        await startSession(s);
      } else if (s.status === 'ending') {
        await stopSession(s.id, 'ended');
      } else if (s.status === 'live') {
        // corte de seguranca extra (se o timer falhou) + detecta live sem processo
        if (s.auto_cutoff_at && Date.now() >= new Date(s.auto_cutoff_at).getTime()) {
          await stopSession(s.id, 'ended');
        } else if (!running.has(s.id)) {
          warn(s.id, 'live sem processo -> error');
          await markError(s, 'Processo de streaming ausente.');
        }
      }
    }

    // Fase 2b: converte materiais pendentes (um por vez p/ nao estourar CPU)
    if (transcoding.size === 0) {
      const { data: mats } = await sb.from('live_materials').select('*').eq('status', 'processing').limit(1);
      // A conversao virou async (assina a URL do bucket privado antes do ffmpeg).
      // Sem o catch, uma falha ali derrubaria o processo por unhandled rejection.
      if (mats && mats[0]) {
        transcodeMaterial(mats[0]).catch((e) =>
          warn(mats[0].id, 'conversao explodiu: ' + (e && e.message)));
      }
    }
  } catch (e) {
    console.error('[tick] excecao inesperada (continuando):', e && e.message);
  }
}

// ════════════════════════════════════════════════
//  Boot
// ════════════════════════════════════════════════
(async () => {
  console.log('── Lives Worker ──');
  console.log('Supabase:', SUPABASE_URL);
  console.log('RTMP destino:', RTMP_URL.replace(/\/\/.*@/, '//'), '(chave omitida)');
  console.log('Corte automatico:', AUTO_CUTOFF, 's | poll:', POLL_MS, 'ms | max restarts:', MAX_RESTARTS);

  pruneCache();
  await reconcile();
  await tick();
  setInterval(tick, POLL_MS);
  console.log('Worker no ar. Aguardando lives...');
})();

// encerramento gracioso
function shutdown() {
  console.log('\nEncerrando worker — matando ffmpegs ativos...');
  for (const [sid, entry] of running) { try { entry.proc && entry.proc.kill('SIGKILL'); } catch {} }
  releaseLock();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', releaseLock);
