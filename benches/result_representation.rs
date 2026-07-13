use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;
use std::hint::black_box;
use std::sync::Arc;
use std::time::Duration;

use criterion::{Criterion, criterion_group, criterion_main};
use csv_align::backend::{SessionData, SnapshotV1, save_comparison_snapshot_workflow};
use csv_align::comparison::engine::generate_summary;
use csv_align::data::types::{
    ColumnCatalog, ColumnDataType, ColumnInfo, ColumnMapping, ComparisonConfig,
    ComparisonNormalizationConfig, CsvData, MappingType, RowComparisonResult,
};
use csv_align::presentation::compare_response;

const RESULT_COUNT: usize = 100_000;

struct TrackingAllocator;

thread_local! {
    static TRACKING: Cell<bool> = const { Cell::new(false) };
    static ALLOCATED_BYTES: Cell<usize> = const { Cell::new(0) };
    static ALLOCATION_CALLS: Cell<usize> = const { Cell::new(0) };
}

#[global_allocator]
static GLOBAL_ALLOCATOR: TrackingAllocator = TrackingAllocator;

unsafe impl GlobalAlloc for TrackingAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let pointer = unsafe { System.alloc(layout) };
        if !pointer.is_null() {
            record_allocation(layout.size());
        }
        pointer
    }

    unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
        let pointer = unsafe { System.alloc_zeroed(layout) };
        if !pointer.is_null() {
            record_allocation(layout.size());
        }
        pointer
    }

    unsafe fn dealloc(&self, pointer: *mut u8, layout: Layout) {
        unsafe { System.dealloc(pointer, layout) };
    }

    unsafe fn realloc(&self, pointer: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
        let new_pointer = unsafe { System.realloc(pointer, layout, new_size) };
        if !new_pointer.is_null() {
            // Count the successful allocator request consistently, whether it grew or shrank.
            record_allocation(new_size);
        }
        new_pointer
    }
}

fn record_allocation(bytes: usize) {
    TRACKING.with(|tracking| {
        if tracking.get() {
            ALLOCATED_BYTES.with(|total| total.set(total.get().saturating_add(bytes)));
            ALLOCATION_CALLS.with(|count| count.set(count.get().saturating_add(1)));
        }
    });
}

struct TrackingGuard;

impl TrackingGuard {
    fn start() -> Self {
        TRACKING.with(|tracking| {
            assert!(
                !tracking.replace(true),
                "allocation measurement is not reentrant"
            );
        });
        Self
    }
}

impl Drop for TrackingGuard {
    fn drop(&mut self) {
        TRACKING.with(|tracking| tracking.set(false));
    }
}

#[derive(Debug)]
struct AllocationMeasurement {
    allocated_bytes: usize,
    allocation_calls: usize,
}

fn measure_allocations<T>(operation: impl FnOnce() -> T) -> AllocationMeasurement {
    ALLOCATED_BYTES.with(|total| total.set(0));
    ALLOCATION_CALLS.with(|count| count.set(0));

    let output = {
        let _guard = TrackingGuard::start();
        black_box(operation())
    };

    let measurement = AllocationMeasurement {
        allocated_bytes: ALLOCATED_BYTES.with(Cell::get),
        allocation_calls: ALLOCATION_CALLS.with(Cell::get),
    };
    drop(output);

    measurement
}

fn result_fixture() -> Vec<RowComparisonResult> {
    (0..RESULT_COUNT)
        .map(|index| RowComparisonResult::Match {
            key: vec![index.to_string()],
            values_a: vec!["value-a".to_string()],
            values_b: vec!["value-b".to_string()],
        })
        .collect()
}

fn catalog() -> Arc<ColumnCatalog> {
    Arc::new(ColumnCatalog::new(
        vec![
            ColumnInfo {
                index: 0,
                name: "id".to_string(),
                data_type: ColumnDataType::String,
            },
            ColumnInfo {
                index: 1,
                name: "value".to_string(),
                data_type: ColumnDataType::String,
            },
        ],
        Vec::new(),
    ))
}

fn csv(file_name: &str) -> Arc<CsvData> {
    Arc::new(CsvData {
        file_path: Some(file_name.to_string()),
        headers: vec!["id".to_string(), "value".to_string()],
        rows: (0..RESULT_COUNT).map(|_| Vec::new()).collect(),
    })
}

fn config() -> ComparisonConfig {
    ComparisonConfig {
        key_columns_a: vec!["id".to_string()],
        key_columns_b: vec!["id".to_string()],
        comparison_columns_a: vec!["value".to_string()],
        comparison_columns_b: vec!["value".to_string()],
        column_mappings: vec![ColumnMapping {
            file_a_column: "value".to_string(),
            file_b_column: "value".to_string(),
            mapping_type: MappingType::ExactMatch,
        }],
        normalization: ComparisonNormalizationConfig::default(),
    }
}

fn session_fixture(results: Vec<RowComparisonResult>) -> SessionData {
    SessionData {
        csv_a: Some(csv("left.csv")),
        csv_b: Some(csv("right.csv")),
        columns_a: catalog(),
        columns_b: catalog(),
        column_mappings: Vec::new(),
        comparison_results: results,
        comparison_config: Some(config()),
        data_revision: 0,
    }
}

fn save_owned_snapshot_reference(session: &SessionData) -> String {
    // Reproduce the pre-optimization workflow: first stage data out of the session,
    // then build a second fully owned persistence graph before serialization.
    let csv_a = Arc::clone(session.csv_a.as_ref().expect("File A"));
    let csv_b = Arc::clone(session.csv_b.as_ref().expect("File B"));
    let catalog_a = Arc::clone(&session.columns_a);
    let catalog_b = Arc::clone(&session.columns_b);
    let config = session
        .comparison_config
        .as_ref()
        .expect("comparison config")
        .clone();
    let results = session.comparison_results.clone();

    let snapshot =
        SnapshotV1::from_comparison(&csv_a, &csv_b, &catalog_a, &catalog_b, &config, &results);
    serde_json::to_string_pretty(&snapshot).expect("owned snapshot serialization")
}

fn benchmark_result_representation(criterion: &mut Criterion) {
    let results = result_fixture();
    let summary = generate_summary(&results, RESULT_COUNT, RESULT_COUNT);
    let session = session_fixture(results.clone());

    // Warm one-time serializer/allocator state before taking allocation samples.
    drop(compare_response(&results, &summary));
    let owned_snapshot = save_owned_snapshot_reference(&session);
    let borrowed_snapshot =
        save_comparison_snapshot_workflow(&session).expect("borrowed snapshot serialization");
    assert_eq!(borrowed_snapshot, owned_snapshot);
    drop(owned_snapshot);
    drop(borrowed_snapshot);

    let response_allocations = measure_allocations(|| compare_response(&results, &summary));
    let owned_snapshot_allocations =
        measure_allocations(|| save_owned_snapshot_reference(&session));
    let borrowed_snapshot_allocations =
        measure_allocations(|| save_comparison_snapshot_workflow(&session).expect("snapshot"));

    eprintln!(
        "RESULT_REPRESENTATION_ALLOCATION response_100k allocated_bytes={} allocator_calls={}",
        response_allocations.allocated_bytes, response_allocations.allocation_calls,
    );
    eprintln!(
        "RESULT_REPRESENTATION_ALLOCATION snapshot_owned_100k allocated_bytes={} allocator_calls={}",
        owned_snapshot_allocations.allocated_bytes, owned_snapshot_allocations.allocation_calls,
    );
    eprintln!(
        "RESULT_REPRESENTATION_ALLOCATION snapshot_borrowed_100k allocated_bytes={} allocator_calls={}",
        borrowed_snapshot_allocations.allocated_bytes,
        borrowed_snapshot_allocations.allocation_calls,
    );

    let mut group = criterion.benchmark_group("result_representation_100k");
    group.sample_size(10);
    group.warm_up_time(Duration::from_secs(1));
    group.measurement_time(Duration::from_secs(5));

    group.bench_function("compare_response", |bencher| {
        bencher.iter(|| compare_response(black_box(&results), black_box(&summary)));
    });
    group.bench_function("snapshot_save_owned_reference", |bencher| {
        bencher.iter(|| save_owned_snapshot_reference(black_box(&session)));
    });
    group.bench_function("snapshot_save_borrowed", |bencher| {
        bencher.iter(|| {
            save_comparison_snapshot_workflow(black_box(&session)).expect("snapshot serialization")
        });
    });
    group.finish();
}

criterion_group!(benches, benchmark_result_representation);
criterion_main!(benches);
