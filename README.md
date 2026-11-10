# Property Listing Search Service

A full-stack property listing search application built with **Java 21 (Javalin + Jdbi 3 + SQLite)** on the backend and **React + TypeScript (Vite + TanStack Router + Leaflet)** on the frontend.

---

## Running the Application

### 1. Run Backend & Frontend Tests
```bash
# Backend JUnit 5 test suite
./gradlew test

# Frontend Vitest + React Testing Library suite
cd frontend
npm install
npm test
```

### 2. Start the Backend API Server (Port 8080)
```bash
./gradlew run
```
On startup, the backend initializes a local SQLite database (`listings.db`), creates the `listings` table (keyed by composite `(source, id)`), and seeds the dataset from `src/main/resources/sample_listings.json`.

### 3. Start the Frontend UI (Port 5173)
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser. Vite proxies `/api/*` requests to `http://localhost:8080`.

---

## Relevance Scoring & Ranking Approach

Each listing is scored in [`ScoringService`](src/main/java/com/brillio/listings/service/ScoringService.java) on a `0.00 – 100.00` scale using two signals:

1. **Recency Score (`[0.0, 1.0]`):**
   * Calculated relative to the current date via an injected `java.time.Clock` (enabling deterministic unit testing).
   * Uses exponential decay with a 90-day scale:
     $$\text{recencyScore} = e^{-\max(0, \text{daysOld}) / 90.0}$$
   * Exponential decay ensures newer listings always score strictly higher than older listings without hard cutoffs that zero out older inventory.

2. **Target Budget Proximity Score (`[0.0, 1.0]`):**
   * When `targetBudget` is provided, proximity is measured by relative percentage distance:
     $$\text{budgetScore} = \max\left(0.0, 1.0 - \frac{|\text{price} - \text{targetBudget}|}{\text{targetBudget}}\right)$$
   * **Combined Score:**
     * With `targetBudget`: `60% budgetScore + 40% recencyScore` (scaled to `0–100`, rounded to 2 decimal places).
     * Without `targetBudget`: `100% recencyScore`.

3. **Deterministic Tie-Breaking:**
   * If two listings produce the exact same `relevanceScore`, [`ListingSearchService`](src/main/java/com/brillio/listings/service/ListingSearchService.java) breaks ties deterministically by:
     1. `listedDate` (newest first)
     2. `price` (lowest first)
     3. `source` ascending, then `id` ascending

---

## Key Design Decisions & Trade-Offs

* **SQLite Filtering (Jdbi 3) + In-Application Scoring/Ranking:**
  * Listings are persisted in SQLite (`SqliteListingRepository`) with composite primary key `(source, id)` because `id` is only unique per MLS feed.
  * Filtering (`minPrice`, `maxPrice`, `minBedrooms`, case-insensitive `city`, and literal substring `INSTR` matching on `description`) is pushed down into SQLite using static named-parameter queries via Jdbi 3 (`findByCriteria`).
  * Relevance scoring (`ScoringService`) and deterministic tie-breaking/pagination (`ListingSearchService`) run in Java over the filtered candidate set so the `Clock`-based exponential recency decay remains clean, portable, and easy to unit-test or extend live.
* **Deliberate Validation & Field-Level Error Highlighting:**
  * Invalid inputs (`minPrice > maxPrice`, negative prices/bedrooms, `targetBudget <= 0`, `page < 1`, `pageSize <= 0`, or non-numeric query params) throw `ValidationException` and return `HTTP 400 Bad Request` with `{ "error": "...", "fields": [...] }`. The React UI displays an alert banner and highlights the specific offending input fields.
  * Valid queries that match zero listings (such as an unknown city) return `HTTP 200 OK` with an empty `items` array and `totalItems: 0`, rendered as a dedicated empty-results state in the UI.
* **Interactive Map & Co-Located Source Grouping (Leaflet + OpenStreetMap):**
  * Search results are displayed alongside an interactive OpenStreetMap view (`ListingsMap.tsx`) with zero API keys required.
  * Listings sharing identical coordinates across multiple MLS feeds are grouped into a single map pin displaying the lowest price and source count, with bidirectional selection between map pins and listing cards (`ListingCard.tsx` / `ListingsPane.tsx`).
* **URL-Driven Frontend State (TanStack Router):**
  * All search filters and pagination parameters (`minPrice`, `maxPrice`, `minBedrooms`, `city`, `keyword`, `targetBudget`, `page`, `pageSize`) are stored in validated URL search parameters via `@tanstack/react-router`.
* **Additional Design Notes:**
  * See [`NOTES.md`](NOTES.md) for further analysis of cross-source price discrepancies, non-linear price slider scaling, and localization (i18n/l10n) strategies.
