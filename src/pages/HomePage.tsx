// src/pages/HomePage.tsx
import { useEffect, useMemo, useState } from "react";
import { fetchArxivArticles, type ArxivArticle } from "../api/arxiv";
import ArticleCard from "../components/ArticleCard";
import { translateMany } from "../api/translate";
import { useI18n } from "../context/i18n";
import LoadingScreen from "../components/LoadingScreen";
import { PAGE_SIZE, MAX_NUM_BUTTONS, QUERY, HEADER_HEIGHT, LAST_PAGE_KEY_PREFIX } from "../config";

const LAST_PAGE_KEY = `${LAST_PAGE_KEY_PREFIX}${QUERY}`;

export default function HomePage() {
  const { lang, setLang } = useI18n();

  const [currentPage, setCurrentPage] = useState<number>(() => {
    const raw = sessionStorage.getItem(LAST_PAGE_KEY);
    const n = raw ? parseInt(raw, 10) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  });
  useEffect(() => {
    sessionStorage.setItem(LAST_PAGE_KEY, String(currentPage));
  }, [currentPage]);

  const [totalResults, setTotalResults] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));

  const [basePage, setBasePage] = useState<ArxivArticle[]>([]);
  const [viewPage, setViewPage] = useState<ArxivArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleCache = useMemo(() => new Map<string, string>(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const start = (currentPage - 1) * PAGE_SIZE;
        const page = await fetchArxivArticles(QUERY, {
          start,
          maxResults: PAGE_SIZE,
          sortBy: "submittedDate",
          sortOrder: "descending",
        });
        if (cancelled) return;
        setTotalResults(page.total);
        setBasePage(page.items);
        setViewPage(page.items);
      } catch (e) {
        if (!cancelled) setError("Falha ao carregar artigos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  useEffect(() => {
    if (!basePage.length) return;
    let cancelled = false;
    (async () => {
      if (lang === "en") {
        setViewPage(basePage);
        return;
      }
      setTranslating(true);
      const titlesOut = basePage.map((a) => a.title);
      const missingIdx: number[] = [];
      basePage.forEach((a, i) => {
        const key = `${a.id}::${lang}`;
        const hit = titleCache.get(key);
        if (hit) titlesOut[i] = hit;
        else missingIdx.push(i);
      });
      try {
        if (missingIdx.length > 0) {
          const toTranslate = missingIdx.map((i) => basePage[i].title);
          const translated = await translateMany(toTranslate, lang, "auto");
          translated.forEach((txt, j) => {
            const i = missingIdx[j];
            const out = txt || basePage[i].title;
            titlesOut[i] = out;
            titleCache.set(`${basePage[i].id}::${lang}`, out);
          });
        }
      } finally {
        if (!cancelled) {
          const merged = basePage.map((a, i) => ({ ...a, title: titlesOut[i] || a.title }));
          setViewPage(merged);
          setTranslating(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lang, basePage, titleCache]);

  function buildPagination(): (number | "...")[] {
    if (totalPages <= MAX_NUM_BUTTONS + 1) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= MAX_NUM_BUTTONS) {
      return [...Array.from({ length: MAX_NUM_BUTTONS }, (_, i) => i + 1), "...", totalPages];
    }
    if (currentPage >= totalPages - (MAX_NUM_BUTTONS - 1)) {
      const start = totalPages - (MAX_NUM_BUTTONS - 1);
      return [1, "...", ...Array.from({ length: MAX_NUM_BUTTONS }, (_, i) => start + i)];
    }
    const mid = [currentPage - 1, currentPage, currentPage + 1];
    return [1, "...", ...mid, "...", totalPages];
  }

  const pages = buildPagination();
  const showLoader = loading || translating;
  const loaderMsg = "Carregando página…";
  const loaderSub = loading ? undefined : "Isso pode levar alguns segundos.";

  return (
    <div>
      <style>{`html, body, #root { margin: 0; padding: 0; }`}</style>
      <LoadingScreen visible={showLoader} message={loaderMsg} sub={loaderSub} />
      <header
        className="header"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          width: "100%",
          height: HEADER_HEIGHT,
          zIndex: 1000,
          background: "#0b0b0b",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "12px 16px",
          boxShadow: "0 2px 8px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: 0.3 }}>
          🧪 HypeSci
        </div>
        <div style={{ marginTop: 8 }}>
          🌍 Idioma:{" "}
          <select value={lang} onChange={(e) => setLang(e.target.value as any)}>
            <option value="en">Inglês (original)</option>
            <option value="pt">Português</option>
            <option value="es">Espanhol</option>
            <option value="fr">Francês</option>
            <option value="de">Alemão</option>
            <option value="it">Italiano</option>
            <option value="ru">Russo</option>
            <option value="zh">Chinês</option>
          </select>
        </div>
      </header>
      <div style={{ height: HEADER_HEIGHT }} />
      <main style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "min(980px, 100%)", padding: "0 16px", boxSizing: "border-box" }}>
          {error ? (
            <p style={{ color: "crimson" }}>{error}</p>
          ) : (
            <>
              {viewPage.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
              <div style={{ display: "flex", justifyContent: "center", gap: 8, margin: "16px 0" }}>
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  ◀ Anterior
                </button>
                {pages.map((p, idx) =>
                  p === "..." ? (
                    <span key={`dots-${idx}`} style={{ padding: "6px 10px", opacity: 0.6 }}>
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p as number)}
                      disabled={p === currentPage}
                      style={{
                        fontWeight: p === currentPage ? 700 : 400,
                        borderBottom: p === currentPage ? "2px solid #000" : "2px solid transparent",
                        padding: "6px 10px",
                      }}
                    >
                      {p}
                    </button>
                  )
                )}
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  Próxima ▶
                </button>
              </div>
              <div style={{ textAlign: "center", fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
                Página {currentPage} de {totalPages} • {Math.min(currentPage * PAGE_SIZE, totalResults)} / {totalResults} resultados
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
