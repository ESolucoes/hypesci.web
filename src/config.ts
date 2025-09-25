function req(name: string): string {
  const v = import.meta.env?.[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v as string;
}

export const ARXIV_BASE = req("VITE_ARXIV_BASE");
export const ARXIV_PATH = req("VITE_ARXIV_PATH");
export const ARXIV_ENDPOINT = `${ARXIV_BASE.replace(/\/+$/, "")}${ARXIV_PATH.startsWith("/") ? ARXIV_PATH : `/${ARXIV_PATH}`}`;
export const LT_BASE = req("VITE_LT_BASE");
export const I18N_STORAGE_KEY = req("VITE_I18N_STORAGE_KEY");
export const I18N_DEFAULT_LANG = req("VITE_I18N_DEFAULT_LANG");
export const LAST_PAGE_KEY_PREFIX = req("VITE_LAST_PAGE_KEY_PREFIX");
export const ARTICLE_TRANSLATED_PREFIX = req("VITE_ARTICLE_TRANSLATED_PREFIX");

export const PAGE_SIZE = 10;
export const MAX_NUM_BUTTONS = 5;
export const QUERY = "science";
export const HEADER_HEIGHT = 92;