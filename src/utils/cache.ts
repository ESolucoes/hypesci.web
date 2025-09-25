import type { ArxivArticle } from "../api/arxiv";

export const pageCache = new Map<string, ArxivArticle[]>();
export const translatedPageCache = new Map<string, ArxivArticle[]>();
export const titleCache = new Map<string, string>();
export const articleCache = new Map<string, { title?: string; summary?: string }>();

export const PAGE_SESSION_PREFIX = "hs::page::";
export const ART_SESSION_PREFIX  = "hs::article::";

export function pageKey(query: string, page: number) {
  return `q=${query}|p=${page}`;
}
export function tPageKey(query: string, page: number, lang: string) {
  return `q=${query}|p=${page}|l=${lang}`;
}
export function artKey(id: string, lang: string) {
  return `id=${id}|l=${lang}`;
}

export function sessionGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
export function sessionSet(key: string, val: any) {
  try { sessionStorage.setItem(key, JSON.stringify(val)); } catch {}
}
