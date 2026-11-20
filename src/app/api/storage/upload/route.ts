import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_ZIP = 50 * 1024 * 1024;

function detectMime(b: Buffer): string | null {
  if (b.length >= 8 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (b.length >= 3 && b[0]===0xff && b[1]===0xd8 && b[2]===0xff) return "image/jpeg";
  if (b.length >= 12 && b.toString("ascii",0,4)==="RIFF" && b.toString("ascii",8,12)==="WEBP") return "image/webp";
  if (b.length >= 4 && b[0]===0x50 && b[1]===0x4b && [3,5,7].includes(b[2]) && [4,6,8].includes(b[3])) return "application/zip";
  return null;
}
export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== new URL(req.url).host) return NextResponse.json({error:"Origine refusée."},{status:403});
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!bearer) return NextResponse.json({error:"Authentification requise."},{status:401});
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return NextResponse.json({error:"Configuration Supabase absente."},{status:500});
    const authClient = createClient(url, anon, {global:{headers:{Authorization:`Bearer ${bearer}`}}});
    const {data:{user},error:authError}=await authClient.auth.getUser(bearer);
    if(authError||!user) return NextResponse.json({error:"Session invalide."},{status:401});
    const admin=createSupabaseAdmin();
    const {data:profile}=await admin.from("profiles").select("role,suspended_at").eq("id",user.id).maybeSingle();
    const {data:roleRows}=await admin.from("user_roles").select("roles(code)").eq("user_id",user.id);
    const isAdmin=profile?.role==="admin" || roleRows?.some((r:any)=>r.roles?.code==="admin");
    if(!isAdmin || profile?.suspended_at) return NextResponse.json({error:"Droits administrateur requis."},{status:403});
    const form=await req.formData();
    const file=form.get("file"); const bucket=String(form.get("bucket")||""); const path=String(form.get("path")||"");
    if(!(file instanceof File)) return NextResponse.json({error:"Fichier manquant."},{status:400});
    const allowed:Record<string,{mimes:string[];max:number}>={"onix-media":{mimes:["image/jpeg","image/png","image/webp"],max:MAX_IMAGE},"onix-covers":{mimes:["image/jpeg","image/png","image/webp"],max:MAX_IMAGE},"onix-pages":{mimes:["image/jpeg","image/png","image/webp"],max:MAX_IMAGE},"onix-archives":{mimes:["application/zip"],max:MAX_ZIP}};
    const rule=allowed[bucket];
    if(!rule || !path || path.startsWith("/") || path.includes("..") || path.length>400) return NextResponse.json({error:"Destination invalide."},{status:400});
    if(file.size<=0 || file.size>rule.max) return NextResponse.json({error:`Taille de fichier invalide (maximum ${Math.round(rule.max/1024/1024)} Mo).`},{status:413});
    const bytes=Buffer.from(await file.arrayBuffer()); const mime=detectMime(bytes);
    if(!mime || !rule.mimes.includes(mime) || (mime!=="application/zip" && file.type && file.type!==mime)) return NextResponse.json({error:"Le contenu réel du fichier ne correspond pas à un format autorisé."},{status:415});
    if(mime==="application/zip" && bytes.length>4 && !bytes.includes(Buffer.from("[Content_Types].xml")) && bytes.includes(Buffer.from("../"))) return NextResponse.json({error:"Archive ZIP suspecte."},{status:400});
    const {error}=await admin.storage.from(bucket).upload(path,bytes,{contentType:mime,upsert:false});
    if(error) return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({ok:true,bucket,path,mime,size:bytes.length});
  } catch(e:any) { return NextResponse.json({error:e?.message||"Erreur serveur."},{status:500}); }
}
