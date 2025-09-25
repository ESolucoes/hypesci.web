import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { translatePreservingMath } from "../api/translate";
import { useI18n } from "../context/i18n";
import LoadingScreen from "../components/LoadingScreen";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { ARTICLE_TRANSLATED_PREFIX } from "../config";

export default function ArticlePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const article = location.state?.article;
  const { lang, setLang } = useI18n();
  const [title, setTitle] = useState(article?.title || "");
  const [summary, setSummary] = useState(article?.summary || "");
  const [translating, setTranslating] = useState(false);
  const runRef = useRef(0);

  useEffect(() => {
    if (!article) return;
    if (lang === "en") {
      setTitle(article.title);
      setSummary(article.summary);
      return;
    }
    const runId = ++runRef.current;
    const k = `${ARTICLE_TRANSLATED_PREFIX}${article.id}::${lang}`;
    try {
      const hit = sessionStorage.getItem(k);
      if (hit) {
        const payload = JSON.parse(hit) as { title?: string; summary?: string };
        if (runRef.current === runId) {
          setTitle(payload.title || article.title);
          setSummary(payload.summary || article.summary);
        }
        return;
      }
    } catch {}
    let cancelled = false;
    (async () => {
      try {
        setTranslating(true);
        const [t, s] = await Promise.all([
          translatePreservingMath(article.title, lang, "auto", `${k}::title`),
          translatePreservingMath(article.summary, lang, "auto", `${k}::summary`),
        ]);
        if (!cancelled && runRef.current === runId) {
          const payload = { title: t || article.title, summary: s || article.summary };
          setTitle(payload.title);
          setSummary(payload.summary);
          try { sessionStorage.setItem(k, JSON.stringify(payload)); } catch {}
        }
      } finally {
        if (!cancelled && runRef.current === runId) setTranslating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lang, article]);

  if (!article) {
    return (
      <div className="article-container">
        <div className="a-card a-card--meta" style={{ textAlign: "center" }}>
          Artigo não encontrado.
        </div>
        <div style={{ textAlign: "center" }}>
          <button onClick={() => navigate("/")}>⬅ Voltar</button>
        </div>
      </div>
    );
  }

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  return (
    <>
      <LoadingScreen visible={translating} message="Carregando artigo…" sub="Isso pode levar alguns segundos." />
      <div className="article-container" style={{ marginTop: "16px" }}>
        <div className="a-toolbar">
          <button onClick={handleBack} className="a-btn">⬅ Voltar</button>
          <label className="a-lang">
            <span style={{ marginRight: 8 }}>🌍 Idioma:</span>
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
          </label>
        </div>
        <div className="a-card a-card--title">
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {title}
          </ReactMarkdown>
        </div>
        <div className="a-card a-card--meta">
          <strong>Autores:</strong> {article.authors}
        </div>
        <div className="a-card a-card--body">
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {summary}
          </ReactMarkdown>
        </div>
        <div className="a-card a-card--meta" style={{ textAlign: "center" }}>
          📅 {new Date(article.published).toLocaleDateString()}
        </div>
      </div>
    </>
  );
}
