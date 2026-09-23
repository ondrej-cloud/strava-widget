# Jídelníček ze Strava.cz na iPhonu

Widget pro [Scriptable](https://scriptable.app), který ukáže objednaný oběd
přímo na ploše telefonu — a po ťuknutí umí i objednat.

**Proč:** Strava.cz se načítá věčnost. Zjistit, co máš k obědu nebo jestli vůbec
máš objednáno, znamená otevřít web, přihlásit se a proklikat se menu. Takhle to
máš na ploše hned, jedním pohledem.

- **na ploše** — widget s nejbližším dnem, co je objednané a kolik máš na kontě
- **po ťuknutí** — celoobrazovková appka: swipe mezi dny, ťuknutím objednáš nebo odhlásíš

Data si drží v cache, takže widget ukáže jídelníček i bez signálu. Přizpůsobuje
se světlému i tmavému režimu iOS.

## Instalace

1. Stáhni si **Scriptable** z App Storu (zdarma).
2. V něm dej **+** a vlož obsah `Jidelnicek.js`.
3. Skript pojmenuj **`Jidelnicek`** — bez diakritiky a bez mezer.
4. Spusť ho jednou tlačítkem ▶ — povolí se připojení a přihlásíš se (viz níž).
5. Na plochu přidej widget **Scriptable**, v jeho nastavení vyber skript
   `Jidelnicek` a **When Interacting** nastav na **Run Script**.

Nepovinně přidej i `Jidelnicek ucet.js` jako samostatný skript — slouží
k přepnutí nebo odhlášení účtu.

## Přihlášení

**Do kódu se nic psát nemusí.** Při prvním spuštění v aplikaci se objeví dialog
se třemi poli: číslo jídelny, uživatelské jméno a heslo.

Skript údaje hned ověří proti Strava.cz — když jsou špatně, zeptá se znovu, když
sedí, uloží je do iOS Keychainu a **příště už se neptá**. Heslo se nikam jinam
neukládá a v kódu nefiguruje.

Číslo jídelny je to čtyřmístné číslo, které zadáváš i na webu Strava.cz.
Když ti heslo přestane platit, řekne si o nové sám dalším dialogem.

Widget na ploše dialog zobrazit neumí, takže než se poprvé přihlásíš v appce,
píše *„Otevři skript Jídelníček v aplikaci Scriptable a přihlas se"*.

### Změna účtu / odhlášení

Spusť skript `Jidelnicek ucet` — nabídne **Přihlásit jiný účet** a **Odhlásit
a smazat údaje**. Totéž umí hlavní skript, když mu do parametru widgetu napíšeš
`ucet`.

## Kolik dní dopředu

V nastavení widgetu je pole **Parameter**. Napíšeš do něj číslo a widget ukáže
o tolik **školních** dní dál:

| Parameter | ukazuje |
|---|---|
| prázdné nebo `0` | nejbližší den |
| `1` | + 1 školní den |
| `2` | + 2 dny |
| `ucet` | otevře přihlášení místo jídelníčku |

Počítají se školní dny, ne kalendářní. Odpoledne se nejbližší den sám překlopí
na zítřek — kdy přesně, řídí `prepnoutNaZitrekOd` v `CONFIG` (výchozí 14:00).

Chceš vidět víc dní najednou? Přidej na plochu víc widgetů, každému dej jiný
parametr a naskládej je na sebe do stacku (podrž → **Edit Stack** → vypni
**Smart Rotate**). Pak mezi dny listuješ swipem přímo na ploše.

## Objednávání

Ťuknutím na widget se otevře appka, kde jde jídlo objednat i odhlásit — stejně
jako na webu. Změna se pošle na Strava.cz hned; widget na ploše ji ukáže až při
dalším překreslení, viz *Proč widget po objednávce hned neukáže změnu*.

## Widget

```
Zítra 10. 9.                       323 Kč
  POLÉVKA   Hovězí s masem a nudlemi
  OBĚD 1    Krupicová kaše s máslem, cukrem…
  OBĚD 2    Fusilli ala bolognese s vepřovým…
  SVAČINA   Avokádová pomazánka, žitný rohlík…
○ nic — lze do 9. 9. 10:00
```

Objednané jídlo má korálové podbarvení a tučný název, ostatní sedí na sotva
znatelném tmavším pruhu. Patička je korálová, když něco objednáno máš, jinak
tlumeně zlatá — stejně jako zůstatek na kontě, když spadne pod stovku.
Po 14:00 (`prepnoutNaZitrekOd`) widget přeskočí na další den, víkendy sám přeskakuje.

Velikosti:

- **malý** — 3 položky, objednané nahoře
- **střední** — celý den (doporučeno)
- **velký** — **tři dny pod sebou**, u každého datum a stav vpravo

Výšky jsou spočítané na 158 pt (malý/střední) a 354 pt (velký) s ~15 pt rezervou.
Když budeš zvětšovat písma nebo přidávat řádky, hlídej si to — iOS přetečení
nezmenší, jen ořízne.

## Jak funguje posun mezi dny

Parametr widgetu říká, o kolik **školních** dní dál než nejbližší den koukáš.
Ne kalendářních: o víkendu ukáže `0` rovnou pondělí.
Nejbližší den je dnešek, po 14:00 (`prepnoutNaZitrekOd`) zítřek.

Kolik dní dopředu jde nastavit, nic neomezuje — parametr je obyčejné číslo.
Chceš víc dní naráz bez swipování? Dej **velký** widget — má tři dny pod sebou.

## Appka (po ťuknutí na widget)

- **swipe doleva/doprava** mezi dny, nahoře lišta s dny (zelená tečka = něco objednáno)
- **ťuknutí na jídlo** = objednat / odhlásit, hned se to propíše a pak potvrdí ze serveru
- zamčená jídla (po termínu) jsou vyšisovaná, ťuknutí řekne proč
- pod dnem je termín, do kdy jde ještě objednávat
- po zavření appky se obnoví cache, aby widget na ploše nedržel starý stav

Polévka je u tvojí jídelny vždycky zamčená — jde k obědu automaticky, zdarma (0 Kč),
nedá se objednat zvlášť. Objednávat jde Oběd 1, Oběd 2 a Svačina.

## Proč widget po objednávce hned neukáže změnu

Objednávka se uloží okamžitě, ale widget na ploše je jen obrázek z posledního
překreslení. Než ho iOS překreslí, ukazuje starý stav — proto se změna objevila
až po restartu telefonu (restart překreslí všechny widgety).

Co s tím:

- appka při zavření přepíše cache čerstvými daty, takže **první další překreslení
  je už správně** — nečeká se na síť
- `obnovitPoMin: 15` říká iOS, jak často by mělo překreslovat
- ručně to jde popohnat: podrž widget → **Edit Widget** → zavřít. Nebo zamknout
  a odemknout telefon a přejet na plochu s widgetem.

Widgety ve stacku si čerstvá data sdílejí (`platnostCacheMin: 5`), takže pět
widgetů neznamená pětkrát víc dotazů na server jídelny.

## Co v widgetu nejde (limity iOS, ne skriptu)

- **swipovat uvnitř jednoho widgetu** — widgety neumí gesta, jen ťuknutí.
  Swipe na ploše se dělá stackem (viz výš), horizontální swipe je v appce.
- **objednat přímo z widgetu** — interaktivní widgety (iOS 17+) Scriptable nenabízí,
  jde jen otevřít skript.
- **animovat cokoliv ve widgetu** — widget je statický snímek. Srdíčko ve
  květinové verzi proto nebliká; tepe jen to v appce, kde běží CSS animace.
- **vynutit obnovení** — kdy se widget překreslí, rozhoduje iOS. Scriptable nemá
  přístup k `WidgetCenter.reloadAllTimelines()`, takže po objednávce nejde říct
  „překresli se hned". Skript si říká o 15 minut (`obnovitPoMin`), iOS to bere
  jako přání, ne příkaz.

## Světlý a tmavý režim

`vzhled: "auto"` v `CONFIG` se řídí systémem; natvrdo jde nastavit `"tmavy"`
nebo `"svetly"`. Appka nechává rozhodnout CSS `prefers-color-scheme`.

Widget naráží na tři omezení Scriptable naráz:

1. `Device.isUsingDarkAppearance()` ve widgetu nefunguje („This API is not
   supported in widgets"). Použitelné je jen `Color.dynamic(světlá, tmavá)`,
   kterou vyhodnotí iOS až při vykreslení.
2. Do nakresleného obrázku (`DrawContext`) se dynamická barva nedostane.
3. `ListWidget` kreslí buď `backgroundGradient`, **nebo** `backgroundImage` —
   ne obojí přes sebe.

Pozadí je proto ve dvou vrstvách: podklad je `backgroundGradient`
z dynamických barev přímo na `ListWidget`, květ je `backgroundImage`
**vnořeného stacku**, který má vlastní vrstvu, takže leží nad přechodem. Aby
jeden obrázek seděl na obě palety, kreslí se korálovou s nízkým krytím a barvu
si bere zespodu.

## Barvy

Paleta jde podle loga Strava.cz: korálová na teplé tmavé
(`#232019 → #0f0d0c`), ve světlém režimu korálová na krémové
(`#fdf7f4 → #f2ded5`). Akcent je `#f2795d` na tmavé a tmavší `#d2472a`
na světlé, aby držel kontrast.

Květ zůstal přesně takový, jaký byl — `okvetniList()` kreslí osm lístků
každý zvlášť, `r = sirka * 0.4`, šířka `r * 0.52`, krytí `0.07`, střed
v pravém dolním rohu. To, že se průhledné lístky v překryvu sčítají, je
součást vzhledu, ne chyba: dává květu měkký střed.

## Na co si dát pozor při úpravách

Kód je bez komentářů, takže tyhle věci jsou popsané jenom tady. Všechny čtyři už
jednou spadly.

**1. Hlavička musí být `text/plain`.** S `Content-Type: application/json` vrací
backend strava.cz HTTP 555 a `{"state":"error"}`. Next.js si u `application/json`
tělo naparsuje sám, ale jejich API vrstva čeká řetězec a udělá si `JSON.parse`.

**2. V `Jidelnicek.js` nesmí být top-level `await`.** `importModule` by skriptům
volajícím skriptům vrátil Promise místo exportů a `jidelnicek.spust` by bylo `undefined`.
Proto se na konci volá `spust(...)` bez `await` a běh ukončí `Script.complete()`.

**3. Globální proměnná se mezi moduly nepřenese.** Rozlišení „běžím sám vs. někdo
mě importoval" proto stojí na `module.filename` a `Script.name()`, ne na
`globalThis`.

**4. `HTML_SABLONA` je template literal.** Uvnitř nesmí být zpětný apostrof ani
`${`, jinak se řetězec rozpadne. Proto JS v appce skládá texty přes `+` a ne přes
šablony. Konfigurace se dovnitř dostává přes `__CONFIG__`, které se nahradí až
za běhu.

**5. Výšky widgetů jsou napočítané.** Střední: 20 padding + 18 hlavička + 6 +
4×21 řádky + 12 patička ≈ 146 pt do dostupných 158. Velký ≈ 333 do 354.
iOS přetečení nezmenší, jen ořízne — proto má každý název `lineLimit = 1`.

## API strava.cz

Neoficiální, ale používá ho i samotný web. **Hlavička musí být
`Content-Type: text/plain;charset=UTF-8`** — s `application/json` vrací HTTP 555.

```
POST /api/login       {cislo, jmeno, heslo, zustatPrihlasen:false, environment:"W", lang:"CZ"}
                   -> {sid, s5url, ignoreCert, uzivatel:{konto, mena, nazevJidelny, …}}

POST /api/objednavky  {cislo, sid, s5url, lang, konto:0, podminka:"", ignoreCert}
                   -> {table0:[…], table1:[…], …}      jeden table = jeden den

POST /api/pridejJidloS5 {cislo, sid, url, veta, pocet, lang, ignoreCert}   ← připraví změnu
POST /api/saveOrders    {cislo, sid, url, xml:null, lang, ignoreCert}      ← potvrdí ji
```

Objednávání je dvoufázové: `pridejJidloS5` na každé jídlo, pak jednou `saveOrders`.
`xml` je `null` pro backend S5 (tvoje jídelna); starší S4 tam chce XML s objednávkami.

Na jídle:
- `pocet > 0` = objednáno
- `omezeniObj.obj === ""` = jde objednat, jinak je důvod v kódu (`C` = po termínu)
- `omezeniObj.zm === ""` = jde odhlásit
- `casKonec` = termín pro objednávky na ten den

Appka ve WebView se načítá s baseURL `https://app.strava.cz`, takže `fetch("/api/…")`
je same-origin a CORS to neblokuje.

## Licence

Copyright (c) 2026 Ondřej Novotný. Všechna práva vyhrazena.

Kód je zveřejněný, aby si ho šlo projít a poučit se z něj. Kopírování, úpravy,
šíření ani komerční použití bez předchozího písemného souhlasu autora dovolené
nejsou. Plné znění je v [LICENSE.md](LICENSE.md).

Projekt nemá s provozovatelem Strava.cz nic společného — jen používá jeho
veřejné API jménem uživatele, který se přihlásí svými údaji.
