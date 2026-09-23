// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: user-cog;

// Prihlaseni / odhlaseni uctu Strava.cz.
// Copyright (c) 2026 Ondrej Novotny — vsechna prava vyhrazena.

const HLAVNI = "Jidelnicek";

const jidelnicek = importModule(HLAVNI);
if (!jidelnicek || !jidelnicek.nastavUcet) throw new Error("Chybí nebo je zastaralý skript " + HLAVNI);

await jidelnicek.nastavUcet();
Script.complete();
