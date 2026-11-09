package com.brillio.listings.service;

import com.brillio.listings.db.SqliteListingRepository;
import com.brillio.listings.model.Listing;
import com.brillio.listings.model.PagedResult;
import com.brillio.listings.model.ScoredListing;
import com.brillio.listings.model.SearchCriteria;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

public class ListingSearchService {
    private final SqliteListingRepository repository;
    private final ScoringService scoringService;

    private static final Comparator<ScoredListing> RANKING_COMPARATOR = Comparator
        .comparingDouble(ScoredListing::relevanceScore).reversed()
        .thenComparing((ScoredListing s) -> LocalDate.parse(s.listing().listedDate()), Comparator.reverseOrder())
        .thenComparingDouble(s -> s.listing().price())
        .thenComparing(s -> s.listing().source())
        .thenComparing(s -> s.listing().id());

    public ListingSearchService(SqliteListingRepository repository, ScoringService scoringService) {
        this.repository = repository;
        this.scoringService = scoringService;
    }

    public PagedResult<ScoredListing> search(SearchCriteria criteria) {
        if (criteria == null) {
            throw new IllegalArgumentException("Search criteria must not be null.");
        }
        criteria.validate();

        List<Listing> allListings = repository.findAll();

        List<ScoredListing> ranked = allListings.stream()
            .filter(listing -> matches(listing, criteria))
            .map(listing -> new ScoredListing(listing, scoringService.score(listing, criteria.targetBudget())))
            .sorted(RANKING_COMPARATOR)
            .toList();

        int totalItems = ranked.size();
        int totalPages = totalItems == 0 ? 0 : (int) Math.ceil((double) totalItems / criteria.pageSize());

        int fromIndex = (criteria.page() - 1) * criteria.pageSize();
        List<ScoredListing> pageItems;
        if (fromIndex >= totalItems) {
            pageItems = List.of();
        } else {
            int toIndex = Math.min(fromIndex + criteria.pageSize(), totalItems);
            pageItems = ranked.subList(fromIndex, toIndex);
        }

        return new PagedResult<>(
            pageItems,
            criteria.page(),
            criteria.pageSize(),
            totalItems,
            totalPages
        );
    }

    private boolean matches(Listing listing, SearchCriteria criteria) {
        if (criteria.minPrice() != null && listing.price() < criteria.minPrice()) {
            return false;
        }
        if (criteria.maxPrice() != null && listing.price() > criteria.maxPrice()) {
            return false;
        }
        if (criteria.minBedrooms() != null && listing.bedrooms() < criteria.minBedrooms()) {
            return false;
        }
        if (criteria.city() != null && !criteria.city().isBlank()) {
            String targetCity = criteria.city().trim().toLowerCase(Locale.ROOT);
            String listingCity = listing.city() == null ? "" : listing.city().trim().toLowerCase(Locale.ROOT);
            if (!listingCity.equals(targetCity)) {
                return false;
            }
        }
        if (criteria.keyword() != null && !criteria.keyword().isBlank()) {
            String targetKeyword = criteria.keyword().trim().toLowerCase(Locale.ROOT);
            String description = listing.description() == null ? "" : listing.description().toLowerCase(Locale.ROOT);
            if (!description.contains(targetKeyword)) {
                return false;
            }
        }
        return true;
    }
}
