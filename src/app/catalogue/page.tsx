"use client";
import { useEffect,useState } from "react";
import WebtoonCard from "@/components/WebtoonCard";
import SectionTitle from "@/components/SectionTitle";
import { supabase } from "@/lib/supabase";
import type { Webtoon } from "@/lib/types";
import AdSlot from "@/components/AdSlot";
export default function Catalogue(){const [items,setItems]=useState<Webtoon[]>([]),[q,setQ]=useState(""),[genre,setGenre]=useState("Tous"),[loading,setLoading]=useState(true);
useEffect(()=>{(async()=>{if(!supabase){setLoading(false);return}let req=supabase.from("webtoons").select("*").eq("is_published",true).order("created_at",{ascending:false});const {data}=await req;setItems((data||[]) as Webtoon[]);setLoading(false)})()},[]);
const genres=["Tous","Action","Romance","Fantasy","Drame","Aventure","Comédie","Thriller"];
const shown=items.filter(x=>(x.title.toLowerCase().includes(q.toLowerCase())||x.author_name?.toLowerCase().includes(q.toLowerCase()))&&(genre==="Tous"||x.genres?.includes(genre)));
return <div className="container-main py-12"><SectionTitle title="Catalogue" subtitle="Explore toutes les séries disponibles sur ONIX WEB."/><AdSlot slotKey="catalogue_top"/><div className="mb-7 grid gap-3 md:grid-cols-[1fr_220px]"><input className="field" placeholder="Rechercher un titre ou un auteur..." value={q} onChange={e=>setQ(e.target.value)}/><select className="field" value={genre} onChange={e=>setGenre(e.target.value)}>{genres.map(g=><option key={g}>{g}</option>)}</select></div>{loading?<p className="text-muted">Chargement du catalogue…</p>:shown.length?<div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{shown.map((x,i)=><><WebtoonCard key={x.id} item={x}/>{i===5&&<div className="col-span-full"><AdSlot slotKey="catalogue_mid"/></div>}</>)}</div>:<div className="rounded-2xl border border-line bg-panel p-10 text-center text-muted">{items.length?"Aucun résultat. Essaie un autre filtre.":"Aucune œuvre publiée pour le moment. Les œuvres apparaîtront ici après leur publication dans Supabase."}</div>}</div>}
