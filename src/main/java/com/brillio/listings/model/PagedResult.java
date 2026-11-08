package com.brillio.listings.model;

import java.util.List;

public record PagedResult<T>(
    List<T> items,
    int page,
    int pageSize,
    int totalItems,
    int totalPages
) {}
