package com.brillio.listings;

import com.brillio.listings.db.SqliteListingRepository;
import com.brillio.listings.service.ScoringService;
import io.javalin.Javalin;

import java.time.Clock;
import java.util.Map;

public class App {
    public static Javalin createApp(SqliteListingRepository repository, Clock clock) {
        ScoringService scoringService = new ScoringService(clock);

        Javalin app = Javalin.create(config -> {
            config.bundledPlugins.enableCors(cors -> cors.addRule(it -> it.anyHost()));
        });

        app.get("/api/health", ctx -> ctx.json(Map.of("status", "ok")));

        // Scaffolded endpoint - full search/filter/pagination implementation in next step
        app.get("/api/listings", ctx -> {
            var listings = repository.findAll().stream()
                .map(l -> com.brillio.listings.model.ScoredListing.from(l, scoringService.score(l, null)))
                .toList();
            ctx.json(new com.brillio.listings.model.PagedResult<>(
                listings, 1, listings.size(), listings.size(), 1
            ));
        });

        return app;
    }

    public static void main(String[] args) {
        SqliteListingRepository repo = new SqliteListingRepository("jdbc:sqlite:listings.db");
        repo.initializeAndSeed("/sample_listings.json");

        Javalin app = createApp(repo, Clock.systemDefaultZone());
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        app.start(port);
    }
}
