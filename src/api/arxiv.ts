import { ARXIV_ENDPOINT } from '../config';

export type ArxivArticle = {
  id: string;
  title: string;
  summary: string;
  authors: string;
  published: string;
};

export type ArxivPage = {
  items: ArxivArticle[];
  total: number;
  start: number;
  maxResults: number;
};

export type ArxivOpts = {
  start?: number;
  maxResults?: number;
  sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
  sortOrder?: 'ascending' | 'descending';
};

export async function fetchArxivArticles(
  query: string = 'science',
  opts: ArxivOpts = {}
): Promise<ArxivPage> {
  const {
    start = 0,
    maxResults = 10,
    sortBy = 'submittedDate',
    sortOrder = 'descending',
  } = opts;

  const url =
    `${ARXIV_ENDPOINT}` +
    `?search_query=all:${encodeURIComponent(query)}` +
    `&start=${start}&max_results=${maxResults}` +
    `&sortBy=${sortBy}&sortOrder=${sortOrder}`;

  const res = await fetch(url, { cache: 'no-store' });
  const text = await res.text();

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, 'text/xml');

  const totalNode =
    xmlDoc.getElementsByTagName('opensearch:totalResults')[0] ||
    xmlDoc.getElementsByTagName('totalResults')[0];
  const total = parseInt(totalNode?.textContent || '0', 10);

  const entries = Array.from(xmlDoc.getElementsByTagName('entry'));
  const items: ArxivArticle[] = entries.map((entry) => ({
    id: entry.getElementsByTagName('id')[0]?.textContent || '',
    title: entry.getElementsByTagName('title')[0]?.textContent?.trim() || '',
    summary: entry.getElementsByTagName('summary')[0]?.textContent?.trim() || '',
    authors: Array.from(entry.getElementsByTagName('author'))
      .map((a) => a.getElementsByTagName('name')[0]?.textContent)
      .join(', '),
    published: entry.getElementsByTagName('published')[0]?.textContent || '',
  }));

  return { items, total, start, maxResults };
}