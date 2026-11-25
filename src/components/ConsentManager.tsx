"use client";
import { useState, useEffect } from "react";
import { Cookie, Settings, X } from "lucide-react";

type Consent = {
  necessary: boolean;
  ads: boolean;
  personalized: boolean;
  updatedAt: string;
};

export default function ConsentManager() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [open, setOpen] = useState(false);

  const save = (a: boolean, p: boolean) => {
    setConsent({
      necessary: true,
      ads: a,
      personalized: p,
      updatedAt: new Date().toISOString(),
    });
  };

  useEffect(() => {
    try {
      const r = localStorage.getItem("consent");
      if (r) setConsent(JSON.parse(r));
    } catch {}
  }, []);

  useEffect(() => {
    if (consent) {
      try {
        localStorage.setItem("consent", JSON.stringify(consent));
      } catch {}
    }
  }, [consent]);

  if (!consent) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:max-w-md z-50 bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-700 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
          <Cookie className="w-4 h-4" />
          <span>Cookies &amp; Confidentialité</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Nous utilisons des cookies pour améliorer votre expérience et diffuser des publicités pertinentes.
        </p>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            onClick={() => setOpen(true)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-600 hover:bg-slate-800 flex items-center gap-1"
          >
            <Settings className="w-3 h-3" />
            Personnaliser
          </button>
          <button
            onClick={() => save(false, false)}
            className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600"
          >
            Refuser
          </button>
          <button
            onClick={() => save(true, true)}
            className="px-3 py-1.5 text-xs rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
          >
            Tout accepter
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white max-w-md w-full rounded-2xl p-5 border border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Préférences de cookies</h3>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/70">
                <div>
                  <p className="font-medium">Essentiels</p>
                  <p className="text-xs text-slate-400">Toujours actifs</p>
                </div>
                <input type="checkbox" checked disabled className="accent-amber-500" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/70">
                <div>
                  <p className="font-medium">Publicités</p>
                  <p className="text-xs text-slate-400">Annonces ciblées</p>
                </div>
                <input
                  type="checkbox"
                  checked={consent.ads}
                  onChange={(e) => setConsent({ ...consent, ads: e.target.checked })}
                  className="accent-amber-500"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/70">
                <div>
                  <p className="font-medium">Contenu personnalisé</p>
                  <p className="text-xs text-slate-400">Recommandations adaptées</p>
                </div>
                <input
                  type="checkbox"
                  checked={consent.personalized}
                  onChange={(e) => setConsent({ ...consent, personalized: e.target.checked })}
                  className="accent-amber-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => save(false, false)}
                className="px-4 py-2 text-xs rounded-xl bg-slate-800 hover:bg-slate-700"
              >
                Tout refuser
              </button>
              <button
                onClick={() => {
                  save(consent.ads, consent.personalized);
                  setOpen(false);
                }}
                className="px-4 py-2 text-xs rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(true)}
        aria-label="Paramètres des cookies"
        className="fixed bottom-4 left-4 z-40 p-2.5 rounded-full bg-slate-900 text-amber-400 border border-slate-700 shadow-lg hover:scale-105 transition"
      >
        <Cookie className="w-4 h-4" />
      </button>
    </>
  );
}