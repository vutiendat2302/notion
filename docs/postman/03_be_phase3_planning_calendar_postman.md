# BE-3 Planning & Calendar — Postman verification

Use a dedicated test account/database. These requests write saved plans and occurrences. The live owner database should be used only for intentional user actions.

## 1 — Postman Environment

Create an environment with `base_url` (for example `https://notion.vtdat.com/api/v1`), `email`, `password`, `access_token`, `refresh_token`, `task_id`, `occurrence_id`, `occurrence_version`, `plan_id`, `plan_item_id`, and `idempotency_key` (`be3-rollover-demo-001`). Keep token and password values in Postman's local environment; do not export them into Git.

## 2 — Test Flow

1. Login, then create a one-off task on `2026-12-29`.
2. Read `2026-W53`, save the plan, add an occurrence pin, change its rank, and read the overview again.
3. Preview rollover to `2027-W01`, confirm with the selected occurrence and an idempotency key, then replay the same request.
4. Read target plan and calendar events/conflicts. Remove the source pin.
5. Repeat selected requests with missing auth, an invalid key, a stale version, a foreign target ID, and a reused idempotency key with a different body.

## 3 — Requests

### 3.1 Login

- **Purpose:** Obtain owner credentials for subsequent requests.
- **Method & URL:** `POST {{base_url}}/auth/login`
- **Authorization:** `No Auth`.
- **Headers:** `Content-Type: application/json`.
- **Query/Path:** None.
- **Body** (`raw` → `JSON`):

```json
{"email":"{{email}}","password":"{{password}}","device_label":"postman-be3"}
```

- **Scripts → Post-response:**

```javascript
pm.test("login 200", () => pm.response.to.have.status(200));
const body = pm.response.json();
pm.environment.set("access_token", body.access_token);
pm.environment.set("refresh_token", body.refresh_token);
```

- **Expected:** `200` with `{"access_token":"<token>","refresh_token":"<token>","user":{"id":"<uuid>"}}` plus other fields. Invalid credentials: `401` with `{"error":{"code":"INVALID_CREDENTIALS","message":"Invalid email or password.","details":null},"request_id":"<id>"}`.

### 3.2 Create a task and occurrence

- **Purpose:** Provide a rollover candidate.
- **Method & URL:** `POST {{base_url}}/tasks`
- **Authorization:** `Bearer Token` → `{{access_token}}`.
- **Headers:** `Content-Type: application/json`.
- **Query/Path:** None.
- **Body** (`raw` → `JSON`):

```json
{"title":"BE3 planning example","scheduled_date":"2026-12-29","start_at":"2026-12-29T09:00:00+07:00","end_at":"2026-12-29T10:00:00+07:00","estimated_minutes":60}
```

- **Scripts → Post-response:**

```javascript
pm.test("task created", () => pm.response.to.have.status(201));
const task = pm.response.json();
pm.environment.set("task_id", task.id);
pm.environment.set("occurrence_id", task.occurrences[0].id);
pm.environment.set("occurrence_version", task.occurrences[0].version);
```

- **Expected:** `201` with `{"id":"<task_uuid>","occurrences":[{"id":"<occ_uuid>","scheduled_date":"2026-12-29","status":"NOT_STARTED","version":1}]}` plus task fields. Invalid time order: `422` with `error.code="VALIDATION_ERROR"`.

### 3.3 Read a dynamic planning period

- **Purpose:** Confirm read does not create a saved plan.
- **Method & URL:** `GET {{base_url}}/planning/periods/WEEK/2026-W53`
- **Authorization:** `Bearer Token` → `{{access_token}}`.
- **Headers:** None.
- **Query/Path:** `period_type=WEEK`, `period_key=2026-W53`.
- **Body:** None.
- **Scripts → Post-response:**

```javascript
pm.test("period bounds and one occurrence", () => {
  pm.response.to.have.status(200);
  const body = pm.response.json();
  pm.expect(body.start_date).to.eql("2026-12-28");
  pm.expect(body.end_date_exclusive).to.eql("2027-01-04");
  pm.expect(body.occurrences.some(x => x.id === pm.environment.get("occurrence_id"))).to.be.true;
});
```

- **Expected:** `200` with `{"period_type":"WEEK","period_key":"2026-W53","start_date":"2026-12-28","end_date_exclusive":"2027-01-04","saved_plan":null,"plan_items":[],"occurrences":[{"id":"<occ_uuid>"}],"planned_focus_minutes":60,"focus_unit":"minutes"}` plus timezone and overdue fields. Invalid `2026-W54`: `422` with `error.code="INVALID_PERIOD_KEY"`; missing auth: `401`.

### 3.4 Save or update a plan

- **Purpose:** Persist focus and notes for the period.
- **Method & URL:** `PUT {{base_url}}/planning/periods/WEEK/2026-W53/plan`
- **Authorization:** `Bearer Token` → `{{access_token}}`.
- **Headers:** `Content-Type: application/json`.
- **Query/Path:** Same period as 3.3.
- **Body** (`raw` → `JSON`):

```json
{"title":"Year-end focus","focus_summary":"Finish current work","notes":"Review before rollover","status":"ACTIVE"}
```

- **Scripts → Post-response:**

```javascript
pm.test("plan saved", () => pm.response.to.have.status(200));
pm.environment.set("plan_id", pm.response.json().id);
```

- **Expected:** `200` with `{"id":"<plan_uuid>","period_key":"2026-W53","status":"ACTIVE","version":1}` plus saved fields. To update, send the same body with `"expected_version":1`; stale version returns `409` with `error.code="PLAN_VERSION_CONFLICT"`.

### 3.5 Add a plan item

- **Purpose:** Pin the occurrence without cloning its task.
- **Method & URL:** `POST {{base_url}}/planning/plans/{{plan_id}}/items`
- **Authorization:** `Bearer Token` → `{{access_token}}`.
- **Headers:** `Content-Type: application/json`.
- **Query/Path:** `plan_id` from 3.4.
- **Body** (`raw` → `JSON`):

```json
{"target_type":"OCCURRENCE","target_id":"{{occurrence_id}}","priority_rank":1,"commitment":"COMMITTED"}
```

- **Scripts → Post-response:**

```javascript
pm.test("pin created", () => pm.response.to.have.status(201));
pm.environment.set("plan_item_id", pm.response.json().id);
```

- **Expected:** `201` with `{"id":"<item_uuid>","period_id":"<plan_uuid>","occurrence_id":"<occ_uuid>","priority_rank":1,"commitment":"COMMITTED"}` plus target key/timestamps. Duplicate: `409` with `error.code="PLAN_ITEM_DUPLICATE"`; foreign or archived target: `404` with `error.code="PLAN_TARGET_NOT_FOUND"`.

### 3.6 Reorder a plan item

- **Purpose:** Change rank and commitment.
- **Method & URL:** `PATCH {{base_url}}/planning/plans/{{plan_id}}/items/{{plan_item_id}}`
- **Authorization:** `Bearer Token` → `{{access_token}}`.
- **Headers:** `Content-Type: application/json`.
- **Query/Path:** IDs from 3.4 and 3.5.
- **Body** (`raw` → `JSON`):

```json
{"priority_rank":2,"commitment":"OPTIONAL"}
```

- **Scripts → Post-response:**

```javascript
pm.test("rank changed", () => {
  pm.response.to.have.status(200);
  pm.expect(pm.response.json().priority_rank).to.eql(2);
});
```

- **Expected:** `200` with `{"id":"<item_uuid>","priority_rank":2,"commitment":"OPTIONAL"}` plus other fields. Empty body or null rank: `422`; foreign `plan_id`/item: `404`.

### 3.7 Preview rollover

- **Purpose:** Review pending occurrences and target week before a write.
- **Method & URL:** `POST {{base_url}}/planning/periods/WEEK/2026-W53/rollover/preview`
- **Authorization:** `Bearer Token` → `{{access_token}}`.
- **Headers:** `Content-Type: application/json`.
- **Query/Path:** Source period.
- **Body** (`raw` → `JSON`):

```json
{"action":"PIN"}
```

- **Scripts → Post-response:**

```javascript
pm.test("target week and candidate", () => {
  pm.response.to.have.status(200);
  const body = pm.response.json();
  pm.expect(body.target_period_key).to.eql("2027-W01");
  const item = body.candidates.find(x => x.occurrence_id === pm.environment.get("occurrence_id"));
  pm.expect(item).to.exist;
  pm.environment.set("occurrence_version", item.version);
});
```

- **Expected:** `200` with `{"source_period_key":"2026-W53","target_period_key":"2027-W01","target_start_date":"2027-01-04","action":"PIN","candidates":[{"occurrence_id":"<occ_uuid>","version":1,"status":"NOT_STARTED"}]}` plus candidate fields. Invalid period: `422`; completed/cancelled occurrences are excluded.

### 3.8 Confirm rollover and replay

- **Purpose:** Pin the selected occurrence in the next week once.
- **Method & URL:** `POST {{base_url}}/planning/rollovers/confirm`
- **Authorization:** `Bearer Token` → `{{access_token}}`.
- **Headers:** `Content-Type: application/json`, `Idempotency-Key: {{idempotency_key}}`.
- **Query/Path:** None.
- **Body** (`raw` → `JSON`):

```json
{"source_period_type":"WEEK","source_period_key":"2026-W53","action":"PIN","items":[{"occurrence_id":"{{occurrence_id}}","expected_version":{{occurrence_version}}}]}
```

- **Scripts → Post-response:**

```javascript
pm.test("rollover accepted or replayed", () => {
  pm.response.to.have.status(200);
  pm.expect(pm.response.json().target_period_key).to.eql("2027-W01");
});
```

- **Expected first call:** `200` with `{"source_period_key":"2026-W53","target_period_key":"2027-W01","action":"PIN","processed_count":1,"occurrence_ids":["<occ_uuid>"],"replayed":false}`. Repeat unchanged: `200`, `replayed=true`, no second pin. Same key with a different action/body: `409` with `error.code="IDEMPOTENCY_CONFLICT"`. Stale `expected_version`: `409` with `error.code="OCCURRENCE_CONFLICT"`; missing key: `422`.

To **move the schedule** instead, preview and confirm with `"action":"RESCHEDULE"` and a *new* idempotency key. The selected occurrence moves to the target start date; its task and completed history remain unchanged.

### 3.9 Read Calendar events

- **Purpose:** Check all-day, timed and due projections separately.
- **Method & URL:** `GET {{base_url}}/calendar/events?start=2026-12-28&end=2027-01-05`
- **Authorization:** `Bearer Token` → `{{access_token}}`.
- **Headers:** None.
- **Query Params:** `start` inclusive, `end` exclusive; range 1–366 days.
- **Body:** None.
- **Scripts → Post-response:**

```javascript
pm.test("calendar has the timed occurrence", () => {
  pm.response.to.have.status(200);
  pm.expect(pm.response.json().timed_occurrences.some(x => x.occurrence_id === pm.environment.get("occurrence_id"))).to.be.true;
});
```

- **Expected:** `200` with `{"start":"2026-12-28","end":"2027-01-05","timezone":"Asia/Ho_Chi_Minh","all_day_occurrences":[],"timed_occurrences":[{"occurrence_id":"<occ_uuid>","title":"BE3 planning example"}],"due_markers":[]}` plus event fields. Reversed or oversized range: `422`; missing auth: `401`.

### 3.10 Check Calendar conflicts

- **Purpose:** Warn before moving/resizing a timed occurrence.
- **Method & URL:** `GET {{base_url}}/calendar/conflicts?start_at=2026-12-29T09:30:00%2B07:00&end_at=2026-12-29T10:30:00%2B07:00`
- **Authorization:** `Bearer Token` → `{{access_token}}`.
- **Headers:** None.
- **Query Params:** `start_at`, `end_at` with offsets; optional `exclude_occurrence_id={{occurrence_id}}` to ignore the item being dragged.
- **Body:** None.
- **Scripts → Post-response:**

```javascript
pm.test("overlap found", () => {
  pm.response.to.have.status(200);
  pm.expect(pm.response.json().has_conflict).to.be.true;
});
```

- **Expected:** `200` with `{"has_conflict":true,"conflicts":[{"occurrence_id":"<occ_uuid>","title":"BE3 planning example"}]}` plus query window fields. With `exclude_occurrence_id`, `has_conflict=false`. Missing offset, reversed window or foreign excluded ID: `422`/`404` respectively.

### 3.11 Remove the source pin

- **Purpose:** Restore the source plan to its previous item list.
- **Method & URL:** `DELETE {{base_url}}/planning/plans/{{plan_id}}/items/{{plan_item_id}}`
- **Authorization:** `Bearer Token` → `{{access_token}}`.
- **Headers:** None.
- **Query/Path:** IDs from 3.4 and 3.5.
- **Body:** None.
- **Scripts → Post-response:**

```javascript
pm.test("pin removed", () => pm.response.to.have.status(204));
```

- **Expected:** `204` with empty body. Repeating the deletion: `404` with `error.code="PLAN_ITEM_NOT_FOUND"`. A closed plan rejects edits with `409` and `error.code="PLAN_CLOSED"`.

## 4 — Quick checklist

- [ ] Year/quarter/month/week/day keys return correct `[start_date, end_date_exclusive)`; `2026-W53` leads to `2027-W01`.
- [ ] Changing `week_starts_on` changes week boundaries; saved plans remain owner scoped.
- [ ] A scheduled and due occurrence appears once in period/Today; due marker remains separate in Calendar.
- [ ] Plan item duplicate, foreign target and stale plan version are rejected.
- [ ] Completed occurrences are absent from rollover preview; replay and changed-body idempotency behave as specified.
- [ ] Conflict windows are half-open: an event ending exactly when another starts is not a conflict.
