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
            throw new ValidationException("minPrice must be a non-negative number.", "minPrice");
        }
        if (maxPrice != null && (!Double.isFinite(maxPrice) || maxPrice < 0)) {
            throw new ValidationException("maxPrice must be a non-negative number.", "maxPrice");
        }
        if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
            throw new ValidationException("minPrice cannot be greater than maxPrice.", "minPrice", "maxPrice");
        }
        if (minBedrooms != null && minBedrooms < 0) {
            throw new ValidationException("minBedrooms must be a non-negative integer.", "minBedrooms");
        }
        if (targetBudget != null && (!Double.isFinite(targetBudget) || targetBudget <= 0)) {
            throw new ValidationException("targetBudget must be greater than zero.", "targetBudget");
        }
        if (page < 1) {
            throw new ValidationException("page must be at least 1.", "page");
        }
        if (pageSize <= 0) {
            throw new ValidationException("pageSize must be greater than zero.", "pageSize");
        }
        if (pageSize > MAX_PAGE_SIZE) {
            throw new ValidationException("pageSize cannot exceed " + MAX_PAGE_SIZE + ".", "pageSize");
        }
    }
}
