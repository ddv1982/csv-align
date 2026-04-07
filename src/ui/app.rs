use super::super::comparison::{engine, mapping};
use super::super::data::csv_loader;
use super::super::data::types::*;
use super::config_panel::ConfigPanel;
use super::export_dialog::ExportDialog;
use super::results_panel::ResultsPanel;
use eframe::egui;
use std::path::PathBuf;

pub struct CsvAlignApp {
    // File paths
    file_a_path: Option<PathBuf>,
    file_b_path: Option<PathBuf>,

    // Loaded CSV data
    csv_data_a: Option<CsvData>,
    csv_data_b: Option<CsvData>,

    // Column information
    columns_a: Vec<ColumnInfo>,
    columns_b: Vec<ColumnInfo>,

    // Configuration
    config: ComparisonConfig,
    column_mappings: Vec<ColumnMapping>,

    // Comparison results
    comparison_results: Vec<RowComparisonResult>,
    comparison_summary: Option<ComparisonSummary>,

    // UI state
    current_filter: ResultFilter,
    show_config: bool,
    show_results: bool,
    error_message: Option<String>,

    // Panels
    config_panel: ConfigPanel,
    results_panel: ResultsPanel,
    export_dialog: ExportDialog,
}

impl Default for CsvAlignApp {
    fn default() -> Self {
        Self {
            file_a_path: None,
            file_b_path: None,
            csv_data_a: None,
            csv_data_b: None,
            columns_a: Vec::new(),
            columns_b: Vec::new(),
            config: ComparisonConfig {
                key_columns_a: Vec::new(),
                key_columns_b: Vec::new(),
                comparison_columns_a: Vec::new(),
                comparison_columns_b: Vec::new(),
                column_mappings: Vec::new(),
            },
            column_mappings: Vec::new(),
            comparison_results: Vec::new(),
            comparison_summary: None,
            current_filter: ResultFilter::default(),
            show_config: true,
            show_results: false,
            error_message: None,
            config_panel: ConfigPanel::default(),
            results_panel: ResultsPanel::default(),
            export_dialog: ExportDialog::default(),
        }
    }
}

impl eframe::App for CsvAlignApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::TopBottomPanel::top("top_panel").show(ctx, |ui| {
            egui::menu::bar(ui, |ui| {
                ui.heading("CSV Align - Compare CSV Files");
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui.button("Reset").clicked() {
                        *self = Self::default();
                    }
                });
            });
        });

        egui::SidePanel::left("side_panel").show(ctx, |ui| {
            ui.heading("Files");

            ui.group(|ui| {
                ui.label("File A:");
                if let Some(path) = &self.file_a_path {
                    ui.label(path.file_name().unwrap_or_default().to_string_lossy());
                } else {
                    ui.label("No file selected");
                }
                if ui.button("Load File A").clicked() {
                    if let Some(path) = rfd::FileDialog::new()
                        .add_filter("CSV", &["csv"])
                        .pick_file()
                    {
                        self.load_file_a(path);
                    }
                }
            });

            ui.group(|ui| {
                ui.label("File B:");
                if let Some(path) = &self.file_b_path {
                    ui.label(path.file_name().unwrap_or_default().to_string_lossy());
                } else {
                    ui.label("No file selected");
                }
                if ui.button("Load File B").clicked() {
                    if let Some(path) = rfd::FileDialog::new()
                        .add_filter("CSV", &["csv"])
                        .pick_file()
                    {
                        self.load_file_b(path);
                    }
                }
            });

            ui.separator();

            if self.csv_data_a.is_some() && self.csv_data_b.is_some() {
                if ui.button("Configure Comparison").clicked() {
                    self.show_config = true;
                    self.show_results = false;
                }

                if ui.button("Run Comparison").clicked() {
                    self.run_comparison();
                }
            }

            if self.show_results && !self.comparison_results.is_empty() {
                if ui.button("Export Results").clicked() {
                    self.export_dialog.open = true;
                }
            }

            if let Some(error) = &self.error_message {
                ui.colored_label(egui::Color32::RED, error);
            }
        });

        // Show export dialog if open
        self.export_dialog.show(ctx, &self.comparison_results);

        egui::CentralPanel::default().show(ctx, |ui| {
            if self.show_config && self.csv_data_a.is_some() && self.csv_data_b.is_some() {
                self.config_panel.show(
                    ui,
                    &self.columns_a,
                    &self.columns_b,
                    &mut self.config,
                    &mut self.column_mappings,
                    &self.csv_data_a.as_ref().unwrap(),
                    &self.csv_data_b.as_ref().unwrap(),
                );
            } else if self.show_results {
                self.results_panel.show(
                    ui,
                    &self.comparison_results,
                    self.comparison_summary.as_ref(),
                    &mut self.current_filter,
                );
            } else {
                ui.vertical_centered(|ui| {
                    ui.label("Load two CSV files to begin comparison");
                    ui.label("Use the panel on the left to load your files");
                });
            }
        });
    }
}

impl CsvAlignApp {
    fn load_file_a(&mut self, path: PathBuf) {
        match csv_loader::load_csv(path.to_str().unwrap_or("")) {
            Ok(csv_data) => {
                self.columns_a = csv_loader::detect_columns(&csv_data);
                self.csv_data_a = Some(csv_data);
                self.file_a_path = Some(path);
                self.error_message = None;
                self.auto_suggest_mappings();
            }
            Err(e) => {
                self.error_message = Some(format!("Error loading file A: {}", e));
            }
        }
    }

    fn load_file_b(&mut self, path: PathBuf) {
        match csv_loader::load_csv(path.to_str().unwrap_or("")) {
            Ok(csv_data) => {
                self.columns_b = csv_loader::detect_columns(&csv_data);
                self.csv_data_b = Some(csv_data);
                self.file_b_path = Some(path);
                self.error_message = None;
                self.auto_suggest_mappings();
            }
            Err(e) => {
                self.error_message = Some(format!("Error loading file B: {}", e));
            }
        }
    }

    fn auto_suggest_mappings(&mut self) {
        if let (Some(_), Some(_)) = (&self.csv_data_a, &self.csv_data_b) {
            let col_names_a: Vec<String> = self.columns_a.iter().map(|c| c.name.clone()).collect();
            let col_names_b: Vec<String> = self.columns_b.iter().map(|c| c.name.clone()).collect();

            self.column_mappings = mapping::suggest_mappings(&col_names_a, &col_names_b);
        }
    }

    fn run_comparison(&mut self) {
        if let (Some(csv_a), Some(csv_b)) = (&self.csv_data_a, &self.csv_data_b) {
            self.config.column_mappings = self.column_mappings.clone();

            self.comparison_results = engine::compare_csv_data(csv_a, csv_b, &self.config);
            self.comparison_summary = Some(engine::generate_summary(&self.comparison_results));

            self.show_config = false;
            self.show_results = true;
            self.error_message = None;
        }
    }
}
