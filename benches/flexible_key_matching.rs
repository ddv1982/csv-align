use criterion::{Criterion, criterion_group, criterion_main};
use std::hint::black_box;

use csv_align::comparison::try_compare_csv_data;
use csv_align::data::types::{
    ColumnMapping, ComparisonConfig, ComparisonNormalizationConfig, CsvData, MappingType,
};

fn csv_with_keys(file_path: &str, keys: impl Iterator<Item = String>) -> CsvData {
    CsvData {
        file_path: Some(file_path.to_string()),
        headers: vec!["order".to_string(), "amount".to_string()],
        rows: keys
            .enumerate()
            .map(|(index, key)| vec![key, format!("{}.50", index)])
            .collect(),
    }
}

fn flexible_config() -> ComparisonConfig {
    ComparisonConfig {
        key_columns_a: vec!["order".to_string()],
        key_columns_b: vec!["order".to_string()],
        comparison_columns_a: vec!["amount".to_string()],
        comparison_columns_b: vec!["amount".to_string()],
        column_mappings: vec![ColumnMapping {
            file_a_column: "amount".to_string(),
            file_b_column: "amount".to_string(),
            mapping_type: MappingType::ExactMatch,
        }],
        normalization: ComparisonNormalizationConfig {
            flexible_key_matching: true,
            ..ComparisonNormalizationConfig::default()
        },
    }
}

/// Mostly-unique token-sharing keys: the common shape where each key pairs
/// with exactly one candidate on the other side (degree-1 fast path).
fn sparse_token_keys(count: usize, suffix: &str) -> impl Iterator<Item = String> + use<'_> {
    (0..count).map(move |index| format!("ORDER-{index} ACME{index} {suffix}"))
}

/// Wildcard keys that all classify against each other: the dense case that
/// exercises candidate classification and max-cardinality selection.
fn dense_wildcard_keys(count: usize) -> impl Iterator<Item = String> {
    (0..count).map(|index| format!("BATCH-**-{index}"))
}

fn bench_flexible_key_matching(criterion: &mut Criterion) {
    let config = flexible_config();

    let sparse_a = csv_with_keys("a.csv", sparse_token_keys(500, "INV"));
    let sparse_b = csv_with_keys("b.csv", sparse_token_keys(500, "PAID"));
    criterion.bench_function("flexible_sparse_500x500", |bencher| {
        bencher.iter(|| {
            black_box(try_compare_csv_data(
                black_box(&sparse_a),
                black_box(&sparse_b),
                black_box(&config),
            ))
        })
    });

    let dense_a = csv_with_keys("a.csv", dense_wildcard_keys(60));
    let dense_b = csv_with_keys("b.csv", dense_wildcard_keys(60));
    criterion.bench_function("flexible_dense_wildcards_60x60", |bencher| {
        bencher.iter(|| {
            black_box(try_compare_csv_data(
                black_box(&dense_a),
                black_box(&dense_b),
                black_box(&config),
            ))
        })
    });
}

criterion_group!(benches, bench_flexible_key_matching);
criterion_main!(benches);
