// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: utensils;

/*
 * Strava.cz – widget jídelníčku pro Scriptable
 *
 * Copyright (c) 2026 Ondřej Novotný
 * Všechna práva vyhrazena. / All rights reserved.
 *
 * Tento software a jeho zdrojový kód jsou vlastnictvím Ondřeje Novotného.
 * Bez předchozího písemného souhlasu autora není dovoleno kód kopírovat,
 * upravovat, šířit, publikovat ani používat pro komerční účely.
 *
 * This software and its source code are the property of Ondřej Novotný.
 * No part of it may be copied, modified, distributed, published or used
 * commercially without the author's prior written permission.
 *
 * Software je poskytován "tak, jak je", bez jakékoliv záruky.
 */

//zakladni verze

const CONFIG = {
  // Nic z toho vyplnovat nemusis. Pri prvnim spusteni v aplikaci se skript
  // zepta na cislo jidelny, jmeno a heslo a ulozi si je do Keychainu.
  cislo: "",
  jmeno: "",
  heslo: "",
  prepnoutNaZitrekOd: 14,
  poradiDruhu: ["Polévka", "Oběd 1", "Oběd 2", "Svačina"],
  obnovitPoMin: 15,
  // "auto" = podle systemoveho vzhledu iOS, jinak "tmavy" / "svetly"
  vzhled: "auto"
};

const API = "https://app.strava.cz/api";
const CACHE = "strava-widget-cache.json";
const UCET = "strava-ucet";

function maUcet() {
  return !!(CONFIG.cislo && CONFIG.jmeno && CONFIG.heslo);
}

function lzeSePtat() {
  return config.runsInApp === true;
}

function jeTma() {
  if (CONFIG.vzhled === "tmavy") return true;
  if (CONFIG.vzhled === "svetly") return false;
  try {
    return Device.isUsingDarkAppearance();
  } catch (e) {
    return true;
  }
}

function nactiUcet() {
  try {
    if (Keychain.contains(UCET)) {
      const u = JSON.parse(Keychain.get(UCET)) || {};
      if (u.cislo) CONFIG.cislo = u.cislo;
      if (u.jmeno) CONFIG.jmeno = u.jmeno;
      if (u.heslo) CONFIG.heslo = u.heslo;
    }
  } catch (e) {}
}

function ulozUcet() {
  try {
    Keychain.set(UCET, JSON.stringify({
      cislo: CONFIG.cislo,
      jmeno: CONFIG.jmeno,
      heslo: CONFIG.heslo
    }));
  } catch (e) {}
}

function zapomenUcet() {
  try { if (Keychain.contains(UCET)) Keychain.remove(UCET); } catch (e) {}
  CONFIG.cislo = "";
  CONFIG.jmeno = "";
  CONFIG.heslo = "";
}

nactiUcet();

const dd = (n) => String(n).padStart(2, "0");
const ddmmyyyy = (d) => `${dd(d.getDate())}.${dd(d.getMonth() + 1)}.${d.getFullYear()}`;
const kratkeDatum = (d) => `${d.getDate()}. ${d.getMonth() + 1}.`;

function parseDatum(s) {
  const [d, m, y] = s.split(".").map(Number);
  return new Date(y, m - 1, d);
}

function dnyZOdpovedi(data, poradi) {
  const dny = Object.keys(data)
    .filter((k) => /^table\d+$/.test(k) && Array.isArray(data[k]) && data[k].length)
    .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))
    .map((k) => ({
      datum: data[k][0].datum,
      date: parseDatum(data[k][0].datum),
      konec: data[k][0].casKonec || null,
      jidla: data[k].map((r) => ({
        veta: r.veta,
        druh: (r.druh_popis || "").trim(),
        nazev: (r.nazev || "").trim(),
        cena: Number(r.cena) || 0,
        objednano: Number(r.pocet) > 0
      })),
    }));

  if (poradi && poradi.length) {
    const kam = (druh) => {
      const i = poradi.indexOf(druh);
      return i < 0 ? 99 : i;
    };
    dny.forEach((d) => d.jidla.sort((a, b) => kam(a.druh) - kam(b.druh)));
  }
  return dny;
}

function vyberIndex(dny, ted, prepnoutOd, posun) {
  if (!dny.length) return -1;
  const dnes = dny.findIndex((d) => d.datum === ddmmyyyy(ted));
  
  let i;
  if (dnes !== -1 && ted.getHours() < prepnoutOd) {
    i = dnes;
  } else {
    const dalsi = dny.findIndex((d) => d.date > ted);
    i = dalsi !== -1 ? dalsi : dnes;
  }
  
  if (i === -1) return -1;
  return Math.min(dny.length - 1, Math.max(0, i + (posun || 0)));
}

const DNY_CZ = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];

function popisDne(date, ted) {
  const rozdil = Math.round((new Date(date).setHours(0,0,0,0) - new Date(ted).setHours(0,0,0,0)) / 86400000);
  if (rozdil === 0) return "Dnes";
  if (rozdil === 1) return "Zítra";
  return DNY_CZ[date.getDay()];
}

function stavDne(den, ted, kratky) {
  const obj = den.jidla.filter((j) => j.objednano);
  if (obj.length) return { text: obj.map((j) => j.druh).join(" + "), ok: true };
  if (kratky) return { text: "–", ok: false };

  const konec = den.konec && new Date(den.konec);
  if (konec && konec > ted) {
    const kdy = `${konec.getDate()}. ${konec.getMonth() + 1}. ${dd(konec.getHours())}:${dd(konec.getMinutes())}`;
    return { text: `nic — lze do ${kdy}`, ok: false };
  }
  return { text: "nic neobjednáno", ok: false };
}

async function post(cesta, telo) {
  const req = new Request(`${API}/${cesta}`);
  req.method = "POST";
  req.headers = { "Content-Type": "text/plain;charset=UTF-8" };
  req.body = JSON.stringify(telo);
  return req.loadJSON();
}

async function prihlas() {
  let login;
  try {
    login = await post("login", {
      cislo: CONFIG.cislo,
      jmeno: CONFIG.jmeno,
      heslo: CONFIG.heslo,
      zustatPrihlasen: false,
      environment: "W",
      lang: "CZ",
    });
  } catch (e) {
    throw new Error("Strava.cz neodpověděla — zkontroluj připojení");
  }
  if (!login || login.state === "error") {
    throw new Error((login && login.message) || "Špatné číslo jídelny, jméno nebo heslo");
  }
  return login;
}

async function dialogUdaju(zprava) {
  const a = new Alert();
  a.title = "Přihlášení na Strava.cz";
  a.message = zprava || "Údaje se uloží do Keychainu, příště už je zadávat nebudeš.";
  a.addTextField("Číslo jídelny", CONFIG.cislo || "");
  a.addTextField("Uživatelské jméno", CONFIG.jmeno || "");
  a.addSecureTextField("Heslo", "");
  a.addAction("Přihlásit");
  a.addCancelAction("Zrušit");

  if ((await a.presentAlert()) !== 0) return null;
  return {
    cislo: a.textFieldValue(0).trim(),
    jmeno: a.textFieldValue(1).trim(),
    heslo: a.textFieldValue(2)
  };
}

// Zeptá se na údaje, ověří je proti Strava.cz a teprve pak uloží.
// Při chybě se ptá znovu s předvyplněnými poli.
async function prihlasDialogem(uvodniZprava) {
  let zprava = uvodniZprava;

  for (;;) {
    const u = await dialogUdaju(zprava);
    if (!u) throw new Error("Přihlášení zrušeno");

    if (!u.cislo || !u.jmeno || !u.heslo) {
      zprava = "Vyplň prosím všechna tři pole.";
      continue;
    }

    CONFIG.cislo = u.cislo;
    CONFIG.jmeno = u.jmeno;
    CONFIG.heslo = u.heslo;

    try {
      const login = await prihlas();
      ulozUcet();
      return login;
    } catch (e) {
      CONFIG.heslo = "";
      zprava = (e.message || String(e)) + " — zkus to prosím znovu.";
    }
  }
}

// Menu pro změnu nebo smazání uloženého účtu.
async function nastavUcet() {
  nactiUcet();

  if (!maUcet()) {
    await prihlasDialogem("Zatím tu není uložený žádný účet.");
    return;
  }

  const a = new Alert();
  a.title = "Účet Strava.cz";
  a.message = CONFIG.jmeno + "\njídelna " + CONFIG.cislo;
  a.addAction("Přihlásit jiný účet");
  a.addDestructiveAction("Odhlásit a smazat údaje");
  a.addCancelAction("Zavřít");

  const volba = await a.presentAlert();
  if (volba === 0) {
    await prihlasDialogem("Zadej údaje nového účtu.");
  } else if (volba === 1) {
    zapomenUcet();
    const h = new Alert();
    h.title = "Odhlášeno";
    h.message = "Uložené číslo jídelny, jméno i heslo jsou smazané.";
    h.addAction("OK");
    await h.presentAlert();
  }
}

async function nactiZeSite() {
  if (!maUcet()) {
    if (!lzeSePtat()) throw new Error("Otevři skript Jídelníček v aplikaci Scriptable a přihlas se");
    await prihlasDialogem("Vítej! Přihlas se na Strava.cz — údaje se uloží a příště už je zadávat nebudeš.");
  }

  let login;
  try {
    login = await prihlas();
  } catch (e) {
    if (!lzeSePtat()) throw e;
    login = await prihlasDialogem("Uložené přihlášení už neplatí: " + (e.message || e));
  }

  const o = await post("objednavky", {
    cislo: CONFIG.cislo,
    sid: login.sid,
    s5url: login.s5url,
    lang: "CZ",
    konto: 0,
    podminka: "",
    ignoreCert: login.ignoreCert,
  });
  if (o.state === "error") throw new Error(o.message || "Načtení objednávek selhalo");
  
  const u = login.uzivatel || {};
  return {
    dny: dnyZOdpovedi(o, CONFIG.poradiDruhu),
    konto: u.konto != null ? Number(u.konto) : null,
    mena: u.mena || "Kč",
    jidelna: u.nazevJidelny || "strava.cz",
  };
}

function cestaKCache() {
  const fm = FileManager.local();
  return fm.joinPath(fm.cacheDirectory(), CACHE);
}

function nactiCache() {
  try {
    const fm = FileManager.local();
    const p = cestaKCache();
    if (!fm.fileExists(p)) return null;
    const data = JSON.parse(fm.readString(p));
    data.dny.forEach((d) => (d.date = parseDatum(d.datum)));
    return data;
  } catch(e) {
    return null;
  }
}

async function nactiData() {
  try {
    const data = await nactiZeSite();
    try {
      FileManager.local().writeString(cestaKCache(), JSON.stringify(data));
    } catch(e) {}
    return data;
  } catch (e) {
    const cache = nactiCache();
    if (cache) return cache;
    throw e;
  }
}

// Barvy podle loga Strava.cz — korálová na teplé tmavé, ne na fialové.
// Color.dynamic(svetla, tmava) ve widgetu funguje, vybere si samo iOS.
// Jedine, co dynamicke byt nemuze, je nakresleny obrazek (viz prekryv()).
function barva(svetla, tmava) {
  const s = new Color(svetla[0], svetla.length > 1 ? svetla[1] : 1);
  const t = new Color(tmava[0], tmava.length > 1 ? tmava[1] : 1);
  if (CONFIG.vzhled === "svetly") return s;
  if (CONFIG.vzhled === "tmavy") return t;
  try {
    if (typeof Color.dynamic === "function") return Color.dynamic(s, t);
  } catch (e) {}
  return jeTma() ? t : s;
}

const textBarva = barva(["#2a1c18"], ["#f6efec"]);
const slaby = barva(["#2a1c18", 0.62], ["#f6efec", 0.6]);
const mdly = barva(["#2a1c18", 0.42], ["#f6efec", 0.42]);
const koralovy = barva(["#d2472a"], ["#f2795d"]);
const koralovyFond = barva(["#ec654d", 0.14], ["#f2795d", 0.16]);
const panel = barva(["#2a1c18", 0.06], ["#ffffff", 0.06]);
const zluty = barva(["#9a6512"], ["#f2b880"]);
const cerveny = barva(["#b8321f"], ["#ff9d92"]);

function okvetniList(dc, cx, cy, uhel, delka, sirka, barva) {
  const sin = Math.sin(uhel);
  const cos = Math.cos(uhel);
  const bod = (x, y) => new Point(cx + x * cos - y * sin, cy + x * sin + y * cos);
  const p = new Path();
  p.move(bod(0, 0));
  p.addCurve(bod(delka, 0), bod(delka * 0.12, sirka), bod(delka * 0.88, sirka * 0.92));
  p.addCurve(bod(0, 0), bod(delka * 0.88, -sirka * 0.92), bod(delka * 0.12, -sirka));
  p.closeSubpath();
  dc.setFillColor(barva);
  dc.addPath(p);
  dc.fillPath();
}

// Barevny podklad widgetu. Dynamicke barvy => Light/Dark resi iOS samo.
function pozadiPrechod() {
  const g = new LinearGradient();
  g.colors = [
    barva(["#fdf7f4"], ["#232019"]),
    barva(["#f8ece6"], ["#191614"]),
    barva(["#f2ded5"], ["#0f0d0c"])
  ];
  g.locations = [0, 0.55, 1];
  g.startPoint = new Point(0, 0);
  g.endPoint = new Point(0.3, 1);
  return g;
}

// Kytka z loga. Kresli se korálovou s nízkým krytím, takze jeden obrazek
// sedi na tmavy i svetly podklad — barvu si bere zespodu.
function prekryv(sirka, vyska) {
  const dc = new DrawContext();
  dc.size = new Size(sirka, vyska);
  dc.opaque = false;
  dc.respectScreenScale = true;

  const r = sirka * 0.4;
  const kvet = new Color("#ec654d", 0.07);
  for (let i = 0; i < 8; i++) {
    okvetniList(dc, sirka * 0.94, vyska * 0.9, (i * Math.PI) / 4, r, r * 0.52, kvet);
  }

  return dc.getImage();
}

// ListWidget kresli bud backgroundGradient, NEBO backgroundImage — ne obojí
// pres sebe. Vnoreny stack uz ale ma vlastni vrstvu, takze jeho obrazek lezi
// nad prechodem. Vraci stack, do ktereho patri veskery obsah widgetu.
function vrstvaPozadi(w, sirka, vyska) {
  w.backgroundGradient = pozadiPrechod();
  w.setPadding(0, 0, 0, 0);

  const k = w.addStack();
  k.layoutVertically();
  k.backgroundImage = prekryv(sirka, vyska);
  return k;
}

function napis(stack, text, font, barva) {
  const t = stack.addText(text);
  t.font = font;
  t.textColor = barva;
  return t;
}

function blokDne(w, den, ted, rodina) {
  const hlava = w.addStack();
  hlava.layoutHorizontally();
  hlava.centerAlignContent();
  napis(hlava, popisDne(den.date, ted), Font.boldSystemFont(12.5), textBarva);
  hlava.addSpacer(5);
  napis(hlava, kratkeDatum(den.date), Font.systemFont(11), slaby);
  hlava.addSpacer();
  
  // inlined stavText
  const s = stavDne(den, ted, true);
  const barva = s.ok ? koralovy : zluty;
  napis(hlava, s.ok ? "\u25cf" : "\u25cb", Font.systemFont(8.5), barva);
  hlava.addSpacer(4);
  napis(hlava, s.text, Font.systemFont(9.5), barva).lineLimit = 1;

  w.addSpacer(3);
  const seznam = w.addStack();
  seznam.layoutVertically();
  seznam.spacing = 2;
  
  const fDruh = 9.5;
  const fNazev = 11.5;
  const pad = 2;
  const sirkaDruh = 48;
  
  den.jidla.slice(0, 4).forEach((j) => {
    const row = seznam.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    row.setPadding(pad, 7, pad, 7);
    row.cornerRadius = 7;
    row.spacing = 6;
    row.backgroundColor = j.objednano ? koralovyFond : panel;

    const druhBox = row.addStack();
    druhBox.size = new Size(sirkaDruh, 0);
    napis(druhBox, j.druh, Font.semiboldSystemFont(fDruh),
      j.objednano ? koralovy : slaby).lineLimit = 1;

    const nazev = napis(row, j.nazev,
      j.objednano ? Font.semiboldSystemFont(fNazev) : Font.systemFont(fNazev),
      j.objednano ? textBarva : mdly);
    nazev.lineLimit = 1;
  });
}

function postavWidget(data, ted, rodina, posun) {
  const male = rodina === "small";
  const viceDnu = rodina === "large";

  const w = new ListWidget();
  const k = vrstvaPozadi(w, male ? 170 : 360, viceDnu ? 380 : 170);
  k.setPadding(10, 12, 10, 12);
  w.url = "scriptable:///run/" + encodeURIComponent(Script.name());
  w.refreshAfterDate = new Date(Date.now() + CONFIG.obnovitPoMin * 60 * 1000);

  const start = vyberIndex(data.dny, ted, CONFIG.prepnoutNaZitrekOd, posun);
  if (start === -1) {
    napis(k, "Žádná data", Font.systemFont(12), slaby);
    k.addSpacer();
    return w;
  }

  const dny = data.dny.slice(start, start + (viceDnu ? 3 : 1));

  const hlavicka = k.addStack();
  hlavicka.layoutHorizontally();
  hlavicka.centerAlignContent();

  if (viceDnu) {
    napis(hlavicka, "Jídelníček", Font.boldSystemFont(14), textBarva);
  } else {
    napis(hlavicka, popisDne(dny[0].date, ted), Font.boldSystemFont(male ? 13 : 15), textBarva);
    hlavicka.addSpacer(5);
    napis(hlavicka, kratkeDatum(dny[0].date), Font.systemFont(male ? 11 : 12), slaby);
  }

  hlavicka.addSpacer();

  if (data.konto != null) {
    napis(hlavicka, `${Math.round(data.konto)} ${data.mena}`,
      Font.mediumSystemFont(male ? 10 : 11), data.konto < 100 ? zluty : slaby);
  }

  if (viceDnu) {
    dny.forEach((den, i) => {
      k.addSpacer(i === 0 ? 7 : 9);
      blokDne(k, den, ted, rodina);
    });
    k.addSpacer();
    return w;
  }

  k.addSpacer(male ? 5 : 6);
  const seznam = k.addStack();
  seznam.layoutVertically();
  seznam.spacing = 2;
  const jidla = male
    ? [...dny[0].jidla].sort((a, b) => Number(b.objednano) - Number(a.objednano))
    : dny[0].jidla;
    
  const radku = male ? 3 : 4;
  const fDruh = male ? 9.5 : 10.5;
  const fNazev = male ? 11 : 12.5;
  const pad = 3;
  const sirkaDruh = male ? 44 : 50;

  jidla.slice(0, radku).forEach((j) => {
    const row = seznam.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    row.setPadding(pad, 7, pad, 7);
    row.cornerRadius = 7;
    row.spacing = 6;
    row.backgroundColor = j.objednano ? koralovyFond : panel;

    const druhBox = row.addStack();
    druhBox.size = new Size(sirkaDruh, 0);
    napis(druhBox, j.druh, Font.semiboldSystemFont(fDruh),
      j.objednano ? koralovy : slaby).lineLimit = 1;

    const nazev = napis(row, j.nazev,
      j.objednano ? Font.semiboldSystemFont(fNazev) : Font.systemFont(fNazev),
      j.objednano ? textBarva : mdly);
    nazev.lineLimit = 1;
  });

  k.addSpacer();

  const patka = k.addStack();
  patka.layoutHorizontally();
  patka.centerAlignContent();
  
  const stav = stavDne(dny[0], ted);
  const sBarva = stav.ok ? koralovy : zluty;
  const v = male ? 9 : 10;
  napis(patka, stav.ok ? "\u25cf" : "\u25cb", Font.systemFont(v - 1), sBarva);
  patka.addSpacer(4);
  napis(patka, stav.text, Font.systemFont(v), sBarva).lineLimit = 1;
  
  patka.addSpacer();
  return w;
}

const HTML_SABLONA = `
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<script>
/* Prazdne = necháme rozhodnout prefers-color-scheme, tj. systemovy vzhled iOS.
   Vyplnene jen kdyz si v CONFIG.vzhled vynutis konkretni tema. */
var vynucene = "__TEMA__";
if (vynucene) document.documentElement.setAttribute("data-tema", vynucene);
</script>
<style>
:root{
  color-scheme:dark light;
  /* tmave (vychozi) — korálová na teplé tmavé, podle loga Strava.cz */
  --bg:#17140f;
  --plocha:radial-gradient(circle at 88% 82%, rgba(242,121,93,.12) 0 22%, transparent 55%),
           linear-gradient(#232019, #100e0c);
  --text:#f6efec; --dim:#a2968f; --accent:#f2795d;
  --panel:rgba(255,255,255,.06);
  --panel2:rgba(255,255,255,.1);
  --okraj:rgba(255,255,255,.16);
  --fond:rgba(242,121,93,.16);
  --naAkcent:#17140f;
  --warn:#f2b880; --err:#ff9d92;
  --toast:#2a241f;
}

@media (prefers-color-scheme: light){
  :root:not([data-tema="tmavy"]){
    --bg:#fbf5f1;
    --plocha:radial-gradient(circle at 88% 82%, rgba(210,71,42,.1) 0 22%, transparent 55%),
             linear-gradient(#fdf8f5, #f3e4dc);
    --text:#2a1c18; --dim:#7b6a63; --accent:#d2472a;
    --panel:rgba(42,28,24,.05);
    --panel2:rgba(42,28,24,.09);
    --okraj:rgba(42,28,24,.18);
    --fond:rgba(210,71,42,.12);
    --naAkcent:#ffffff;
    --warn:#9a6512; --err:#b8321f;
    --toast:#ffffff;
  }
}

:root[data-tema="svetly"]{
  --bg:#fbf5f1;
  --plocha:radial-gradient(circle at 88% 82%, rgba(210,71,42,.1) 0 22%, transparent 55%),
           linear-gradient(#fdf8f5, #f3e4dc);
  --text:#2a1c18; --dim:#7b6a63; --accent:#d2472a;
  --panel:rgba(42,28,24,.05);
  --panel2:rgba(42,28,24,.09);
  --okraj:rgba(42,28,24,.18);
  --fond:rgba(210,71,42,.12);
  --naAkcent:#ffffff;
  --warn:#9a6512; --err:#b8321f;
  --toast:#ffffff;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;margin:0;padding:0}
html,body{height:100%}
body{
  background:var(--plocha);
  background-color:var(--bg);
  color:var(--text);
  font:400 15px/1.35 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;
  display:flex;flex-direction:column;overflow:hidden;
   padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
}
header{padding:14px 18px 10px;display:flex;align-items:flex-end;gap:10px}
header .t{flex:1;min-width:0}
header h1{font-size:19px;font-weight:700;letter-spacing:-.02em}
header p{font-size:12px;color:var(--dim);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.konto{font-size:13px;font-weight:600;background:var(--panel);border:1px solid var(--okraj);
  padding:6px 11px;border-radius:999px;white-space:nowrap}
.konto.low{color:var(--warn);border-color:var(--warn)}
nav{display:flex;gap:6px;padding:2px 18px 10px;overflow-x:auto;scrollbar-width:none}
nav::-webkit-scrollbar{display:none}
nav button{
  flex:0 0 auto;background:var(--panel);color:var(--dim);border:1px solid var(--okraj);
  border-radius:999px;padding:7px 13px;font-size:12.5px;font-weight:600;font-family:inherit;
  display:flex;align-items:center;gap:6px;transition:.15s;
}
nav button.on{background:var(--accent);color:var(--naAkcent);border-color:var(--accent)}
nav button .d{width:6px;height:6px;border-radius:50%;background:var(--accent);opacity:0}
nav button.has .d{opacity:1}
nav button.on .d{background:var(--naAkcent)}
.days{flex:1;display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory; /* ios 13+ */
  scrollbar-width:none;overscroll-behavior-x:contain}
.days::-webkit-scrollbar{display:none}
.day{flex:0 0 100%;scroll-snap-align:center;overflow-y:auto;padding:2px 18px 18px}
.day h2{font-size:14px;font-weight:600;color:var(--dim);margin-bottom:10px}
.meal {
  background: var(--panel);
  border: 1.5px solid var(--okraj);
  border-radius: 15px;
  padding: 13px 15px;
  margin-bottom: 9px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  transition: transform .12s, background .15s, border-color .15s;
}
/* .meal:hover{background:var(--card2)} */
.meal:active{transform:scale(.985)}
.meal.on {
  background: var(--fond);
  border-color: var(--accent);
}
.meal.locked{opacity:.42}
.meal .box{
  flex:0 0 22px;height:22px;border-radius:7px;border:2px solid var(--okraj);
  display:flex;align-items:center;justify-content:center;margin-top:1px;
  font-size:13px;font-weight:700;color:var(--naAkcent);
}
.meal.on .box{background:var(--accent);border-color:var(--accent)}
.meal .b{flex:1;min-width:0}
.meal .k{display:flex;align-items:center;gap:7px;margin-bottom:3px}
.meal .druh{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--dim)}
.meal.on .druh{color:var(--accent)}
.meal .cena{font-size:11px;color:var(--dim)}
.meal .n{font-size:14.5px;line-height:1.32}
.meal.on .n{font-weight:600}
.note{font-size:12px;color:var(--dim);padding:2px 2px 14px;display:flex;gap:6px;align-items:center}
.note.warn{color:var(--warn)}
.spin{flex:1;display:flex;align-items:center;justify-content:center;color:var(--dim);font-size:14px}
#toast{
  position:fixed;left:50%;bottom:calc(26px + env(safe-area-inset-bottom));transform:translate(-50%,20px);
  background:var(--toast);border:1px solid var(--okraj);color:var(--text);
  padding:11px 17px;border-radius:13px;font-size:13.5px;font-weight:500;
  opacity:0;transition:.22s;pointer-events:none;max-width:86%;text-align:center;z-index:9;
}
#toast.show{opacity:1;transform:translate(-50%,0)}
#toast.err{border-color:var(--err);color:var(--err)}
</style>

<header>
  <div class="t"><h1 id="nadpis">Jídelníček</h1><p id="podnadpis">načítám…</p></div>
  <div class="konto" id="konto">–</div>
</header>
<nav id="nav"></nav>
<div class="days" id="days"><div class="spin">načítám…</div></div>
<div id="toast"></div>

<script>
let CFG = __CONFIG__;
let S = { sid: null, url: null, dny: [], konto: null, mena: "Kč", idx: 0, busy: false, ignoreCert: false, jidelna: "" };
const DNY = ["Ne","Po","Út","St","Čt","Pá","So"];
const DNY_PLNE = ["Neděle","Pondělí","Úterý","Středa","Čtvrtek","Pátek","Sobota"];

function toast(msg, err){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "show" + (err ? " err" : "");
  setTimeout(() => { t.className = ""; }, 2600);
}

function dnesStr(){
  const d = new Date();
  const p = n => String(n).padStart(2,"0");
  return p(d.getDate()) + "." + p(d.getMonth()+1) + "." + d.getFullYear();
}

function parseDatum(s){
  const a = s.split(".").map(Number);
  return new Date(a[2], a[1]-1, a[0]);
}

function labelDne(datum){
  const d = parseDatum(datum);
  const r = Math.round((d.setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
  if (r === 0) return "Dnes";
  if (r === 1) return "Zítra";
  return DNY[new Date(d).getDay()];
}

function celeDne(datum){
  const r = Math.round((parseDatum(datum).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
  if (r === 0) return "Dnes";
  if (r === 1) return "Zítra";
  return DNY_PLNE[parseDatum(datum).getDay()];
}

function lzeZmenit(m){ return m.pocet > 0 ? m.zm === "" : m.obj === ""; }

async function refresh(){
  const r1 = await fetch("https://app.strava.cz/api/login", {
    method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({ cislo: CFG.cislo, jmeno: CFG.jmeno, heslo: CFG.heslo, zustatPrihlasen: false, environment: "W", lang: "CZ" })
  });
  const login = await r1.json();
  if (login.state === "error") throw new Error(login.message || "Přihlášení selhalo");
  
  S.sid = login.sid;
  S.url = login.s5url;
  S.ignoreCert = login.ignoreCert;
  
  const u = login.uzivatel || {};
  S.konto = u.konto != null ? Number(u.konto) : null;
  S.mena = u.mena || "Kč";
  S.jidelna = u.nazevJidelny || "";
  
  const r2 = await fetch("https://app.strava.cz/api/objednavky", {
    method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({ cislo: CFG.cislo, sid: S.sid, s5url: S.url, lang: "CZ", konto: 0, podminka: "", ignoreCert: S.ignoreCert })
  });
  const o = await r2.json();
  if (o.state === "error") throw new Error(o.message || "Načtení selhalo");
  
  const poradi = CFG.poradiDruhu || [];
  S.dny = Object.keys(o).filter(k => /^table\\d+$/.test(k) && o[k].length)
    .sort((a,b) => Number(a.slice(5)) - Number(b.slice(5)))
    .map(k => {
      return {
        datum: o[k][0].datum,
        konec: o[k][0].casKonec || null,
        jidla: o[k].map(r => ({
          veta: r.veta,
          druh: (r.druh_popis||"").trim(),
          nazev: (r.nazev||"").trim(),
          cena: Number(r.cena)||0,
          pocet: Number(r.pocet)||0,
          obj: (r.omezeniObj && r.omezeniObj.obj) || "",
          zm: (r.omezeniObj && r.omezeniObj.zm) || ""
        })).sort((a,b) => {
          let x = poradi.indexOf(a.druh); if (x < 0) x = 99;
          let y = poradi.indexOf(b.druh); if (y < 0) y = 99;
          return x - y;
        })
      };
    });
}

function el(tag, cls, text){
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function vykresli(){
  document.getElementById("podnadpis").textContent = S.jidelna || "";
  const k = document.getElementById("konto");
  k.textContent = S.konto != null ? Math.round(S.konto) + " " + S.mena : "–";
  k.className = "konto" + (S.konto != null && S.konto < 100 ? " low" : "");

  const nav = document.getElementById("nav");
  nav.innerHTML = "";
  
  S.dny.forEach((d, i) => {
    const has = d.jidla.some(m => m.pocet > 0);
    const b = el("button", (i === S.idx ? "on " : "") + (has ? "has" : ""));
    b.appendChild(el("span", "d"));
    b.appendChild(el("span", null, labelDne(d.datum) + " " + parseDatum(d.datum).getDate() + "."));
    b.onclick = () => skoc(i);
    nav.appendChild(b);
  });
  
  const akt = nav.children[S.idx];
  if (akt) akt.scrollIntoView({inline: "center", block: "nearest", behavior: "smooth"});

  const wrap = document.getElementById("days");
  const scroll = wrap.scrollLeft;
  wrap.innerHTML = "";
  
  S.dny.forEach((d, i) => {
    const page = el("div", "day");
    const dt = parseDatum(d.datum);
    page.appendChild(el("h2", null, dt.getDate() + ". " + (dt.getMonth()+1) + ". " + dt.getFullYear()));

    d.jidla.forEach(m => {
      const on = m.pocet > 0;
      const lze = lzeZmenit(m);
      const c = el("div", "meal" + (on ? " on" : "") + (lze ? "" : " locked"));
      
      const box = el("div", "box", on ? "✓" : "");
      c.appendChild(box);
      
      const b = el("div", "b");
      const head = el("div", "k");
      head.appendChild(el("span", "druh", m.druh));
      if (m.cena) head.appendChild(el("span", "cena", Math.round(m.cena) + " " + S.mena));
      b.appendChild(head);
      b.appendChild(el("div", "n", m.nazev));
      
      c.appendChild(b);
      c.onclick = () => prepni(i, m);
      page.appendChild(c);
    });

    const obj = d.jidla.filter(m => m.pocet > 0);
    const konec = d.konec ? new Date(d.konec) : null;
    const otevreno = d.jidla.some(lzeZmenit);
    
    const n = el("div", "note" + (obj.length ? "" : " warn"));
    
    if (obj.length) {
      n.textContent = "objednáno: " + obj.map(m => m.druh).join(", ");
    } else if (otevreno && konec) {
      const p = x => String(x).padStart(2,"0");
      n.textContent = "nic neobjednáno · lze do " + konec.getDate() + ". " + (konec.getMonth()+1) + ". "
        + p(konec.getHours()) + ":" + p(konec.getMinutes());
    } else {
      n.textContent = "nic neobjednáno · objednávky uzavřeny";
    }
    page.appendChild(n);
    wrap.appendChild(page);
  });
  
  wrap.scrollLeft = scroll || S.idx * wrap.clientWidth;
  nadpisDne();
}

function nadpisDne(){
  const d = S.dny[S.idx];
  document.getElementById("nadpis").textContent = d ? celeDne(d.datum) : "Jídelníček";
}

function skoc(i){
  S.idx = i;
  const wrap = document.getElementById("days");
  wrap.scrollTo({ left: i * wrap.clientWidth, behavior: "smooth" });
}

async function prepni(dayIdx, meal){
  if (S.busy) return;
  if (!lzeZmenit(meal)) {
    toast(meal.pocet > 0 ? "Odhlásit už nejde" : "Objednávky pro tento den jsou uzavřené", true);
    return;
  }
  
  const novy = meal.pocet > 0 ? 0 : 1;
  S.busy = true;
  meal.pocet = novy; // optimistic update
  vykresli();

  try {
    const r1 = await fetch("https://app.strava.cz/api/pridejJidloS5", {
      method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ cislo: CFG.cislo, sid: S.sid, url: S.url, veta: meal.veta, pocet: novy, lang: "CZ", ignoreCert: S.ignoreCert })
    });
    const pr = await r1.json();
    if (pr.state === "error") throw new Error(pr.message || "Změna se nepovedla");
    
    const r2 = await fetch("https://app.strava.cz/api/saveOrders", {
      method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ cislo: CFG.cislo, sid: S.sid, url: S.url, xml: null, lang: "CZ", ignoreCert: S.ignoreCert })
    });
    const sr = await r2.json();
    if (sr.state === "error") throw new Error(sr.message || "Uložení se nepovedlo");
    
    toast(novy ? "Objednáno: " + meal.druh : "Odhlášeno: " + meal.druh);
    S.busy = false;
    await refresh();
    vykresli();
  } catch (e) {
    meal.pocet = novy ? 0 : 1; // revert
    S.busy = false;
    vykresli();
    toast(String(e.message || e), true);
  }
}

document.getElementById("days").addEventListener("scroll", function() {
  const wrap = this;
  const i = Math.round(wrap.scrollLeft / wrap.clientWidth);
  if (i !== S.idx && S.dny[i]) {
    S.idx = i;
    nadpisDne();
    const nav = document.getElementById("nav");
    for (let j = 0; j < nav.children.length; j++) {
      nav.children[j].classList.toggle("on", j === i);
    }
    const akt = nav.children[i];
    if (akt) akt.scrollIntoView({inline: "center", block: "nearest", behavior: "smooth"});
  }
}, {passive: true});

refresh().then(() => {
  let dnes = S.dny.findIndex(d => d.datum === dnesStr());
  if (dnes < 0) dnes = 0;
  if (new Date().getHours() >= CFG.prepnoutNaZitrekOd && S.dny[dnes+1]) dnes++;
  S.idx = dnes;
  vykresli();
}).catch(e => {
  document.getElementById("days").innerHTML = "";
  document.getElementById("podnadpis").textContent = String(e.message || e);
});
</script>
`;

function widgetChyby(zprava) {
  const w = new ListWidget();
  const k = vrstvaPozadi(w, 360, 170);
  k.setPadding(10, 12, 10, 12);
  napis(k, "Jídelníček", Font.boldSystemFont(14), textBarva);
  k.addSpacer(6);
  napis(k, zprava, Font.systemFont(11), cerveny).lineLimit = 3;
  k.addSpacer();
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  return w;
}

async function spust(posun) {
  nactiUcet();

  if (config.runsInWidget) {
    let widget;
    try {
      const data = await nactiData();
      widget = postavWidget(data, new Date(), config.widgetFamily || "medium", posun);
    } catch (e) {
      widget = widgetChyby(String(e.message || e));
    }
    Script.setWidget(widget);
  } else {
    // prvni spusteni: zeptat se na prihlaseni driv, nez se otevre WebView —
    // ten se prihlasuje sam a potrebuje uz vyplnene CONFIG
    if (!maUcet() && lzeSePtat()) {
      await prihlasDialogem("Vítej! Přihlas se na Strava.cz — údaje se uloží a příště už je zadávat nebudeš.");
    }

    const wv = new WebView();
    const html = HTML_SABLONA
      .replace("__TEMA__", CONFIG.vzhled === "tmavy" || CONFIG.vzhled === "svetly" ? CONFIG.vzhled : "")
      .replace("__CONFIG__", JSON.stringify(CONFIG));
    await wv.loadHTML(html, "https://app.strava.cz");
    await wv.present(true);

    try {
      const data = await nactiZeSite();
      FileManager.local().writeString(cestaKCache(), JSON.stringify(data));
    } catch(e) {}
  }
  Script.complete();
}

module.exports = { spust, nastavUcet, zapomenUcet };

const jeHlavni = module.filename.includes(Script.name());
if (jeHlavni) {
  const param = String(args.widgetParameter == null ? "" : args.widgetParameter).trim().toLowerCase();
  if (param === "ucet" || param === "účet" || param === "odhlasit" || param === "prihlasit") {
    nastavUcet().then(() => Script.complete());
  } else {
    spust(Number(param) || 0);
  }
}
