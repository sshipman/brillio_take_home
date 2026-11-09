package com.brillio.listings.db;

import com.brillio.listings.model.Listing;
import com.brillio.listings.model.SearchCriteria;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.mapper.reflect.ConstructorMapper;
import org.jdbi.v3.core.statement.PreparedBatch;

import java.io.InputStream;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.List;
import java.util.Locale;

public class SqliteListingRepository {
    private static final String CREATE_TABLE_SQL = """
        CREATE TABLE IF NOT EXISTS listings (
            id TEXT NOT NULL,
            source TEXT NOT NULL,
            address TEXT NOT NULL,
            city TEXT NOT NULL,
            state TEXT NOT NULL,
            zip TEXT NOT NULL,
            price REAL NOT NULL,
            bedrooms INTEGER NOT NULL,
            bathrooms REAL NOT NULL,
            sqft INTEGER NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            listedDate TEXT NOT NULL,
            status TEXT NOT NULL,
            description TEXT NOT NULL,
            PRIMARY KEY (source, id)
        )
    """;

    private static final String UPSERT_SQL = """
        INSERT OR REPLACE INTO listings (
            id, source, address, city, state, zip, price, bedrooms, bathrooms,
            sqft, latitude, longitude, listedDate, status, description
        ) VALUES (
            :id, :source, :address, :city, :state, :zip, :price, :bedrooms, :bathrooms,
            :sqft, :latitude, :longitude, :listedDate, :status, :description
        )
    """;

    private static final String FIND_BY_CRITERIA_SQL = """
        SELECT * FROM listings
        WHERE (:minPrice IS NULL OR price >= :minPrice)
          AND (:maxPrice IS NULL OR price <= :maxPrice)
          AND (:minBedrooms IS NULL OR bedrooms >= :minBedrooms)
          AND (:city IS NULL OR LOWER(TRIM(city)) = :city)
          AND (:keywordPattern IS NULL OR LOWER(description) LIKE :keywordPattern ESCAPE '\\')
    """;

    private final String jdbcUrl;
    private final Jdbi jdbi;
    private Connection keepAliveConnection;

    public SqliteListingRepository(String jdbcUrl) {
        this.jdbcUrl = jdbcUrl;
        this.jdbi = Jdbi.create(jdbcUrl);
        this.jdbi.registerRowMapper(ConstructorMapper.factory(Listing.class));
    }

    public void initializeAndSeed(String resourcePath) {
        try {
            // Keep a connection open if using an in-memory SQLite database so tables persist
            if (jdbcUrl.contains(":memory:") || jdbcUrl.contains("mode=memory")) {
                keepAliveConnection = DriverManager.getConnection(jdbcUrl);
            }
            jdbi.useHandle(handle -> handle.execute(CREATE_TABLE_SQL));

            if (resourcePath != null) {
                ObjectMapper mapper = new ObjectMapper();
                try (InputStream is = getClass().getResourceAsStream(resourcePath)) {
                    if (is == null) {
                        throw new IllegalStateException("Resource not found: " + resourcePath);
                    }
                    List<Listing> listings = mapper.readValue(is, new TypeReference<List<Listing>>() {});
                    saveAll(listings);
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize SQLite repository", e);
        }
    }

    public void saveAll(List<Listing> listings) {
        jdbi.useTransaction(handle -> {
            PreparedBatch batch = handle.prepareBatch(UPSERT_SQL);
            for (Listing listing : listings) {
                batch.bindMethods(listing).add();
            }
            batch.execute();
        });
    }

    public List<Listing> findAll() {
        return findByCriteria(new SearchCriteria(null, null, null, null, null, null, 1, SearchCriteria.MAX_PAGE_SIZE));
    }

    public List<Listing> findByCriteria(SearchCriteria criteria) {
        String normalizedCity = (criteria.city() == null || criteria.city().isBlank())
            ? null
            : criteria.city().trim().toLowerCase(Locale.ROOT);

        String keywordPattern = null;
        if (criteria.keyword() != null && !criteria.keyword().isBlank()) {
            String escaped = criteria.keyword().trim().toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
            keywordPattern = "%" + escaped + "%";
        }

        String finalKeywordPattern = keywordPattern;
        return jdbi.withHandle(handle ->
            handle.createQuery(FIND_BY_CRITERIA_SQL)
                .bind("minPrice", criteria.minPrice())
                .bind("maxPrice", criteria.maxPrice())
                .bind("minBedrooms", criteria.minBedrooms())
                .bind("city", normalizedCity)
                .bind("keywordPattern", finalKeywordPattern)
                .mapTo(Listing.class)
                .list()
        );
    }

    public void close() {
        if (keepAliveConnection != null) {
            try {
                keepAliveConnection.close();
            } catch (SQLException ignored) {
            }
        }
    }
}
