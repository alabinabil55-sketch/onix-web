import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
export async function POST(req:Request){
 try{
  const auth=req.headers.get("authorization")||"";
  const token=auth.replace(/^Bearer\s+/i,"");
  if(!token)return NextResponse.json({error:"Authentification requise."},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!anon||!service)return NextResponse.json({error:"Configuration Supabase serveur incomplète."},{status:500});
  const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:{user}}=await userClient.auth.getUser(token);if(!user)return NextResponse.json({error:"Session invalide."},{status:401});
  const admin=createClient(url,service);
  const {data:profile}=await admin.from("profiles").select("role").eq("id",user.id).single();if(profile?.role!=="admin")return NextResponse.json({error:"Accès administrateur requis."},{status:403});
  const {period="LAST_30_DAYS"}=await req.json().catch(()=>({}));
  const clientId=process.env.ADSENSE_CLIENT_ID,clientSecret=process.env.ADSENSE_CLIENT_SECRET,refreshToken=process.env.ADSENSE_REFRESH_TOKEN,accountId=process.env.ADSENSE_ACCOUNT_ID;
  if(!clientId||!clientSecret||!refreshToken||!accountId)return NextResponse.json({error:"Identifiants AdSense absents du serveur. Consulte .env.example."},{status:400});
  const oauth=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:"refresh_token"})});
  const authData=await oauth.json();if(!oauth.ok)throw new Error(authData.error_description||authData.error||"Échec OAuth Google.");
  const now=new Date(),start=new Date(now),end=new Date(now);if(period==="LAST_7_DAYS")start.setDate(now.getDate()-7);else if(period==="LAST_30_DAYS")start.setDate(now.getDate()-30);else if(period==="LAST_MONTH"){start.setMonth(now.getMonth()-1,1);end.setDate(0)}else start.setDate(1);
  const fmt=(d:Date)=>({year:d.getFullYear(),month:d.getMonth()+1,day:d.getDate()});
  const params=new URLSearchParams();params.set("dateRange","CUSTOM");params.set("startDate.year",String(fmt(start).year));params.set("startDate.month",String(fmt(start).month));params.set("startDate.day",String(fmt(start).day));params.set("endDate.year",String(fmt(end).year));params.set("endDate.month",String(fmt(end).month));params.set("endDate.day",String(fmt(end).day));params.append("metrics","ESTIMATED_EARNINGS");params.append("metrics","IMPRESSIONS");params.append("metrics","CLICKS");params.append("dimensions","DATE");params.set("currencyCode","USD");
  const report=await fetch(`https://adsense.googleapis.com/v2/${accountId}/reports:generate?${params}`,{headers:{Authorization:`Bearer ${authData.access_token}`}});
  const reportData=await report.json();if(!report.ok)throw new Error(reportData.error?.message||"Impossible de récupérer le rapport AdSense.");
  const headers=reportData.headers||[];const idx=(name:string)=>headers.findIndex((h:any)=>h.name===name);const dateIdx=idx("DATE"),earnIdx=idx("ESTIMATED_EARNINGS"),impIdx=idx("IMPRESSIONS"),clickIdx=idx("CLICKS");
  const rows=(reportData.rows||[]).map((row:any)=>{const c=row.cells||[];const dateRaw=c[dateIdx]?.value||"";const eventDate=dateRaw.length===8?`${dateRaw.slice(0,4)}-${dateRaw.slice(4,6)}-${dateRaw.slice(6,8)}`:dateRaw;return {event_date:eventDate,source:"Google AdSense API",amount:Number(c[earnIdx]?.value||0),currency:"USD",impressions:Number(c[impIdx]?.value||0),clicks:Number(c[clickIdx]?.value||0),external_reference:`adsense:${accountId}:${eventDate}`}}).filter((x:any)=>x.event_date);
  if(rows.length){const {error}=await admin.from("ad_revenue_events").upsert(rows,{onConflict:"external_reference"});if(error)throw new Error(error.message)}
  return NextResponse.json({rows:rows.length,source:"Google AdSense API"});
 }catch(e:any){return NextResponse.json({error:e.message||"Erreur serveur."},{status:500})}
}
