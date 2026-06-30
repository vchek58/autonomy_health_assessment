package com.example.model;

import java.util.List;

public record Patient(
    String id,
    // Combination of name[use=official].given[0] and name[use=official].family
    String fullName,
    String familyName,       // name[use=official].family
    List<String> givenNames, // all entries in name[use=official].given
    String gender,
    String birthSex,         // extension[us-core-birthsex].valueCode — "M", "F", or "UNK"
    String birthDate,        // ISO-8601 date string e.g. "1961-02-11"
    String deceasedDate      // null if alive; ISO-8601 datetime from deceasedDateTime
) {}
