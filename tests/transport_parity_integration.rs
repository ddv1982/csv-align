use csv_align::api::app::TRANSPORT_PARITY_ROUTE_PATHS;

fn frontend_transport_route_templates() -> Vec<&'static str> {
    include_str!("../frontend/src/services/apiRoutes.ts")
        .lines()
        .filter(|line| line.contains(": '/api/"))
        .filter_map(|line| line.split('\'').nth(1))
        .collect()
}

fn backend_transport_route_templates() -> Vec<String> {
    TRANSPORT_PARITY_ROUTE_PATHS
        .iter()
        .map(|route| {
            route
                .replace("{session_id}", "{sessionId}")
                .replace("{file_letter}", "{fileLetter}")
        })
        .collect()
}

#[test]
fn frontend_transport_routes_match_backend_transport_routes() {
    assert_eq!(
        frontend_transport_route_templates(),
        backend_transport_route_templates()
    );
}
