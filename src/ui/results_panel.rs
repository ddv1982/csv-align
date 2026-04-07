use super::super::data::types::*;
use eframe::egui;

#[derive(Default)]
pub struct ResultsPanel {
    #[allow(dead_code)]
    scroll_to_row: Option<usize>,
}

impl ResultsPanel {
    pub fn show(
        &mut self,
        ui: &mut egui::Ui,
        results: &[RowComparisonResult],
        summary: Option<&ComparisonSummary>,
        current_filter: &mut ResultFilter,
    ) {
        egui::ScrollArea::vertical().show(ui, |ui| {
            ui.heading("Comparison Results");

            // Summary section
            if let Some(summary) = summary {
                ui.group(|ui| {
                    ui.label("Summary:");
                    ui.horizontal(|ui| {
                        ui.label(format!("Total in File A: {}", summary.total_rows_a));
                        ui.label(format!("Total in File B: {}", summary.total_rows_b));
                    });
                    ui.horizontal(|ui| {
                        ui.colored_label(
                            egui::Color32::GREEN,
                            format!("Matches: {}", summary.matches),
                        );
                        ui.colored_label(
                            egui::Color32::RED,
                            format!("Mismatches: {}", summary.mismatches),
                        );
                    });
                    ui.horizontal(|ui| {
                        ui.colored_label(
                            egui::Color32::YELLOW,
                            format!("Missing Left: {}", summary.missing_left),
                        );
                        ui.colored_label(
                            egui::Color32::YELLOW,
                            format!("Missing Right: {}", summary.missing_right),
                        );
                    });
                    ui.horizontal(|ui| {
                        ui.colored_label(
                            egui::Color32::LIGHT_BLUE,
                            format!("Duplicates A: {}", summary.duplicates_a),
                        );
                        ui.colored_label(
                            egui::Color32::LIGHT_BLUE,
                            format!("Duplicates B: {}", summary.duplicates_b),
                        );
                    });
                });
            }

            ui.separator();

            // Filter controls
            ui.group(|ui| {
                ui.label("Filter:");
                ui.horizontal(|ui| {
                    if ui
                        .selectable_label(*current_filter == ResultFilter::All, "All")
                        .clicked()
                    {
                        *current_filter = ResultFilter::All;
                    }
                    if ui
                        .selectable_label(*current_filter == ResultFilter::Matches, "Matches")
                        .clicked()
                    {
                        *current_filter = ResultFilter::Matches;
                    }
                    if ui
                        .selectable_label(*current_filter == ResultFilter::Mismatches, "Mismatches")
                        .clicked()
                    {
                        *current_filter = ResultFilter::Mismatches;
                    }
                    if ui
                        .selectable_label(
                            *current_filter == ResultFilter::MissingLeft,
                            "Missing Left",
                        )
                        .clicked()
                    {
                        *current_filter = ResultFilter::MissingLeft;
                    }
                    if ui
                        .selectable_label(
                            *current_filter == ResultFilter::MissingRight,
                            "Missing Right",
                        )
                        .clicked()
                    {
                        *current_filter = ResultFilter::MissingRight;
                    }
                    if ui
                        .selectable_label(*current_filter == ResultFilter::Duplicates, "Duplicates")
                        .clicked()
                    {
                        *current_filter = ResultFilter::Duplicates;
                    }
                });
            });

            ui.separator();

            // Results table
            let filtered_results: Vec<&RowComparisonResult> = results
                .iter()
                .filter(|r| self.matches_filter(r, current_filter))
                .collect();

            ui.label(format!(
                "Showing {} of {} results",
                filtered_results.len(),
                results.len()
            ));

            egui::ScrollArea::horizontal().show(ui, |ui| {
                egui::Grid::new("results_grid")
                    .striped(true)
                    .min_col_width(100.0)
                    .show(ui, |ui| {
                        // Header
                        ui.label("Type");
                        ui.label("Key");
                        ui.label("File A Values");
                        ui.label("File B Values");
                        ui.label("Differences");
                        ui.end_row();

                        // Data rows
                        for result in filtered_results {
                            self.show_result_row(ui, result);
                            ui.end_row();
                        }
                    });
            });
        });
    }

    fn matches_filter(&self, result: &RowComparisonResult, filter: &ResultFilter) -> bool {
        match filter {
            ResultFilter::All => true,
            ResultFilter::Matches => matches!(result, RowComparisonResult::Match { .. }),
            ResultFilter::Mismatches => matches!(result, RowComparisonResult::Mismatch { .. }),
            ResultFilter::MissingLeft => matches!(result, RowComparisonResult::MissingLeft { .. }),
            ResultFilter::MissingRight => {
                matches!(result, RowComparisonResult::MissingRight { .. })
            }
            ResultFilter::Duplicates => matches!(result, RowComparisonResult::Duplicate { .. }),
        }
    }

    fn show_result_row(&self, ui: &mut egui::Ui, result: &RowComparisonResult) {
        match result {
            RowComparisonResult::Match {
                key,
                values_a,
                values_b,
            } => {
                ui.colored_label(egui::Color32::GREEN, "Match");
                ui.label(key.join(", "));
                ui.label(values_a.join(", "));
                ui.label(values_b.join(", "));
                ui.label("");
            }
            RowComparisonResult::Mismatch {
                key,
                values_a,
                values_b,
                differences,
            } => {
                ui.colored_label(egui::Color32::RED, "Mismatch");
                ui.label(key.join(", "));
                ui.label(values_a.join(", "));
                ui.label(values_b.join(", "));

                let diff_text: Vec<String> = differences
                    .iter()
                    .map(|d| format!("{}: {} vs {}", d.column_a, d.value_a, d.value_b))
                    .collect();
                ui.colored_label(egui::Color32::RED, diff_text.join("; "));
            }
            RowComparisonResult::MissingLeft { key, values_b } => {
                ui.colored_label(egui::Color32::YELLOW, "Missing Left");
                ui.label(key.join(", "));
                ui.label("");
                ui.label(values_b.join(", "));
                ui.label("");
            }
            RowComparisonResult::MissingRight { key, values_a } => {
                ui.colored_label(egui::Color32::YELLOW, "Missing Right");
                ui.label(key.join(", "));
                ui.label(values_a.join(", "));
                ui.label("");
                ui.label("");
            }
            RowComparisonResult::Duplicate {
                key,
                source,
                values,
            } => {
                let source_str = match source {
                    DuplicateSource::FileA => "Dup A",
                    DuplicateSource::FileB => "Dup B",
                    DuplicateSource::Both => "Dup Both",
                };
                ui.colored_label(egui::Color32::LIGHT_BLUE, source_str);
                ui.label(key.join(", "));

                let values_str: Vec<String> = values.iter().map(|v| v.join(",")).collect();
                ui.label(values_str.join(" | "));
                ui.label("");
                ui.label("");
            }
        }
    }
}
