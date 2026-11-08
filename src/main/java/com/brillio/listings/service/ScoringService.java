package com.brillio.listings.service;

import com.brillio.listings.model.Listing;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public class ScoringService {
    private final Clock clock;

    public ScoringService(Clock clock) {
        this.clock = clock;
    }

    /**
     * Computes a relevance score in the range [0.0, 100.0] based on proximity to
     * targetBudget and listing recency relative to the injected Clock.
     */
    public double score(Listing listing, Double targetBudget) {
        LocalDate today = LocalDate.now(clock);
        LocalDate listed = LocalDate.parse(listing.listedDate());
        long daysOld = Math.max(0, ChronoUnit.DAYS.between(listed, today));

        // Exponential decay with ~90-day scale so listings remain differentiated across months
        double recencyScore = Math.exp(-daysOld / 90.0);

        double combined;
        if (targetBudget != null && targetBudget > 0) {
            double diffRatio = Math.abs(listing.price() - targetBudget) / targetBudget;
            double budgetScore = Math.max(0.0, 1.0 - diffRatio);
            combined = (0.60 * budgetScore) + (0.40 * recencyScore);
        } else {
            combined = recencyScore;
        }

        return Math.round(combined * 10000.0) / 100.0;
    }
}
