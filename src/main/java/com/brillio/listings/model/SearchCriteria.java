package com.brillio.listings.model;

public record SearchCriteria(
    Double minPrice,
    Double maxPrice,
    Integer minBedrooms,
    String city,
    String keyword,
    Double targetBudget,
    int page,
    int pageSize
) {
    public static final int DEFAULT_PAGE = 1;
    public static final int DEFAULT_PAGE_SIZE = 5;
    public static final int MAX_PAGE_SIZE = 100;

    public void validate() {
        if (minPrice != null && (!Double.isFinite(minPrice) || minPrice < 0)) {
            throw new IllegalArgumentException("minPrice must be a non-negative number.");
        }
        if (maxPrice != null && (!Double.isFinite(maxPrice) || maxPrice < 0)) {
            throw new IllegalArgumentException("maxPrice must be a non-negative number.");
        }
        if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
            throw new IllegalArgumentException("minPrice cannot be greater than maxPrice.");
        }
        if (minBedrooms != null && minBedrooms < 0) {
            throw new IllegalArgumentException("minBedrooms must be a non-negative integer.");
        }
        if (targetBudget != null && (!Double.isFinite(targetBudget) || targetBudget <= 0)) {
            throw new IllegalArgumentException("targetBudget must be greater than zero.");
        }
        if (page < 1) {
            throw new IllegalArgumentException("page must be at least 1.");
        }
        if (pageSize <= 0) {
            throw new IllegalArgumentException("pageSize must be greater than zero.");
        }
        if (pageSize > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("pageSize cannot exceed " + MAX_PAGE_SIZE + ".");
        }
    }
}
