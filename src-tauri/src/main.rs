use std::error::Error;
use std::sync::Arc;

use csv_align::backend::SessionStore;

mod commands;

use commands::{
    compare, create_session, delete_session, export_results, load_comparison_snapshot,
    load_csv, load_csv_bytes, load_pair_order, save_comparison_snapshot, save_pair_order,
    suggest_mappings,
};

macro_rules! tauri_commands {
    ($consumer:ident) => {
        $consumer!(
            create_session,
            delete_session,
            load_csv,
            load_csv_bytes,
            suggest_mappings,
            compare,
            export_results,
            save_pair_order,
            load_pair_order,
            save_comparison_snapshot,
            load_comparison_snapshot,
        )
    };
}

macro_rules! command_name_list {
    ($($command:ident),* $(,)?) => {
        &[ $(stringify!($command)),* ]
    };
}

macro_rules! command_handler_list {
    ($($command:ident),* $(,)?) => {
        tauri::generate_handler![$($command),*]
    };
}

const REGISTERED_TAURI_COMMAND_NAMES: &[&str] = tauri_commands!(command_name_list);

#[cfg(test)]
mod tests;

#[cfg(test)]
mod pair_order_tests;

#[cfg(test)]
mod comparison_snapshot_tests;

fn main() -> Result<(), Box<dyn Error + Send + Sync>> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .try_init()?;

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Arc::new(SessionStore::default()))
        .invoke_handler(tauri_commands!(command_handler_list))
        .run(tauri::generate_context!())?;

    Ok(())
}
