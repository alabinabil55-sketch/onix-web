"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, Search, Menu, X, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function Header() {
 const [user,setUser]=useState<string|null>(null), [open,setOpen]=useState(false);
 useEffect(()=>{ if(!supabase)return; supabase.auth.getUser().then(({data})=>setUser(data.user?.email??null));
 const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user.email??null));
 return ()=>subscription.unsubscribe(); },[]);
 const nav=[["Accueil","/"],["Catalogue","/catalogue"],["Nouveautés","/nouveautes"],["Classement","/classement"]];
 return <header className="sticky top-0 z-50 border-b border-line/80 bg-ink/90 backdrop-blur-xl">
  <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 md:px-8">
   <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-[.18em]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet text-ink"><BookOpen size={20}/></span>ONIX<span className="text-violet">WEB</span></Link>
   <nav className="hidden items-center gap-7 md:flex">{nav.map(([n,h])=><Link key={h} href={h} className="text-sm text-muted transition hover:text-white">{n}</Link>)}</nav>
   <div className="hidden items-center gap-3 md:flex"><Link href="/recherche" className="rounded-xl p-2 text-muted hover:bg-white/5 hover:text-white"><Search size={19}/></Link><Link href={user?"/profil":"/connexion"} className="btn-primary !px-4 !py-2 text-sm">{user?<><UserRound size={16}/> Mon espace</>:"Connexion"}</Link></div>
   <button className="md:hidden" onClick={()=>setOpen(!open)} aria-label="Ouvrir le menu">{open?<X/>:<Menu/>}</button>
  </div>
  {open&&<nav className="grid gap-1 border-t border-line px-4 py-4 md:hidden">{nav.map(([n,h])=><Link onClick={()=>setOpen(false)} key={h} href={h} className="rounded-lg px-3 py-3 hover:bg-white/5">{n}</Link>)}<Link href="/recherche" className="rounded-lg px-3 py-3">Recherche</Link><Link href="/connexion" className="rounded-lg px-3 py-3">Connexion / Inscription</Link></nav>}
 </header>;
}
