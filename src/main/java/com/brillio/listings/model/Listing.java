package com.brillio.listings.model;

public record Listing(
    String id,
    String source,
    String address,
    String city,
    String state,
    String zip,
    double price,
    int bedrooms,
    double bathrooms,
    int sqft,
    double latitude,
    double longitude,
    String listedDate,
    String status,
    String description
) {}
