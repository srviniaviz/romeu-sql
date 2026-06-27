mod db;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(db::DbPoolState::new())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_stronghold::Builder::new(|password| {
                use sha2::{Digest, Sha256};

                Sha256::digest(password.as_bytes()).to_vec()
            })
            .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            db::commands::db_test_connection,
            db::commands::db_list_databases,
            db::commands::db_list_tables,
            db::commands::db_list_table_stats,
            db::commands::db_benchmark_analyze,
            db::commands::db_list_cluster_users,
            db::commands::db_list_cluster_permissions,
            db::commands::db_select_rows_page,
            db::commands::db_count_rows,
            db::commands::db_explain_rows,
            db::commands::db_list_columns,
            db::commands::db_list_indexes,
            db::commands::db_list_delete_cascade_impacts,
            db::commands::db_execute_sql,
            db::commands::db_select_query,
            db::commands::db_export_query,
            db::commands::db_insert_row,
            db::commands::db_update_row,
            db::commands::db_delete_row,
            db::commands::db_create_table,
            db::commands::db_create_database
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
