# Postman — FE-3 Projects and Settings integration

These endpoints already exist in the backend; this flow verifies the FE-3 integration without creating unrelated data. Run against an isolated test environment, or use a disposable owner account. Planning and Calendar requests are documented in `03_be_phase3_planning_calendar_postman.md`.

## 1. Postman Environment

Create an environment with `base_url` (`http://127.0.0.1:18001/api/v1` for the rollback-only test server), `access_token`, `project_id`, `project_version`, `category_id`, `original_timezone` and `original_week_starts_on`. The browser uses HttpOnly cookies; Postman can use the returned bearer token. Do not save real credentials in a shared collection.

## 2. Test Flow

1. Log in with the existing owner (`POST /auth/login`) and save `access_token`.
2. Read user settings; save original timezone and week start.
3. Create a category, then create, list, update and archive a project.
4. Patch account settings, read them again, then restore original values.
5. Rename/recolor/archive the test category.
6. Repeat a protected request without authorization and with a foreign or malformed ID.

## 3. Requests

For every protected request choose **Authorization → Bearer Token** and enter `{{access_token}}`. Choose **Body → raw → JSON** for requests with a body; use `Content-Type: application/json`. The Postman script goes in **Scripts → Post-response**.

### 3.1 Login

- Method & URL: `POST {{base_url}}/auth/login`
- Authorization: **No Auth**
- Headers: `Content-Type: application/json`
- Body:

```json
{"email":"browser-e2e@example.com","password":"TestPassword123!","device_label":"postman-fe3"}
```

- Post-response script:

```javascript
pm.test("login 200", () => pm.response.to.have.status(200));
pm.environment.set("access_token", pm.response.json().access_token);
```

- Expected: `200` with `access_token`, `user` and expiry. Invalid credentials return `401` with `{ "error": { "code": "...", "message": "..." }, "request_id": "..." }`.

### 3.2 Read settings

- Method & URL: `GET {{base_url}}/users/me`
- Authorization: Bearer token; no body or query params.
- Post-response script:

```javascript
pm.test("settings available", () => pm.response.to.have.status(200));
const settings = pm.response.json().settings;
pm.environment.set("original_timezone", settings.timezone);
pm.environment.set("original_week_starts_on", settings.week_starts_on);
```

- Expected: `200` with `settings.timezone`, `week_starts_on`, `theme` and `working_hours_json`. Missing auth: `401` error envelope.

### 3.3 Create category

- Method & URL: `POST {{base_url}}/categories`
- Authorization: Bearer token; header `Content-Type: application/json`.
- Body:

```json
{"name":"Postman FE3 category","accent_token":"SKY","sort_order":0}
```

- Post-response script:

```javascript
pm.test("category created", () => pm.response.to.have.status(201));
pm.environment.set("category_id", pm.response.json().id);
```

- Expected: `201` with category `id`, `name`, `accent_token`. Empty name: `422` validation envelope.

### 3.4 Create project

- Method & URL: `POST {{base_url}}/projects`
- Authorization: Bearer token; header `Content-Type: application/json`.
- Body:

```json
{"title":"Postman FE3 project","description":"Verify FE3 project form","category_id":"{{category_id}}","status":"ACTIVE","start_date":"2026-11-20","target_date":"2026-12-20"}
```

- Post-response script:

```javascript
pm.test("project created", () => pm.response.to.have.status(201));
const project = pm.response.json();
pm.environment.set("project_id", project.id);
pm.environment.set("project_version", project.version);
```

- Expected: `201` with project `id`, `version: 1`, title and dates. Bad category ID or invalid date: `422` or `404` error envelope.

### 3.5 List and update project

- Method & URL: `GET {{base_url}}/projects` then `PATCH {{base_url}}/projects/{{project_id}}`
- Authorization: Bearer token; PATCH header `Content-Type: application/json`.
- GET: no body or query params. Expected `200` array containing the new project.
- PATCH body:

```json
{"title":"Postman FE3 project updated","status":"ON_HOLD","expected_version":{{project_version}}}
```

- PATCH post-response script:

```javascript
pm.test("project updated", () => pm.response.to.have.status(200));
pm.environment.set("project_version", pm.response.json().version);
```

- Expected: `200` with incremented version. A stale `expected_version` returns `409` error envelope. A foreign or missing ID returns `404`.

### 3.6 Archive project

- Method & URL: `PATCH {{base_url}}/projects/{{project_id}}`
- Authorization: Bearer token; header `Content-Type: application/json`.
- Body:

```json
{"archived":true,"expected_version":{{project_version}}}
```

- Post-response script:

```javascript
pm.test("project archived", () => pm.response.to.have.status(200));
pm.test("archive timestamp set", () => pm.expect(pm.response.json().archived_at).to.not.equal(null));
```

- Expected: `200` with `archived_at`; default list excludes the archived project. Missing auth: `401`.

### 3.7 Update and restore settings

- Method & URL: `PATCH {{base_url}}/users/me/settings`; then `GET {{base_url}}/users/me` to confirm.
- Authorization: Bearer token; PATCH header `Content-Type: application/json`.
- Body:

```json
{"timezone":"Asia/Ho_Chi_Minh","week_starts_on":7,"theme":"DARK","working_hours_json":{"start":"09:00","end":"17:00"}}
```

- Post-response script:

```javascript
pm.test("settings updated", () => pm.response.to.have.status(200));
pm.test("week starts Sunday", () => pm.expect(pm.response.json().week_starts_on).to.equal(7));
```

- Expected: `200` with the updated settings. Unknown timezone and week start outside 1–7 return `422` validation envelopes. Restore original values with a second PATCH body:

```json
{"timezone":"{{original_timezone}}","week_starts_on":{{original_week_starts_on}},"theme":"SYSTEM","working_hours_json":null}
```

### 3.8 Rename, recolor and archive category

- Method & URL: `PATCH {{base_url}}/categories/{{category_id}}`
- Authorization: Bearer token; header `Content-Type: application/json`.
- First body:

```json
{"name":"Postman FE3 category updated","accent_token":"SAGE"}
```

- Post-response script:

```javascript
pm.test("category updated", () => pm.response.to.have.status(200));
pm.test("name persisted", () => pm.expect(pm.response.json().name).to.equal("Postman FE3 category updated"));
```

- Expected: `200` with updated name and accent. Empty name: `422`; foreign ID: `404`. Archive with body:

```json
{"archived":true}
```

- Expected: `200` with non-null `archived_at`; default `GET {{base_url}}/categories` omits it.

## 4. Quick checklist

- [ ] Every protected route rejects missing authorization.
- [ ] Settings persist across a new GET and are restored afterward.
- [ ] Project version increases; stale writes return `409`.
- [ ] Archived project and category disappear from default lists without deleting their task associations.
- [ ] Validation errors use the standard error envelope and a request ID.
