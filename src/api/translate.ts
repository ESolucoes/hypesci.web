import { LT_BASE } from '../config';

const memCache = new Map<string, string>();

// Fallbacks opcionais via .env (separados por vírgula)
const LT_FALLBACKS: string[] =
  (import.meta.env?.VITE_LT_FALLBACKS as string | undefined)?.split(',')
    .map(s => s.trim()).filter(Boolean) ?? [];

/* ===================== Utils ===================== */
function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}
function key(source: string, target: string, text: string) {
  return `tr::${source}->${target}::${hash(text)}`;
}
function stripEndSlash(s: string) { return (s || '').replace(/\/+$/, ''); }
function joinUrl(base: string, path: string) {
  const b = stripEndSlash(base);
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

async function postJSON<T>(url: string, body: any, timeoutMs = 12000): Promise<T> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: ctrl.signal,
      mode: 'cors',
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${txt}`);
    }
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

async function getJSON<T>(url: string, timeoutMs = 12000): Promise<T> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: ctrl.signal,
      mode: 'cors',
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${txt}`);
    }
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

function parseSingle(data: any, fallback: string): string {
  // Pode vir:
  // - { translatedText: "..." }
  // - ["..."]  (algumas instâncias retornam array mesmo no single)
  // - [{ translatedText: "..." }]
  if (typeof data?.translatedText === 'string') return data.translatedText;
  if (Array.isArray(data)) {
    const first = data[0];
    if (typeof first === 'string') return first;
    if (first && typeof first?.translatedText === 'string') return first.translatedText;
  }
  return fallback;
}

function parseBatch(data: any): string[] {
  // Pode vir:
  // - ["a","b"]
  // - [{ translatedText: "a" }, ...]
  // - { translations: [{ text: "a" }, ...] }
  // - { translatedText: "a" } (devolve 1)
  if (Array.isArray(data)) {
    return data.map((d: any) => (typeof d === 'string' ? d : (d?.translatedText ?? '')));
  }
  if (Array.isArray((data as any)?.translations)) {
    return (data as any).translations.map((d: any) => d?.text ?? d?.translatedText ?? '');
  }
  if (typeof (data as any)?.translatedText === 'string') {
    return [ (data as any).translatedText ];
  }
  throw new Error('Formato de resposta inesperado do servidor de tradução.');
}

async function tryTranslateArray(
  bases: string[],
  payload: { q: string | string[]; source: string; target: string; format: 'text' | 'html' },
  isBatch: boolean
): Promise<string[] | string> {
  let lastErr: any = null;
  for (const base of bases) {
    try {
      const url = joinUrl(base, 'translate');
      const data = await postJSON<any>(url, payload);
      if (isBatch) return parseBatch(data);
      return parseSingle(data, Array.isArray(payload.q) ? payload.q[0] : (payload.q as string));
    } catch (e) {
      lastErr = e;
      // tenta o próximo base
    }
  }
  throw lastErr ?? new Error('Falha ao contatar servidores de tradução.');
}

function allBases(): string[] {
  // Ordem: LT_BASE → fallbacks (.env) → defaults conhecidos
  const bases: string[] = [];
  const primary = stripEndSlash(LT_BASE || '');
  if (primary) bases.push(primary);
  for (const f of LT_FALLBACKS) {
    const u = stripEndSlash(f);
    if (u && !bases.includes(u)) bases.push(u);
  }
  // defaults conhecidos (só se ainda não presentes)
  const defaults = [
    'https://libretranslate.de',
    'https://translate.astian.org',
    'https://libretranslate.com'
  ];
  for (const d of defaults) {
    if (!bases.includes(d)) bases.push(d);
  }
  return bases;
}

/* ===================== API pública ===================== */
export async function ltHealthcheck(): Promise<boolean> {
  const bases = allBases();
  for (const base of bases) {
    try {
      const url = joinUrl(base, 'languages');
      const json = await getJSON<any>(url, 7000);
      if (Array.isArray(json) && json.length > 0) return true;
    } catch {
      // tenta o próximo
    }
  }
  return false;
}

export async function translateText(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto'
) {
  const q = (text || '').trim();
  if (!q) return text;

  const k = key(sourceLang, targetLang, q);
  const hit = memCache.get(k) ?? sessionStorage.getItem(k);
  if (hit) return hit;

  try {
    const bases = allBases();
    const payload = { q, source: sourceLang, target: targetLang, format: 'text' as const };
    const out = await tryTranslateArray(bases, payload, false) as string;

    memCache.set(k, out);
    try { sessionStorage.setItem(k, out); } catch {}
    return out;
  } catch {
    return text; // fallback silencioso
  }
}

export async function translateMany(
  texts: string[],
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<string[]> {
  const inputs = texts.map((t) => (t || '').trim());
  const results: string[] = new Array(inputs.length);

  const toSend: { idx: number; text: string }[] = [];
  inputs.forEach((t, i) => {
    if (!t) { results[i] = t; return; }
    const k = key(sourceLang, targetLang, t);
    const hit = memCache.get(k) ?? sessionStorage.getItem(k);
    if (hit) results[i] = hit;
    else toSend.push({ idx: i, text: t });
  });
  if (toSend.length === 0) return results;

  try {
    const bases = allBases();
    const payload = {
      q: toSend.map(x => x.text),
      source: sourceLang,
      target: targetLang,
      format: 'text' as const
    };
    const outs = await tryTranslateArray(bases, payload, true) as string[];

    toSend.forEach(({ idx, text }, j) => {
      const out = outs[j] ?? text;
      const k = key(sourceLang, targetLang, text);
      results[idx] = out;
      memCache.set(k, out);
      try { sessionStorage.setItem(k, out); } catch {}
    });

    return results;
  } catch {
    // fallback: faz single por single (também com cache)
    const singles = await Promise.all(
      toSend.map(({ text }) => translateText(text, targetLang, sourceLang))
    );
    toSend.forEach(({ idx, text }, j) => {
      results[idx] = singles[j] ?? text;
    });
    return results;
  }
}

/* ===================== Preservar blocos de LaTeX/Math ===================== */
const MATH_BLOCK_RE =
  /(\$\$[\s\S]*?\$\$)|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g;

function extractMathBlocks(input: string) {
  const blocks: string[] = [];
  const replaced = input.replace(MATH_BLOCK_RE, (m) => {
    const idx = blocks.length;
    blocks.push(m);
    return `[[MTX_${idx}]]`;
  });
  return { text: replaced, blocks };
}
function restoreMathBlocks(text: string, blocks: string[]) {
  return text.replace(/\[\[MTX_(\d+)]]/g, (_, g1) => blocks[Number(g1)] ?? '');
}
function chunkText(input: string, maxLen = 2400): string[] {
  if (input.length <= maxLen) return [input];
  const parts: string[] = [];
  let buf = '';
  const pieces = input.split(/(\n{2,}|\.\s+|\?|\!)/g);
  for (let i = 0; i < pieces.length; i++) {
    const next = (buf + pieces[i]).trim();
    if (next.length > maxLen) {
      if (buf) parts.push(buf);
      buf = pieces[i].trim();
      while (buf.length > maxLen) {
        parts.push(buf.slice(0, maxLen));
        buf = buf.slice(maxLen);
      }
    } else {
      buf = next;
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

export async function translatePreservingMath(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto',
  cacheKey?: string
): Promise<string> {
  const src = (text || '').trim();
  if (!src) return text;

  if (cacheKey) {
    try {
      const hit = sessionStorage.getItem(cacheKey);
      if (hit) return hit;
    } catch {}
  }

  const { text: safe, blocks } = extractMathBlocks(src);
  const chunks = chunkText(safe);

  let translated: string[] = [];
  try {
    translated = await translateMany(chunks, targetLang, sourceLang);
  } catch {
    translated = chunks;
  }

  const joined = translated.join(' ');
  const out = restoreMathBlocks(joined, blocks);

  if (cacheKey) {
    try { sessionStorage.setItem(cacheKey, out); } catch {}
  }
  return out;
}
