macro_rules! command_name_list {
    ($($command:ident),* $(,)?) => {
        &[ $(stringify!($command)),* ]
    };
}

pub(super) const REGISTERED_TAURI_COMMAND_NAMES: &[&str] = tauri_commands!(command_name_list);
