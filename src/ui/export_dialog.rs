use super::super::data::export;
use super::super::data::types::RowComparisonResult;
use eframe::egui;

pub struct ExportDialog {
    pub open: bool,
    pub file_path: String,
    pub export_type: ExportType,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ExportType {
    All,
    Matches,
    Mismatches,
    MissingLeft,
    MissingRight,
    Duplicates,
}

impl Default for ExportDialog {
    fn default() -> Self {
        Self {
            open: false,
            file_path: String::new(),
            export_type: ExportType::All,
        }
    }
}

impl ExportDialog {
    pub fn show(&mut self, ctx: &egui::Context, results: &[RowComparisonResult]) {
        if !self.open {
            return;
        }

        let mut open = self.open;
        let mut file_path = self.file_path.clone();
        let mut export_type = self.export_type.clone();
        let mut export_clicked = false;
        let mut cancel_clicked = false;

        egui::Window::new("Export Results")
            .open(&mut open)
            .resizable(false)
            .show(ctx, |ui| {
                ui.label("Export comparison results to CSV");

                ui.horizontal(|ui| {
                    ui.label("File path:");
                    ui.text_edit_singleline(&mut file_path);
                    if ui.button("Browse").clicked() {
                        if let Some(path) = rfd::FileDialog::new()
                            .add_filter("CSV", &["csv"])
                            .save_file()
                        {
                            file_path = path.to_string_lossy().to_string();
                        }
                    }
                });

                ui.horizontal(|ui| {
                    ui.label("Export:");
                    egui::ComboBox::from_label("")
                        .selected_text(format!("{export_type:?}"))
                        .show_ui(ui, |ui| {
                            ui.selectable_value(&mut export_type, ExportType::All, "All Results");
                            ui.selectable_value(
                                &mut export_type,
                                ExportType::Matches,
                                "Matches Only",
                            );
                            ui.selectable_value(
                                &mut export_type,
                                ExportType::Mismatches,
                                "Mismatches Only",
                            );
                            ui.selectable_value(
                                &mut export_type,
                                ExportType::MissingLeft,
                                "Missing Left Only",
                            );
                            ui.selectable_value(
                                &mut export_type,
                                ExportType::MissingRight,
                                "Missing Right Only",
                            );
                            ui.selectable_value(
                                &mut export_type,
                                ExportType::Duplicates,
                                "Duplicates Only",
                            );
                        });
                });

                ui.horizontal(|ui| {
                    if ui.button("Export").clicked() && !file_path.is_empty() {
                        export_clicked = true;
                    }

                    if ui.button("Cancel").clicked() {
                        cancel_clicked = true;
                    }
                });
            });

        self.open = open;
        self.file_path = file_path;
        self.export_type = export_type;

        if export_clicked {
            let filtered_results: Vec<RowComparisonResult> = results
                .iter()
                .filter(|r| self.matches_export_type(r))
                .cloned()
                .collect();

            match export::export_results(&filtered_results, &self.file_path) {
                Ok(_) => {
                    self.open = false;
                }
                Err(_e) => {
                    // Error handling would go here
                }
            }
        }

        if cancel_clicked {
            self.open = false;
        }
    }

    fn matches_export_type(&self, result: &RowComparisonResult) -> bool {
        match self.export_type {
            ExportType::All => true,
            ExportType::Matches => matches!(result, RowComparisonResult::Match { .. }),
            ExportType::Mismatches => matches!(result, RowComparisonResult::Mismatch { .. }),
            ExportType::MissingLeft => matches!(result, RowComparisonResult::MissingLeft { .. }),
            ExportType::MissingRight => matches!(result, RowComparisonResult::MissingRight { .. }),
            ExportType::Duplicates => matches!(result, RowComparisonResult::Duplicate { .. }),
        }
    }
}
