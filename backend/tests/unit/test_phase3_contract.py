from app.main import app


def test_phase3_openapi_has_typed_routes_and_required_idempotency_key() -> None:
    paths = app.openapi()["paths"]
    overview = paths["/api/v1/planning/periods/{period_type}/{period_key}"]["get"]
    events = paths["/api/v1/calendar/events"]["get"]
    confirm = paths["/api/v1/planning/rollovers/confirm"]["post"]
    assert overview["responses"]["200"]["content"]["application/json"]["schema"]["$ref"].endswith(
        "PeriodOverviewResponse"
    )
    assert events["responses"]["200"]["content"]["application/json"]["schema"]["$ref"].endswith(
        "CalendarEventsResponse"
    )
    assert any(
        parameter["name"] == "Idempotency-Key" and parameter["required"]
        for parameter in confirm["parameters"]
    )
