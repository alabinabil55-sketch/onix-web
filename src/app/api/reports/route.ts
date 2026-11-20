import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime="nodejs";
export async function POST(req:Request){
 try{
  const origin=req.headers.get("origin"); if(!origin||new URL(origin).host!==new URL(req.url).host)return NextResponse.json({error:"Origine refusée."},{status:403});
  const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");if(!token)return NextResponse.json({error:"Connexion requise."},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!anon)return NextResponse.json({error:"Backend non configuré."},{status:500});
  const db=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}});const {data:{user}}=await db.auth.getUser(token);if(!user)return NextResponse.json({error:"Session invalide."},{status:401});
  const body=await req.json();const allowed=["webtoon","chapter","page","comment","user"];
  if(!allowed.includes(body.target_type)||typeof body.target_id!=="string"||typeof body.reason!=="string"||body.reason.trim().length<3||body.reason.length>100|| (body.details&&String(body.details).length>2000))return NextResponse.json({error:"Signalement invalide."},{status:400});
  const since=new Date(Date.now()-60*60*1000).toISOString();
  const {count:recent,error:rateError}=await db.from("reports").select("id",{count:"exact",head:true}).eq("reporter_id",user.id).gte("created_at",since);
  if(rateError)return NextResponse.json({error:"Impossible de vérifier la limite de signalement."},{status:503});
  if((recent||0)>=5)return NextResponse.json({error:"Limite atteinte : maximum 5 signalements par heure."},{status:429});
  const {data,error}=await db.from("reports").insert({reporter_id:user.id,target_type:body.target_type,target_id:body.target_id,reason:body.reason.trim(),details:body.details?String(body.details):null}).select("id").single();
  if(error) return NextResponse.json({error:error.message},{status:400});return NextResponse.json({ok:true,id:data.id},{status:201});
 }catch(e:any){return NextResponse.json({error:e?.message||"Erreur serveur."},{status:500})}
}
