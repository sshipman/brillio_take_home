package com.brillio.listings.db;

import com.brillio.listings.model.Listing;
import com.brillio.listings.model.SearchCriteria;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class SqliteListingRepository {
    private final String jdbcUrl;
    private Connection keepAliveConnection;

    public SqliteListingRepository(String jdbcUrl) {
        this.jdbcUrl = jdbcUrl;
    }

    public void initializeAndSeed(String resourcePath) {
        try {
            // Keep a connection open if using an in-memory SQLite database so tables persist
            if (jdbcUrl.contains(":memory:") || jdbcUrl.contains("mode=memory")) {
                keepAliveConnection = DriverManager.getConnection(jdbcUrl);
            }
            try (Connection conn = getConnection();
                 Statement stmt = conn.createStatement()) {
                stmt.execute("""
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
                """);
            }

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

    public void saveAll(List<Listing> listings) throws SQLException {
        String sql = """
            INSERT OR REPLACE INTO listings (
                id, source, address, city, state, zip, price, bedrooms, bathrooms,
                sqft, latitude, longitude, listedDate, status, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            conn.setAutoCommit(false);
            for (Listing l : listings) {
                ps.setString(1, l.id());
                ps.setString(2, l.source());
                ps.setString(3, l.address());
                ps.setString(4, l.city());
                ps.setString(5, l.state());
                ps.setString(6, l.zip());
                ps.setDouble(7, l.price());
                ps.setInt(8, l.bedrooms());
                ps.setDouble(9, l.bathrooms());
                ps.setInt(10, l.sqft());
                ps.setDouble(11, l.latitude());
                ps.setDouble(12, l.longitude());
                ps.setString(13, l.listedDate());
                ps.setString(14, l.status());
                ps.setString(15, l.description());
                ps.addBatch();
            }
            ps.executeBatch();
            conn.commit();
        }
    }

    public List<Listing> findAll() {
        return findByCriteria(new SearchCriteria(null, null, null, null, null, null, 1, SearchCriteria.MAX_PAGE_SIZE));
    }

    public List<Listing> findByCriteria(SearchCriteria criteria) {
        StringBuilder sql = new StringBuilder("SELECT * FROM listings WHERE 1=1");
        List<Object> params = new ArrayList<>();

        if (criteria.minPrice() != null) {
            sql.append(" AND price >= ?");
            params.add(criteria.minPrice());
        }
        if (criteria.maxPrice() != null) {
            sql.append(" AND price <= ?");
            params.add(criteria.maxPrice());
        }
        if (criteria.minBedrooms() != null) {
            sql.append(" AND bedrooms >= ?");
            params.add(criteria.minBedrooms());
        }
        if (criteria.city() != null && !criteria.city().isBlank()) {
            sql.append(" AND LOWER(TRIM(city)) = ?");
            params.add(criteria.city().trim().toLowerCase(Locale.ROOT));
        }
        if (criteria.keyword() != null && !criteria.keyword().isBlank()) {
            String escapedKeyword = criteria.keyword().trim().toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
            sql.append(" AND LOWER(description) LIKE ? ESCAPE '\\'");
            params.add("%" + escapedKeyword + "%");
        }

        List<Listing> results = new ArrayList<>();
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++) {
                ps.setObject(i + 1, params.get(i));
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    results.add(new Listing(
                        rs.getString("id"),
                        rs.getString("source"),
                        rs.getString("address"),
                        rs.getString("city"),
                        rs.getString("state"),
                        rs.getString("zip"),
                        rs.getDouble("price"),
                        rs.getInt("bedrooms"),
                        rs.getDouble("bathrooms"),
                        rs.getInt("sqft"),
                        rs.getDouble("latitude"),
                        rs.getDouble("longitude"),
                        rs.getString("listedDate"),
                        rs.getString("status"),
                        rs.getString("description")
                    ));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to query listings from SQLite", e);
        }
        return results;
    }

    private Connection getConnection() throws SQLException {
        return DriverManager.getConnection(jdbcUrl);
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
