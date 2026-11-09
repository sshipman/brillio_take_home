package com.brillio.listings;

import com.brillio.listings.db.SqliteListingRepository;
import com.brillio.listings.model.SearchCriteria;
import com.brillio.listings.model.ValidationException;
import com.brillio.listings.service.ListingSearchService;
import com.brillio.listings.service.ScoringService;
import io.javalin.Javalin;
import io.javalin.http.Context;

import java.time.Clock;
import java.util.List;
import java.util.Map;

public class App {
    public static Javalin createApp(SqliteListingRepository repository, Clock clock) {
        ScoringService scoringService = new ScoringService(clock);
        ListingSearchService searchService = new ListingSearchService(repository, scoringService);

        Javalin app = Javalin.create(config -> {
            config.bundledPlugins.enableCors(cors -> cors.addRule(it -> it.anyHost()));
        });

        app.exception(ValidationException.class, (e, ctx) -> {
            ctx.status(400).json(Map.of(
                "error", e.getMessage(),
                "fields", e.getFields()
            ));
        });

        app.exception(IllegalArgumentException.class, (e, ctx) -> {
            ctx.status(400).json(Map.of(
                "error", e.getMessage(),
                "fields", List.of()
            ));
        });

        app.get("/api/health", ctx -> ctx.json(Map.of("status", "ok")));

        app.get("/api/listings", ctx -> {
            SearchCriteria criteria = parseSearchCriteria(ctx);
            ctx.json(searchService.search(criteria));
        });

        return app;
    }

    private static SearchCriteria parseSearchCriteria(Context ctx) {
        Double minPrice = parseOptionalDouble(ctx, "minPrice");
        Double maxPrice = parseOptionalDouble(ctx, "maxPrice");
        Integer minBedrooms = parseOptionalInt(ctx, "minBedrooms");
        String city = ctx.queryParam("city");
        String keyword = ctx.queryParam("keyword");
        Double targetBudget = parseOptionalDouble(ctx, "targetBudget");
        Integer page = parseOptionalInt(ctx, "page");
        Integer pageSize = parseOptionalInt(ctx, "pageSize");

        return new SearchCriteria(
            minPrice,
            maxPrice,
            minBedrooms,
            city,
            keyword,
            targetBudget,
            page != null ? page : SearchCriteria.DEFAULT_PAGE,
            pageSize != null ? pageSize : SearchCriteria.DEFAULT_PAGE_SIZE
        );
    }

    private static Double parseOptionalDouble(Context ctx, String paramName) {
        String raw = ctx.queryParam(paramName);
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Double.parseDouble(raw.trim());
        } catch (NumberFormatException e) {
            throw new ValidationException("Invalid numeric value for '" + paramName + "': " + raw, paramName);
        }
    }

    private static Integer parseOptionalInt(Context ctx, String paramName) {
        String raw = ctx.queryParam(paramName);
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            throw new ValidationException("Invalid integer value for '" + paramName + "': " + raw, paramName);
        }
    }

    public static void main(String[] args) {
        SqliteListingRepository repo = new SqliteListingRepository("jdbc:sqlite:listings.db");
        repo.initializeAndSeed("/sample_listings.json");

        Javalin app = createApp(repo, Clock.systemDefaultZone());
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        app.start(port);
    }
}
