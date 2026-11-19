# Git Branch Naming Convention & Workflow

> **Dự án:** Personal Productivity & Time Management App  
> **Phiên bản:** 1.0  
> **Ngôn ngữ:** Tiếng Việt  
> **Áp dụng cho:** Monorepo (`frontend/`, `backend/`, `ai-service/`, `ocr-service/`, `infra/`)  
> **Mục đích:** Quy chuẩn đặt tên nhánh, commit và quy trình hợp nhất code rõ ràng, dễ bảo trì khi dự án mở rộng.

---

## 1. Chiến lược quản lý nhánh

Áp dụng **Git Flow tối giản**: chỉ có hai nhánh tồn tại lâu dài, các nhánh thực hiện công việc có vòng đời ngắn.

| Nhánh | Vai trò | Quy tắc |
|---|---|---|
| `main` | Phiên bản ổn định, đủ điều kiện triển khai | Chỉ nhận thay đổi đã kiểm thử qua Pull Request (PR) |
| `dev` | Nhánh tích hợp các tính năng đang phát triển | Nhận PR từ các nhánh công việc; phải thường xuyên chạy kiểm thử |
| `feature/*`, `fix/*`, … | Nhánh theo từng đầu việc | Tạo từ `dev`, hợp nhất vào `dev`, sau đó xóa |
| `hotfix/*` | Sửa lỗi khẩn cấp trên phiên bản đang triển khai | Tạo từ `main`, đưa bản sửa về cả `main` **và** `dev` |

```text
main  ──────────────────────────────────────●───► production
        ▲                                  ▲
        │ release / PR                     │ hotfix
        │                                  │
dev   ──●─────●────────●────────●─────────●───► integration
            ▲         ▲        ▲
            │         │        │
       feature/*   fix/*   refactor/*
```

> **Lưu ý:** Dấu `/` chỉ là quy ước phân nhóm trong tên nhánh Git, không tạo quan hệ cha–con về mặt kỹ thuật. Không cần tạo các nhánh cố định như `backend`, `frontend`, `database` hay `ai`.

---

## 2. Quy tắc đặt tên nhánh

### 2.1. Cú pháp chuẩn

```text
<type>/<scope>-<short-description>
```

Ví dụ:

```text
feature/be-task-crud
feature/fe-dashboard
feature/db-initial-schema
feature/ai-daily-planner
fix/be-recurrence-duplicates
refactor/be-task-service
chore/infra-docker-compose
```

**Quy định:**

- Chỉ dùng chữ thường (`a-z`), chữ số, dấu gạch ngang `-` và dấu gạch chéo `/` phân cấp tên.
- Mô tả ngắn, dễ đọc, dùng tiếng Anh không dấu theo dạng `kebab-case`.
- Nhánh phải thể hiện **loại thay đổi + phạm vi + mục tiêu**.
- Không dùng khoảng trắng, dấu hai chấm `:`, ký tự đặc biệt hoặc tên chung chung như `new`, `test1`, `update-all`.
- Nếu có Jira/GitHub Issue, có thể thêm ID: `feature/be-task-crud-123` hoặc `feature/PROJ-123-task-crud` (chọn **một** quy ước nhất quán).
- Một nhánh nên tương ứng với một phạm vi thay đổi có thể review và kiểm thử độc lập.

### 2.2. Loại nhánh (type)

| Prefix | Khi sử dụng | Ví dụ |
|---|---|---|
| `feature/` | Thêm chức năng mới | `feature/be-task-details` |
| `fix/` | Sửa lỗi thường | `fix/fe-calendar-overflow` |
| `refactor/` | Cải tổ code không chủ đích đổi hành vi | `refactor/be-task-service` |
| `chore/` | Công việc kỹ thuật, cấu hình, phụ thuộc | `chore/infra-docker-compose` |
| `docs/` | Tài liệu | `docs/api-specification` |
| `test/` | Bổ sung, sửa test | `test/be-recurrence` |
| `perf/` | Tối ưu hiệu năng | `perf/db-task-query` |
| `hotfix/` | Sửa lỗi khẩn cấp trên `main` | `hotfix/auth-token-expiry` |

**Quy ước chọn:** Dùng `feature/` thay vì `feat/` cho branch; dùng `feat(...)` trong commit (Conventional Commits). Hai chuẩn có mục đích khác nhau.

### 2.3. Phạm vi (scope)

| Scope | Thư mục / lĩnh vực | Ví dụ |
|---|---|---|
| `be` | `backend/` — FastAPI, business API | `feature/be-auth` |
| `fe` | `frontend/` — Next.js, UI | `feature/fe-task-details` |
| `db` | MySQL, models, migrations | `feature/db-task-schema` |
| `ai` | `ai-service/` — agents, planning, RAG | `feature/ai-task-extraction` |
| `ocr` | `ocr-service/` — PaddleOCR, document parsing | `feature/ocr-table-extraction` |
| `infra` | Docker, networking, CI/CD, self-host | `chore/infra-minio-setup` |
| `mobile` | iOS React Native / Expo về sau | `feature/mobile-task-list` |
| `contracts` | API contracts, OpenAPI, shared schemas | `feature/contracts-task-api` |
| `product` | Đặc tả nghiệp vụ / tài liệu sản phẩm | `docs/product-planning-workspace` |

**Thay đổi nhiều scope:** Nếu là một feature xuyên tầng, ưu tiên một tên theo nghiệp vụ, ví dụ `feature/task-creation-flow`, miễn PR vẫn đủ nhỏ. Không nhất thiết tách backend/frontend chỉ để bám tên nhánh; có thể chia thành nhiều PR khi cần.

---

## 3. Danh sách tên nhánh gợi ý theo module

### 3.1. Backend (`be`)

```text
feature/be-auth
feature/be-task-crud
feature/be-task-details
feature/be-subtasks
feature/be-checklists
feature/be-recurrence
feature/be-project-management
feature/be-goal-management
feature/be-daily-planning
feature/be-weekly-planning
feature/be-monthly-planning
feature/be-yearly-planning
feature/be-time-tracking
feature/be-reminders
feature/be-analytics
```

### 3.2. Frontend (`fe`)

```text
feature/fe-app-layout
feature/fe-dashboard
feature/fe-task-management
feature/fe-task-details
feature/fe-calendar
feature/fe-daily-workspace
feature/fe-weekly-workspace
feature/fe-monthly-workspace
feature/fe-yearly-workspace
feature/fe-analytics-dashboard
```

### 3.3. Database (`db`)

```text
feature/db-initial-schema
feature/db-task-schema
feature/db-planning-schema
feature/db-goal-schema
feature/db-time-tracking-schema
chore/db-alembic-setup
```

### 3.4. AI / OCR

```text
feature/ai-service-setup
feature/ai-task-extraction
feature/ai-daily-planner
feature/ai-rag-pipeline
feature/ai-chart-generator
feature/ocr-service-setup
feature/ocr-document-processing
feature/ocr-table-extraction
```

### 3.5. Infrastructure (`infra`)

```text
chore/infra-docker-compose
chore/infra-mysql-setup
chore/infra-minio-setup
chore/infra-qdrant-setup
chore/infra-ollama-setup
chore/infra-ci-pipeline
```

---

## 4. Quy trình làm việc chuẩn

### Bước 1 — Đồng bộ `dev`

```bash
git switch dev
git pull --ff-only origin dev
```

> Chỉ dùng `--ff-only` khi local `dev` không có commit riêng chưa được tích hợp. Nếu lệnh thất bại, kiểm tra lịch sử thay vì ép merge.

### Bước 2 — Tạo nhánh mới từ `dev`

```bash
git switch -c feature/db-initial-schema
```

Kiểm tra nhánh đang đứng:

```bash
git branch --show-current
```

### Bước 3 — Thực hiện thay đổi và commit

```bash
git status
git add <file-or-folder>
git commit -m "feat(db): add initial task and occurrence schema"
```

Hạn chế `git add .` khi có file cấu hình, bí mật hoặc thay đổi ngoài ý muốn. Luôn kiểm tra `git diff --staged` trước khi commit.

### Bước 4 — Push nhánh lên GitHub

```bash
git push -u origin feature/db-initial-schema
```

Tạo Pull Request:

```text
base:    dev
compare: feature/db-initial-schema
```

Nếu có GitHub CLI (`gh`) và đã xác thực:

```bash
gh pr create --base dev --head feature/db-initial-schema \
  --title "feat(db): initial schema" \
  --body "Add initial MySQL schema and Alembic migration with tests."
```

### Bước 5 — Review và hợp nhất

Trước khi merge cần kiểm tra:

- [ ] Tính năng đúng yêu cầu nghiệp vụ.
- [ ] Tests liên quan pass.
- [ ] Không commit `.env`, token, mật khẩu hoặc private key.
- [ ] Không làm thay đổi module ngoài phạm vi mà chưa giải thích.
- [ ] API contract/migration đã được cập nhật nếu có thay đổi tương ứng.
- [ ] PR có mô tả mục tiêu, thay đổi chính, cách kiểm thử.

Khuyến nghị **Squash and merge** các feature branch để lịch sử `dev` gọn; việc giữ đầy đủ lịch sử commit riêng lẻ là lựa chọn theo nhu cầu đội nhóm.

### Bước 6 — Dọn nhánh sau khi merge

```bash
git switch dev
git pull --ff-only origin dev
git branch -d feature/db-initial-schema
```

Nếu nhánh đã được squash trên GitHub, `git branch -d` có thể cảnh báo vì commit gốc không nằm trong lịch sử local. Khi đã **xác nhận PR merge thành công và không còn thay đổi cần giữ**, mới dùng:

```bash
git branch -D feature/db-initial-schema
```

Xóa nhánh remote nếu GitHub chưa tự xóa:

```bash
git push origin --delete feature/db-initial-schema
```

---

## 5. Chuẩn commit message — Conventional Commits

Cú pháp:

```text
<type>(<scope>): <description>
```

Ví dụ:

```text
feat(be): implement task CRUD endpoints
feat(db): add task occurrence migration
feat(fe): build weekly planning workspace
feat(ai): implement local task extraction
fix(ocr): handle empty PaddleOCR results
refactor(be): extract recurrence service
chore(infra): configure MinIO persistence
docs(product): document yearly planning requirements
test(be): cover recurrence exceptions
perf(db): optimize scheduled occurrence query
```

**Nguyên tắc:**

- Dùng động từ mô tả thay đổi, ngắn và cụ thể.
- Commit cùng mục đích; tránh một commit chứa nhiều vấn đề không liên quan.
- `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf` là các loại commit khuyến nghị.
- Đối với thay đổi phá vỡ tương thích, ghi rõ breaking change theo chuẩn nhóm (ví dụ dấu `!` hoặc footer `BREAKING CHANGE:`).

---

## 6. Quy trình phát hành `dev` → `main`

Khi nhóm tính năng trên `dev` đã ổn định:

1. Xác nhận test, migration và checklist triển khai.
2. Tạo PR từ `dev` vào `main`.
3. Review các thay đổi tổng hợp.
4. Merge vào `main` sau khi các kiểm tra bắt buộc pass.
5. Tạo tag theo Semantic Versioning nếu có phát hành, ví dụ `v1.0.0`.

```bash
git switch main
git pull --ff-only origin main
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

> Chỉ tag sau khi commit phát hành thực sự đã có trên `main`. Các lệnh trên chỉ minh họa thao tác tag; không thay thế bước tạo/review PR.

### Hotfix từ `main`

```bash
git switch main
git pull --ff-only origin main
git switch -c hotfix/auth-token-expiry
```

Sau khi sửa và kiểm thử, tạo PR vào `main`, sau đó đồng bộ cùng bản sửa về `dev` (qua PR/cherry-pick có kiểm soát). Không để `main` có bản sửa mà `dev` không có.

---

## 7. Quy tắc bảo vệ repository

Đề xuất thiết lập branch protection/rulesets trên GitHub:

| Nhánh | Khuyến nghị |
|---|---|
| `main` | Không push trực tiếp; bắt buộc PR, CI pass; không force-push |
| `dev` | Ưu tiên PR, chạy CI; hạn chế force-push |
| `feature/*` | Có thể push chủ động; hạn chế rewrite lịch sử khi làm chung |

- Không đưa thông tin nhạy cảm vào repository (kể cả nhánh feature).
- PR nên liên kết issue nếu có.
- Database migration phải được test cùng phiên bản code tương ứng.
- Không merge code lỗi chỉ để giữ tiến độ.
- Dọn nhánh đã merge để danh sách nhánh luôn rõ ràng.

---

## 8. Những lỗi thường gặp

### `fatal: 'feat:...' is not a valid branch name`

Tên nhánh Git **không được có `:`**. Đổi thành:

```bash
git switch -c feature/initial-manager-view
```

### `git push` yêu cầu Username/Password GitHub dù đã cấu hình SSH

Kiểm tra URL remote:

```bash
git remote -v
```

Nếu URL đang là HTTPS, đặt lại SSH (thay `OWNER` và `REPO` theo repository thật):

```bash
git remote set-url origin git@github.com:OWNER/REPO.git
ssh -T git@github.com
```

### Có cần tạo nhánh `backend`, `frontend`, `database` không?

Không cần. Đó là **scope** trong tên nhánh ngắn hạn, không phải nhánh tích hợp lâu dài.

### Nên đặt nhánh cho một thay đổi gồm cả frontend và backend như thế nào?

Có thể dùng `feature/task-creation-flow` nếu thực sự là một luồng nghiệp vụ thống nhất. Nếu thay đổi lớn, chia thành nhiều PR có contract rõ ràng.

---

## 9. Checklist trước khi tạo nhánh

- [ ] Xác định loại thay đổi (`feature`, `fix`, `refactor`, ...).
- [ ] Xác định phạm vi (`be`, `fe`, `db`, `ai`, `ocr`, `infra`, ...).
- [ ] Viết mô tả ngắn, nhất quán theo `kebab-case`.
- [ ] Xác định nhánh gốc: bình thường là `dev`, hotfix là `main`.
- [ ] Kiểm tra `git status` trước khi chuyển nhánh.
- [ ] Đồng bộ nhánh gốc từ remote.
- [ ] Có tiêu chí nghiệm thu rõ ràng cho công việc sắp thực hiện.

---

## 10. Quy ước chính thức đề xuất cho dự án

**Nhánh dài hạn:** `main`, `dev`.

**Công thức nhánh:** `<type>/<scope>-<short-description>`.

**Công thức commit:** `<type>(<scope>): <description>`.

**Luồng mặc định:** `dev` → nhánh công việc → PR → `dev` → PR phát hành → `main`.

**Nhánh bắt đầu phù hợp cho công đoạn database hiện tại:**

```text
feature/db-initial-schema
```

> Ưu tiên tên rõ nghĩa, PR nhỏ, review được và code có test. Một quy ước đơn giản được tuân thủ nhất quán có giá trị hơn một hệ thống phân nhánh phức tạp.
