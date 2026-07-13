use axum::{
    extract::Request,
    http::{HeaderMap, HeaderValue, StatusCode, header, uri::Authority},
    middleware::Next,
    response::{IntoResponse, Response},
};

pub const LOOPBACK_PORT: u16 = 3001;
const FRONTEND_DEV_PORT: u16 = 5173;

fn is_loopback_host(host: &str) -> bool {
    host.eq_ignore_ascii_case("localhost")
        || host == "127.0.0.1"
        || host == "::1"
        || host == "[::1]"
}

fn is_allowed_authority(authority: &Authority, allowed_ports: &[u16]) -> bool {
    is_loopback_host(authority.host())
        && authority
            .port_u16()
            .is_some_and(|port| allowed_ports.contains(&port))
}

fn single_header_value(headers: &HeaderMap, name: axum::http::HeaderName) -> Option<&HeaderValue> {
    let mut values = headers.get_all(name).iter();
    let value = values.next()?;
    values.next().is_none().then_some(value)
}

fn is_allowed_host(headers: &HeaderMap) -> bool {
    single_header_value(headers, header::HOST)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<Authority>().ok())
        .is_some_and(|authority| is_allowed_authority(&authority, &[LOOPBACK_PORT]))
}

fn is_configured_origin(origin: &str) -> bool {
    [LOOPBACK_PORT, FRONTEND_DEV_PORT].into_iter().any(|port| {
        origin == format!("http://127.0.0.1:{port}")
            || origin == format!("http://localhost:{port}")
            || origin == format!("http://[::1]:{port}")
    })
}

fn has_allowed_origin(headers: &HeaderMap) -> bool {
    let mut origins = headers.get_all(header::ORIGIN).iter();
    let Some(origin) = origins.next() else {
        return true;
    };

    origins.next().is_none() && origin.to_str().is_ok_and(is_configured_origin)
}

fn is_cross_site_request(request: &Request) -> bool {
    request
        .headers()
        .get_all("sec-fetch-site")
        .iter()
        .filter_map(|value| value.to_str().ok())
        .any(|value| value.eq_ignore_ascii_case("cross-site"))
}

pub async fn enforce_loopback_request(request: Request, next: Next) -> Response {
    if !is_allowed_host(request.headers())
        || !has_allowed_origin(request.headers())
        || is_cross_site_request(&request)
    {
        return (StatusCode::FORBIDDEN, "Forbidden").into_response();
    }

    next.run(request).await
}
