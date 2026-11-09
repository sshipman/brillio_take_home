package com.brillio.listings.service;

import com.brillio.listings.db.SqliteListingRepository;
import com.brillio.listings.model.Listing;
import com.brillio.listings.model.PagedResult;
import com.brillio.listings.model.ScoredListing;
import com.brillio.listings.model.SearchCriteria;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

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

        List<Listing> filteredListings = repository.findByCriteria(criteria);

        List<ScoredListing> ranked = filteredListings.stream()
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
}
