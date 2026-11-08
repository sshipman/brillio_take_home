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
) {}
