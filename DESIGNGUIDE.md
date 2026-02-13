# BBL Workspace Management – Design Guide

## Modernes CD Bund (Oblique)

Dieses Projekt folgt dem **modernen** Swiss Federal Design System (**Oblique**),
**nicht** dem Legacy CD Bund (Frutiger-basiert, Bootstrap).

| Aspekt           | Modern (Oblique)                                | Legacy CD Bund                       |
|------------------|-------------------------------------------------|--------------------------------------|
| Schriftart       | Noto Sans                                       | Frutiger                             |
| Framework        | Angular / Framework-agnostisch                  | Bootstrap 4                          |
| Referenz         | oblique.bit.admin.ch                            | swiss.github.io/styleguide           |
| Visueller Stil   | Flach, minimalistisch, grosse Weissräume        | Klassisch, dekorativ                 |
| GitHub           | github.com/oblique-bit/oblique                  | github.com/swiss/styleguide          |

**Wichtig**: Die beiden Systeme sind leicht zu verwechseln. Wir verwenden
ausschliesslich das moderne System (Oblique).

Referenz-Implementation: `kbob-fdk` (C:\Users\DavidRasner\Documents\GitHub\kbob-fdk)

---

## 1. Design-Prinzipien

### 1.1 Grundwerte der Bundesverwaltung

Die folgenden Grundwerte sind in den CD-Bund-Richtlinien verankert und bilden
die Basis für alle visuellen Entscheidungen:

> «Der einheitliche Einsatz der CD-Elemente sorgt für ein durchgängiges
> Erscheinungsbild über alle Webauftritte des Bundes. Er stellt sicher, dass
> eine Website sofort als Webauftritt des Bundes erkennbar ist. Gleichzeitig
> vermittelt er die Grundwerte der täglichen Arbeit der Bundesverwaltung:
> **Qualität, Effizienz und Transparenz.**»
>
> — CD Bund Richtlinien, Bundeskanzlei

### 1.2 Oblique Design-Prinzipien

Aus dem offiziellen Oblique-Repository (github.com/oblique-bit/oblique):

| Prinzip                | Beschreibung                                                                                              |
|------------------------|-----------------------------------------------------------------------------------------------------------|
| **Konsistenz**         | Einheitliches Erscheinungsbild über alle Bundesprojekte hinweg                                            |
| **Wartbarkeit**        | Code und Design müssen langfristig pflegbar sein                                                          |
| **Hohe Qualität**      | Anspruch an hochwertige Frontend-Entwicklung                                                              |
| **Design-to-Code**     | Strikte 1:1-Entsprechung zwischen Figma-Tokens und CSS-Variablen – eine gemeinsame «Single Source of Truth» |
| **Minimale Abweichung**| Abweichungen von Oblique-Standards minimieren, um Upgrade-Komplexität zu reduzieren                       |

### 1.3 Angewandte Prinzipien (Projekt)

Abgeleitet aus den offiziellen Vorgaben für dieses Projekt:

| Prinzip            | Umsetzung                                                                   |
|--------------------|-----------------------------------------------------------------------------|
| **Klarheit**       | Informationshierarchie durch konsistente Typografie und Abstände            |
| **Barrierefreiheit** | WCAG 2.1 AA als Mindeststandard (gesetzlich verankert via BehiG)          |
| **Vertrauen**      | Offizielle Ästhetik, die Seriosität und Zuverlässigkeit vermittelt         |
| **Effizienz**      | Aufgabenorientierte Oberflächen, die kognitive Belastung minimieren        |
| **Konsistenz**     | Einheitliche visuelle Sprache über alle Bereiche (Shop, Planung, Circular) |

---

## 2. Verbindliche CD-Elemente

### 2.1 Element-Klassifikation

Das CD Bund definiert drei Kategorien von Design-Elementen:

| Kategorie               | Beschreibung                            | Beispiele                                                |
|--------------------------|-----------------------------------------|----------------------------------------------------------|
| **Corporate (CD)**       | Pflicht, nicht veränderbar              | Logo/Wappen, roter Strich, Farbpalette, Schrift, Footer  |
| **Fixed (FIX)**          | Pflicht, Platzierung vorgegeben         | Header, Navigation, Breadcrumb, Suche, Sprachwechsel     |
| **Flexible (FLEX)**      | Optional, konfigurierbar               | Facetten-Navigation, Galerien, Kontaktboxen              |

### 2.2 Nicht veränderbare Elemente

Diese CD-Elemente dürfen **nicht modifiziert** werden:

1. **Logo & Bezeichnung** — Schweizer Wappen mit viersprachigem Text,
   Name der Organisationseinheit, graue Trennlinie
2. **Roter Strich** — Aktiver Navigationsindikator (#DC0018)
3. **Farbpalette** — Rot für Selektion, Blau (#006699) für Text-Links,
   Grautöne für Text und Hintergründe
4. **Typografie** — Noto Sans (modernes CD Bund)
5. **Footer** — Einheitliche Fusszeile mit Copyright und rechtlichen Hinweisen

### 2.3 Farbregeln

| Farbe             | Verwendung                                                    |
|--------------------|--------------------------------------------------------------|
| **Schweizer Rot**  | Header-Linie, Navigations-Selektion, Hover auf Links        |
| **Interaktions-Blau** | Standard-Linkfarbe, primäre Buttons                       |
| **Grautöne**       | Text, Hintergründe, Borders – je nach Hierarchie            |

---

## 3. Design-Token-Architektur

### 3.1 Drei-Stufen-System (Oblique)

Oblique definiert Design Tokens auf drei Ebenen:

| Stufe           | Beschreibung                                  | Nutzung                        |
|-----------------|-----------------------------------------------|--------------------------------|
| **Primitive**   | Rohe Werte (z.B. exakte Hex-Codes)           | Nur intern                     |
| **Semantic**    | Bedeutungsvolle Referenzen auf Primitives     | Projektverwendung, CSS-Variablen |
| **Component**   | Referenzen auf Semantic Tokens                | Komponentenstile               |

### 3.2 Token-Namenskonvention

Oblique: `--ob-[scope]-[category]-[property]-[variant]`

Projekt (vereinfacht): `--{kategorie}-{eigenschaft}-{variante}`

```
--color-primary-dark      Semantischer Farbtoken
--text-body-sm            Typografie-Token
--space-xl                Abstands-Token
--font-weight-bold        Schriftschnitt-Token
```

### 3.3 Modes-System

> «Modes sind ein Mechanismus, um die Werte einer Sammlung verwandter Tokens
> bedingt zu ändern.»
> — Oblique Design System

Gesteuert über CSS-Klassen und Media Queries. Ermöglicht Features wie
Dark Mode ohne zusätzlichen Entwicklungsaufwand. (Im aktuellen Prototyp
noch nicht implementiert.)

### 3.4 Unsere Token-Datei

Alle visuellen Werte in **`css/tokens.css`** als CSS Custom Properties.
`style.css` importiert `tokens.css` und referenziert die Tokens.

---

## 4. Design Tokens (Referenz)

Alle visuellen Werte sind als CSS Custom Properties in **`css/tokens.css`** definiert.
Komponentenstile in `style.css` referenzieren diese Tokens.

### 4.1 Farbpalette

#### Markenfarben (Brand)

| Token                     | Wert      | Verwendung                         |
|---------------------------|-----------|-------------------------------------|
| `--color-accent`          | `#DC0018` | Schweizer Rot – aktive Nav-Linie, Badges |
| `--color-accent-light`    | `#F7001D` | Hover-Variante                     |
| `--color-accent-dark`     | `#B00014` | Dunkle Variante                    |

#### Primärfarben (Interactive)

| Token                     | Wert      | Verwendung                         |
|---------------------------|-----------|-------------------------------------|
| `--color-primary`         | `#006699` | Links, Buttons, aktive Zustände    |
| `--color-primary-hover`   | `#005580` | Button Hover                       |
| `--color-primary-light`   | `#E6F0F7` | Badge-Hintergründe, Ghost-Button   |
| `--color-primary-dark`    | `#004B6E` | Pressed-State                      |

#### Neutralfarben

| Token                     | Wert      | Verwendung                         |
|---------------------------|-----------|-------------------------------------|
| `--color-gray-50`         | `#FAFAFA` | Subtilster Hintergrund             |
| `--color-gray-100`        | `#F5F5F5` | Alternativer Hintergrund           |
| `--color-gray-200`        | `#E0E0E0` | Borders, Trennlinien               |
| `--color-gray-300`        | `#BDBDBD` | Input-Borders, Divider             |
| `--color-gray-400`        | `#9E9E9E` | Placeholder, Counts                |
| `--color-gray-500`        | `#757575` | Sekundärtext, Labels               |
| `--color-gray-600`        | `#474747` | Nav-Text, Beschreibungen           |
| `--color-gray-800`        | `#262626` | Primärtext, Überschriften          |

#### Semantische Textfarben

| Token                     | Wert      | Verwendung                         |
|---------------------------|-----------|-------------------------------------|
| `--color-text-primary`    | `#1a2a3a` | Haupttext                          |
| `--color-text-secondary`  | `#4a5568` | Beschreibungen                     |
| `--color-text-muted`      | `#718096` | Deaktivierter / Hilfstext          |
| `--color-text-inverse`    | `#FFFFFF` | Text auf dunklem Hintergrund       |

#### Oberflächen

| Token                     | Wert      | Verwendung                         |
|---------------------------|-----------|-------------------------------------|
| `--color-surface-dark`    | `#3e5060` | Federal Bar, Footer                |
| `--color-surface-darker`  | `#2d3a44` | Footer-Unterzeile                  |
| `--color-bg-default`      | `#FFFFFF` | Standard-Hintergrund               |
| `--color-bg-alt`          | `#F5F5F5` | Alternativhintergrund              |

#### Statusfarben

| Token                     | Wert      | Verwendung                         |
|---------------------------|-----------|-------------------------------------|
| `--color-success`         | `#3E8A27` | Erfolg, Circular-Hub Grün          |
| `--color-success-light`   | `#E8F5E3` | Erfolg-Hintergrund                 |
| `--color-warning`         | `#E89F00` | Warnung                            |
| `--color-warning-light`   | `#FCF8E3` | Warnung-Hintergrund                |
| `--color-error`           | `#C4161C` | Fehler                             |
| `--color-error-light`     | `#F2DEDE` | Fehler-Hintergrund                 |
| `--color-info`            | `#31708F` | Information                        |
| `--color-info-light`      | `#D9EDF7` | Info-Hintergrund                   |

---

### 4.2 Typografie

**Schriftart**: Noto Sans (Google Fonts)

```css
font-family: "Noto Sans", "Helvetica Neue", Arial, sans-serif;
```

#### Typografie-Skala (Major Third, Faktor 1.25)

| Token           | Grösse    | Pixel | Verwendung                       |
|-----------------|-----------|-------|----------------------------------|
| `--text-display`| 2.25rem   | 36px  | Hero-Titel                       |
| `--text-h1`     | 1.75rem   | 28px  | Seitentitel                      |
| `--text-h2`     | 1.5rem    | 24px  | Sektionsüberschriften            |
| `--text-h3`     | 1.25rem   | 20px  | Kartenüberschriften              |
| `--text-h4`     | 1.125rem  | 18px  | Unterüberschriften               |
| `--text-h5`     | 1rem      | 16px  | Kleine Überschriften             |
| `--text-body`   | 1rem      | 16px  | Fliesstext                       |
| `--text-body-sm`| 0.875rem  | 14px  | Kompakter Text, Labels           |
| `--text-body-xs`| 0.6875rem | 11px  | Federal Bar Text, Wappen-Text    |
| `--text-caption`| 0.75rem   | 12px  | Bildunterschriften, Badges       |
| `--text-label`  | 0.875rem  | 14px  | Formular-Labels                  |

#### Schriftschnitte

| Token                     | Wert | Verwendung                       |
|---------------------------|------|----------------------------------|
| `--font-weight-normal`    | 400  | Fliesstext                       |
| `--font-weight-medium`    | 500  | Produktnamen, Links              |
| `--font-weight-semibold`  | 600  | Buttons, Labels, Überschriften   |
| `--font-weight-bold`      | 700  | Preise, Hauptüberschriften       |

#### Zeilenhöhen

| Token                     | Wert | Verwendung                       |
|---------------------------|------|----------------------------------|
| `--line-height-tight`     | 1.2  | Überschriften                    |
| `--line-height-snug`      | 1.3  | Federal-Bar-Text                 |
| `--line-height-normal`    | 1.5  | Fliesstext (Standard)            |
| `--line-height-relaxed`   | 1.6  | Beschreibungen                   |

---

### 4.3 Abstände (Spacing)

Basis: **4px** Einheit.

| Token          | Wert  | Verwendung                       |
|----------------|-------|----------------------------------|
| `--space-xs`   | 4px   | Minimaler Abstand                |
| `--space-sm`   | 8px   | Gap zwischen kleinen Elementen   |
| `--space-md`   | 16px  | Standard-Padding / Gap           |
| `--space-lg`   | 24px  | Zwischen Sektionen               |
| `--space-xl`   | 32px  | Container-Padding, grosse Gaps   |
| `--space-2xl`  | 48px  | Sektions-Padding                 |
| `--space-3xl`  | 64px  | Page-Hero-Padding                |
| `--space-4xl`  | 80px  | Maximaler Abstand                |

---

### 4.4 Layout

| Token                     | Wert    | Verwendung                       |
|---------------------------|---------|----------------------------------|
| `--container-max-width`   | 1564px  | Maximale Inhaltsbreite           |
| `--container-padding`     | 32px    | Horizontales Padding             |
| `--grid-gutter`           | 24px    | Grid-Abstand                     |
| `--sidebar-width`         | 260px   | Kategorie-Sidebar                |

---

## 5. Header-Struktur (CD Bund)

Der Header folgt dem 3-zeiligen admin.ch-Muster:

```
┌──────────────────────────────────────────────────────────────┐
│ FEDERAL BAR (#3e5060, 46px)                                  │
│ "Alle Schweizer Bundesbehörden"                    "DE" ▾    │
├──────────────────────────────────────────────────────────────┤
│ BRAND BAR (weiss, ~100px)                                    │
│ [🇨🇭] Schweizerische Eidgenossenschaft │ BBL    [Suche 🔍]  │
│      Confédération suisse               │                    │
│      Confederazione Svizzera            │                    │
│      Confederaziun svizra               │                    │
├──────────────────────────────────────────────────────────────┤
│ NAV BAR (weiss, 64px, border top+bottom)                     │
│ Produktkatalog ▾    Büroplanung ▾    Circular-Hub ▾          │
│ ═══════════════ (roter aktiver Strich, 3px, #DC0018)         │
└──────────────────────────────────────────────────────────────┘
```

### 5.1 Federal Bar

- Hintergrund: `--color-surface-dark` (#3e5060)
- Höhe: `--topbar-height` (46px)
- Text: weiss, 14px, font-weight 400
- Inhalt links: "Alle Schweizer Bundesbehörden" mit Chevron
- Inhalt rechts: Sprachkürzel "DE" mit Chevron

### 5.2 Brand Bar

- Hintergrund: weiss
- Padding: 24px 32px
- Links: Wappen (34px) + Viersprachiger Text (11px) + Divider (1px, 60px hoch) + Departement (16px bold)
- Rechts: Suche-Button
- Wappen fungiert als Home-Link

### 5.3 Navigation Bar

- Höhe: `--nav-height` (64px)
- Border oben und unten: 1px solid `--color-gray-200`
- Aktiver Tab: `::after` Pseudo-Element, 3px Höhe, `--color-accent` (#DC0018)
- Hover: Text wird `--color-primary`
- Dropdown-Trigger mit animiertem Chevron (rotate 180° bei open)

---

## 6. Komponenten

### 6.1 Mega-Dropdown

- Position: absolute, unter Nav-Item
- Border-top: 2px solid `--color-primary`
- Padding: 28px 36px
- Animation: fadeIn 150ms
- Min-width: 680px (Desktop)
- Sektionsüberschriften: 13px uppercase, primary-Farbe
- Links: 14px, gray-600, hover → primary mit 4px padding-left Shift

### 6.2 Produkt-Karte

```
┌─────────────────────┐
│                     │  ← Bild-Bereich (200px Höhe, gray-100 BG)
│    [SVG Icon]       │     Badges oben rechts (Neu/Gebraucht)
│                     │
├─────────────────────┤
│ Produktname         │  ← 14px, medium, primary-Farbe
│ Beschreibung        │  ← 12px, gray-500
│ CHF 180.00          │  ← 15px, bold, gray-800
├─────────────────────┤
│ Marke    [Bestellen]│  ← 11px grau | Primary Button sm
└─────────────────────┘
```

- Border: 1px solid gray-200
- Border-radius: 4px
- Hover: border primary, shadow, translateY(-2px)
- Cursor: pointer (ganze Karte klickbar)
- Grid: `repeat(auto-fill, minmax(280px, 1fr))`

### 6.3 Breadcrumbs

```
Produkte › Stühle › Bürostühle › Produktname
```

- Separator: Chevron-Right SVG (14px)
- Font-size: 14px
- Letzte Position: gray-800 (nicht verlinkt)
- Links: gray-600, hover → primary

### 6.4 Buttons

| Variante      | Klasse           | Stil                                    |
|---------------|------------------|-----------------------------------------|
| Primary       | `.btn--primary`  | BG primary, Text weiss                  |
| Outline       | `.btn--outline`  | Border gray-300, Text gray-600          |
| Ghost         | `.btn--ghost`    | Kein Border, Text primary               |
| Green         | `.btn--green`    | BG success (#3E8A27), Text weiss        |
| Small         | `.btn--sm`       | Padding 5px 10px, Font 12px             |

Alle Buttons: border-radius 4px, font-weight 600, transition 150ms.

### 6.5 Kategorie-Baum (Sidebar)

- Radio-Button-Style für aktive Kategorie
- Expand/Collapse mit rotierendem Chevron (90°)
- Einrückung pro Ebene: +28px padding-left
- Max 3 Ebenen
- Animierte max-height Transition (350ms cubic-bezier)

### 6.6 Footer

- Hintergrund: `--color-surface-dark` (#3e5060)
- Text: rgba(255,255,255,0.7)
- Links: gleiche Farbe, hover → weiss
- Inhalt: Copyright + Impressum/Rechtliches/Barrierefreiheit/Kontakt

---

## 7. Responsive Breakpoints

| Breakpoint | Anpassungen                                                     |
|------------|------------------------------------------------------------------|
| ≤ 1100px   | Stats-Grid: 4 → 2 Spalten                                      |
| ≤ 768px    | Hamburger-Menü statt Inline-Nav                                 |
|            | Sidebar ausgeblendet                                            |
|            | Tile-Grid: 3 → 1 Spalte                                        |
|            | Stilwelt-Grid: 3 → 1 Spalte                                    |
|            | Produktdetail: Row → Column                                    |
|            | Federal-Bar: kleinere Schrift                                   |
|            | Brand-Bar: Divider ausgeblendet                                |
| ≤ 480px    | Stats-Grid: 2 → 1 Spalte                                       |
|            | Toolbar: Column-Layout                                         |
|            | Wappen verkleinert (28px)                                      |

---

## 8. Interaktionsmuster

### 8.1 Seitenübergänge

- Fade-in Animation (250ms) bei Seitenwechsel
- Smooth scroll-to-top bei Navigation

### 8.2 Hover-Effekte

- Karten: translateY(-2px) + Schatten + Border-Farbe Primary
- Links: Farbe → Primary, text-decoration je nach Kontext
- Dropdown-Links: padding-left +4px Shift
- Nav-Buttons: Textfarbe → Primary

### 8.3 Focus-Stile

- Outline: 2px solid primary, offset 2px
- Sichtbar nur bei Keyboard-Navigation (:focus-visible)

### 8.4 Dropdown-Verhalten

- Klick öffnet/schliesst
- Klick ausserhalb schliesst alle
- Escape-Taste schliesst alle
- Chevron rotiert bei geöffnetem Zustand

---

## 9. Barrierefreiheit

### 9.1 Strukturelle Semantik

- `<header role="banner">` für Site-Header
- `<nav aria-label="Hauptnavigation">` für Navigation
- `<main id="mainContent">` für Hauptinhalt
- `<footer>` für Footer
- Skip-Link als erstes Element im Body

### 9.2 ARIA-Attribute

```html
<!-- Dropdown -->
<button aria-expanded="false" aria-haspopup="true">Produktkatalog ▾</button>

<!-- Kategorie-Baum -->
<div role="tree">
  <div role="treeitem" aria-expanded="true" tabindex="0">Stühle</div>
</div>

<!-- Produktkarte -->
<div role="button" tabindex="0" aria-label="Bürostuhl Giroflex 64">...</div>
```

### 9.3 Rechtliche Grundlage

> «Alle Internet-Angebote des Bundes müssen so gestaltet sein, dass
> Menschen mit Behinderungen sie ohne Einschränkung nutzen können.»
> — CD Bund Richtlinien

**Massgebliche Standards:**
- Behindertengleichstellungsgesetz (BehiG)
- P028-Richtlinien des Bundes für barrierefreie Webangebote
- Web Content Accessibility Guidelines (WCAG) 2.1, Konformitätsstufe AA
- WAI-ARIA 1.0

### 9.4 Kontrastverhältnisse

Die Farbkombinationen sind auf WCAG AA Kontrast (4.5:1 für Text) ausgelegt:

| Kombination                | Verhältnis | Status |
|----------------------------|-----------|--------|
| gray-800 auf weiss         | ~14:1     | AAA    |
| primary (#006699) auf weiss| ~5.5:1    | AA     |
| weiss auf surface-dark     | ~7:1      | AAA    |
| gray-500 auf weiss         | ~4.6:1    | AA     |

---

## 10. Datei-Konventionen

### 10.1 CSS-Naming

BEM-artige Konvention:

```
.block                     → .product-card
.block__element             → .product-card__image
.block__element--modifier   → .product-card__badge--new
```

### 10.2 CSS Custom Properties

Siehe Abschnitt 3.2 (Token-Namenskonvention).

### 10.3 Dateistruktur

- `tokens.css`: Nur `:root`-Variablen, keine Selektoren
- `style.css`: Importiert `tokens.css`, enthält alle Komponentenstile
- `app.js`: Gesamte SPA-Logik in einer Datei (Routing, Rendering, Events)
