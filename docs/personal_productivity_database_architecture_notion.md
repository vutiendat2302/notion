# Database Architecture & Technology Specification

> **Dự án:** Personal Productivity & Time Management App  
> **Phiên bản tài liệu:** 1.0  
> **Ngày cập nhật:** 17/11/2026  
> **Trạng thái:** Architecture & Technology Baseline — chưa thiết kế ERD/schema chi tiết  
> **Phạm vi:** Kiến trúc database, framework, công cụ, cấu hình, tích hợp FastAPI, vận hành và tiêu chuẩn kỹ thuật  
> **Đối tượng sử dụng:** Developer, AI coding assistant, người review kiến trúc

---

## 1. Executive Summary

Ứng dụng quản lý kế hoạch cá nhân sẽ dùng **MySQL 8.4 LTS** làm hệ quản trị cơ sở dữ liệu quan hệ chính. Database phục vụ chung cho **Next.js Web** và **React Native iOS** thông qua **FastAPI (Python 3.14)**. Các client **không truy cập trực tiếp MySQL**.

Phương án triển khai là **Single Primary Database**, tập trung tính toàn vẹn dữ liệu, transaction, backup và đơn giản trong vận hành. Ở giai đoạn đầu **không triển khai** database cluster, read replica, Redis, message broker hoặc các thành phần phân tán khi chưa có nhu cầu rõ ràng.

**Công cụ quản trị database được chọn: JetBrains DataGrip**. DataGrip thay thế DBeaver trong tất cả hướng dẫn của dự án.

### 1.1. Quyết định đã chốt

| Thành phần | Quyết định | Ghi chú |
|---|---|---|
| Database engine | **MySQL 8.4 LTS** | Sử dụng bản cập nhật bảo mật thuộc nhánh 8.4 LTS |
| Storage engine | **InnoDB** | ACID, foreign keys, row-level locking |
| Backend runtime | **Python 3.14** | Kiểm thử dependency và lock version |
| Backend framework | **FastAPI** | REST API dùng chung cho web và iOS |
| Backend architecture | **Hybrid Modular Monolith** | Feature-first, layer-based bên trong |
| ORM | **SQLAlchemy 2.x** | Typed ORM, AsyncSession |
| Async MySQL driver | **asyncmy** | Sử dụng qua SQLAlchemy async dialect |
| Schema migration | **Alembic** | Một migration history cho toàn database |
| Dependency management | **uv + uv.lock** | Khóa phiên bản đã kiểm thử |
| Local orchestration | **Docker Compose** | MySQL container và persistent volume |
| Database IDE | **JetBrains DataGrip** | Query, inspect schema, xem và quản trị dữ liệu |
| Default character set | **utf8mb4** | Tiếng Việt, ký tự Unicode, emoji |
| Default collation | **utf8mb4_0900_ai_ci** | Có ngoại lệ cho các trường cần so sánh chính xác |
| Time storage | **UTC** | Backend chuyển timezone tại ranh giới API |
| Initial deployment | **Single Primary MySQL** | Không thêm replica/cluster |

### 1.2. Những gì chưa chốt ở tài liệu này

- ERD, danh sách bảng, cột, foreign keys và indexes cụ thể.
- Lựa chọn cuối cùng giữa UUID dạng `BINARY(16)` hay các kiểu ID khác.
- Phạm vi các bảng `goals`, `habits`, `reminders` và cơ chế lưu lịch sử.
- Managed MySQL provider, VPS cụ thể và giá thuê production.
- Backup retention chính thức, RPO/RTO và quy mô dữ liệu dự kiến.
- Có dùng read models/materialized aggregates cho Analytics hay không.

**Nguyên tắc:** Không tự biến những đề xuất chưa duyệt thành quyết định đã chốt.

---

## 2. Design Goals & Non-Goals

### 2.1. Mục tiêu kiến trúc

1. **Data Integrity First:** Không mất lịch sử task, recurrence, time tracking khi cập nhật.
2. **Predictable Transactions:** Một nghiệp vụ nhiều bước phải commit/rollback nhất quán.
3. **Stable Time Semantics:** Không nhầm giờ địa phương với UTC, tránh lỗi lịch nhắc.
4. **Maintainability:** Đổi bảng bằng migration, không sửa thủ công production schema.
5. **Security:** Database không phơi trực tiếp Internet, tài khoản app có quyền tối thiểu.
6. **Low Operational Cost:** Chạy được local Docker và deploy cloud quy mô nhỏ.
7. **Mobile-ready:** Web và iOS cùng sử dụng một backend, không truy cập MySQL trực tiếp.
8. **Auditable Changes:** Dữ liệu quan trọng có trường thời gian và chính sách lưu lịch sử rõ ràng ở giai đoạn thiết kế schema.

### 2.2. Không nằm trong phạm vi giai đoạn này

- Thiết kế chi tiết `CREATE TABLE` cho Tasks, Calendar, Habits, Analytics.
- Chọn microservices, CQRS đa database hay event sourcing.
- Tối ưu quy mô hàng triệu người dùng ngay từ đầu.
- Đưa business logic vào stored procedure/triggers nếu không có lý do cụ thể.
- Cài tất cả công cụ hoặc dịch vụ trả phí chỉ vì chúng phổ biến.

---

## 3. System Architecture

### 3.1. Sơ đồ tổng thể

```mermaid
flowchart TB
    WEB[Next.js Web App]
    IOS[React Native iOS App - phase later]
    API[FastAPI REST API - Python 3.14]
    SVC[Domain Services - Hybrid Architecture]
    REPO[Repositories - SQLAlchemy 2.x]
    POOL[SQLAlchemy Async Engine + asyncmy]
    MYSQL[(MySQL 8.4 LTS / InnoDB)]
    WORKER[Reminder / Recurrence Worker]
    MIG[Alembic Migrations]
    BACKUP[Backups + Restore Validation]
    IDE[JetBrains DataGrip - authorized admin]

    WEB -->|HTTPS| API
    IOS -->|HTTPS| API
    API --> SVC
    SVC --> REPO
    REPO --> POOL
    POOL --> MYSQL
    WORKER --> SVC
    MIG --> MYSQL
    MYSQL --> BACKUP
    IDE -.->|Local port or secure tunnel| MYSQL
```

> `Worker → Service` là hướng phụ thuộc ở mức nghiệp vụ; worker dùng các service/repository thông qua session và transaction được quản lý, không gọi HTTP endpoint nội bộ không cần thiết.

### 3.2. Nguyên tắc kết nối

- **Next.js / React Native → FastAPI:** HTTPS REST, xác thực và phân quyền tại backend.
- **FastAPI → SQLAlchemy → asyncmy → MySQL:** Mọi query nghiệp vụ đi qua data access layer.
- **Alembic → MySQL:** Chỉ migration mới thay đổi schema có kiểm soát.
- **DataGrip → MySQL:** Chỉ cho truy cập phát triển hoặc quản trị được cấp phép; production dùng kết nối bảo mật.
- **Background worker → MySQL:** Có session/transaction riêng; không chia sẻ `AsyncSession` đồng thời giữa các job.

### 3.3. Kiến trúc triển khai theo môi trường

| Environment | Database | Kết nối | Chính sách |
|---|---|---|---|
| Local / Development | MySQL 8.4 trong Docker | Backend container dùng `mysql:3306`; DataGrip dùng `127.0.0.1:3307` | Có thể reset dữ liệu test |
| Automated Test | MySQL container riêng, cùng nhánh 8.4 | Cô lập mỗi test suite | Chạy migration, test constraints, không dùng SQLite để thay MySQL |
| Staging (tùy chọn) | MySQL riêng | Mạng riêng / TLS | Kiểm tra migration và restore trước production |
| Production | Managed MySQL hoặc VPS MySQL | Private network hoặc TLS | Backups, least privilege, monitoring |

**Không dùng chung database development và production.** Không đặt tài khoản quản trị database trong frontend.

---

## 4. Database Technology Stack

| Layer | Công nghệ | Vai trò chính | Mức ưu tiên |
|---|---|---|---|
| RDBMS | MySQL 8.4 LTS Community | Relational persistence | Bắt buộc |
| Storage | InnoDB | ACID, foreign keys, locking | Bắt buộc |
| Python ↔ DB | asyncmy | Async MySQL driver | Bắt buộc khi dùng async SQLAlchemy |
| ORM | SQLAlchemy 2.x | Typed models, query abstraction | Bắt buộc |
| Async session | `AsyncSession`, `async_sessionmaker` | Unit of Work per operation | Bắt buộc |
| Schema versioning | Alembic | Migrations có thứ tự | Bắt buộc |
| Configuration | Pydantic Settings | Quản lý URL, pool, environment | Đề xuất |
| Package management | uv | Sync và lock dependencies | Bắt buộc |
| Local database | Docker Compose | Container, volume, healthcheck | Bắt buộc |
| SQL IDE | **DataGrip** | SQL console, schemas, records, query plan | Bắt buộc theo lựa chọn của dự án |
| Schema visualization | DataGrip diagram / dbdiagram.io | Xem/sửa thiết kế ERD | Tùy nhu cầu |
| Data seeding | Python scripts + SQL migrations | Seed dữ liệu dev/test | Khi cần |
| Backup | `mysqldump` / managed backup | Sao lưu nhất quán và restore | Bắt buộc |
| Metrics | MySQL status + application metrics | Connections, errors, latency | Bắt buộc ở mức cơ bản |

### 4.1. Quy tắc tương thích phiên bản

- Dùng **Python 3.14 tiêu chuẩn**, không mặc định bật free-threading build.
- **Không tự pin version mới nhất** bằng suy đoán. Dùng `uv lock`, `uv sync` rồi chạy thử trên môi trường thật.
- `asyncmy` 0.2.17 có wheel CPython 3.14 trên Linux; đây là dấu hiệu hỗ trợ đóng gói, **không thay thế integration test**.
- Với SQLAlchemy, giữ cùng major được kiểm chứng trong CI; đọc release notes trước khi cập nhật lớn.
- Mỗi lần đổi MySQL minor/patch, chạy ít nhất migration smoke test, integration tests và restore rehearsal.

---

## 5. MySQL Server Configuration

### 5.1. Baseline

| Thuộc tính | Cấu hình khởi đầu | Lý do |
|---|---|---|
| Version line | `8.4` LTS | Ổn định và kiểm soát nâng cấp |
| Engine | `InnoDB` | Transaction và khóa hàng |
| Character set | `utf8mb4` | Unicode đầy đủ |
| Collation mặc định | `utf8mb4_0900_ai_ci` | Search/sort không phân biệt hoa thường và dấu theo collation |
| Server timezone | `+00:00` (UTC) | Nhất quán với backend |
| SQL mode | Giữ strict mode của MySQL; kiểm tra thực tế | Tránh silent truncation và chuyển kiểu ngoài ý muốn |
| Transaction isolation | Mặc định InnoDB `REPEATABLE READ` | Chỉ thay đổi khi có yêu cầu và test chứng minh |
| Foreign keys | Enforced | Bảo vệ quan hệ dữ liệu |
| Network | Localhost / private network | Tránh mở 3306 ra Internet |
| Durability | Ưu tiên cấu hình durable mặc định | Không hy sinh an toàn dữ liệu để đổi lấy tốc độ |

### 5.2. Charset, collation và dữ liệu tiếng Việt

- Dùng `utf8mb4` từ server → database → bảng → connection.
- Mặc định `utf8mb4_0900_ai_ci` hữu ích cho tìm kiếm người dùng, nhưng **accent-insensitive và case-insensitive**: không dùng máy móc cho mọi unique key.
- Những trường cần so sánh byte-exact như token hash, opaque key, idempotency key nên dùng binary/varbinary hoặc collation phù hợp khi thiết kế schema.
- Kiểm tra riêng hành vi so sánh tiếng Việt, Unicode normalization, dấu và emoji trong test thực tế.

### 5.3. Date/Time & Timezone Policy

**Quy ước:** Thời điểm tuyệt đối được xử lý timezone-aware trong Python, chuyển về UTC trước khi lưu. Khi sử dụng MySQL `DATETIME(6)` phải hiểu rằng cột **không lưu timezone**.

- `Instant`: lưu UTC, có quy ước chuyển đổi rõ ở ORM/type layer và API.
- `Local calendar date`: dùng `DATE` cho ngày lịch mang ý nghĩa địa phương, không ép mọi ngày thành UTC instant.
- `Scheduled wall-clock time`: lưu đủ thông tin ngày/giờ local và timezone theo nghiệp vụ khi thiết kế recurrence/reminder.
- `TIMESTAMP` có quy tắc timezone/giới hạn riêng; chỉ dùng khi đã đánh giá rõ.
- Múi giờ mặc định hiển thị: `Asia/Ho_Chi_Minh`; cho phép user setting về sau.
- Test các tình huống qua ngày, qua tháng, thay đổi timezone, lịch lặp và reminder đến hạn.

**Ví dụ:** “Học tiếng Anh mỗi ngày lúc 20:00” là quy tắc theo giờ địa phương, không thể biểu diễn đầy đủ chỉ bằng một UTC timestamp cố định.

### 5.4. Định hướng kiểu dữ liệu (chưa chốt schema)

| Nhóm dữ liệu | Định hướng | Cảnh báo |
|---|---|---|
| Khóa chính | UUID với chiến lược thống nhất; xem xét `BINARY(16)` | Phải thống nhất byte order / serialize |
| Thời điểm | `DATETIME(6)` lưu UTC | MySQL không tự giữ tzinfo |
| Ngày lịch | `DATE` | Không dùng thay timestamp |
| Thời lượng | Số giây/phút dạng integer | Tránh float cho phép cộng thời lượng |
| Số đo tài chính/mục tiêu | `DECIMAL` nếu cần chính xác | Tránh float khi yêu cầu tính toán chính xác |
| JSON metadata | `JSON` chỉ với dữ liệu ít cấu trúc | Không thay thế quan hệ và foreign key |
| Trạng thái | Enum ứng dụng / constrained value theo thiết kế | Chọn giữa DB ENUM và VARCHAR có chủ đích |

### 5.5. Index & Performance Policy

- Index được thiết kế từ **query patterns thực tế**, không index mọi cột.
- Khuyến nghị index các truy vấn thường gặp: user, ngày, trạng thái, occurrence, project (quyết định cuối ở ERD).
- Kiểm tra `EXPLAIN`/`EXPLAIN ANALYZE` trên query chậm.
- Tránh N+1 queries qua SQLAlchemy `selectinload`/`joinedload` khi cần.
- List endpoints phải có pagination; không trả toàn bộ lịch sử trong một request.
- Với Analytics, bắt đầu bằng SQL aggregate/read queries, **chưa cần database thứ hai**.

---

## 6. Hybrid Backend Integration

### 6.1. Ranh giới module và hạ tầng chung

```text
backend/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   └── logging.py
│   ├── db/
│   │   ├── base.py             # SQLAlchemy Declarative Base
│   │   ├── engine.py           # Async Engine + Pool
│   │   ├── session.py          # AsyncSession factory / DI
│   │   ├── metadata.py         # Register all ORM metadata for Alembic
│   │   └── types.py            # Shared DB types only when necessary
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── tasks/
│   │   │   ├── api/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── models/
│   │   │   ├── schemas/
│   │   │   │   ├── requests/
│   │   │   │   └── responses/
│   │   │   ├── mappers/
│   │   │   └── domain/
│   │   ├── projects/
│   │   ├── categories/
│   │   ├── calendar/
│   │   ├── time_tracking/
│   │   ├── reminders/
│   │   ├── analytics/
│   │   ├── habits/
│   │   └── goals/
│   ├── workers/
│   └── shared/
├── alembic/
│   ├── env.py
│   └── versions/
├── infra/
│   └── mysql/
│       └── my.cnf
├── tests/
│   ├── unit/
│   ├── integration/
│   └── database/
├── docker-compose.yml
├── pyproject.toml
├── uv.lock
└── .env.example
```

**Quy định:** `db/` chỉ chứa hạ tầng chung (engine, session, metadata, types). ORM models và repositories đặt trong từng domain module. Chỉ có một Alembic migration history quản lý toàn bộ MySQL schema.

### 6.2. Request / Response flow

```text
Next.js / iPhone
  → FastAPI Router
  → Pydantic Request DTO
  → Application Service
  → Repository
  → SQLAlchemy AsyncSession
  → asyncmy
  → MySQL InnoDB
  → Repository result
  → Service (complete business flow)
  → Mapper / Pydantic Response DTO
  → JSON response
```

Mapper là bước chuyển đổi dữ liệu, **không** tự truy vấn DB. Với response rất đơn giản có thể sử dụng Pydantic trực tiếp thay vì tạo mapper rỗng.

### 6.3. Ownership và transaction boundaries

| Thành phần | Trách nhiệm | Không được làm |
|---|---|---|
| Router | HTTP, authentication, request parsing | Viết SQL hoặc tự commit |
| Service | Business logic, orchestration, transaction | Phụ thuộc vào HTTP Request để tính nghiệp vụ |
| Repository | SQLAlchemy data access, query | Tự ý commit theo từng CRUD; quyết định nghiệp vụ |
| ORM Model | Ánh xạ bảng, quan hệ, constraints | Chứa HTTP logic |
| Mapper | ORM/Domain → DTO | Gọi DB/network |
| db infrastructure | Engine, session, base metadata | Chứa logic Task/Reminder |
| Worker | Kích hoạt workflow theo schedule | Bỏ qua idempotency, chia sẻ session đồng thời |

**Transaction owner:** Application Service hoặc Unit of Work. Repository có thể `add`, `flush`, `select`, `delete` nhưng không quyết định `commit` cho một chuỗi nghiệp vụ.

### 6.4. Cấu hình SQLAlchemy Async Engine (minh họa)

```python
# app/db/engine.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_size=5,
    max_overflow=5,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    autoflush=False,
)
```

```python
# app/db/session.py
from collections.abc import AsyncIterator
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.engine import AsyncSessionLocal

async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session
```

Ví dụ điều phối transaction trong Service:

```python
async def create_task(self, command: CreateTaskCommand) -> Task:
    async with self.session.begin():
        task = await self.task_repository.create(command)
        # Additional writes and validation within the same transaction.
        return task
```

**Chú ý:** Đoạn code ở trên là kiến trúc tham khảo, không phải implementation hoàn chỉnh. Hạn chế bắt đầu transaction sau khi session đã tự mở transaction từ một query khác (`autobegin`). Cần kiểm thử cụ thể cơ chế dependency/session khi triển khai.

### 6.5. Pool sizing

- Cấu hình ban đầu: `pool_size=5`, `max_overflow=5`, `pool_pre_ping=True`, `pool_recycle=1800`.
- Tổng kết nối tiềm năng = số API worker × (pool_size + max_overflow) **cộng** kết nối từ worker/migration/DataGrip.
- Đối với app cá nhân, dùng ít worker; tránh tăng worker mà không kiểm tra `max_connections` của MySQL.
- Không tạo một `AsyncSession` toàn cục dùng chung cho nhiều request hoặc concurrent tasks.
- Đóng và dispose engine khi process shutdown.

---

## 7. Local Development — Docker Compose

### 7.1. Yêu cầu

- Ubuntu + Docker Engine + Docker Compose plugin.
- DataGrip cài trên máy cá nhân.
- MySQL trong container với persistent volume.
- MySQL chỉ mở cổng trên loopback để DataGrip truy cập, **không public Internet**.
- Tách biến môi trường bí mật khỏi Git.

### 7.2. `docker-compose.yml` tham khảo

```yaml
services:
  mysql:
    image: mysql:8.4
    container_name: productivity-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:?required}
      MYSQL_DATABASE: ${MYSQL_DATABASE:-productivity}
      MYSQL_USER: ${MYSQL_USER:-productivity_app}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:?required}
    ports:
      - "127.0.0.1:3307:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./infra/mysql/my.cnf:/etc/mysql/conf.d/zz-productivity.cnf:ro
    healthcheck:
      test:
        - CMD-SHELL
        - 'mysql -h 127.0.0.1 -u root -p"$$MYSQL_ROOT_PASSWORD" -N -e "SELECT 1" >/dev/null 2>&1'
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 30s

volumes:
  mysql_data:
```

Giải thích cổng:

- Bên trong Docker network: `mysql:3306`.
- Trên Ubuntu host / DataGrip: `127.0.0.1:3307`.
- Chọn host port `3307` để tránh xung đột nếu máy đã có MySQL ở `3306`.
- Khi đưa lên production, không dùng mẫu port mapping này để expose MySQL ra mạng công cộng.

**Lưu ý:** Trước lần chạy đầu, tạo file `./infra/mysql/my.cnf` để bind mount không lỗi.

### 7.3. `infra/mysql/my.cnf` tham khảo

```ini
[mysqld]
character-set-server=utf8mb4
collation-server=utf8mb4_0900_ai_ci
default-time-zone='+00:00'
```

Giữ cấu hình MySQL tối giản. Chưa chỉnh `innodb_buffer_pool_size`, redo logs hay durability settings theo cảm tính. Khi có số liệu tài nguyên và workload thực tế mới tối ưu tiếp.

### 7.4. `.env.example`

```dotenv
# Development example only — never commit real passwords.
MYSQL_ROOT_PASSWORD=replace_with_strong_root_password
MYSQL_DATABASE=productivity
MYSQL_USER=productivity_app
MYSQL_PASSWORD=replace_with_strong_app_password

# Backend inside Docker Compose network:
DATABASE_URL=mysql+asyncmy://productivity_app:YOUR_URL_ENCODED_PASSWORD@mysql:3306/productivity?charset=utf8mb4

# Backend running directly on the host (alternative):
# DATABASE_URL=mysql+asyncmy://productivity_app:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:3307/productivity?charset=utf8mb4
```

**Quan trọng:** Password chứa `@`, `:`, `/`, `%` hoặc ký tự URL đặc biệt phải được URL-encode trong connection string, hoặc dùng `SQLAlchemy URL.create()` để tránh lỗi parse.

### 7.5. Các lệnh cơ bản

```bash
# Create actual .env locally, set unique strong passwords.
cp .env.example .env

# Start DB
docker compose up -d mysql

# View status/logs
docker compose ps
docker compose logs -f mysql

# Check server version
# Password is read from inside the container environment.
docker compose exec mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" -N -e "SELECT VERSION()" "$MYSQL_DATABASE"'

# Stop container, keep data
docker compose stop mysql

# Start again
docker compose start mysql
```

**Cảnh báo:** `docker compose down -v` xóa named volumes, có thể xóa dữ liệu không khôi phục được nếu chưa backup. Không đưa lệnh này vào workflow thường ngày.

---

## 8. DataGrip — Database IDE Chính Thức

### 8.1. Mục đích sử dụng

DataGrip là nơi developer thực hiện:

- Quản lý Data Sources cho MySQL local/staging/production.
- Duyệt schema, tables, views, foreign keys và indexes.
- Viết SQL, kiểm tra query plan, test query thủ công.
- Xem và chỉnh dữ liệu test ở môi trường development.
- Xem sơ đồ quan hệ khi đã có ERD/schema.
- Kiểm tra migration result và database version.

**DataGrip không thay thế Alembic** trong việc quản lý version schema.

### 8.2. Cấu hình kết nối Local MySQL

1. Khởi chạy Docker Compose và kiểm tra MySQL healthy.
2. Mở **DataGrip → File → New → Data Source → MySQL** (hoặc chọn MySQL từ Database Explorer).
3. Nhập thông tin:

| Trường | Giá trị cho local |
|---|---|
| Name | `Productivity - Local` |
| Host | `127.0.0.1` |
| Port | `3307` |
| Database | `productivity` |
| User | `productivity_app` |
| Password | Giá trị `MYSQL_PASSWORD` trong `.env` local |
| Driver | MySQL (JDBC) do DataGrip quản lý |

4. Khi DataGrip yêu cầu, cài/download MySQL driver.
5. Bấm **Test Connection**; sau khi thành công bấm Apply/OK.
6. Mở console và chạy:

```sql
SELECT VERSION();
SELECT DATABASE();
SELECT @@time_zone, @@system_time_zone;
SHOW VARIABLES LIKE 'character_set_server';
SHOW VARIABLES LIKE 'collation_server';
SHOW VARIABLES LIKE 'sql_mode';
```

7. Chỉ sau khi các giá trị khớp tài liệu mới bắt đầu xây migrations và models.

### 8.3. DataGrip với Production

- **Không mở public port 3306** chỉ để DataGrip kết nối.
- Nếu bắt buộc quản trị remote, ưu tiên SSH tunnel, VPN hoặc private network; dùng TLS khi đi qua mạng ngoài máy tin cậy.
- Tạo tài khoản **read-only** cho tác vụ quan sát/query production; thao tác ghi dùng cơ chế phê duyệt rõ ràng.
- Không dùng tài khoản root cho kết nối DataGrip thường ngày.
- Bật xác nhận thao tác nguy hiểm và xác minh môi trường trước khi chạy UPDATE/DELETE.
- Không lưu/export production secrets trong Git hay tài liệu Notion.

### 8.4. DataGrip & Schema Governance

| Công việc | Công cụ chủ quản |
|---|---|
| Thiết kế ERD | Tài liệu + DataGrip diagram/dbdiagram.io |
| Tạo và chỉnh schema ứng dụng | **Alembic migrations** |
| Duyệt schema đã apply | **DataGrip** |
| Xem/test query | **DataGrip** |
| Seed data tự động | Scripts / tests version-controlled |
| Backup và restore | MySQL tools hoặc managed backup |

Không sửa bảng thủ công trên production rồi bỏ qua migration. Nếu có hotfix khẩn cấp, phải bổ sung migration tương ứng và ghi nhận change.

---

## 9. Migration Management — Alembic

### 9.1. Quy tắc

1. **One database, one migration history** cho toàn app.
2. Toàn bộ schema changes nằm trong `alembic/versions/` và được review.
3. Không dùng `Base.metadata.create_all()` cho production deployment.
4. `alembic revision --autogenerate` chỉ tạo bản nháp; developer **phải đọc, sửa và kiểm tra**.
5. Không xóa các cột/bảng có dữ liệu nếu chưa có phương án backup, data migration và kiểm thử.
6. `downgrade()` có thể không bảo toàn dữ liệu; rollback production thường cần migration sửa sai hoặc restore theo kế hoạch.
7. Không chạy đồng thời hai instance migration trên cùng một database.

### 9.2. Đặc điểm MySQL cần lưu ý

Nhiều lệnh DDL (`ALTER TABLE`, `CREATE TABLE`, `DROP TABLE`, v.v.) gây **implicit commit** trong MySQL. Không được giả định rằng toàn bộ schema migration có thể rollback nguyên tử giống một transaction DML thông thường.

Hệ quả:

- Migration phải có cách khôi phục khi chạy lỗi giữa chừng.
- Trước migration nguy hiểm cần backup và kiểm tra staging.
- Tách data migration phức tạp khỏi thay đổi schema nếu cần.
- Ưu tiên expand → migrate data → contract khi thay đổi cột được client đang dùng.

### 9.3. Quy trình phát hành schema

```text
Edit ORM models / schema design
   ↓
Create Alembic revision
   ↓
Review generated SQL and constraints
   ↓
Apply to fresh test database
   ↓
Run tests + verify with DataGrip
   ↓
Backup target environment
   ↓
Apply once in deployment pipeline
   ↓
Smoke test / monitoring
```

### 9.4. API và mobile compatibility

Khi iOS xuất hiện, backend và database có thể deploy nhiều lần trong khi app iPhone chưa được cập nhật. Schema migration cần duy trì khả năng tương thích tối thiểu qua một khoảng chuyển tiếp, tránh xóa/đổi nghĩa trường mà API cũ vẫn sử dụng.

---

## 10. Domain Ownership — Chưa Thiết Kế Bảng

Danh sách dưới đây là **ranh giới ownership dự kiến**, không phải ERD hoặc danh sách bảng chính thức.

| Domain | Sở hữu logic/dữ liệu | Ranh giới quan trọng |
|---|---|---|
| Auth & Users | Identity, credentials, sessions, settings | Không đưa secrets vào domain khác |
| Projects | Gom nhóm và tiến độ dự án | Không trực tiếp sửa occurrence lịch sử |
| Categories | Danh mục công việc | Dùng chung theo quy tắc service |
| Tasks | Task definition, recurrence rules, task occurrences | Nguồn sự thật cho lịch công việc |
| Calendar | Query/view lịch từ occurrence | Không tạo thêm bảng “calendar copy” chỉ để hiển thị |
| Time Tracking | Actual time entries, timer sessions | Không suy ra actual time từ planned time |
| Reminders | Scheduled reminders, dispatch state | Idempotency, retry, delivery attempts |
| Habits | Habit model và check-in (nếu tách riêng) | Chốt mô hình sau khi review business rules |
| Goals | Mục tiêu dài hạn, progress | Không ép tất cả goal thành % task hoàn thành |
| Analytics | Read queries, aggregates, metrics | Không sở hữu dữ liệu nguồn trùng lặp |

### 10.1. Ba thực thể nền tảng cần bảo toàn ở bước schema

- **Task:** định nghĩa công việc gốc.
- **Task Occurrence:** một lần xuất hiện của công việc theo lịch và có trạng thái riêng.
- **Time Entry:** phiên hoạt động thực tế, có thể liên kết occurrence hoặc độc lập.

**Không lưu trạng thái DONE duy nhất tại Task definition** nếu đó là công việc lặp. Không xóa lịch sử hoàn thành khi sửa recurrence hoặc archive task.

---

## 11. Concurrency, Idempotency & Data Integrity

### 11.1. Recurrence engine

- Một lần lặp phải có **recurrence identity** xác định được (ví dụ: rule + occurrence key, chi tiết chốt ở schema).
- Enforce unique constraint ở MySQL, không chỉ check trong Python.
- Job chạy lại không được tạo thêm occurrence trùng.
- Khi sửa recurrence, giữ nguyên các occurrence đã hoàn thành theo chính sách history.
- Test hai worker cùng sinh occurrence đồng thời.

### 11.2. Time tracking

- Không cộng trùng time entries bị overlap nếu metric định nghĩa Active Time là tổng thời gian thực tế duy nhất.
- Timer start/pause/resume/stop cần trạng thái rõ và cơ chế phục hồi session bị bỏ quên.
- Dữ liệu actual time không tự sinh từ planned schedule.
- Phân biệt `MANUAL` và `TIMER` theo nghiệp vụ.

### 11.3. Reminder reliability

- Reminder worker phải có truy vấn đến hạn + cách **claim job nguyên tử** phù hợp, tránh hai worker gửi cùng một reminder.
- Mỗi reminder cần idempotency key và trạng thái xử lý.
- Retry có backoff và giới hạn; không retry vô hạn.
- Không gửi notification bên trong transaction giữ lock quá lâu.
- Định nghĩa rõ hành vi khi commit thành công nhưng provider gửi timeout: có khả năng gửi trùng, phải có biện pháp dedupe nếu provider hỗ trợ.
- Bắt đầu với DB-backed scheduler/worker cho một người dùng; chưa cần Kafka/Celery/Redis nếu chưa có số liệu yêu cầu.

### 11.4. Isolation / Locking

- Mặc định dùng InnoDB `REPEATABLE READ`; test các trường hợp race condition thực tế.
- Với thao tác cùng sửa một đối tượng, cân nhắc `SELECT ... FOR UPDATE`, optimistic versioning hoặc unique constraint.
- Không mặc định dùng lock toàn bảng.
- Không nhầm lẫn isolation level với đảm bảo nghiệp vụ; cần test bằng concurrent transactions.

---

## 12. Database Security

### 12.1. Nguyên tắc bắt buộc

- **Least privilege:** App user chỉ có quyền cần thiết cho CRUD runtime. Migration có thể dùng credential riêng được cấp quyền DDL.
- **No root in app:** Backend không dùng MySQL root account.
- **Secrets management:** Không commit `.env`, không đưa database password vào frontend bundle, logs hoặc Notion.
- **Parameter binding:** SQLAlchemy parameterized queries; không nối SQL từ user input.
- **Ownership authorization:** Mọi query người dùng phải lọc và kiểm tra quyền sở hữu ở backend.
- **Private connectivity:** DB chỉ mở trong Docker network/private network; DataGrip remote qua secure access.
- **TLS for remote DB:** Bật TLS và xác minh chứng chỉ khi dùng kết nối mạng không tin cậy.
- **Data minimization:** Chỉ lưu dữ liệu cần cho app; tránh lưu token plaintext không cần thiết.
- **Auditing:** Log sự kiện quan trọng mà không log mật khẩu, token, PII nhạy cảm.

### 12.2. Environment separation

- Tài khoản, database và credentials cho Dev/Test/Prod phải riêng.
- Không dùng data dump production ở dev nếu chưa masking/anonymizing khi có thông tin nhạy cảm.
- Migrations chạy bằng workflow có kiểm soát; tránh DataGrip tự ý sửa production schema.

---

## 13. Backup & Disaster Recovery

### 13.1. Nguyên tắc

- Backup **không phải** là một Docker volume nằm cùng ổ cứng duy nhất.
- Lưu ít nhất một bản backup ngoài máy/volume chạy database.
- Tự động backup theo tần suất tương ứng RPO; retention và encryption phải được chốt trước production.
- Kiểm thử **restore thật** lên database riêng theo định kỳ.
- Không chạy schema migration phá hủy dữ liệu đồng thời với logical dump.

### 13.2. Logical backup bằng mysqldump (development example)

```bash
# Save into a secure local directory outside the DB volume.
umask 077
mkdir -p backups

docker compose exec -T mysql sh -c \
  'exec mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" \
  --single-transaction --quick --no-tablespaces \
  --set-gtid-purged=OFF "$MYSQL_DATABASE"' \
  > "backups/productivity_$(date +%F_%H%M%S).sql"
```

`--single-transaction` phù hợp để lấy snapshot nhất quán với InnoDB, nhưng không nên chạy DDL thay đổi schema đồng thời. Với MySQL Managed, ưu tiên tích hợp backup chính thức của provider và kiểm thử restore bằng phương thức đó.

### 13.3. Restore rehearsal

1. Tạo database **riêng cho restore**, không ghi đè dev/prod đang hoạt động.
2. Restore dump vào DB mới bằng MySQL client hoặc DataGrip với quyền phù hợp.
3. Kiểm tra version, charset, schema revision, số bản ghi quan trọng.
4. Chạy integration/smoke tests đối với database phục hồi.
5. Ghi lại thời gian restore thực tế để quyết định RTO.

**Không chạy lệnh restore vào production nếu chưa xác định đúng host/database và có kế hoạch rollback.**

---

## 14. Monitoring & Operational Baseline

### 14.1. Chỉ số cần quan sát

| Nhóm | Chỉ số |
|---|---|
| Availability | Database reachable, failed connections |
| Performance | Query latency P50/P95, slow queries |
| Connections | Threads connected, connection pool usage, wait time |
| Transactions | Deadlocks, lock wait timeouts, rollback count |
| Capacity | Database size, free disk, storage growth |
| Replication | Không áp dụng ở giai đoạn Single Primary |
| Data quality | Duplicate prevention failures, integrity violations |
| Migrations | Applied Alembic revision, migration errors |
| Backup | Last successful backup, restore test timestamp |

### 14.2. Health checks

- **Liveness:** FastAPI process còn chạy; không bắt buộc query DB.
- **Readiness:** Kiểm tra có thể kết nối DB bằng query nhẹ như `SELECT 1`.
- Không expose server/database details, credential hoặc stack trace qua public health endpoint.
- Không coi container `running` là bằng chứng ứng dụng đã đọc/ghi DB đúng.

---

## 15. Test Strategy

| Test class | Nội dung | Công cụ |
|---|---|---|
| ORM mapping | Datatypes, relation, UUID, timestamp | pytest + SQLAlchemy |
| Migration smoke | Fresh DB → head, schema consistent | Alembic + MySQL container |
| Repository integration | CRUD, unique, FK, filtering by user | pytest + real MySQL |
| Transaction | Commit/rollback khi multi-step fail | pytest |
| Concurrency | Duplicate recurrence, racing reminders | Async tests |
| Timezone | UTC/local conversion, date boundary | pytest + test matrix |
| Index/query | EXPLAIN, query shape, pagination | MySQL/DataGrip |
| Backup/restore | Restore dump into test DB | Shell + MySQL |
| Security | Authorization, secret handling | Integration & code review |

Không dùng SQLite như DB thay thế duy nhất cho integration tests: MySQL khác SQLite ở collation, types, transaction, locking và migration behavior.

### 15.1. Acceptance gates trước production

- [ ] Python 3.14 + SQLAlchemy + asyncmy cài được trên Docker Linux target.
- [ ] MySQL 8.4 chạy healthy và DataGrip kết nối thành công.
- [ ] Charset/collation/timezone được xác minh bằng SQL.
- [ ] Migrations chạy thành công trên fresh DB.
- [ ] Lịch sử task/occurrence/time entries được bảo toàn qua update.
- [ ] Concurrency tests chứng minh không tạo occurrence trùng.
- [ ] Reminder retries không dẫn đến gửi trùng không kiểm soát.
- [ ] Có bản backup độc lập và restore rehearsal thành công.
- [ ] MySQL không có public port ngoài ý muốn.
- [ ] Ứng dụng không dùng root DB user.

---

## 16. Deployment & Scaling Strategy

### 16.1. Phase 1 — Local development

- MySQL Docker + named volume.
- FastAPI chạy local hoặc Docker.
- DataGrip kết nối `127.0.0.1:3307`.
- Backup thủ công/định kỳ nhỏ.
- Không cần HA, replica, Redis hay proxy layer.

### 16.2. Phase 2 — Personal production

- Chọn Managed MySQL hoặc MySQL trên VPS có persistent disk và backup thật.
- DB trong private network; backend được cấp quyền kết nối riêng.
- Migrations thực thi khi deploy, trước khi traffic dựa vào schema mới.
- Backup automated, có kiểm tra restore và storage alerts.
- Kiểm tra giới hạn connections của dịch vụ DB nếu backend nhiều worker.

### 16.3. Phase 3 — Scale only when justified

Chỉ cân nhắc read replica, Redis, queue hoặc tối ưu server lớn khi có số liệu chứng minh cần: ví dụ tăng rõ rệt concurrent sessions, analytics query chậm, notification throughput cao hoặc yêu cầu HA. Không thêm ngay vào architecture baseline.

---

## 17. Development Workflow & Coding Rules for AI Assistants

### 17.1. Quy tắc thiết kế DB

1. **Respect architecture:** Hybrid module ownership, một database MySQL, một Alembic history.
2. **No schema magic:** Không tự `create_all()` hoặc chỉnh bảng production ngoài migration.
3. **No hidden data duplication:** Không tạo bảng vì UI/biểu đồ nếu có thể query từ dữ liệu gốc.
4. **Preserve task history:** Recurrence changes không được xóa occurrence đã hoàn thành.
5. **Atomic writes:** Multi-step nghiệp vụ dùng transaction.
6. **No repository auto-commit:** Service/Unit of Work sở hữu commit.
7. **Validate time semantics:** UTC instant khác local date và schedule theo giờ địa phương.
8. **Enforce constraints in MySQL:** Unique/FK/check là tuyến phòng thủ cuối cùng.
9. **Strict data isolation:** Mọi truy vấn kiểm soát user ownership.
10. **Run tests and migrations:** Mọi thay đổi models hoặc repository phải được kiểm thử.
11. **Never disclose secrets:** Không ghi password/token vào code, markdown hoặc logs.
12. **Do not invent decisions:** ERD, IDs, provider, retention còn để mở thì phải ghi rõ đề xuất.

### 17.2. Checklist review một pull request liên quan DB

- [ ] ORM model thuộc đúng domain module.
- [ ] Repository không chứa business logic hoặc commit tùy ý.
- [ ] Nếu thay schema đã tạo Alembic revision.
- [ ] Đã review generated migration, đặc biệt DDL MySQL implicit commit.
- [ ] Không làm mất dữ liệu/lịch sử khi migration hoặc update.
- [ ] Có constraint/index phù hợp với query patterns.
- [ ] Có test failure, rollback và duplicate/concurrency nếu cần.
- [ ] Không lộ credential; không mở cổng DB public.
- [ ] Query dưới dạng parameterized SQL / ORM.
- [ ] API response không serialize trực tiếp ORM ngoài quy tắc DTO.
- [ ] Đã kiểm tra compatibility web/iOS nếu thay đổi contract.

---

## 18. Suggested Implementation Plan

### Stage A — Tooling & connectivity

- [ ] Chuẩn bị Docker Compose MySQL 8.4.
- [ ] Hoàn thiện `.env.example` và `infra/mysql/my.cnf`.
- [ ] Cài và cấu hình JetBrains DataGrip.
- [ ] Kiểm tra MySQL charset, collation, timezone.
- [ ] Xác nhận SQLAlchemy + asyncmy hoạt động trên Python 3.14.

### Stage B — Database infrastructure

- [ ] Thiết lập `app/db/base.py`, `engine.py`, `session.py`, `metadata.py`.
- [ ] Cấu hình Pydantic Settings, health check và pool defaults.
- [ ] Khởi tạo Alembic, kiểm tra migration round trip.
- [ ] Viết integration test kết nối và transaction.

### Stage C — Domain / ERD design (tài liệu tiếp theo)

- [ ] Chốt danh sách entities và ownership.
- [ ] Thiết kế ERD Tasks / Recurrence / Occurrences / Time Entries.
- [ ] Chốt UUID strategy, foreign keys, unique constraints, indexes.
- [ ] Chốt Habits / Goals / Reminders schema.
- [ ] Tạo schema migrations đầu tiên.

### Stage D — Production readiness

- [ ] Chọn hosting MySQL.
- [ ] Thiết lập network, TLS và least-privilege accounts.
- [ ] Thiết lập backup off-host và restore rehearsal.
- [ ] Bổ sung monitoring, alerts và migration release workflow.

---

## 19. Architecture Decision Records (ADR)

### ADR-DB-001 — MySQL thay PostgreSQL

- **Status:** Accepted.
- **Decision:** Dùng MySQL 8.4 LTS/InnoDB.
- **Context:** Dự án cá nhân ưu tiên kiểm soát backend, dữ liệu và vận hành đơn giản.
- **Consequences:** ORM, schema types, migrations và các đoạn tài liệu cũ ghi PostgreSQL phải được cập nhật; không dùng `TIMESTAMPTZ`, PostgreSQL-specific UUID/array syntax.

### ADR-DB-002 — DataGrip thay DBeaver

- **Status:** Accepted.
- **Decision:** JetBrains DataGrip là SQL IDE chính.
- **Consequences:** Local connection dùng `127.0.0.1:3307`, không dùng root, không để IDE thay Alembic.

### ADR-DB-003 — Single Primary Database

- **Status:** Accepted for initial stage.
- **Decision:** Không replication, sharding, cache server và broker từ đầu.
- **Revisit condition:** Chỉ thay đổi khi có metrics hoặc yêu cầu uptime/scale rõ ràng.

### ADR-DB-004 — SQLAlchemy Async + asyncmy

- **Status:** Selected; compatibility verification required.
- **Decision:** FastAPI DB runtime sử dụng SQLAlchemy async API qua asyncmy.
- **Fallback:** Nếu driver phát sinh lỗi thực tế, đánh giá aiomysql hoặc sync strategy qua test; không tự âm thầm đổi stack.

### ADR-DB-005 — Migration Source of Truth

- **Status:** Accepted.
- **Decision:** Alembic quản lý schema; DataGrip dùng để quan sát/query.
- **Consequences:** Mọi schema change production phải trace được đến migration revision.

---

## 20. Official References

- [MySQL 8.4 Reference Manual](https://dev.mysql.com/doc/refman/8.4/en/)
- [MySQL — Character Sets and Collations](https://dev.mysql.com/doc/refman/8.4/en/charset.html)
- [MySQL — DDL Statements That Cause Implicit Commit](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html)
- [MySQL — mysqldump](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html)
- [SQLAlchemy — MySQL and MariaDB Dialects](https://docs.sqlalchemy.org/en/20/dialects/mysql.html)
- [SQLAlchemy — AsyncIO Extension](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [Alembic Documentation](https://alembic.sqlalchemy.org/en/latest/)
- [JetBrains DataGrip — MySQL Data Source](https://www.jetbrains.com/help/datagrip/mysql.html)
- [asyncmy on PyPI](https://pypi.org/project/asyncmy/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

---

## 21. Handover Summary

**Kiến trúc DB được chọn:** `Single Primary MySQL 8.4 LTS (InnoDB) → SQLAlchemy Async + asyncmy → FastAPI Python 3.14 → Next.js Web / React Native iOS`.

**Công cụ phát triển:** `Docker Compose + Alembic + uv + pytest + JetBrains DataGrip`.

**Trạng thái hiện tại:** Đã định nghĩa nền tảng kiến trúc, framework và tiêu chuẩn kỹ thuật. **Chưa chốt ERD/schema chi tiết**. Tài liệu tiếp theo là **Database Logical Design & ERD**.

> **Tài liệu này thay thế các lựa chọn PostgreSQL/DBeaver ở tài liệu cũ.** Không tự sửa hai bản frontend/backend spec khác; khi đồng bộ toàn dự án, cập nhật mọi tham chiếu PostgreSQL sang MySQL và rà soát lại datatype/SQL/migrations theo đặc điểm MySQL.
