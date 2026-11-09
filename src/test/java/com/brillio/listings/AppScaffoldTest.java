package com.brillio.listings;

import com.brillio.listings.db.SqliteListingRepository;
import io.javalin.Javalin;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class AppScaffoldTest {
    @Test
    void testSqliteSeedAndHealthEndpoint() throws Exception {
        SqliteListingRepository repo = new SqliteListingRepository("jdbc:sqlite:file:testdb?mode=memory&cache=shared");
        repo.initializeAndSeed("/sample_listings.json");
        assertEquals(12, repo.findAll().size());

        Clock fixedClock = Clock.fixed(Instant.parse("2026-09-05T00:00:00Z"), ZoneOffset.UTC);
        Javalin app = App.createApp(repo, fixedClock).start(0);

        try {
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest req = HttpRequest.newBuilder(
                URI.create("http://127.0.0.1:" + app.port() + "/api/listings?pageSize=20")
            ).GET().build();
            HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
            assertEquals(200, resp.statusCode());
            assertTrue(resp.body().contains("\"totalItems\":12"));
            assertTrue(resp.body().contains("\"address\":\"123 Main St, Apt 4B\""));
            assertTrue(resp.body().contains("\"relevanceScore\":"));
        } finally {
            app.stop();
            repo.close();
        }
    }
}
