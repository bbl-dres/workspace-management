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
`style.css` importiert `tokens.css` und referenziert die Tokens direkt ueber `var(--color-*)`,
`var(--text-*)`, `var(--space-*)` etc.

Token-Werte sind an das offizielle Swiss Design System (Tailwind Config) angeglichen:
- Graupalette: Tailwind-Graus mit Blauunterton
- Sekundaerpalette: Offizielles Blue-Gray (secondary-50 bis secondary-900)
- Schatten: Offizielle Dual-Layer-Definitionen
- Radien: Offizielle Skala (Default 3px)
- Fokus: Offizielles Purple (#8655F6)
- Typografie: Mobile-first mit responsiven Skalierungen an offiziellen Breakpoints
- Layout: Responsive Container-Padding, Grid-Gutter, Section-Padding

### 3.2 Token-Durchsetzung (Hard Rule)

In `style.css` darf **kein einziger** hardcodierter Wert fuer Farben, Schriftgroessen,
Abstaende, Radien, Schatten oder Uebergaenge vorkommen. Jeder solche Wert MUSS
eine CSS Custom Property aus `tokens.css` referenzieren (`var(--token)`).

Erlaubte Ausnahmen:
- `html { font-size: 16px }` — Root-Basis
- `1px` Border-Breiten — Strukturell, kein Design-Token
- SVG-Attribute (viewBox, stroke-width) — Elementspezifisch
- CSS-Werte in `url()` (SVG Data URIs) — Inline-Grafiken

### 3.3 Responsive Token-Architektur

Tokens skalieren automatisch an offiziellen Breakpoints via `@media`-Overrides in `tokens.css`.
Dies ersetzt das PostCSS/Tailwind-Build-System der Referenz-Implementation durch natives CSS.

```
:root {
  --text-h1: 1.625rem;           /* Mobile-first base */
}
@media (min-width: 1024px) {
  :root { --text-h1: 2rem; }     /* lg scale */
}
@media (min-width: 1280px) {
  :root { --text-h1: 2.5rem; }   /* xl scale */
}
@media (min-width: 1920px) {
  :root { --text-h1: 3rem; }     /* 3xl scale */
}
```

### 3.4 Token-Namenskonvention

```
--color-primary-dark      Semantischer Farbtoken
--color-secondary-600     Offizielle Sekundaerpalette
--color-rp-primary        Projekt-spezifischer Token (Raumplanung)
--color-white-50          Alpha/Overlay-Token
--text-body-sm            Typografie-Token
--text-compact            Kompakt-UI-Token (13px)
--space-xl                Abstands-Token
--space-1-5               Halb-Schritt-Abstands-Token
--font-weight-bold        Schriftschnitt-Token
--section-py              Responsiver Layout-Token
--btn-min-h               Komponenten-Token
--shadow-rp-lg            Projekt-spezifischer Schatten-Token
```

---

## 4. Design Tokens (Referenz)

### 4.1 Farbpalette

#### Markenfarben (Brand — Swiss Red)

| Token                     | Wert      | Offizielle Palette | Verwendung                  |
|---------------------------|-----------|--------------------|-----------------------------|
| `--color-accent`          | `#D8232A` | primary-600        | Swiss Red, aktive Nav-Linie |
| `--color-accent-light`    | `#E53940` | primary-500        | Hover-State                 |
| `--color-accent-dark`     | `#BF1F25` | primary-700        | Pressed-State               |

#### Primaerfarben (Interactive — projekt-spezifisch)

| Token                     | Wert      | Verwendung                         |
|---------------------------|-----------|-------------------------------------|
| `--color-primary`         | `#006699` | Links, Buttons, aktive Zustaende   |
| `--color-primary-hover`   | `#005580` | Button Hover                       |
| `--color-primary-light`   | `#E6F0F7` | Badge-Hintergruende, Ghost-Button  |
| `--color-primary-dark`    | `#004B6E` | Pressed-State                      |

> **Abweichung:** Das offizielle Design System nutzt Swiss Red fuer interaktive Elemente
> (Outline-Buttons, Links). Dieses Projekt verwendet Blau (#006699) fuer interaktive Elemente,
> um die Unterscheidung zwischen Brand-Akzent (Rot) und interaktiven Elementen zu erhalten.

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

#### Sekundaerpalette (Offizielles Blue-Gray)

| Token                     | Wert      | Offizielle Palette | Verwendung                  |
|---------------------------|-----------|--------------------|-----------------------------|
| `--color-secondary-50`    | `#F0F4F7` | secondary-50       | Subtilster BG               |
| `--color-secondary-100`   | `#DFE4E9` | secondary-100      | Footer-Hover                |
| `--color-secondary-200`   | `#ACB4BD` | secondary-200      | Borders                     |
| `--color-secondary-300`   | `#828E9A` | secondary-300      | Footer-Trennlinien          |
| `--color-secondary-400`   | `#596978` | secondary-400      | Muted auf Dunkel            |
| `--color-secondary-500`   | `#46596B` | secondary-500      | Sekundaer-Buttons           |
| `--color-secondary-600`   | `#2F4356` | secondary-600      | Federal Bar, Footer-Info    |
| `--color-secondary-700`   | `#263645` | secondary-700      | Footer-Unterzeile           |
| `--color-secondary-800`   | `#1C2834` | secondary-800      | Dunkelster BG               |
| `--color-secondary-900`   | `#131B22` | secondary-900      | Maximal dunkel              |

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
| `--color-surface-dark`    | `#2F4356` | Federal Bar, Footer-Info (= secondary-600) |
| `--color-surface-darker`  | `#263645` | Footer-Unterzeile (= secondary-700)|

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

#### Alpha/Overlay-Tokens

| Token                     | Wert                       | Verwendung                   |
|---------------------------|----------------------------|-------------------------------|
| `--color-white-50`        | `rgba(255,255,255,0.5)`    | Halbtransparentes Weiss       |
| `--color-white-40`        | `rgba(255,255,255,0.4)`    | Button-Border auf Dunkel      |
| `--color-white-30`        | `rgba(255,255,255,0.3)`    | Hover auf dunklem Hintergrund |
| `--color-white-20`        | `rgba(255,255,255,0.2)`    | Subtiler Overlay              |
| `--color-white-15`        | `rgba(255,255,255,0.15)`   | Button-Hover auf Dunkel       |
| `--color-white-10`        | `rgba(255,255,255,0.1)`    | Minimaler Overlay             |
| `--color-backdrop`        | `rgba(0,0,0,0.7)`          | Modal-Backdrop                |
| `--color-black-10`        | `rgba(0,0,0,0.1)`          | Subtiler Border               |

#### Raumplanung (projekt-spezifische Palette)

| Token                     | Wert      | Verwendung                         |
|---------------------------|-----------|-------------------------------------|
| `--color-rp-primary`      | `#005EA8` | Raumplanung Primaerfarbe            |
| `--color-rp-primary-dark` | `#003C69` | Panel-Toggle, Aktions-Buttons       |
| `--color-rp-primary-hover`| `#00508C` | Hover-State                         |
| `--color-rp-blue-50`      | `#E8F0FA` | Subtiler Hintergrund                |
| `--color-rp-blue-100`     | `#E0EDFF` | Aktives Tool                        |
| `--color-rp-blue-200`     | `#D0E2FA` | Aktives Tool Hover                  |
| `--color-rp-surface`      | `#EBF0F5` | Accordion-Toggle Hintergrund        |
| `--color-rp-surface-hover`| `#DEE5ED` | Accordion-Toggle Hover              |
| `--color-rp-tool-text`    | `#5E666B` | Tool-Label Textfarbe                |

#### Circular-Hub (projekt-spezifisch)

| Token                     | Wert      | Verwendung                         |
|---------------------------|-----------|-------------------------------------|
| `--color-circular`        | `#047857` | Circular-Primaerfarbe (green-700)   |
| `--color-circular-light`  | `#D1FAE5` | Circular-Hintergrund (green-100)    |
| `--color-circular-dark`   | `#065F46` | Circular-Akzent (green-800)         |
| `--color-circular-bg`     | `#ECFDF5` | Circular-Seiten-BG (green-50)       |

---

### 4.2 Typografie

**Schriftart**: Noto Sans (Google Fonts)

```css
font-family: "Noto Sans", "Helvetica Neue", Arial, sans-serif;
```

> **Abweichung:** Das offizielle Design System nutzt die lizenzierte Schrift Frutiger.
> Dieses Projekt verwendet Noto Sans als frei verfuegbare Alternative.
> Font-Weight 700 (bold) wird anstelle einer separaten Frutiger-Bold-Datei verwendet.

#### Responsive Typografie-Skala

Alle Typografie-Tokens skalieren responsiv an offiziellen Breakpoints.
Basiswerte (Mobile-first) entsprechen den offiziellen `text--*` Klassen.

| Token           | Base (Mobile) | lg (1024px) | xl (1280px) | 3xl (1920px) | Offiziell     |
|-----------------|---------------|-------------|-------------|--------------|---------------|
| `--text-display`| 2rem (32px)   | 2.5rem      | 3rem        | 3.5rem       | text--4xl     |
| `--text-h1`     | 1.625rem (26px)| 2rem       | 2.5rem      | 3rem         | text--3xl     |
| `--text-h2`     | 1.375rem (22px)| 1.625rem   | 2rem        | 2.5rem       | text--2xl     |
| `--text-h3`     | 1.25rem (20px) | 1.375rem   | 1.625rem    | 2rem         | text--xl      |
| `--text-h4`     | 1.125rem (18px)| —          | 1.25rem     | 1.375rem     | text--lg      |
| `--text-h5`     | 1rem (16px)    | —          | 1.125rem    | 1.25rem      | text--base    |
| `--text-body`   | 1rem (16px)    | —          | 1.125rem    | 1.25rem      | text--base    |
| `--text-body-sm`| 0.875rem (14px)| —          | 1rem        | 1.125rem     | text--sm      |
| `--text-body-xs`| 0.75rem (12px) | —          | 0.875rem    | 1rem         | text--xs      |
| `--text-caption`| 0.75rem (12px) | —          | 0.875rem    | 1rem         | text--xs      |
| `--text-label`  | 0.875rem (14px)| —          | 1rem        | 1.125rem     | text--sm      |

#### Schriftschnitte

| Token                     | Wert | Verwendung                       |
|---------------------------|------|----------------------------------|
| `--font-weight-normal`    | 400  | Fliesstext                       |
| `--font-weight-medium`    | 500  | Produktnamen, Links              |
| `--font-weight-semibold`  | 600  | Labels, Ueberschriften           |
| `--font-weight-bold`      | 700  | Buttons, Hauptueberschriften     |

#### Zeilenhoehen (aligned mit Tailwind Defaults)

| Token                     | Wert  | Tailwind   | Verwendung                  |
|---------------------------|-------|------------|-----------------------------|
| `--line-height-tight`     | 1.25  | leading-tight  | Ueberschriften          |
| `--line-height-snug`      | 1.375 | leading-snug   | Kompakte Texte          |
| `--line-height-normal`    | 1.5   | leading-normal | Fliesstext (Standard)   |
| `--line-height-relaxed`   | 1.625 | leading-relaxed| Beschreibungen          |
| `--line-height-loose`     | 2     | leading-loose  | Grosszuegiger Text      |

---

### 4.3 Abstaende (Spacing)

Basis: **4px** Einheit (= Tailwind 0.25rem Inkremente).

| Token          | Wert  | Tailwind   | Verwendung                       |
|----------------|-------|------------|----------------------------------|
| `--space-0-5`  | 2px   | 0.5        | Minimaler Mikro-Abstand          |
| `--space-xs`   | 4px   | 1          | Minimaler Abstand                |
| `--space-1-5`  | 6px   | 1.5        | Kleiner Zwischen-Abstand         |
| `--space-sm`   | 8px   | 2          | Gap zwischen kleinen Elementen   |
| `--space-2-5`  | 10px  | 2.5        | Kompaktes Padding                |
| `--space-3`    | 12px  | 3          | Zwischen-Padding                 |
| `--space-md`   | 16px  | 4          | Standard-Padding / Gap           |
| `--space-lg`   | 24px  | 6          | Zwischen Sektionen               |
| `--space-xl`   | 32px  | 8          | Container-Padding, grosse Gaps   |
| `--space-2xl`  | 48px  | 12         | Sektions-Padding                 |
| `--space-3xl`  | 64px  | 16         | Hero-Padding                     |
| `--space-4xl`  | 80px  | 20         | Maximaler Abstand                |

---

### 4.4 Layout (Responsive)

Layout-Tokens skalieren automatisch an offiziellen Breakpoints.

#### Container & Grid

| Token                   | Base (Mobile) | xs (480px) | sm (640px) | lg (1024px) | xl (1280px) | 3xl (1920px) |
|-------------------------|---------------|------------|------------|-------------|-------------|--------------|
| `--container-padding`   | 1rem (16px)   | 1.75rem    | 2.25rem    | 2.5rem      | 3rem        | 4rem         |
| `--grid-gutter`         | 1.25rem (20px)| 1.75rem    | 2.25rem    | 2.5rem      | 3rem        | 4rem         |
| `--container-max-width` | 1544px        | —          | —          | —           | —           | 1676px       |

Offizielle Aequivalente: `px-4` → `xs:px-7` → `sm:px-9` → `lg:px-10` → `xl:px-12` → `3xl:px-16`

#### Section Vertical Padding

| Token               | Base (Mobile) | lg (1024px) | 3xl (1920px) |
|----------------------|---------------|-------------|--------------|
| `--section-py`       | 3.5rem (56px) | 5rem (80px) | 8rem (128px) |
| `--section-py-half`  | 1.75rem (28px)| 2.5rem (40px)| 4rem (64px) |

#### Top-Header Vertical Padding

| Token               | Base (Mobile) | md (768px) | lg (1024px) | xl (1280px) | 3xl (1920px) |
|----------------------|---------------|------------|-------------|-------------|--------------|
| `--top-header-py`    | 0.75rem (12px)| 1rem (16px)| 1.5rem (24px)| 2rem (32px)| 2.5rem (40px)|

Offizielles Aequivalent: `py-3` → `md:py-4` → `lg:py-6` → `xl:py-8` → `3xl:py-10`

#### Button Min-Heights

| Token               | Base (Mobile) | xl (1280px) | 3xl (1920px) |
|----------------------|---------------|-------------|--------------|
| `--btn-min-h`        | 44px          | 48px        | 52px         |
| `--btn-sm-min-h`     | 34px          | 40px        | 44px         |
| `--btn-lg-min-h`     | 48px          | 52px        | 56px         |

#### Feste Layout-Werte

| Token                     | Wert    | Responsive             | Verwendung               |
|---------------------------|---------|------------------------|--------------------------|
| `--sidebar-width`         | 280px   | —                      | Kategorie-Sidebar        |
| `--topbar-height`         | 46px    | —                      | Federal Bar              |
| `--nav-height`            | 56px    | xl: 64px, 3xl: 80px   | Navigationsleiste        |

---

### 4.5 Border Radius (aligned mit offizieller Skala)

| Token           | Wert   | Offiziell | Verwendung                       |
|-----------------|--------|-----------|----------------------------------|
| `--radius-xs`   | 1px    | xs        | Minimaler Radius                 |
| `--radius-sm`   | 2px    | sm        | Buttons (offiziell rounded-sm)   |
| `--radius`      | 3px    | DEFAULT   | Standard (Karten, Inputs)        |
| `--radius-lg`   | 5px    | lg        | Groessere Elemente               |
| `--radius-xl`   | 6px    | xl        | Panels                           |
| `--radius-2xl`  | 8px    | 2xl       | Modals, grosse Karten            |
| `--radius-3xl`  | 10px   | 3xl       | Spezialkomponenten               |
| `--radius-4xl`  | 12px   | 4xl       | Toolbar (Raumplanung)            |
| `--radius-pill` | 20px   | —         | Pill-foermige Buttons            |
| `--radius-full` | 9999px | full      | Kreise, Pills                    |

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

#### Raumplanung-Schatten (projekt-spezifisch)

| Token              | Definition                               | Verwendung              |
|--------------------|------------------------------------------|-------------------------|
| `--shadow-rp-sm`   | `0 1px 3px rgba(0,0,0,0.12)`            | Kleine Karten           |
| `--shadow-rp`      | `0 2px 8px rgba(0,0,0,0.15)`            | Standard-Panels         |
| `--shadow-rp-md`   | `0 2px 10px rgba(0,0,0,0.18)`           | Mittlere Panels         |
| `--shadow-rp-lg`   | `0 2px 12px rgba(0,0,0,0.2)`            | Grosse Panels           |
| `--shadow-rp-card` | `0 4px 12px rgba(0,0,0,0.15)`           | Karten-Schatten         |
| `--shadow-rp-label`| `0 1px 4px rgba(0,0,0,0.2)`             | Map-Labels              |
| `--shadow-rp-button`| `0 2px 4px rgba(0,0,0,0.15)`           | Tool-Buttons            |

---

## 5. Header-Struktur (CD Bund)

Der Header folgt dem 3-zeiligen admin.ch-Muster:

```
+--------------------------------------------------------------+
| FEDERAL BAR (--color-surface-dark #2F4356, 46px)              |
| "Alle Schweizer Bundesbehoerden"   [LS] [GS] [Anmelden] [DE]|
+--------------------------------------------------------------+
| BRAND BAR (weiss)                                             |
| [CH] Schweizerische Eidgenossenschaft | BBL   Jobs Kontakt Q |
+--------------------------------------------------------------+
| NAV BAR (weiss, 56px/64px/80px responsive, border-bottom)     |
| Produktkatalog  Gebrauchte Moebel  Arbeitsplaetze gestalten   |
| =============== (roter aktiver Strich, 3px)                   |
+--------------------------------------------------------------+
```

### 5.1 Federal Bar

- Hintergrund: `--color-surface-dark` (#2F4356 = secondary-600)
- Hoehe: `--topbar-height` (46px)
- Links: "Alle Schweizer Bundesbehoerden" mit Chevron
- Rechts: Leichte Sprache (Icon+Label), Gebaerdensprache (Icon+Label),
  Anmelden-Button, Language Switcher Dropdown (DE/FR/IT/RM)
- Accessibility-Links: Label nur auf Desktop, nur Icon auf Mobile

### 5.2 Brand Bar

- Hintergrund: weiss
- Responsive vertikales Padding: `--top-header-py` (12px → 40px)
- Links: Wappen (30×33px → 32×34px lg → 40×44px 3xl) + Viersprachiger Text (hidden below xl) + Divider (responsive 40/56/70px) + Departementsname
- Rechts: Meta-Navigation (Jobs, Kontakt, Medien, hidden below lg) + Suche + Warenkorb
- Font-size: `--text-body-sm`, scales to `--text-body` at 3xl
- Wappen fungiert als Home-Link

### 5.3 Navigation Bar

- Hoehe: `--nav-height` (56px, xl: 64px, 3xl: 80px)
- Links: Produktkatalog, Gebrauchte Moebel, Arbeitsplaetze gestalten, Belegungsplanung
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

- `.section` — padding mit `--section-py` (responsive 56px → 128px)
- `.section--bg-alt` — Alternating Background (`--color-bg-alt`)
- Hintergrund-Alternation: weiss → grau → weiss

---

## 7. Komponenten

### 7.1 Karten (Cards)

#### Padding & Sizing (aligned mit offiziellem card.postcss)

| Bereich       | Wert                | Offizielles Aequivalent |
|---------------|---------------------|-------------------------|
| Card Body     | 2.5rem 1.5rem       | py-10 px-6              |
| Card Body (Mobile) | 1.5rem 1rem    | py-6 px-4               |
| Card Footer   | 0 1.5rem 1.5rem     | px-6 pb-6               |
| Card Title    | `--text-h4` (18px+) | text-lg xl:text-xl      |
| Card Title Weight | bold (700)      | font-bold               |

#### Centered Card (Tile)

- Ohne Icons, nur Text (Titel + Beschreibung + Pfeil)
- Pfeil: 36px Box, `--color-accent` Border
- **Hover**: Pfeil fuellt sich rot, verschiebt 2px rechts. Shadow → `--shadow-2xl`.
- Klasse: `.card--centered .card--interactive`

#### Produkt-Karte

- Bild (responsive srcset 400w/600w/800w), Titel, Beschreibung, Preis, Marke
- Badges: "Neu" (accent), "Gebraucht" (circular)
- Hover: Shadow-Erhoehung auf `--shadow-2xl`

#### Card-Varianten

| Variante             | Klasse                  | Beschreibung                      |
|----------------------|-------------------------|-----------------------------------|
| Horizontal           | `.card--horizontal`     | Bild links, Inhalt rechts         |
| Highlight (rot)      | `.card--highlight`      | 5px roter Top-Border              |
| Highlight (blau)     | `.card--highlight-primary` | 5px blauer Top-Border          |

### 7.2 Buttons (aligned mit offiziellem btn.postcss)

#### Sizing & Spacing

| Variante | Min-Height        | Font-Size        | Padding | Radius        |
|----------|-------------------|------------------|---------|---------------|
| Default  | `--btn-min-h`     | `--text-body`    | 0 1rem  | `--radius-sm` |
| Small    | `--btn-sm-min-h`  | `--text-body-sm` | 0 1rem  | `--radius-sm` |
| Large    | `--btn-lg-min-h`  | `--text-h4`      | 0 1rem  | `--radius-sm` |

Alle Buttons: border-radius `--radius-sm` (2px = offiziell rounded-sm),
font-weight `--font-weight-normal` (400, per btn.postcss), transition `var(--transition-fast)`,
line-height `--line-height-tight` (1.25).
SVG-Icons: `stroke-width: 0.3px` per btn.postcss.

> **Abweichung:** Offizielle Buttons nutzen `rounded-sm` (2px), nicht `rounded` (3px).
> Buttons nutzen `--radius-sm`, andere Komponenten (Karten, Inputs) nutzen `--radius` (3px).

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

### 7.3 Hero Section

- Layout: Flexbox, Text links + Bild rechts (50/50)
- Titel: `--text-h1` (responsive 26px → 48px), `--color-text-primary`
- Beschreibung: `--text-h4`, `--line-height-snug`
- CTAs: Primary-Button + Outline-Button mit Arrow-Icon
- Gap: `--grid-gutter` (responsive)
- Padding: `var(--space-2xl) --container-padding --section-py`
- Mobile: Stacked (Text oben, Bild unten), Padding `--section-py-half --container-padding`
- Bild: Responsive `<picture>` mit srcset

### 7.4 Breadcrumbs

```
Home > Produktkatalog > Stuehle > Produktname
```

- Padding: 0.5rem 0 (offiziell py-2 xl:py-3)
- Separator: Chevron-Right SVG (14px)
- Font-size: `--text-body-sm` (14px)
- Letzte Position: gray-800 (nicht verlinkt)
- Links: gray-600, hover → primary

### 7.5 Kategorie-Baum (Sidebar)

- Radio-Button-Style fuer aktive Kategorie
- Expand/Collapse mit rotierendem Chevron (90 Grad)
- Einrueckung pro Ebene: +28px padding-left
- Max 3 Ebenen

### 7.6 Footer (aligned mit offiziellem footer.postcss)

Zwei-teiliger Footer:

1. **Footer-Info** (`--color-surface-dark` = secondary-600) — 3-Spalten Grid:
   - Padding: `--section-py`
   - Inner Gap: `--space-3xl` (64px)
   - Ueber uns (Beschreibungstext)
   - Bleiben Sie informiert (Social Links + Newsletter-Button)
   - Weitere Informationen (Link-Liste mit Pfeilen)
   - Trennlinien: `--color-secondary-300`
   - Hover-Hintergrund: `--color-secondary-700`

2. **Footer-Bottom** (`--color-surface-darker` = secondary-700) — Copyright + Impressum/Rechtliches/Barrierefreiheit/Kontakt
   - Padding: `var(--space-3)` (12px)
   - Font-size: `--text-body-xs`

### 7.7 Back-to-Top Button (aligned mit back-to-top-btn.postcss)

- Fixed bottom-right, erscheint nach 400px Scroll
- `--radius-sm` (2px), `--shadow-lg`, `--color-secondary-500` Text
- Responsive Groessen: 44px (base), 48px (lg), 64px (xl)
- Hover: BG → `--color-secondary-500`, Text → weiss, Shadow → `--shadow-xl`
- SVG: fill + stroke, stroke-width 0.3px
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

Breakpoints aligned mit offiziellen Werten aus `tailwind.config.js`:

| Breakpoint | Pixel   | Offiziell | Token-Aenderungen                                           |
|------------|---------|-----------|--------------------------------------------------------------|
| Base       | 0       | —         | Mobile-first Basiswerte                                      |
| xs         | 480px   | xs        | Container-Padding ↑, Grid-Gutter ↑                          |
| sm         | 640px   | sm        | Container-Padding ↑, Grid-Gutter ↑                          |
| md         | 768px   | md        | Top-Header-Padding ↑                                        |
| lg         | 1024px  | lg        | Typografie skaliert (display–h3), Section-Padding ↑, Layout ↑|
| xl         | 1280px  | xl        | Alle Typografie skaliert, Buttons ↑, Nav-Height 64px, Layout ↑|
| 3xl        | 1920px  | 3xl       | Finale Skalierung aller Tokens                               |

### Responsive Verhalten

| Breakpoint | Layout-Anpassungen                                               |
|------------|------------------------------------------------------------------|
| <= 768px   | Hamburger-Menu, Sidebar hidden, Tile-Grid 1 Spalte              |
|            | Hero stacked, Meta-Nav hidden, A11y-Labels hidden               |
|            | Card-Body Padding reduziert (1.5rem 1rem)                       |
| <= 480px   | Wappen 28px, Toolbar stacked                                    |

---

## 9. Interaktionsmuster

### 9.1 Seitenuebergaenge

- Fade-in Animation (250ms) bei Seitenwechsel
- Smooth scroll-to-top bei Navigation

### 9.2 Hover-Effekte

- **Karten**: Shadow → `--shadow-2xl`, Pfeil fuellt sich rot mit 2px Rechts-Shift
- **Links**: Farbe → Primary, text-decoration je nach Kontext
- **Nav-Links**: Text → Accent
- **Back-to-Top**: BG → Accent, Icon → weiss
- **Footer-Links**: BG → `--color-secondary-100`

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
| weiss auf surface-dark (#2F4356) | ~8.5:1 | AAA   |
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
| `tokens.css`  | `:root`-Variablen + responsive `@media`-Overrides         |
| `style.css`   | Alle Komponentenstile (direkte Token-Referenzen)          |
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
| `#/grundriss`  | Belegungsplanung             | grundriss    |
| `#/circular`   | Gebrauchte Moebel            | circular     |
| `#/scan`       | Objekt scannen               | circular     |
| `#/erfassen`   | Neues Objekt erfassen        | circular     |
| `#/charta`     | Charta kreislauforientiertes Bauen | circular |

---

## 12. Intentionale Abweichungen vom offiziellen Design System

| Bereich              | Offizielles System          | Dieses Projekt             | Begruendung                           |
|----------------------|-----------------------------|----------------------------|---------------------------------------|
| Interaktive Farbe    | Swiss Red (#D8232A)         | Blau (#006699)             | Unterscheidung Brand vs. Interaktiv   |
| Schriftart           | Frutiger (lizenziert)       | Noto Sans (Google Fonts)   | Lizenzkosten, freie Verfuegbarkeit    |
| Bold-Gewicht         | Separate Font-Datei         | font-weight: 700           | Vereinfachung ohne Build-System       |
| Build-System         | PostCSS + Tailwind          | Native CSS Custom Properties| Vanilla-Stack, kein Build-Schritt     |
| Token-Responsive     | Tailwind @apply Klassen     | @media auf :root           | CSS-native Responsive-Tokens          |

---

## 13. Entfernte Legacy-Elemente & Korrekturen

Die folgenden Elemente wurden bei der Alignment-Refaktorierung entfernt oder korrigiert:

| Element               | Alter Wert    | Ersatz / Begruendung                     |
|-----------------------|---------------|------------------------------------------|
| `--ob-*` Alias-Block  | 20+ Aliases   | Direkte Token-Referenzen (`--color-*`)   |
| `--footer-height`     | 200px         | Nicht benoetigt (auto-height)            |
| `--brand-height`      | 80px          | Nicht benoetigt (auto-height)            |
| `--color-focus-input`  | #006699      | Einheitlich `--color-focus` (#8655F6)    |
| `--color-surface-dark` | #3e5060      | Korrigiert zu #2F4356 (secondary-600)    |
| `--color-surface-darker`| #2d3a44     | Korrigiert zu #263645 (secondary-700)    |
| `--color-badge-red-bg` | #FEE2E2      | Korrigiert zu #FAE1E2 (CD Bund red-100)  |
| `--color-badge-red-text`| #991B1B     | Korrigiert zu #99191E (CD Bund red-800)  |
| `var(--surface)`       | undefined     | Korrigiert zu `var(--color-bg-surface)`  |
| `var(--border)`        | undefined     | Korrigiert zu `var(--color-border)`      |
| `var(--text)`          | undefined     | Korrigiert zu `var(--color-text-primary)`|
| `var(--font-family-body)` | undefined  | Korrigiert zu `var(--font-family)`       |

Neue Tokens hinzugefuegt:
- Halb-Schritt-Abstaende (`--space-0-5`, `--space-1-5`, `--space-2-5`, `--space-3`)
- Kompakt-UI-Schriftgroessen (`--text-micro`, `--text-mini`, `--text-compact`)
- Alpha/Overlay-Tokens (`--color-white-*`, `--color-backdrop`, `--color-black-10`)
- Raumplanung-Palette und Schatten (`--color-rp-*`, `--shadow-rp-*`)
- Zusaetzliche Radien (`--radius-4xl`, `--radius-pill`)

---

## 14. Terminologie & Schreibkonventionen

### 14.1 Sprachregister

Die Anwendung richtet sich an **Mitarbeitende der Bundesverwaltung** (Facility Manager,
Beschaffungsstellen, Bueroplanende). Der Tonfall ist:

- **Institutionell**: Sachlich, klar, vertrauenswuerdig
- **Aufgabenorientiert**: Beschreibungen sagen, was man tun kann — nicht, was man entdecken soll
- **Nicht werblich**: Kein Marketing-Tonfall, keine Verkaufssprache

### 14.2 Verbotene Formulierungen

| Vermeiden             | Stattdessen verwenden           | Begruendung                              |
|-----------------------|---------------------------------|------------------------------------------|
| "Entdecken Sie..."    | Direkte Beschreibung            | Werblich, nicht aufgabenorientiert       |
| "Lassen Sie sich inspirieren" | Sachliche Beschreibung  | Marketing-Sprache                        |
| "stoebern"            | "suchen"                        | Zu umgangssprachlich                     |
| "Finden Sie..."       | Direkte Aufzaehlung             | Werblich                                 |
| "unser Sortiment"     | "Produkte" / "Mobiliar"         | Kein Ladengeschaeft                      |
| "Ihre Workspaces"     | "Arbeitsplaetze"                | Anglizismus vermeiden                    |
| "Kunden"              | "Bedarfsstellen" / "Nutzerorganisationen" | BBL hat keine Kunden im kommerziellen Sinn |

### 14.3 Bevorzugte Terminologie

| Bereich               | Bevorzugt                       | Vermeiden                        |
|-----------------------|---------------------------------|----------------------------------|
| Moebelbezeichnung     | "Mobiliar"                      | "Moebel" (informell)             |
| Zielgruppe intern     | "Bundesstellen" / "Bedarfsstellen" | "Kunden"                      |
| Bestellprozess        | "In den Warenkorb"              | "Bestellen" (impliziert Sofortkauf) |
| Planung               | "Belegungsplanung"              | "Arbeitsplaetze verwalten" (irreführend) |
| Englisch              | Deutsche Entsprechung           | Anglizismus (Workspace, etc.)    |
| Wiederverwendung      | "wiederverwenden"               | "weiternutzen" (unscharf)        |

### 14.4 Verbindliche Navigationslabels

| Ziel                  | Nav-Label                       | Breadcrumb                       | Seitentitel (h1)                 |
|-----------------------|---------------------------------|----------------------------------|----------------------------------|
| Produktkatalog        | Produktkatalog                  | Produktkatalog                   | (kein eigener h1)                |
| Arbeitsplaetze        | Arbeitsplaetze gestalten        | Arbeitsplaetze gestalten         | Arbeitsplaetze gestalten         |
| Belegungsplanung      | Belegungsplanung                | Belegungsplanung                 | Belegungsplanung (in Entwicklung)|
| Gebrauchte Moebel     | Gebrauchte Moebel               | Gebrauchte Moebel                | Gebrauchte Moebel                |
| Circular Sub-Seiten   | —                               | Gebrauchte Moebel > [Sub]        | [Sub-Titel]                      |
| Planung Sub-Seiten    | —                               | Arbeitsplaetze gestalten > [Sub] | [Sub-Titel]                      |

### 14.5 Schreibregeln

1. **Keine Possessivpronomen fuer Bundeseigentum**: "Bueroraeme" statt "Ihre Bueroraeme" —
   Raeme gehoeren der Organisation, nicht den Nutzenden.
2. **Infinitivkonstruktionen bevorzugen**: "Mobiliar bestellen, Raeme planen" statt
   "Bestellen Sie Mobiliar, planen Sie Raeme" — kuerzer, sachlicher.
3. **Zustand nur bei Circular-Produkten anzeigen**: Katalogprodukte sind per Definition neu.
   "Zustand: Neu" ist redundant und erzeugt eine falsche Parallele.
4. **Cookie-Banner wahrheitsgemess**: Nur technisch notwendige Cookies erwaehnen,
   wenn keine Marketing-/Tracking-Cookies vorhanden sind.
5. **Footer beschreibt den Service**: Nicht generische BBL-Beschreibung, sondern
   Bezug zur konkreten Plattform-Funktionalitaet.
