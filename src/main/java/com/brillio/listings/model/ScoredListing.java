package com.brillio.listings.model;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

public record ScoredListing(
    @JsonUnwrapped Listing listing,
    double relevanceScore
) {}
