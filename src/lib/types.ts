export type Webtoon = {
  id: string; title: string; slug: string; synopsis: string | null;
  cover_url: string | null; author_name: string | null; status: string;
  language: string; genres: string[]; views_count: number; created_at: string;
};
export type Chapter = { id:string; webtoon_id:string; chapter_number:number; title:string; published_at:string|null };
