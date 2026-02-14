# BBL Workspace Management – Design Guide

## Swiss Federal Design System

Dieses Projekt folgt dem **Swiss Federal Design System** (swiss/designsystem),
dem offiziellen Design-System der Schweizer Bundesverwaltung.

| Aspekt           | Wert                                                    |
|------------------|---------------------------------------------------------|
| Schriftart       | Noto Sans                                               |
| Framework        | Vanilla JS (Framework-agnostisch)                       |
| Referenz         | github.com/swiss/designsystem                           |
| Token-Basis      | Tailwind CSS Config (umgesetzt als CSS Custom Properties)|
| Visueller Stil   | Flach, minimalistisch, grosse Weissraeume               |

Referenz-Implementation: `kbob-fdk` (lokale Kopie)

---

## 1. Design-Prinzipien

### 1.1 Grundwerte der Bundesverwaltung

> «Der einheitliche Einsatz der CD-Elemente sorgt fuer ein durchgaengiges
> Erscheinungsbild ueber alle Webauftritte des Bundes. Er stellt sicher, dass
> eine Website sofort als Webauftritt des Bundes erkennbar ist. Gleichzeitig
> vermittelt er die Grundwerte der taeglichen Arbeit der Bundesverwaltung:
> **Qualitaet, Effizienz und Transparenz.**»
>
> — CD Bund Richtlinien, Bundeskanzlei

### 1.2 Angewandte Prinzipien

| Prinzip            | Umsetzung                                                                   |
|--------------------|-----------------------------------------------------------------------------|
| **Klarheit**       | Informationshierarchie durch konsistente Typografie und Abstaende           |
| **Barrierefreiheit** | WCAG 2.1 AA als Mindeststandard (gesetzlich verankert via BehiG)          |
| **Vertrauen**      | Offizielle Aesthetik, die Seriositaet und Zuverlaessigkeit vermittelt      |
| **Effizienz**      | Aufgabenorientierte Oberflaechen, die kognitive Belastung minimieren       |
| **Konsistenz**     | Einheitliche visuelle Sprache ueber alle Bereiche (Shop, Planung, Circular)|

---

## 2. Verbindliche CD-Elemente

### 2.1 Element-Klassifikation

| Kategorie               | Beschreibung                            | Beispiele                                                |
|--------------------------|-----------------------------------------|----------------------------------------------------------|
| **Corporate (CD)**       | Pflicht, nicht veraenderbar             | Logo/Wappen, roter Strich, Farbpalette, Schrift, Footer  |
| **Fixed (FIX)**          | Pflicht, Platzierung vorgegeben         | Header, Navigation, Breadcrumb, Suche, Sprachwechsel     |
| **Flexible (FLEX)**      | Optional, konfigurierbar               | Facetten-Navigation, Galerien, Kontaktboxen              |

### 2.2 Nicht veraenderbare Elemente

1. **Logo & Bezeichnung** — Schweizer Wappen mit viersprachigem Text,
   Name der Organisationseinheit, graue Trennlinie
2. **Roter Strich** — Aktiver Navigationsindikator (`--color-accent`)
3. **Farbpalette** — Rot fuer Selektion, Blau (`--color-primary`) fuer Text-Links,
   Grautuene fuer Text und Hintergruende
4. **Typografie** — Noto Sans
5. **Footer** — Einheitliche Fusszeile mit Copyright und rechtlichen Hinweisen

---

## 3. Design-Token-Architektur

### 3.1 Token-System

Alle visuellen Werte sind in **`css/tokens.css`** als CSS Custom Properties definiert.
`style.css` importiert `tokens.css` und referenziert die Tokens ueber `--ob-*` Aliases.

Token-Werte sind an das offizielle Swiss Design System (Tailwind Config) angeglichen:
- Graupalette: Tailwind-Graus mit Blauunterton
- Schatten: Offizielle Dual-Layer-Definitionen
- Radien: Offizielle Skala (Default 3px)
- Fokus: Offizielles Purple (#8655F6)

### 3.2 Token-Namenskonvention

```
--color-primary-dark      Semantischer Farbtoken
--text-body-sm            Typografie-Token
--space-xl                Abstands-Token
--font-weight-bold        Schriftschnitt-Token
```

---

## 4. Design Tokens (Referenz)

### 4.1 Farbpalette

#### Markenfarben (Brand)

| Token                     | Wert      | Verwendung                             |
|---------------------------|-----------|----------------------------------------|
| `--color-accent`          | `#D8232A` | Swiss Red – aktive Nav-Linie, Badges   |
| `--color-accent-light`    | `#E53940` | primary-500                            |
| `--color-accent-dark`     | `#BF1F25` | primary-700                            |

#### Primaerfarben (Interactive)

| Token                     | Wert      | Verwendung                         |
|---------------------------|-----------|-------------------------------------|
| `--color-primary`         | `#006699` | Links, Buttons, aktive Zustaende   |
| `--color-primary-hover`   | `#005580` | Button Hover                       |
| `--color-primary-light`   | `#E6F0F7` | Badge-Hintergruende, Ghost-Button  |
| `--color-primary-dark`    | `#004B6E` | Pressed-State                      |

#### Neutralfarben (Tailwind-aligned)

| Token                     | Wert      | Verwendung                         |
|---------------------------|-----------|-------------------------------------|
| `--color-gray-50`         | `#F9FAFB` | Subtilster Hintergrund             |
| `--color-gray-100`        | `#F3F4F6` | Alternativhintergrund (`--bg-alt`) |
| `--color-gray-200`        | `#E5E7EB` | Borders, Trennlinien               |
| `--color-gray-300`        | `#D1D5DB` | Input-Borders, Divider             |
| `--color-gray-400`        | `#9CA3AF` | Placeholder, Muted Text            |
| `--color-gray-500`        | `#6B7280` | Sekundaertext, Labels              |
| `--color-gray-600`        | `#4B5563` | Nav-Text, Beschreibungen           |
| `--color-gray-700`        | `#374151` | Betonte Beschreibungen             |
| `--color-gray-800`        | `#1F2937` | Primaertext, Ueberschriften       |
| `--color-gray-900`        | `#111827` | Staerkster Kontrast                |

#### Semantische Textfarben

| Token                     | Wert            | Verwendung                       |
|---------------------------|-----------------|----------------------------------|
| `--color-text-primary`    | `#1F2937`       | Haupttext (= gray-800)          |
| `--color-text-secondary`  | `#6B7280`       | Beschreibungen (= gray-500)     |
| `--color-text-muted`      | `#9CA3AF`       | Hilfstext (= gray-400)          |
| `--color-text-inverse`    | `#FFFFFF`       | Text auf dunklem Hintergrund    |
| `--color-text-on-dark`    | `rgba(255,255,255,0.7)` | Gedaempfter Text auf Dunkel |

#### Oberflaechen

| Token                     | Wert      | Verwendung                         |
|---------------------------|-----------|-------------------------------------|
| `--color-bg-default`      | `#FFFFFF` | Standard-Hintergrund               |
| `--color-bg-alt`          | `#F3F4F6` | Alternativhintergrund (= gray-100) |
| `--color-bg-surface`      | `#F9FAFB` | Subtiler Hintergrund (= gray-50)   |
| `--color-surface-dark`    | `#3e5060` | Federal Bar, Footer-Info           |
| `--color-surface-darker`  | `#2d3a44` | Footer-Unterzeile                  |

#### Statusfarben (aligned mit offiziellen Paletten)

| Token                     | Wert      | Offizielle Palette | Verwendung         |
|---------------------------|-----------|--------------------|--------------------|
| `--color-success`         | `#047857` | green-700          | Erfolg, Circular   |
| `--color-success-light`   | `#D1FAE5` | green-100          | Erfolg-Hintergrund |
| `--color-warning`         | `#F59E0B` | yellow-500         | Warnung            |
| `--color-warning-light`   | `#FEF3C7` | yellow-100         | Warnung-Hintergrund|
| `--color-error`           | `#D8232A` | red-600            | Fehler             |
| `--color-error-light`     | `#FEE2E2` | red-100            | Fehler-Hintergrund |
| `--color-info`            | `#0F6B75` | teal-700           | Information        |
| `--color-info-light`      | `#CCFBF1` | teal-100           | Info-Hintergrund   |

#### Fokus

| Token                     | Wert      | Verwendung                         |
|---------------------------|-----------|-------------------------------------|
| `--color-focus`           | `#8655F6` | Offizielles Purple – Focus-Ring    |

---

### 4.2 Typografie

**Schriftart**: Noto Sans (Google Fonts)

```css
font-family: "Noto Sans", "Helvetica Neue", Arial, sans-serif;
```

#### Typografie-Skala

| Token           | Groesse   | Pixel | Offizielles Aequivalent | Verwendung              |
|-----------------|-----------|-------|-------------------------|-------------------------|
| `--text-display`| 2.75rem   | 44px  | (projekt-spezifisch)    | Hero-Titel              |
| `--text-h1`     | 2.25rem   | 36px  | (projekt-spezifisch)    | Seitentitel             |
| `--text-h2`     | 1.75rem   | 28px  | (projekt-spezifisch)    | Sektionsueberschriften  |
| `--text-h3`     | 1.375rem  | 22px  | 2xl                     | Kartenueberschriften    |
| `--text-h4`     | 1.125rem  | 18px  | lg                      | Unterueberschriften     |
| `--text-h5`     | 1rem      | 16px  | base                    | Kleine Ueberschriften   |
| `--text-body`   | 1rem      | 16px  | base                    | Fliesstext              |
| `--text-body-sm`| 0.875rem  | 14px  | sm                      | Kompakter Text, Labels  |
| `--text-body-xs`| 0.75rem   | 12px  | xs                      | Federal Bar, Wappen     |
| `--text-caption`| 0.75rem   | 12px  | xs                      | Bildunterschriften      |
| `--text-compact`| 0.8125rem | 13px  | (projekt-spezifisch)    | Buttons, Dropdowns      |
| `--text-label`  | 0.875rem  | 14px  | sm                      | Formular-Labels         |

#### Schriftschnitte

| Token                     | Wert | Verwendung                       |
|---------------------------|------|----------------------------------|
| `--font-weight-normal`    | 400  | Fliesstext                       |
| `--font-weight-medium`    | 500  | Produktnamen, Links              |
| `--font-weight-semibold`  | 600  | Buttons, Labels, Ueberschriften  |
| `--font-weight-bold`      | 700  | Preise, Hauptueberschriften      |

#### Zeilenhoehen

| Token                     | Wert | Verwendung                       |
|---------------------------|------|----------------------------------|
| `--line-height-tight`     | 1.2  | Ueberschriften                   |
| `--line-height-snug`      | 1.3  | Federal-Bar-Text                 |
| `--line-height-normal`    | 1.5  | Fliesstext (Standard)            |
| `--line-height-relaxed`   | 1.6  | Beschreibungen                   |
| `--line-height-loose`     | 1.8  | Grosszuegiger Text               |

---

### 4.3 Abstaende (Spacing)

Basis: **4px** Einheit (= Tailwind 0.25rem Inkremente).

| Token          | Wert  | Verwendung                       |
|----------------|-------|----------------------------------|
| `--space-xs`   | 4px   | Minimaler Abstand                |
| `--space-sm`   | 8px   | Gap zwischen kleinen Elementen   |
| `--space-md`   | 16px  | Standard-Padding / Gap           |
| `--space-lg`   | 24px  | Zwischen Sektionen               |
| `--space-xl`   | 32px  | Container-Padding, grosse Gaps   |
| `--space-2xl`  | 48px  | Sektions-Padding                 |
| `--space-3xl`  | 64px  | Hero-Padding                     |
| `--space-4xl`  | 80px  | Maximaler Abstand                |

---

### 4.4 Layout

| Token                     | Wert    | Verwendung                       |
|---------------------------|---------|----------------------------------|
| `--container-max-width`   | 1544px  | Offizieller 2xl Breakpoint       |
| `--container-padding`     | 32px    | Horizontales Padding             |
| `--grid-gutter`           | 24px    | Grid-Abstand                     |
| `--sidebar-width`         | 260px   | Kategorie-Sidebar                |

---

### 4.5 Border Radius (aligned mit offizieller Skala)

| Token          | Wert  | Offiziell | Verwendung                       |
|----------------|-------|-----------|----------------------------------|
| `--radius-xs`  | 1px   | xs        | Minimaler Radius                 |
| `--radius-sm`  | 2px   | sm        | Badges, Tags                     |
| `--radius`     | 3px   | DEFAULT   | Standard (Buttons, Karten, Inputs)|
| `--radius-lg`  | 5px   | lg        | Groessere Elemente               |
| `--radius-xl`  | 6px   | xl        | Panels                           |
| `--radius-2xl` | 8px   | 2xl       | Modals, grosse Karten            |
| `--radius-3xl` | 10px  | 3xl       | Spezialkomponenten               |
| `--radius-full`| 9999px| full      | Kreise, Pills                    |

---

### 4.6 Schatten (offizielle Dual-Layer-Definitionen)

| Token         | Definition                                                              |
|---------------|-------------------------------------------------------------------------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)`                                           |
| `--shadow`    | `0 1px 2px rgba(0,0,0,0.06), 0 1px 5px rgba(0,0,0,0.08)`             |
| `--shadow-md` | `0 2px 4px -1px rgba(0,0,0,0.06), 0 4px 10px -1px rgba(0,0,0,0.08)` |
| `--shadow-lg` | `0 2px 6px -1px rgba(0,0,0,0.06), 0 5px 20px -3px rgba(0,0,0,0.08)` |
| `--shadow-xl` | `0 6px 10px -5px rgba(0,0,0,0.06), 0 15px 25px -3px rgba(0,0,0,0.09)`|
| `--shadow-2xl`| `0 10px 20px rgba(0,0,0,0.06), 1px 10px 70px -8px rgba(0,0,0,0.13)`  |

---

## 5. Header-Struktur (CD Bund)

Der Header folgt dem 3-zeiligen admin.ch-Muster:

```
+--------------------------------------------------------------+
| FEDERAL BAR (#3e5060, 46px)                                   |
| "Alle Schweizer Bundesbehoerden"   [LS] [GS] [Anmelden] [DE]|
+--------------------------------------------------------------+
| BRAND BAR (weiss)                                             |
| [CH] Schweizerische Eidgenossenschaft | BBL   Jobs Kontakt Q |
+--------------------------------------------------------------+
| NAV BAR (weiss, 64px, border top+bottom)                      |
| Produktkatalog  Gebrauchte Moebel  Arbeitsplaetze gestalten   |
| =============== (roter aktiver Strich, 3px)                   |
+--------------------------------------------------------------+
```

### 5.1 Federal Bar

- Hintergrund: `--color-surface-dark` (#3e5060)
- Hoehe: `--topbar-height` (46px)
- Links: "Alle Schweizer Bundesbehoerden" mit Chevron
- Rechts: Leichte Sprache (Icon+Label), Gebaerdensprache (Icon+Label),
  Anmelden-Button, Language Switcher Dropdown (DE/FR/IT/RM)
- Accessibility-Links: Label nur auf Desktop, nur Icon auf Mobile

### 5.2 Brand Bar

- Hintergrund: weiss
- Links: Wappen (34px) + Viersprachiger Text + Divider + Departementsname
- Rechts: Meta-Navigation (Jobs, Kontakt, Medien) + Suche + Warenkorb
- Meta-Navigation: Getrennt durch vertikale Linie, hidden auf Mobile
- Wappen fungiert als Home-Link

### 5.3 Navigation Bar

- Hoehe: `--nav-height` (64px)
- Links: Produktkatalog, Gebrauchte Moebel, Arbeitsplaetze gestalten, Arbeitsplaetze verwalten
- Aktiver Tab: `::after` Pseudo-Element, 3px Hoehe, `--color-accent`
- Hover: Text wird `--color-accent`
- Mobile: Hamburger-Menu mit Slide-Down

---

## 6. Seitenstruktur

### 6.1 Home Page

1. **Hero Section** — Text links (Titel, Beschreibung, 2 CTAs), Bild rechts. Weisser Hintergrund.
2. **Tile-Grid** (`section--bg-alt`) — 3 Karten ohne Icons: Produktkatalog, Arbeitsplaetze gestalten, Gebrauchte Moebel
3. **Neuheiten** — Produktgrid mit 6 neuen Produkten + "Alle Produkte einsehen" Link

### 6.2 Planung Page

1. Breadcrumb + Page Hero
2. Tile-Grid — 3 Karten: Stilwelten, Planungsbeispiele, CAD-Daten
3. Stilwelten-Grid (`section--bg-alt`) — 6 Bild-Karten

### 6.3 Section-Wrapper

- `.section` — padding mit `--_center-pad` fuer fluid centering
- `.section--bg-alt` — Alternating Background (`--color-bg-alt`)
- Hintergrund-Alternation: weiss → grau → weiss

---

## 7. Komponenten

### 7.1 Karten (Cards)

#### Centered Card (Tile)

- Ohne Icons, nur Text (Titel + Beschreibung + Pfeil)
- Pfeil: 36px Box, `--color-accent` Border
- **Hover**: Pfeil fuellt sich rot, verschiebt 2px rechts. Titel bleibt unveraendert.
- Klasse: `.card--centered .card--interactive`

#### Produkt-Karte

- Bild (responsive srcset 400w/600w/800w), Titel, Beschreibung, Preis, Marke
- Badges: "Neu" (accent), "Gebraucht" (circular)
- Hover: Shadow-Erhoehung

#### Card-Varianten

| Variante             | Klasse                  | Beschreibung                      |
|----------------------|-------------------------|-----------------------------------|
| Horizontal           | `.card--horizontal`     | Bild links, Inhalt rechts         |
| Highlight (rot)      | `.card--highlight`      | 5px roter Top-Border              |
| Highlight (blau)     | `.card--highlight-primary` | 5px blauer Top-Border          |

### 7.2 Buttons

| Variante      | Klasse           | Stil                                    |
|---------------|------------------|-----------------------------------------|
| Primary       | `.btn--primary`  | BG primary, Text weiss                  |
| Outline       | `.btn--outline`  | Border gray-300, Text gray-600          |
| Secondary     | `.btn--secondary`| BG primary-light, Border primary        |
| Ghost         | `.btn--ghost`    | Kein Border, Text primary               |
| Link          | `.btn--link`     | Underline, kein Padding                 |
| Negative      | `.btn--negative` | Weisser Rahmen, transparent BG          |
| Small         | `.btn--sm`       | Kompaktes Padding                       |
| Large         | `.btn--lg`       | Groesseres Padding + Font               |

Alle Buttons: border-radius `--radius` (3px), font-weight 600, transition 150ms.

### 7.3 Hero Section

- Layout: Flexbox, Text links + Bild rechts (50/50)
- Titel: `--text-display` (44px), `--color-text-primary`
- Beschreibung: `--text-body`, `--color-text-secondary`
- CTAs: Primary-Button + Outline-Button mit Arrow-Icon
- Mobile: Stacked (Text oben, Bild unten)
- Bild: Responsive `<picture>` mit srcset

### 7.4 Breadcrumbs

```
Home > Produktkatalog > Stuehle > Produktname
```

- Separator: Chevron-Right SVG (14px)
- Font-size: 14px
- Letzte Position: gray-800 (nicht verlinkt)
- Links: gray-600, hover → primary

### 7.5 Kategorie-Baum (Sidebar)

- Radio-Button-Style fuer aktive Kategorie
- Expand/Collapse mit rotierendem Chevron (90 Grad)
- Einrueckung pro Ebene: +28px padding-left
- Max 3 Ebenen

### 7.6 Footer

Zwei-teiliger Footer:

1. **Footer-Info** (`--color-surface-dark`) — 3-Spalten Grid:
   - Ueber uns (Beschreibungstext)
   - Bleiben Sie informiert (Social Links: Facebook, Instagram, LinkedIn, X, YouTube + Newsletter-Button)
   - Weitere Informationen (Link-Liste mit Pfeilen)

2. **Footer-Bottom** (`--color-surface-darker`) — Copyright + Impressum/Rechtliches/Barrierefreiheit/Kontakt

### 7.7 Back-to-Top Button

- Fixed bottom-right, erscheint nach 400px Scroll
- `--color-accent` Border, Chevron-up Icon
- Hover: Roter Hintergrund, weisses Icon
- Smooth-scroll nach oben

### 7.8 Cookie/Consent Banner

- Fixed bottom, `--color-surface-dark` Hintergrund
- Text + "Akzeptieren" (primary) / "Ablehnen" (outline) Buttons
- localStorage-Persistenz (Key: `cookieConsent`)
- Slide-up Animation

### 7.9 Language Switcher

- "DE" Button im Federal Bar mit Dropdown
- Optionen: Deutsch, Francais, Italiano, Rumantsch
- Visuell funktional (aendert Button-Text), keine echte Uebersetzung
- Click-outside schliesst Dropdown

---

## 8. Responsive Breakpoints

Breakpoints aligned mit offiziellen Werten:

| Breakpoint | Offiziell | Anpassungen                                             |
|------------|-----------|----------------------------------------------------------|
| <= 768px   | md        | Hamburger-Menu, Sidebar hidden, Tile-Grid 1 Spalte      |
|            |           | Hero stacked, Meta-Nav hidden, A11y-Labels hidden        |
|            |           | Produktdetail Column, Federal-Bar kleinere Schrift       |
|            |           | Cookie-Banner stacked                                    |
| <= 480px   | xs        | Wappen 28px, Toolbar stacked                             |

---

## 9. Interaktionsmuster

### 9.1 Seitenuebergaenge

- Fade-in Animation (250ms) bei Seitenwechsel
- Smooth scroll-to-top bei Navigation

### 9.2 Hover-Effekte

- **Karten**: Shadow-Erhoehung, Pfeil fuellt sich rot mit 2px Rechts-Shift
- **Links**: Farbe → Primary, text-decoration je nach Kontext
- **Nav-Links**: Text → Accent
- **Back-to-Top**: BG → Accent, Icon → weiss

### 9.3 Focus-Stile

- Outline: **2px solid `--color-focus` (#8655F6 Purple)**, offset 2px
- Sichtbar nur bei Keyboard-Navigation (`:focus-visible`)
- Offizielles Purple statt Blau – aligned mit Swiss Design System

### 9.4 Dropdown-Verhalten

- Klick oeffnet/schliesst
- Klick ausserhalb schliesst (Language Switcher)
- Chevron rotiert bei geoeffnetem Zustand

---

## 10. Barrierefreiheit

### 10.1 Strukturelle Semantik

- `<header role="banner">` fuer Site-Header
- `<nav aria-label="Hauptnavigation">` fuer Navigation
- `<main id="mainContent">` fuer Hauptinhalt
- `<footer>` fuer Footer
- Skip-Link als erstes Element im Body
- Cookie-Banner mit `role="alert"`

### 10.2 ARIA-Attribute

```html
<!-- Language Switcher -->
<button aria-expanded="false" aria-haspopup="true">DE</button>
<div role="listbox"><button role="option" aria-selected="true">Deutsch</button></div>

<!-- Kategorie-Baum -->
<div role="tree">
  <div role="treeitem" aria-expanded="true" tabindex="0">Stuehle</div>
</div>

<!-- Produktkarte -->
<div role="button" tabindex="0" aria-label="Buerostuhl Giroflex 64">...</div>
```

### 10.3 Accessibility-Links

- Leichte Sprache + Gebaerdensprache im Federal Bar
- Desktop: Icon + Label, Mobile: nur Icon
- Skip-Link: "Zum Inhalt springen"

### 10.4 Kontrastverhaaeltnisse

| Kombination                | Verhaeltnis | Status |
|----------------------------|-------------|--------|
| gray-800 (#1F2937) auf weiss | ~13:1    | AAA    |
| primary (#006699) auf weiss  | ~5.5:1   | AA     |
| weiss auf surface-dark       | ~7:1     | AAA    |
| gray-500 (#6B7280) auf weiss | ~5.0:1   | AA     |
| focus purple auf weiss       | ~4.6:1   | AA     |

---

## 11. Datei-Konventionen

### 11.1 CSS-Naming

BEM-artige Konvention:

```
.block                     -> .product-card
.block__element            -> .product-card__image
.block__element--modifier  -> .product-card__badge--new
```

### 11.2 Dateistruktur

| Datei         | Inhalt                                                    |
|---------------|-----------------------------------------------------------|
| `tokens.css`  | Nur `:root`-Variablen, keine Selektoren                   |
| `style.css`   | `--ob-*` Aliases + alle Komponentenstile                  |
| `index.html`  | Statische Shell (Header, Footer, Cookie Banner, Back-to-Top) |
| `app.js`      | SPA-Logik (Routing, Rendering, Events, Interaktive Komponenten) |
| `data/*.json` | Kategorien und Produkte                                    |

### 11.3 Navigation (Routes)

| Route          | Seite                        | Nav-Mapping  |
|----------------|------------------------------|--------------|
| `#/home`       | Home (Hero + Tiles + Neuheiten) | —         |
| `#/shop`       | Produktkatalog               | shop         |
| `#/product/:id`| Produktdetail                | shop         |
| `#/planung`    | Arbeitsplaetze gestalten     | planung      |
| `#/grundriss`  | Arbeitsplaetze verwalten     | grundriss    |
| `#/circular`   | Gebrauchte Moebel            | circular     |
| `#/scan`       | Objekt scannen               | circular     |
| `#/erfassen`   | Neues Objekt erfassen        | circular     |
| `#/charta`     | Charta kreislauforientiertes Bauen | circular |
