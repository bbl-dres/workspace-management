# BBL Workspace Management – Requirements

## 1. Projektübersicht

**BBL Workspace Management** ist eine webbasierte Single-Page Application (SPA) für das
Bundesamt für Bauten und Logistik (BBL) der Schweizerischen Eidgenossenschaft.

Die Anwendung dient der Verwaltung, Bestellung und Planung von Büroarbeitsplätzen
in Bundesgebäuden. Sie richtet sich an Mitarbeitende der Bundesverwaltung.

### 1.1 Zielgruppe

- Büroplanende und Facility-Manager in Bundesgebäuden
- Beschaffungsstellen der Bundesverwaltung
- Mitarbeitende, die Mobiliar bestellen oder Circular-Objekte erfassen

### 1.2 Rahmenbedingungen

| Aspekt                | Vorgabe                                                 |
|-----------------------|---------------------------------------------------------|
| Design-System         | Modernes CD Bund (Oblique), **nicht** Legacy CD Bund    |
| Sprache UI            | Deutsch (de)                                            |
| Technologie           | Vanilla HTML / CSS / JavaScript – kein Framework        |
| Datenquelle           | Statische JSON-Dateien (`data/products.json`, etc.)     |
| Browser-Support       | Aktuelle Versionen von Chrome, Firefox, Edge, Safari    |
| Barrierefreiheit      | WCAG 2.1 AA angestrebt                                  |

---

## 2. Funktionale Anforderungen

### 2.1 Navigation & Routing

| ID    | Anforderung                                                                                       |
|-------|---------------------------------------------------------------------------------------------------|
| NAV-1 | Hash-basiertes SPA-Routing (`#/shop`, `#/product/{id}`, `#/planung`, `#/circular`)               |
| NAV-2 | Browser-Back/Forward funktioniert korrekt (popstate, hashchange)                                  |
| NAV-3 | 3-zeiliger CD-Bund-Header: Federal Bar, Brand Bar, Navigationsleiste                             |
| NAV-4 | Mega-Dropdown-Menüs für Hauptnavigationspunkte                                                   |
| NAV-5 | Breadcrumbs mit Chevron-Separatoren auf allen Unterseiten                                        |
| NAV-6 | Mobile Hamburger-Menü unter 768px                                                                |
| NAV-7 | Scroll-to-top bei Seitenwechsel                                                                  |
| NAV-8 | Kein Home-Button in der Navigation – Schweizer Wappen dient als Home-Link                        |
| NAV-9 | Keine sticky/fixed Elemente – globaler Page-Scrollbar                                            |

### 2.2 Produktkatalog (Shop)

| ID     | Anforderung                                                                                     |
|--------|-------------------------------------------------------------------------------------------------|
| SHOP-1 | Linke Sidebar mit hierarchischer Kategorie-Navigation (Baum mit expand/collapse)                |
| SHOP-2 | Responsive Produkt-Grid (`auto-fill, minmax(280px, 1fr)`)                                      |
| SHOP-3 | Produktkarten mit: SVG-Icon, Name, Beschreibung, Preis, Marke, Badges (Neu/Gebraucht)         |
| SHOP-4 | Textsuche über Name, Beschreibung und Marke mit Debounce (200ms)                               |
| SHOP-5 | Sortierung: Name A–Z / Z–A, Preis auf-/absteigend, Neuheiten zuerst                           |
| SHOP-6 | Anzeige der gefilterten Produktanzahl                                                           |
| SHOP-7 | Produkt-Detailseite (keine Modal) mit Breadcrumbs und URL `#/product/{id}`                     |
| SHOP-8 | Detailseite zeigt: grosses Icon, Name, Beschreibung, Meta-Tabelle, Preis, Bestell-Button       |
| SHOP-9 | Circular-Produkte werden im Shop **nicht** angezeigt (eigener Bereich)                          |

### 2.3 Büroplanung

| ID     | Anforderung                                                                                     |
|--------|-------------------------------------------------------------------------------------------------|
| PLAN-1 | Übersichtsseite mit Tiles: Stilwelten, Planungsbeispiele, CAD-Daten                            |
| PLAN-2 | Stilwelten-Karten mit farbigen Gradienten (6 Stile)                                            |
| PLAN-3 | Platzhalter für zukünftige Grundriss-App                                                       |

### 2.4 Circular-Hub

| ID     | Anforderung                                                                                     |
|--------|-------------------------------------------------------------------------------------------------|
| CIRC-1 | Übersichtsseite mit grünem Hero-Bereich und Tiles                                              |
| CIRC-2 | QR-Code/Inventar-Scanner (Eingabefeld mit Suche)                                               |
| CIRC-3 | Erfassungsformular für neue Circular-Objekte                                                   |
| CIRC-4 | Grid mit verfügbaren gebrauchten Möbeln (isCircular === true)                                  |
| CIRC-5 | Grüne Farbgebung (#3E8A27) als visuelle Abgrenzung                                             |

### 2.5 Startseite (Home)

| ID     | Anforderung                                                                                     |
|--------|-------------------------------------------------------------------------------------------------|
| HOME-1 | Statistik-Karten: Anzahl Produkte, Marken, Kategorien, Circular-Objekte                        |
| HOME-2 | Kacheln als Einstieg zu den drei Hauptbereichen                                                |
| HOME-3 | Neuheiten-Sektion mit Produktkarten                                                            |

---

## 3. Nicht-funktionale Anforderungen

### 3.1 Performance

| ID     | Anforderung                                                                                     |
|--------|-------------------------------------------------------------------------------------------------|
| PERF-1 | Keine Frameworks – leichtgewichtiger Vanilla-Stack                                              |
| PERF-2 | Async Laden der Daten via fetch() mit Promise.all                                              |
| PERF-3 | Debounced Search-Input (200ms)                                                                  |
| PERF-4 | Nur betroffene DOM-Bereiche aktualisieren (z.B. updateProductGrid)                             |

### 3.2 Barrierefreiheit (A11y)

| ID     | Anforderung                                                                                     |
|--------|-------------------------------------------------------------------------------------------------|
| A11Y-1 | Skip-Link "Zum Inhalt springen"                                                                |
| A11Y-2 | ARIA-Labels für interaktive Elemente (Buttons, Navigation, Tree)                               |
| A11Y-3 | aria-expanded auf Dropdowns und Hamburger                                                      |
| A11Y-4 | role="tree" / role="treeitem" für Kategorie-Baum                                               |
| A11Y-5 | Keyboard-Navigation (Enter/Space aktiviert Tiles und Cards)                                    |
| A11Y-6 | Focus-visible Styles auf interaktiven Elementen                                                |

### 3.3 Responsive Design

| ID     | Anforderung                                                                                     |
|--------|-------------------------------------------------------------------------------------------------|
| RES-1  | Breakpoints: 1100px, 768px, 480px                                                              |
| RES-2  | Sidebar wird unter 768px ausgeblendet                                                          |
| RES-3  | Grids passen sich an (4 → 2 → 1 Spalten für Stats, etc.)                                      |
| RES-4  | Hamburger-Menü ersetzt Navigation unter 768px                                                  |
| RES-5  | Produktdetail-Layout wechselt auf gestapelt (column) unter 768px                               |

---

## 4. Datenmodell

### 4.1 Produkt (`products.json`)

```json
{
  "id": 1,
  "name": "Barhocker Dietiker Ono",
  "description": "Designer This Weber, Holz/Leder schwarz",
  "price": 63.00,
  "currency": "CHF",
  "category": "stuehle",
  "subcategory": "barhocker",
  "brand": "Dietiker",
  "isNew": false,
  "isCircular": false
}
```

| Feld        | Typ     | Beschreibung                                     |
|-------------|---------|--------------------------------------------------|
| id          | number  | Eindeutige Produkt-ID                            |
| name        | string  | Produktbezeichnung                               |
| description | string  | Kurzbeschreibung                                 |
| price       | number  | Preis in CHF (monatlich oder Einzelpreis)        |
| currency    | string  | Währung (immer "CHF")                            |
| category    | string  | Oberkategorie (z.B. "stuehle", "tische")         |
| subcategory | string  | Unterkategorie (z.B. "buerostuehle")             |
| brand       | string  | Markenname                                       |
| isNew       | boolean | Neuheit-Flag                                     |
| isCircular  | boolean | Gebraucht-/Circular-Flag                         |

### 4.2 Kategorie (`categories.json`)

```json
{
  "id": "stuehle",
  "label": "Stühle",
  "children": [
    { "id": "buerostuehle", "label": "Bürostühle", "children": [] }
  ]
}
```

Hierarchie bis zu 3 Ebenen tief (z.B. Stühle → Fauteuil → Leder/Stoff).

---

## 5. Projektstruktur

```
workspace-management/
├── index.html              # HTML-Shell (Header, Footer, #app Container)
├── REQUIREMENTS.md         # Dieses Dokument
├── DESIGNGUIDE.md          # Design-System-Dokumentation
├── css/
│   ├── tokens.css          # Design Tokens (CSS Custom Properties)
│   └── style.css           # Alle Komponentenstile
├── js/
│   └── app.js              # SPA-Logik (Routing, Rendering, Events)
└── data/
    ├── products.json       # Produktdaten (40 Einträge)
    └── categories.json     # Kategorie-Baum (18 Oberkategorien)
```

---

## 6. Zukunft / Roadmap (Out-of-Scope für Prototyp)

- Warenkorbfunktion und Bestellprozess
- Authentifizierung / Login für Bundesverwaltung
- Backend-API (Ersatz für statische JSON)
- Grundriss-App (2D-Raumplaner im Browser)
- Multi-Language (FR, IT, EN neben DE)
- Print-Stylesheets für Bestelllisten
- PWA / Offline-Fähigkeit für Lager-Scan
