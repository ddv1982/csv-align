use super::super::data::types::*;
use eframe::egui;

pub struct ConfigPanel {
    selected_key_a: Vec<String>,
    selected_key_b: Vec<String>,
    selected_comp_a: Vec<String>,
    selected_comp_b: Vec<String>,
}

impl Default for ConfigPanel {
    fn default() -> Self {
        Self {
            selected_key_a: Vec::new(),
            selected_key_b: Vec::new(),
            selected_comp_a: Vec::new(),
            selected_comp_b: Vec::new(),
        }
    }
}

impl ConfigPanel {
    pub fn show(
        &mut self,
        ui: &mut egui::Ui,
        columns_a: &[ColumnInfo],
        columns_b: &[ColumnInfo],
        config: &mut ComparisonConfig,
        column_mappings: &mut Vec<ColumnMapping>,
        csv_a: &CsvData,
        csv_b: &CsvData,
    ) {
        egui::ScrollArea::vertical().show(ui, |ui| {
            ui.heading("Configuration");

            // Key columns selection
            ui.group(|ui| {
                ui.label("Key Columns (for matching rows)");
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label("File A:");
                        for col in columns_a {
                            let mut selected = self.selected_key_a.contains(&col.name);
                            if ui.checkbox(&mut selected, &col.name).changed() {
                                if selected {
                                    self.selected_key_a.push(col.name.clone());
                                } else {
                                    self.selected_key_a.retain(|c| c != &col.name);
                                }
                                config.key_columns_a = self.selected_key_a.clone();
                            }
                        }
                    });

                    ui.vertical(|ui| {
                        ui.label("File B:");
                        for col in columns_b {
                            let mut selected = self.selected_key_b.contains(&col.name);
                            if ui.checkbox(&mut selected, &col.name).changed() {
                                if selected {
                                    self.selected_key_b.push(col.name.clone());
                                } else {
                                    self.selected_key_b.retain(|c| c != &col.name);
                                }
                                config.key_columns_b = self.selected_key_b.clone();
                            }
                        }
                    });
                });
            });

            ui.separator();

            // Comparison columns selection
            ui.group(|ui| {
                ui.label("Comparison Columns (values to compare)");
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label("File A:");
                        for col in columns_a {
                            let mut selected = self.selected_comp_a.contains(&col.name);
                            if ui.checkbox(&mut selected, &col.name).changed() {
                                if selected {
                                    self.selected_comp_a.push(col.name.clone());
                                } else {
                                    self.selected_comp_a.retain(|c| c != &col.name);
                                }
                                config.comparison_columns_a = self.selected_comp_a.clone();
                            }
                        }
                    });

                    ui.vertical(|ui| {
                        ui.label("File B:");
                        for col in columns_b {
                            let mut selected = self.selected_comp_b.contains(&col.name);
                            if ui.checkbox(&mut selected, &col.name).changed() {
                                if selected {
                                    self.selected_comp_b.push(col.name.clone());
                                } else {
                                    self.selected_comp_b.retain(|c| c != &col.name);
                                }
                                config.comparison_columns_b = self.selected_comp_b.clone();
                            }
                        }
                    });
                });
            });

            ui.separator();

            // Column mappings
            ui.group(|ui| {
                ui.label("Column Mappings");

                if column_mappings.is_empty() {
                    ui.label("No mappings suggested");
                } else {
                    for (i, mapping) in column_mappings.clone().iter().enumerate() {
                        ui.horizontal(|ui| {
                            ui.label(format!(
                                "{} → {}",
                                mapping.file_a_column, mapping.file_b_column
                            ));
                            ui.label(format!("({:?})", mapping.mapping_type));

                            if ui.button("Remove").clicked() {
                                column_mappings.remove(i);
                            }
                        });
                    }
                }

                ui.separator();

                // Manual mapping
                ui.label("Add Manual Mapping:");
                let mut new_a = String::new();
                let mut new_b = String::new();

                ui.horizontal(|ui| {
                    egui::ComboBox::from_label("File A Column")
                        .selected_text("Select column")
                        .show_ui(ui, |ui| {
                            for col in columns_a {
                                ui.selectable_value(&mut new_a, col.name.clone(), &col.name);
                            }
                        });

                    egui::ComboBox::from_label("File B Column")
                        .selected_text("Select column")
                        .show_ui(ui, |ui| {
                            for col in columns_b {
                                ui.selectable_value(&mut new_b, col.name.clone(), &col.name);
                            }
                        });

                    if ui.button("Add Mapping").clicked() && !new_a.is_empty() && !new_b.is_empty()
                    {
                        column_mappings.push(ColumnMapping {
                            file_a_column: new_a,
                            file_b_column: new_b,
                            mapping_type: MappingType::ManualMatch,
                        });
                    }
                });
            });

            ui.separator();

            // Data preview
            ui.collapsing("Data Preview", |ui| {
                ui.label(format!(
                    "File A: {} rows, {} columns",
                    csv_a.rows.len(),
                    csv_a.headers.len()
                ));
                ui.label(format!(
                    "File B: {} rows, {} columns",
                    csv_b.rows.len(),
                    csv_b.headers.len()
                ));

                if ui.button("Show Sample Data").clicked() {
                    // Could implement a popup with sample data
                }
            });
        });
    }
}
