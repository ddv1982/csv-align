use csv_align::data::{
    ColumnMapping, ComparisonSummary, MappingType, RowComparisonResult, ValueDifference,
};
use csv_align::presentation::{compare_response, suggest_mappings_response};
use serde_json::json;

#[test]
fn presentation_suggest_mappings_payload_shape_is_stable() {
    let mappings = vec![
        ColumnMapping {
            file_a_column: "id".to_string(),
            file_b_column: "ID".to_string(),
            mapping_type: MappingType::ExactMatch,
        },
        ColumnMapping {
            file_a_column: "postal_code".to_string(),
            file_b_column: "zipCode".to_string(),
            mapping_type: MappingType::FuzzyMatch(0.82),
        },
    ];

    let response = suggest_mappings_response(&mappings);

    assert_eq!(
        serde_json::to_value(response).unwrap(),
        json!({
            "mappings": [
                {
                    "file_a_column": "id",
                    "file_b_column": "ID",
                    "mapping_type": "exact",
                    "similarity": null
                },
                {
                    "file_a_column": "postal_code",
                    "file_b_column": "zipCode",
                    "mapping_type": "fuzzy",
                    "similarity": 0.82
                }
            ]
        })
    );
}

#[test]
fn presentation_compare_payload_shape_is_stable_for_each_result_variant() {
    assert_compare_shape(
        RowComparisonResult::Match {
            key: vec!["1".to_string()],
            values_a: vec!["Alice".to_string()],
            values_b: vec!["Alice".to_string()],
        },
        json!({
            "success": true,
            "results": [{
                "result_type": "match",
                "key": ["1"],
                "values_a": ["Alice"],
                "values_b": ["Alice"],
                "duplicate_values_a": [],
                "duplicate_values_b": [],
                "differences": []
            }],
            "summary": default_summary_json()
        }),
    );

    assert_compare_shape(
        RowComparisonResult::Mismatch {
            key: vec!["1".to_string()],
            values_a: vec!["Alice".to_string()],
            values_b: vec!["Alicia".to_string()],
            differences: vec![ValueDifference {
                column_a: "name".to_string(),
                column_b: "full_name".to_string(),
                value_a: "Alice".to_string(),
                value_b: "Alicia".to_string(),
            }],
        },
        json!({
            "success": true,
            "results": [{
                "result_type": "mismatch",
                "key": ["1"],
                "values_a": ["Alice"],
                "values_b": ["Alicia"],
                "duplicate_values_a": [],
                "duplicate_values_b": [],
                "differences": [{
                    "column_a": "name",
                    "column_b": "full_name",
                    "value_a": "Alice",
                    "value_b": "Alicia"
                }]
            }],
            "summary": default_summary_json()
        }),
    );

    assert_compare_shape(
        RowComparisonResult::MissingLeft {
            key: vec!["1".to_string()],
            values_b: vec!["only in b".to_string()],
        },
        json!({
            "success": true,
            "results": [{
                "result_type": "missing_left",
                "key": ["1"],
                "values_a": [],
                "values_b": ["only in b"],
                "duplicate_values_a": [],
                "duplicate_values_b": [],
                "differences": []
            }],
            "summary": default_summary_json()
        }),
    );

    assert_compare_shape(
        RowComparisonResult::MissingRight {
            key: vec!["2".to_string()],
            values_a: vec!["only in a".to_string()],
        },
        json!({
            "success": true,
            "results": [{
                "result_type": "missing_right",
                "key": ["2"],
                "values_a": ["only in a"],
                "values_b": [],
                "duplicate_values_a": [],
                "duplicate_values_b": [],
                "differences": []
            }],
            "summary": default_summary_json()
        }),
    );

    assert_compare_shape(
        RowComparisonResult::UnkeyedLeft {
            key: vec!["NULL".to_string()],
            values_b: vec!["unusable in b".to_string()],
        },
        json!({
            "success": true,
            "results": [{
                "result_type": "unkeyed_left",
                "key": ["NULL"],
                "values_a": [],
                "values_b": ["unusable in b"],
                "duplicate_values_a": [],
                "duplicate_values_b": [],
                "differences": []
            }],
            "summary": default_summary_json()
        }),
    );

    assert_compare_shape(
        RowComparisonResult::UnkeyedRight {
            key: vec!["".to_string()],
            values_a: vec!["unusable in a".to_string()],
        },
        json!({
            "success": true,
            "results": [{
                "result_type": "unkeyed_right",
                "key": [""],
                "values_a": ["unusable in a"],
                "values_b": [],
                "duplicate_values_a": [],
                "duplicate_values_b": [],
                "differences": []
            }],
            "summary": default_summary_json()
        }),
    );

    assert_compare_shape(
        RowComparisonResult::Duplicate {
            key: vec!["dup".to_string()],
            values_a: vec![vec!["A1".to_string(), "A2".to_string()]],
            values_b: vec![vec!["B1".to_string(), "B2".to_string()]],
        },
        json!({
            "success": true,
            "results": [{
                "result_type": "duplicate_both",
                "key": ["dup"],
                "values_a": ["A1", "A2"],
                "values_b": ["B1", "B2"],
                "duplicate_values_a": [["A1", "A2"]],
                "duplicate_values_b": [["B1", "B2"]],
                "differences": []
            }],
            "summary": default_summary_json()
        }),
    );
}

fn assert_compare_shape(result: RowComparisonResult, expected: serde_json::Value) {
    let response = compare_response(&[result], &default_summary());
    assert_eq!(serde_json::to_value(response).unwrap(), expected);
}

fn default_summary() -> ComparisonSummary {
    ComparisonSummary {
        total_rows_a: 1,
        total_rows_b: 1,
        matches: 0,
        mismatches: 0,
        missing_left: 0,
        missing_right: 0,
        unkeyed_left: 0,
        unkeyed_right: 0,
        duplicates_a: 0,
        duplicates_b: 0,
    }
}

fn default_summary_json() -> serde_json::Value {
    json!({
        "total_rows_a": 1,
        "total_rows_b": 1,
        "matches": 0,
        "mismatches": 0,
        "missing_left": 0,
        "missing_right": 0,
        "unkeyed_left": 0,
        "unkeyed_right": 0,
        "duplicates_a": 0,
        "duplicates_b": 0
    })
}
