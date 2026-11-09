package com.brillio.listings.model;

import java.util.List;

public class ValidationException extends IllegalArgumentException {
    private final List<String> fields;

    public ValidationException(String message, String... fields) {
        super(message);
        this.fields = List.of(fields);
    }

    public List<String> getFields() {
        return fields;
    }
}
