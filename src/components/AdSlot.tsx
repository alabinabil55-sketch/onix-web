"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Slot={id:string;slot_key:string;label:string;enabled:boolean;provider:string;publisher_id:string|null;ad_unit_id:string|null;format:string|null};
function readConsent(){try{return JSON.parse(localStorage.getItem("onix-consent-v1")||"null")}catch{return null}}
export default function AdSlot({slotKey}:{slotKey:string}){
 const [slot,setSlot]=useState<Slot|null>(null),[consent,setConsent]=useState<any>(null),[scriptReady,setScriptReady]=useState(false);
 useEffect(()=>{setConsent(readConsent());const onConsent=(e:any)=>setConsent(e.detail);window.addEventListener("onix-consent-updated",onConsent);if(!supabase)return()=>window.removeEventListener("onix-consent-updated",onConsent);supabase.from("ad_slots").select("*").eq("slot_key",slotKey).eq("enabled",true).maybeSingle().then(({data})=>setSlot(data as Slot|null));return()=>window.removeEventListener("onix-consent-updated",onConsent)},[slotKey]);
 useEffect(()=>{if(!slot||!consent?.ads||!consent?.personalized||slot.provider!=="adsense"||!slot.publisher_id||!slot.ad_unit_id)return;let script=document.querySelector<HTMLScriptElement>("script[data-onix-adsense]");if(script){if((window as any).adsbygoogle)setScriptReady(true);else script.addEventListener("load",()=>setScriptReady(true),{once:true});return}script=document.createElement("script");script.async=true;script.crossOrigin="anonymous";script.dataset.onixAdsense="true";script.src=`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(slot.publisher_id)}`;script.onload=()=>setScriptReady(true);document.head.appendChild(script)},[slot,consent]);
 useEffect(()=>{if(!scriptReady||!slot||!consent?.ads||!consent?.personalized)return;try{(window as any).adsbygoogle=(window as any).adsbygoogle||[];(window as any).adsbygoogle.push({})}catch{}},[scriptReady,slot,consent]);
 if(!slot?.enabled||!consent?.ads||!consent?.personalized||slot.provider!=="adsense"||!slot.publisher_id||!slot.ad_unit_id)return null;
 return <aside className="mx-auto my-7 w-full max-w-5xl px-3" aria-label="Publicité"><p className="mb-2 text-center text-[10px] uppercase tracking-widest text-muted">Publicité</p><div className="min-h-[100px] overflow-hidden rounded-xl border border-line/60 bg-panel/30 text-center"><ins className="adsbygoogle block" style={{display:"block",minHeight:100}} data-ad-client={slot.publisher_id} data-ad-slot={slot.ad_unit_id} data-ad-format={slot.format||"auto"} data-full-width-responsive="true"/></div></aside>
}
