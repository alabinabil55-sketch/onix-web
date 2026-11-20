import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConsentManager from "@/components/ConsentManager";
export const metadata:Metadata={title:"ONIX WEB — Webtoons à découvrir",description:"Découvrez et lisez des webtoons, mangas, manhwas et manhuas sur ONIX WEB."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body><Header/><main className="min-h-[65vh]">{children}</main><Footer/><ConsentManager/></body></html>}
