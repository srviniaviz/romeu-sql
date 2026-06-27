use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionInput {
    #[serde(rename = "type")]
    pub engine: DbEngine,
    pub host: String,
    pub port: String,
    pub database: String,
    pub username: String,
    pub password: Option<String>,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DbEngine {
    Postgres,
    Mysql,
    Sqlite,
    Sqlserver,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RowQueryOptions {
    pub project: Option<String>,
    pub sort: Option<String>,
    pub skip: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub data_type: String,
    pub nullable: bool,
    pub default_value: Value,
    pub is_primary_key: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexInfo {
    pub name: String,
    pub columns: String,
    pub unique: bool,
    #[serde(rename = "type")]
    pub index_type: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub table_type: String,
    pub estimated_rows: Option<i64>,
    pub total_bytes: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterUserInfo {
    pub name: String,
    pub role: String,
    pub can_login: bool,
    pub is_admin: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterPermissionInfo {
    pub principal: String,
    pub object_name: String,
    pub privilege: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BenchmarkTableResult {
    pub table_name: String,
    pub estimated_rows: Option<i64>,
    pub total_bytes: Option<i64>,
    pub index_count: i64,
    pub count_ms: f64,
    pub sample_ms: f64,
    pub total_ms: f64,
    pub score: i64,
    pub grade: String,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BenchmarkAnalyzeResult {
    pub database: String,
    pub table_count: i64,
    pub average_score: i64,
    pub slowest_table: Option<String>,
    pub total_ms: f64,
    pub tables: Vec<BenchmarkTableResult>,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Csv,
    Json,
    Xls,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub path: String,
    pub rows: u64,
}

pub type JsonRow = BTreeMap<String, Value>;
