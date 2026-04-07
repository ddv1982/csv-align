use eframe::egui;

fn main() -> Result<(), eframe::Error> {
    env_logger::init(); // Log to stderr (if you run with `RUST_LOG=debug`).

    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default().with_inner_size([1200.0, 800.0]),
        ..Default::default()
    };

    eframe::run_native(
        "CSV Align - Compare CSV Files",
        options,
        Box::new(|_cc| Box::new(csv_align::ui::app::CsvAlignApp::default())),
    )
}
