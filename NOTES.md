# Live Session Preparation & Design Notes

## 1. Cross-Source Duplicate Listings & Price Discrepancies

### Observations in `sample_listings.json`
The sample dataset contains 4 cross-feed duplicate pairs (between `MLS_A` and `MLS_B`) where the same physical property has identical `(latitude, longitude, bedrooms, bathrooms, sqft)` and near-identical addresses, but **different asking prices and `listedDate` values**:

| Property | `MLS_A` Record | `MLS_B` Record | Price & Date Comparison |
| :--- | :--- | :--- | :--- |
| **123 Main St, Apt 4B** (Springfield) | `A1`: **$450,000** (`2026-08-29`) | `B7`: **$452,000** (`2026-08-27`) | -$2,000 lower on newer feed (`MLS_A`) |
| **456 Oak Ave** (Springfield) | `A2`: **$525,000** (`2026-09-02`, zip `22150`) | `B8`: **$527,500** (`2026-08-30`, zip `22151`) | -$2,500 lower on newer feed (`MLS_A`) |
| **789 Pine Rd** (Fairfax) | `A3`: **$399,000** (`2026-09-01`) | `B9`: **$399,500** (`2026-08-25`) | -$500 lower on newer feed (`MLS_A`) |
| **55 Elm Ct** (Vienna) | `A5`: **$470,000** (`2026-09-04`) | `B11`: **$465,000** (`2026-08-15`) | +$5,000 higher on newer feed (`MLS_A`), or $5,000 cheaper on `MLS_B` |

---

### UI Approaches for Surfacing Multi-Source Price Info

1. **Approach 1: "Also Listed On..." Cross-Reference Badge (Non-Deduplicated)**
   * Keep each listing as its own card (preserving pagination and total counts), and annotate cards that have a matching property from another MLS source:
     * e.g., *"Also on MLS_B (B7) for $452,000 (Listed 2026-08-27)"*
2. **Approach 2: Primary Listing Card + Source Comparison Strip (Deduplicated / Merged)**
   * If deduplicating, collapse matching properties into a single canonical card (e.g., newest `listedDate` or highest relevance score) and render a compact sub-list of all MLS feeds with their respective prices and dates so no pricing info is lost.
3. **Approach 3: Price Trend / Discrepancy Indicator (Preferred UI Pattern)**
   * Compare `listedDate` and `price` across matching MLS records to surface a chronological price delta pill on the card:
     * Example (`A1` vs `B7`): `📉 $2,000 lower than MLS_B ($452,000 on 2026-08-27)`
     * Example (`A5` vs `B11`): `📈 $5,000 higher than MLS_B ($465,000 on 2026-08-15)`
4. **Approach 4: Implementation Layer (Pure Frontend vs. Backend-Assisted)**
   * **Initial Preferred Approach — Pure Frontend + Price Trend Indicator:**
     * Group/match items in the React UI by physical property fingerprint (e.g., matching `latitude` + `longitude` + `bedrooms` + `sqft`, or normalized street address).
     * Compute the price delta and date comparison against sibling records and render the **Price Trend / Discrepancy Indicator** pill directly in the card component without altering the backend API contract or database queries.
     * *Trade-off to mention in interview:* Pure frontend matching is zero-touch on the backend API, though it only sees duplicates present in the current fetched payload (unless all matching candidates or `alternateSources` are attached by the backend across pages).
   * **Backend Alternative (if cross-page awareness is needed):**
     * Attach `List<SourceSummary> otherSources` to `ScoredListing` in `ListingSearchService` before pagination slices the list, so even if a duplicate lands on page 2, page 1's card still displays the price trend indicator.

---

## 2. Other Potential Live Requirements Spotted in `sample_listings.json`

* **Negated Pet Keywords in Descriptions:**
  * Several descriptions contain `"no pets"`, `"pets not permitted"`, `"Pet restrictions apply"`, or `"no pets due to HOA"`, while others say `"Pet friendly"`, `"Pets allowed"`, or `"Pets welcome"`.
  * Naive substring search for `"pet"` matches both positive and negated phrases.
* **Listing `status` Filtering:**
  * Most listings are `"active"`, while `A7` (Chantilly) is `"pending"` (and the schema notes `"active" | "pending" | "sold"`).
* **Geographic / Radius Search:**
  * Every listing includes `latitude` and `longitude`, enabling Haversine distance filtering or proximity ranking.

---

## 3. Two-Handled Price Range Slider & Non-Linear Scaling Approaches

### The Scaling Problem
A linear slider from `$0` to `$10,000,000` compresses the `$300k – $800k` range (where the vast majority of buyers shop) into ~5% of the track width, making the thumbs twitchy and hard to control.

### Approaches to Solve Scaling & Prevent `minPrice > maxPrice`

1. **Approach 1: Piecewise Linear ("Multi-Slope") Scale**
   * Divide the slider track `[0% .. 100%]` into segments with different step sizes:
     * `0% – 60%`: `$200k` to `$800k` (in `$10k` steps) — dedicates 60% of the physical track to the core market range.
     * `60% – 85%`: `$800k` to `$2.0M` (in `$50k` steps).
     * `85% – 100%`: `$2.0M` to `$5.0M+` (in `$250k` steps, where `100%` represents **"No Max"** / `undefined`).
   * *Pros:* Clean round dollar stops; wide control in the typical price band; unbounded top end.

2. **Approach 2: Data-Driven Bounds (`min` / `max` from Inventory)**
   * Derive slider bounds dynamically from the dataset (e.g., `$350k` to `$650k` in `$5k` steps, or via a `/api/listings/stats` endpoint), treating the extreme left/right ends as `"No Min"` / `"No Max"`.
   * *Pros:* Zero wasted track space.
   * *Cons:* A single luxury outlier (`$15M`) skews a linear scale unless paired with non-linear stops.

3. **Approach 3: Hybrid Dual-Thumb Slider + Synced Numeric Inputs**
   * Pair a two-handled slider (which clamps `min <= max` while dragging) with the editable `Min Price` and `Max Price` number boxes.
   * *Assessment Advantage:* The handout explicitly tests how the app handles invalid inputs like `minPrice > maxPrice`. Keeping the text inputs alongside the slider lets the user/interviewer type `minPrice = 600000` and `maxPrice = 400000` to exercise backend 400 validation and red field highlighting, while the slider prevents `min > max` during normal dragging.

4. **Approach 4: Curated Discrete Price Stops Array (Simplest Implementation)**
   * Map the slider directly to indices `0 .. N-1` of a curated array of price stops:
     ```ts
     const PRICE_STOPS = [
       0, 250_000, 300_000, 350_000, 375_000, 400_000, 425_000, 450_000, 475_000,
       500_000, 525_000, 550_000, 600_000, 650_000, 750_000, 1_000_000, 1_500_000,
       2_000_000, 3_000_000, 5_000_000
     ]
     ```
   * Index `0` maps to `minPrice = undefined` ("No Min") and the last index maps to `maxPrice = undefined` ("No Max").
   * *Pros:* Trivial to implement (`min=0`, `max=PRICE_STOPS.length - 1`, `step=1`), guarantees clean numbers, and gives fine `$25k` resolution around `$350k–$550k` while still reaching `$5M+`.

---

## 4. Localization (i18n / l10n) & Translation Strategy

### 1. Frontend UI String Externalization
* **Library / Mechanism:**
  * Use `react-i18next` (`i18next`) or `react-intl` (`FormatJS`) for full pluralization and interpolation support, or a lightweight typed dictionary hook `useTranslation()` backed by locale JSON bundles (`src/locales/en.json`, `src/locales/es.json`, etc.).
* **Strings to Externalize (`main.tsx` & `ListingsMap.tsx`):**
  * Header title/subtitle, form field labels (`Min Price ($)`, `Max Price ($)`, `Min Bedrooms`, `City`, `Description Keyword`, `Target Budget`, `Page Size`), input placeholders, and button labels (`Search Listings`, `Reset`, `Previous Page`, `Next Page`).
  * **Interpolated & Pluralized Strings:**
    * Summary count: `"Showing {{count}} of {{total}} matching listings (Page {{page}} of {{totalPages}})"`
    * Map pin badge: `"{{price}} ({{count}} sources)"` (handling singular vs. plural)
    * Empty state: `"No listings matched your search criteria in '{{city}}'."`
  * **Card Metadata & Enumerated Values:**
    * Labels (`Bedrooms`, `Bathrooms`, `Sqft`, `Listed`, `Status`, `Source`, `Score`).
    * Enumerated database values like `status` (`"active" | "pending" | "sold"`) mapped to translation keys (`status.active` -> `"Active"` / `"Activo"`).

### 2. Localizing Backend Validation Errors
* **Option A (Recommended): Machine-Readable Error Codes (`errorCode` + `fields`)**
  * Extend `ValidationException` on the backend to include a stable `errorCode` (e.g., `"ERR_MIN_GREATER_THAN_MAX"`, `"ERR_PAGE_SIZE_MAX"`, `"ERR_INVALID_NUMBER"`) alongside the fallback English `error` message and `fields`:
    ```json
    {
      "errorCode": "ERR_MIN_GREATER_THAN_MAX",
      "error": "minPrice cannot be greater than maxPrice.",
      "fields": ["minPrice", "maxPrice"]
    }
    ```
  * The frontend translates `t('errors.' + body.errorCode)` using the active locale, falling back to `body.error`.
* **Option B: Server-Side `Accept-Language` Resource Bundles**
  * Pass the `Accept-Language` header from the frontend and resolve localized error strings on the Java backend via `java.util.ResourceBundle` (`messages_en.properties`, `messages_es.properties`).

### 3. Locale-Aware Number, Currency, and Date Formatting (`Intl`)
* **Currency (`Intl.NumberFormat`):**
  ```ts
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(item.price)
  ```
* **Compact Map Pin Prices (`notation: 'compact'`):**
  ```ts
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', notation: 'compact' }).format(price)
  ```
* **Dates (`Intl.DateTimeFormat`):**
  * Format ISO `listedDate` (`YYYY-MM-DD`) via `new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })`.

### 4. Locale Selection & Third-Party MLS Data
* Add a language selector in `<header>` (defaulting to `navigator.language`), persisted in `localStorage` or URL search params, and sync `<html lang={locale}>`.
* Free-text MLS `description` fields are third-party user/agent content and remain in their source language unless paired with an on-demand translation API.
