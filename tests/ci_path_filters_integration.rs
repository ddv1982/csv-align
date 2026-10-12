const CI: &str = include_str!("../.github/workflows/ci.yml");

fn patterns(filter: &str) -> Vec<&str> {
    let marker = format!("            {filter}:\n");
    CI.split_once(&marker)
        .expect("CI filter must exist")
        .1
        .lines()
        .take_while(|line| line.starts_with("              - "))
        .map(|line| {
            line.trim()
                .strip_prefix("- '")
                .unwrap()
                .strip_suffix('\'')
                .unwrap()
        })
        .collect()
}

#[test]
fn contract_changes_select_every_consumer_filter() {
    for filter in ["run_rust_ci", "run_frontend_ci", "run_tauri_ci"] {
        assert!(
            patterns(filter).contains(&"contracts/**"),
            "contracts/transport-contract.json must select {filter}"
        );
    }
}

#[test]
fn docs_only_changes_remain_excluded() {
    // With dorny's default `some`, separate negative rules are alternatives,
    // not exclusions. One negated brace expression excludes both categories.
    assert_eq!(patterns("run_full_ci"), ["!{*.md,**/*.md,LICENSE}"]);
    for filter in ["run_rust_ci", "run_frontend_ci", "run_tauri_ci"] {
        let patterns = patterns(filter);
        assert!(!patterns.contains(&"**"), "{filter} must stay scoped");
        assert!(
            !patterns
                .iter()
                .any(|pattern| pattern.starts_with("docs/") || *pattern == "README.md")
        );
    }
}
