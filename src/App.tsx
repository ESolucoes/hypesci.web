import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ArticlePage from "./pages/ArticlePage";
import { I18nProvider } from "./context/i18n";
import "./App.css";

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/article/:id" element={<ArticlePage />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}
