use std::fmt;

use axum::{
    http::StatusCode,
    response::{IntoResponse, Json, Response},
};
use serde::{Serialize, Serializer};
use thiserror::Error;

use crate::backend::requests::CompareValidationError as ValidationError;

#[derive(Debug, Error)]
pub enum CsvAlignError {
    #[error("{resource} not found")]
    NotFound { resource: String },
    #[error("{0}")]
    Validation(ValidationError),
    #[error("{0}")]
    BadInput(String),
    #[error("{0}")]
    Parse(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Internal(String),
}

#[derive(Serialize)]
struct ErrorBody<'a> {
    code: &'a str,
    error: String,
}

impl CsvAlignError {
    fn code(&self) -> &'static str {
        match self {
            Self::NotFound { .. } => "not_found",
            Self::Validation(_) => "validation",
            Self::BadInput(_) => "bad_input",
            Self::Parse(_) => "parse",
            Self::Io(_) => "io",
            Self::Internal(_) => "internal",
        }
    }

    fn status_code(&self) -> StatusCode {
        match self {
            Self::NotFound { .. } => StatusCode::NOT_FOUND,
            Self::Validation(_) | Self::BadInput(_) | Self::Parse(_) => StatusCode::BAD_REQUEST,
            Self::Io(_) | Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl IntoResponse for CsvAlignError {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let body = ErrorBody {
            code: self.code(),
            error: self.to_string(),
        };

        (status, Json(body)).into_response()
    }
}

impl Serialize for CsvAlignError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        ErrorBody {
            code: self.code(),
            error: self.to_string(),
        }
        .serialize(serializer)
    }
}

impl From<ValidationError> for CsvAlignError {
    fn from(value: ValidationError) -> Self {
        Self::Validation(value)
    }
}

impl From<String> for CsvAlignError {
    fn from(value: String) -> Self {
        Self::Internal(value)
    }
}

impl From<&str> for CsvAlignError {
    fn from(value: &str) -> Self {
        Self::Internal(value.to_string())
    }
}

impl fmt::Display for ErrorBody<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.code, self.error)
    }
}
