package com.brillio.listings;

import com.brillio.listings.db.SqliteListingRepository;
import com.brillio.listings.model.Listing;
import com.brillio.listings.model.PagedResult;
import com.brillio.listings.model.ScoredListing;
import com.brillio.listings.model.SearchCriteria;
import com.brillio.listings.service.ListingSearchService;
import com.brillio.listings.service.ScoringService;
import io.javalin.Javalin;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

public class ListingSearchServiceTest {
    private SqliteListingRepository repo;
    private ScoringService scoringService;
    private ListingSearchService searchService;
    private Clock fixedClock;

    @BeforeEach
    void setUp() {
        String dbName = "testdb_" + UUID.randomUUID().toString().replace("-", "");
        repo = new SqliteListingRepository("jdbc:sqlite:file:" + dbName + "?mode=memory&cache=shared");
        repo.initializeAndSeed("/sample_listings.json");
        fixedClock = Clock.fixed(Instant.parse("2026-09-05T00:00:00Z"), ZoneOffset.UTC);
        scoringService = new ScoringService(fixedClock);
        searchService = new ListingSearchService(repo, scoringService);
    }

    @AfterEach
    void tearDown() {
        repo.close();
    }

    @Test
    void testUnfilteredSearchReturnsAllListingsRankedByRecency() {
        SearchCriteria criteria = new SearchCriteria(null, null, null, null, null, null, 1, 20);
        PagedResult<ScoredListing> result = searchService.search(criteria);

        assertEquals(12, result.totalItems());
        assertEquals(1, result.totalPages());
        assertEquals(12, result.items().size());

        // Without targetBudget, most recent listing (A5: 2026-09-04) ranks first
        assertEquals("A5", result.items().getFirst().listing().id());
        // Oldest listing (A7: 2026-07-28) ranks last
        assertEquals("A7", result.items().get(11).listing().id());
    }

    @Test
    void testFilterByPriceRangeAndMinBedrooms() {
        SearchCriteria criteria = new SearchCriteria(450000.0, 550000.0, 3, null, null, null, 1, 20);
        PagedResult<ScoredListing> result = searchService.search(criteria);

        assertFalse(result.items().isEmpty());
        for (ScoredListing item : result.items()) {
            Listing l = item.listing();
            assertTrue(l.price() >= 450000.0 && l.price() <= 550000.0);
            assertTrue(l.bedrooms() >= 3);
        }
    }

    @Test
    void testFilterByCityCaseInsensitiveAndTrimmed() {
        SearchCriteria criteria = new SearchCriteria(null, null, null, "  sPrInGfIeLd ", null, null, 1, 20);
        PagedResult<ScoredListing> result = searchService.search(criteria);

        assertEquals(4, result.totalItems());
        for (ScoredListing item : result.items()) {
            assertEquals("Springfield", item.listing().city());
        }
    }

    @Test
    void testFilterByKeywordCaseInsensitive() {
        SearchCriteria criteria = new SearchCriteria(null, null, null, null, "METRO", null, 1, 20);
        PagedResult<ScoredListing> result = searchService.search(criteria);

        assertEquals(2, result.totalItems());
        for (ScoredListing item : result.items()) {
            assertTrue(item.listing().description().toLowerCase().contains("metro"));
        }
    }

    @Test
    void testTargetBudgetAndRecencyRanking() {
        // Target budget of $450,000 in Springfield: A1 ($450k, 2026-08-29) vs B7 ($452k, 2026-08-27) vs A2 ($525k)
        SearchCriteria criteria = new SearchCriteria(null, null, null, "Springfield", null, 450000.0, 1, 10);
        PagedResult<ScoredListing> result = searchService.search(criteria);

        assertEquals(4, result.totalItems());
        assertEquals("A1", result.items().get(0).listing().id());
        assertEquals("B7", result.items().get(1).listing().id());
        assertTrue(result.items().get(0).relevanceScore() > result.items().get(1).relevanceScore());
        assertTrue(result.items().get(1).relevanceScore() > result.items().get(2).relevanceScore());
    }

    @Test
    void testTiedScoresBreakTiesDeterministically() throws Exception {
        String tieDb = "tiedb_" + UUID.randomUUID().toString().replace("-", "");
        SqliteListingRepository tieRepo = new SqliteListingRepository("jdbc:sqlite:file:" + tieDb + "?mode=memory&cache=shared");
        tieRepo.initializeAndSeed(null);

        Listing l1 = new Listing("Z9", "MLS_B", "1 Tie St", "Reston", "VA", "20190",
            500000, 3, 2.0, 1500, 38.9, -77.3, "2026-09-01", "active", "Tie test");
        Listing l2 = new Listing("A1", "MLS_A", "2 Tie St", "Reston", "VA", "20190",
            500000, 3, 2.0, 1500, 38.9, -77.3, "2026-09-01", "active", "Tie test");
        Listing l3 = new Listing("A2", "MLS_A", "3 Tie St", "Reston", "VA", "20190",
            500000, 3, 2.0, 1500, 38.9, -77.3, "2026-09-01", "active", "Tie test");
        tieRepo.saveAll(List.of(l1, l3, l2));

        ListingSearchService tieSearch = new ListingSearchService(tieRepo, scoringService);
        PagedResult<ScoredListing> result = tieSearch.search(
            new SearchCriteria(null, null, null, null, null, 500000.0, 1, 10)
        );

        assertEquals(3, result.items().size());
        assertEquals(result.items().get(0).relevanceScore(), result.items().get(1).relevanceScore());
        assertEquals("MLS_A:A1", result.items().get(0).listing().source() + ":" + result.items().get(0).listing().id());
        assertEquals("MLS_A:A2", result.items().get(1).listing().source() + ":" + result.items().get(1).listing().id());
        assertEquals("MLS_B:Z9", result.items().get(2).listing().source() + ":" + result.items().get(2).listing().id());
        tieRepo.close();
    }

    @Test
    void testNoMatchesForNonExistentCityReturnsEmptyResult() {
        SearchCriteria criteria = new SearchCriteria(null, null, null, "Atlantis", null, null, 1, 10);
        PagedResult<ScoredListing> result = searchService.search(criteria);

        assertEquals(0, result.totalItems());
        assertEquals(0, result.totalPages());
        assertTrue(result.items().isEmpty());
    }

    @Test
    void testPaginationBoundaries() {
        // 12 total items, pageSize = 5 -> page 1 has 5, page 2 has 5, page 3 has 2, page 4 has 0
        PagedResult<ScoredListing> page1 = searchService.search(new SearchCriteria(null, null, null, null, null, null, 1, 5));
        PagedResult<ScoredListing> page2 = searchService.search(new SearchCriteria(null, null, null, null, null, null, 2, 5));
        PagedResult<ScoredListing> page3 = searchService.search(new SearchCriteria(null, null, null, null, null, null, 3, 5));
        PagedResult<ScoredListing> page4 = searchService.search(new SearchCriteria(null, null, null, null, null, null, 4, 5));

        assertEquals(3, page1.totalPages());
        assertEquals(5, page1.items().size());
        assertEquals(5, page2.items().size());
        assertEquals(2, page3.items().size());
        assertEquals(0, page4.items().size());
        assertNotEquals(page1.items().getFirst().listing().id(), page2.items().getFirst().listing().id());
    }

    @Test
    void testInvalidFilterValuesThrowIllegalArgumentException() {
        // minPrice > maxPrice
        assertThrows(IllegalArgumentException.class, () ->
            searchService.search(new SearchCriteria(600000.0, 400000.0, null, null, null, null, 1, 10))
        );
        // negative minPrice
        assertThrows(IllegalArgumentException.class, () ->
            searchService.search(new SearchCriteria(-1.0, null, null, null, null, null, 1, 10))
        );
        // negative minBedrooms
        assertThrows(IllegalArgumentException.class, () ->
            searchService.search(new SearchCriteria(null, null, -2, null, null, null, 1, 10))
        );
        // non-positive targetBudget
        assertThrows(IllegalArgumentException.class, () ->
            searchService.search(new SearchCriteria(null, null, null, null, null, 0.0, 1, 10))
        );
        // page <= 0
        assertThrows(IllegalArgumentException.class, () ->
            searchService.search(new SearchCriteria(null, null, null, null, null, null, 0, 10))
        );
        // pageSize <= 0
        assertThrows(IllegalArgumentException.class, () ->
            searchService.search(new SearchCriteria(null, null, null, null, null, null, 1, 0))
        );
    }

    @Test
    void testApiReturns400OnInvalidQueryParameters() throws Exception {
        Javalin app = App.createApp(repo, fixedClock).start(0);
        try {
            HttpClient client = HttpClient.newHttpClient();

            // minPrice > maxPrice
            HttpRequest req1 = HttpRequest.newBuilder(
                URI.create("http://127.0.0.1:" + app.port() + "/api/listings?minPrice=600000&maxPrice=400000")
            ).GET().build();
            HttpResponse<String> resp1 = client.send(req1, HttpResponse.BodyHandlers.ofString());
            assertEquals(400, resp1.statusCode());
            assertTrue(resp1.body().contains("minPrice cannot be greater than maxPrice"));
            assertTrue(resp1.body().contains("\"fields\":[\"minPrice\",\"maxPrice\"]"));

            // pageSize <= 0
            HttpRequest req2 = HttpRequest.newBuilder(
                URI.create("http://127.0.0.1:" + app.port() + "/api/listings?pageSize=0")
            ).GET().build();
            HttpResponse<String> resp2 = client.send(req2, HttpResponse.BodyHandlers.ofString());
            assertEquals(400, resp2.statusCode());
            assertTrue(resp2.body().contains("pageSize must be greater than zero"));
            assertTrue(resp2.body().contains("\"fields\":[\"pageSize\"]"));

            // non-numeric minPrice
            HttpRequest req3 = HttpRequest.newBuilder(
                URI.create("http://127.0.0.1:" + app.port() + "/api/listings?minPrice=abc")
            ).GET().build();
            HttpResponse<String> resp3 = client.send(req3, HttpResponse.BodyHandlers.ofString());
            assertEquals(400, resp3.statusCode());
            assertTrue(resp3.body().contains("Invalid numeric value"));
            assertTrue(resp3.body().contains("\"fields\":[\"minPrice\"]"));
        } finally {
            app.stop();
        }
    }
}
