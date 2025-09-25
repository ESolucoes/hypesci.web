import { useNavigate } from "react-router-dom";

type Article = {
  id: string;
  title: string;
  summary: string;
  authors: string;
  published: string;
};

export default function ArticleCard({ article }: { article: Article }) {
  const navigate = useNavigate();

  return (
    <div
      className="card"
      onClick={() =>
        navigate(`/article/${encodeURIComponent(article.id)}`, { state: { article } })
      }
      style={{ cursor: "pointer" }}
    >
      <h2>{article.title}</h2>
    </div>
  );
}
