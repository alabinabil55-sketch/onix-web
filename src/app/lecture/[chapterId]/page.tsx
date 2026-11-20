"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, AlertTriangle, Check, ChevronDown,
  ChevronUp, Maximize, Minimize, Settings2, X, LoaderCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Page = { id: string; image_url: string; page_number: number };
type Chapter = {
  id: string; chapter_number: number; title: string; webtoon_id: string;
  is_published: boolean;
};
type Series = { title: string; slug: string };
type ReaderSettings = { width: "normal" | "wide"; gap: "none" | "small" | "normal" };

const localKey = (id: string) => `onix-reader:${id}`;

export default function Reader() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const router = useRouter();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [series, setSeries] = useState<Series | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [previousId, setPreviousId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [controlsVisible, setControlsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("image_missing");
  const [reportDetails, setReportDetails] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [settings, setSettings] = useState<ReaderSettings>({ width: "wide", gap: "none" });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageRefs = useRef<Map<number, HTMLImageElement>>(new Map());
  const pageCount = pages.length;

  const saveProgress = useCallback(async (page: number) => {
    if (!chapterId || !Number.isFinite(page)) return;
    const safePage = Math.max(1, Math.min(pageCount || 1, Math.round(page)));
    if (typeof window !== "undefined") {
      window.localStorage.setItem(localKey(chapterId), String(safePage));
    }
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);
    const { error: saveError } = await supabase.from("reading_history").upsert({
      user_id: user.id, chapter_id: chapterId, page_number: safePage,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,chapter_id" });
    setSaving(false);
    if (!saveError) setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, [chapterId, pageCount]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError("");
      if (!supabase) { setError("Le lecteur nécessite une connexion à Supabase."); setLoading(false); return; }
      const { data: c, error: chapterError } = await supabase.from("chapters")
        .select("id,chapter_number,title,webtoon_id,is_published")
        .eq("id", chapterId).eq("is_published", true).single();
      if (chapterError || !c) { if (!cancelled) { setError("Ce chapitre est introuvable ou n'est pas publié."); setLoading(false); } return; }
      const [{ data: w }, { data: p }, { data: allChapters }, { data: { user } }] = await Promise.all([
        supabase.from("webtoons").select("title,slug").eq("id", c.webtoon_id).single(),
        supabase.from("chapter_pages").select("id,image_url,page_number").eq("chapter_id", c.id).order("page_number", { ascending: true }),
        supabase.from("chapters").select("id,chapter_number").eq("webtoon_id", c.webtoon_id).eq("is_published", true).order("chapter_number", { ascending: true }),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;
      const list = allChapters || [];
      const index = list.findIndex((x: { id: string }) => x.id === c.id);
      setChapter(c as Chapter); setSeries(w as Series | null); setPages((p || []) as Page[]);
      setPreviousId(index > 0 ? list[index - 1].id : null);
      setNextId(index >= 0 && index < list.length - 1 ? list[index + 1].id : null);
      let resume = 1;
      if (user) {
        const { data: history } = await supabase.from("reading_history").select("page_number")
          .eq("user_id", user.id).eq("chapter_id", c.id).maybeSingle();
        if (history?.page_number) resume = history.page_number;
      } else if (typeof window !== "undefined") {
        resume = Number(window.localStorage.getItem(localKey(c.id)) || 1);
      }
      if (!cancelled) {
        setCurrentPage(Math.max(1, Math.min((p || []).length || 1, resume)));
        setLoading(false);
      }
    }
    load().catch(() => { if (!cancelled) { setError("Impossible de charger ce chapitre. Vérifie ta connexion et réessaie."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [chapterId]);

  // Restore the last saved position after page images have been laid out.
  useEffect(() => {
    if (loading || !pages.length) return;
    const target = pageRefs.current.get(currentPage);
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
  // Only restore after the chapter has loaded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pages.length]);

  // Track the page currently occupying the reading viewport.
  useEffect(() => {
    if (!pages.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) {
        const n = Number((visible.target as HTMLElement).dataset.page || 1);
        setCurrentPage(n);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => { void saveProgress(n); }, 1100);
      }
    }, { rootMargin: "-15% 0px -55% 0px", threshold: [0, .15, .35, .6] });
    pageRefs.current.forEach(el => observer.observe(el));
    return () => { observer.disconnect(); if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [pages, saveProgress]);

  // Warm up the next two images without downloading the whole chapter at once.
  useEffect(() => {
    if (!pages.length) return;
    [currentPage, currentPage + 1, currentPage + 2].forEach(n => {
      const page = pages[n - 1];
      if (page?.image_url && n !== currentPage) {
        const img = new Image(); img.decoding = "async"; img.src = page.image_url;
      }
    });
  }, [currentPage, pages]);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3200);
  }, []);
  useEffect(() => { showControls(); return () => { if (hideTimer.current) clearTimeout(hideTimer.current); }; }, [showControls]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch { setError("Le mode plein écran n'est pas disponible dans ce navigateur."); }
  };

  const jumpTo = (n: number) => {
    const target = pageRefs.current.get(Math.max(1, Math.min(pageCount, n)));
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submitReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !chapter) { setReportStatus("Service momentanément indisponible."); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error: reportError } = await supabase.from("chapter_reports").insert({
      chapter_id: chapter.id, user_id: user?.id || null,
      reason: reportReason, details: reportDetails.trim() || null,
    });
    setReportStatus(reportError ? "Le signalement n'a pas pu être envoyé. Réessaie plus tard." : "Signalement envoyé. Merci pour ton aide.");
    if (!reportError) { setReportDetails(""); }
  };

  const widthClass = settings.width === "normal" ? "max-w-[760px]" : "max-w-[1100px]";
  const gapClass = settings.gap === "none" ? "gap-0" : settings.gap === "small" ? "gap-1" : "gap-4";

  if (loading) return <div className="grid min-h-[75vh] place-items-center bg-[#07080c] text-white"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-violet" size={30}/><p className="mt-4 text-sm text-zinc-400">Préparation de ta lecture…</p></div></div>;
  if (error && !chapter) return <div className="grid min-h-[75vh] place-items-center bg-[#07080c] px-6 text-center text-white"><div><AlertTriangle className="mx-auto text-amber-400" size={34}/><p className="mt-4 text-zinc-300">{error}</p><Link href="/catalogue" className="mt-6 inline-flex rounded-xl bg-violet px-5 py-3 font-semibold text-black">Retour au catalogue</Link></div></div>;

  return <div className="reader-shell min-h-screen bg-[#07080c] text-white" onTouchStart={showControls} onMouseMove={showControls} onClick={showControls}>
    <div className={`reader-topbar fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[#090a0f]/95 backdrop-blur-xl transition-transform duration-300 ${controlsVisible ? "translate-y-0" : "-translate-y-full"}`}>
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-3 sm:px-6">
        <Link href={series ? `/webtoon/${series.slug}` : "/catalogue"} className="flex min-w-0 items-center gap-2 text-zinc-400 hover:text-white"><ArrowLeft size={18}/><span className="hidden sm:inline">Retour à la série</span></Link>
        <div className="min-w-0 flex-1 text-center"><p className="truncate text-sm font-semibold">{series?.title || "ONIX WEB"}</p><p className="truncate text-[11px] text-zinc-500">Chapitre {chapter?.chapter_number}{chapter?.title ? ` · ${chapter.title}` : ""}</p></div>
        <div className="flex items-center gap-1"><button onClick={(e)=>{e.stopPropagation();setSettingsOpen(v=>!v)}} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Paramètres du lecteur"><Settings2 size={18}/></button><button onClick={(e)=>{e.stopPropagation();void toggleFullscreen()}} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Plein écran">{fullscreen?<Minimize size={18}/>:<Maximize size={18}/>}</button><button onClick={(e)=>{e.stopPropagation();setReportOpen(true)}} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-amber-300" aria-label="Signaler une erreur"><AlertTriangle size={18}/></button></div>
      </div>
      {settingsOpen&&<div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-5 border-t border-white/10 px-4 py-3 text-xs" onClick={e=>e.stopPropagation()}><label className="flex items-center gap-2">Largeur <select className="rounded-lg border border-white/10 bg-[#171923] px-2 py-1" value={settings.width} onChange={e=>setSettings(s=>({...s,width:e.target.value as ReaderSettings["width"]}))}><option value="normal">Confort</option><option value="wide">Large</option></select></label><label className="flex items-center gap-2">Espacement <select className="rounded-lg border border-white/10 bg-[#171923] px-2 py-1" value={settings.gap} onChange={e=>setSettings(s=>({...s,gap:e.target.value as ReaderSettings["gap"]}))}><option value="none">Sans espace</option><option value="small">Petit</option><option value="normal">Normal</option></select></label></div>}
    </div>

    <main className={`mx-auto flex min-h-screen flex-col items-center px-0 pb-28 pt-14 transition-[max-width] duration-200 ${widthClass}`}>
      {pages.length ? <div className={`flex w-full flex-col ${gapClass}`}>
        {pages.map((page, index) => <img key={page.id} ref={el=>{if(el)pageRefs.current.set(page.page_number,el);else pageRefs.current.delete(page.page_number)}} data-page={page.page_number} src={page.image_url} alt={`Page ${page.page_number} du chapitre ${chapter?.chapter_number}`} loading={index < 2 ? "eager" : "lazy"} decoding="async" fetchPriority={index===0?"high":"auto"} draggable={false} className="block h-auto w-full select-none bg-[#0d0e13] object-contain" onError={()=>setError(`Une image de la page ${page.page_number} ne peut pas être chargée.`)} />)}
      </div> : <div className="grid min-h-[65vh] w-full place-items-center px-6 text-center"><div><BookOpenIcon/><h2 className="mt-4 text-lg font-semibold">Chapitre en préparation</h2><p className="mt-2 text-sm text-zinc-500">Les pages de ce chapitre n'ont pas encore été ajoutées.</p></div></div>}
      {error&&chapter&&<div className="mx-4 my-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">{error}</div>}
      <div className="w-full px-5 py-12 text-center"><p className="text-xs uppercase tracking-[.25em] text-zinc-600">Fin du chapitre</p><div className="mt-5 flex flex-wrap justify-center gap-3"><button disabled={!previousId} onClick={()=>previousId&&router.push(`/lecture/${previousId}`)} className="reader-nav-btn"><ChevronUp size={17}/> Chapitre précédent</button><button disabled={!nextId} onClick={()=>nextId&&router.push(`/lecture/${nextId}`)} className="reader-nav-btn">Chapitre suivant <ChevronDown size={17}/></button></div><Link href={series?`/webtoon/${series.slug}`:"/catalogue"} className="mt-5 inline-block text-xs text-zinc-500 hover:text-white">Retour à la fiche de la série</Link></div>
    </main>

    <div className={`reader-bottombar fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#090a0f]/95 backdrop-blur-xl transition-transform duration-300 ${controlsVisible ? "translate-y-0" : "translate-y-full"}`} onClick={e=>e.stopPropagation()}>
      <div className="mx-auto max-w-[1400px] px-4 py-3 sm:px-6"><div className="mb-2 flex items-center justify-between text-[11px] text-zinc-500"><span>Page {Math.min(currentPage,pageCount||1)} / {pageCount}</span><span className="flex items-center gap-2">{saving?<LoaderCircle className="animate-spin" size={12}/>:savedAt?<Check size={12} className="text-emerald-400"/>:null}{savedAt?`Progression enregistrée à ${savedAt}`:"Progression automatique"}</span></div><input aria-label="Position dans le chapitre" type="range" min="1" max={Math.max(1,pageCount)} value={Math.min(currentPage,pageCount||1)} onChange={e=>jumpTo(Number(e.target.value))} className="reader-range w-full"/><div className="mt-2 flex items-center justify-between"><button disabled={!previousId} onClick={()=>previousId&&router.push(`/lecture/${previousId}`)} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white disabled:opacity-30"><ArrowLeft size={15}/> Précédent</button><button onClick={()=>void saveProgress(currentPage)} className="text-xs text-zinc-500 hover:text-white">Enregistrer maintenant</button><button disabled={!nextId} onClick={()=>nextId&&router.push(`/lecture/${nextId}`)} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white disabled:opacity-30">Suivant <ArrowRight size={15}/></button></div></div>
    </div>

    {reportOpen&&<div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 px-4 py-6" onClick={()=>setReportOpen(false)}><form onSubmit={submitReport} onClick={e=>e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141620] p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Signaler un problème</h2><button type="button" onClick={()=>setReportOpen(false)} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10"><X size={18}/></button></div><p className="mt-2 text-sm text-zinc-500">Chapitre {chapter?.chapter_number} · Aide-nous à corriger cette lecture.</p><label className="mt-5 block text-xs text-zinc-400">Type de problème</label><select value={reportReason} onChange={e=>setReportReason(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b0d14] p-3 text-sm"><option value="image_missing">Image manquante</option><option value="image_broken">Image illisible ou cassée</option><option value="wrong_order">Pages dans le mauvais ordre</option><option value="wrong_chapter">Mauvais chapitre</option><option value="translation">Erreur de traduction ou de texte</option><option value="other">Autre problème</option></select><label className="mt-4 block text-xs text-zinc-400">Détails (facultatif)</label><textarea value={reportDetails} onChange={e=>setReportDetails(e.target.value)} maxLength={1500} rows={4} placeholder="Décris le problème…" className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#0b0d14] p-3 text-sm outline-none focus:border-violet"/>{reportStatus&&<p className="mt-3 text-sm text-violet-300">{reportStatus}</p>}<button className="mt-5 w-full rounded-xl bg-violet px-4 py-3 text-sm font-bold text-black">Envoyer le signalement</button></form></div>}
  </div>;
}

function BookOpenIcon(){return <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet/10 text-violet"><Settings2 size={25}/></div>}
