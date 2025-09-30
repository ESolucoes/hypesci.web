import { LT_BASE } from '../config';

const memCache = new Map<string, string>();

function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}
function key(source: string, target: string, text: string) {
  return `tr::${source}->${target}::${hash(text)}`;
}

export async function ltHealthcheck(): Promise<boolean> {
  try {
    const r = await fetch(`${LT_BASE}/languages`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    return Array.isArray(json);
  } catch {
    return false;
  }
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
    const res = await fetch(`${LT_BASE}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ q, source: sourceLang, target: targetLang, format: 'text' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
    const data = await res.json();

    // Compatibilidade com LibreTranslate e variações
    let out: string;
    if (typeof data?.translatedText === 'string') {
      out = data.translatedText;
    } else if (Array.isArray(data)) {
      out = typeof data[0] === 'string'
        ? data[0]
        : (data[0]?.translatedText ?? q);
    } else {
      out = q;
    }

    memCache.set(k, out);
    try { sessionStorage.setItem(k, out); } catch {}
    return out;
  } catch {
    return text;
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
    const payload = { q: toSend.map(x => x.text), source: sourceLang, target: targetLang, format: 'text' };
    const res = await fetch(`${LT_BASE}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
    const data = await res.json();

    let outs: string[] = [];
    if (Array.isArray(data)) {
      // Pode vir ["texto1","texto2"] ou [{translatedText:"..."}, ...]
      outs = data.map((d: any) =>
        typeof d === 'string' ? d : (d?.translatedText ?? '')
      );
    } else if (Array.isArray(data?.translations)) {
      outs = data.translations.map(
        (d: any) => d?.text ?? d?.translatedText ?? ''
      );
    } else if (typeof data?.translatedText === 'string') {
      outs = [data.translatedText];
    } else {
      throw new Error('Formato bulk inesperado');
    }

    toSend.forEach(({ idx, text }, j) => {
      const out = outs[j] ?? text;
      const k = key(sourceLang, targetLang, text);
      results[idx] = out;
      memCache.set(k, out);
      try { sessionStorage.setItem(k, out); } catch {}
    });

    return results;
  } catch {
    const singles = await Promise.all(
      toSend.map(({ text }) => translateText(text, targetLang, sourceLang))
    );
    toSend.forEach(({ idx, text }, j) => {
      results[idx] = singles[j] ?? text;
    });
    return results;
  }
}

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
