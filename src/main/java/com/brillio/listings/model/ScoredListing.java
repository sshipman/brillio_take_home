package com.brillio.listings.model;

public record ScoredListing(
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
    String description,
    double relevanceScore
) {
    public static ScoredListing from(Listing listing, double relevanceScore) {
        return new ScoredListing(
            listing.id(),
            listing.source(),
            listing.address(),
            listing.city(),
            listing.state(),
            listing.zip(),
            listing.price(),
            listing.bedrooms(),
            listing.bathrooms(),
            listing.sqft(),
            listing.latitude(),
            listing.longitude(),
            listing.listedDate(),
            listing.status(),
            listing.description(),
            relevanceScore
        );
    }
}
