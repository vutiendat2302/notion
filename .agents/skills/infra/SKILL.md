---
name: infra
description: "Vận hành self-host Ubuntu bằng Docker Compose cho Next.js, Backend, AI, OCR, MySQL, MinIO, Qdrant, Ollama: network isolation, resource limits, secrets, logging, backup và triển khai."
---

# Infrastructure & Self-host Operations Skill

## Khi nào dùng

Khi sửa Dockerfiles, Docker Compose, môi trường Ubuntu, reverse proxy/TLS, internal network, secrets, worker scheduling, healthchecks, deployment, backup, monitoring, CI/CD hoặc cấu hình dev/prod.

## Quyết định triển khai

- **Self-host trên Ubuntu** là mặc định. Không giả định AWS S3/R2, managed MySQL, VPS/GPU trả phí hay các dịch vụ cloud khác.
- Có thể xây FE Next.js local hoặc deploy ở nơi khác sau này nhưng **không tự chuyển hạ tầng** nếu user chưa quyết.
- Một repository, services độc lập, mỗi service có Dockerfile/dependencies/healthcheck/logs riêng.
- **Web → Backend**, **Backend ↔ AI**, **AI → OCR**; SQL/MinIO/Qdrant/Ollama chỉ trên private Docker networks hoặc loopback quản trị.
- iPhone truy cập từ ngoài nhà qua kênh HTTPS/VPN được kiểm soát; không expose trực tiếp DB và internal services.

## Container inventory đề xuất

| Service | Chức năng | Port container tham khảo | Public? |
|---|---|---:|---|
| `frontend` | Next.js | 3000 | qua reverse proxy nếu self-host |
| `backend` | FastAPI | 8000 | qua reverse proxy HTTPS |
| `ai-service` | FastAPI + agents | 8001 | **Không** |
| `ocr-service` | PaddleOCR | 8866 | **Không** |
| `mysql` | MySQL 8.4 | 3306 | **Không** |
| `minio` | Object storage API | 9000 | **Không** (console cũng không public) |
| `qdrant` | Vector index | 6333 | **Không** |
| `ollama` | Local inference | 11434 | **Không** |
| `workers` | Jobs/reminders/ingestion | — | **Không** |

Ports chỉ là convention môi trường phát triển; ưu tiên ports nội bộ Compose theo tên DNS service.

## Cấu trúc đề xuất

```text
infra/
├── compose.yaml
├── compose.dev.yaml
├── compose.prod.yaml        # nếu thực sự cần override
├── mysql/
│   └── my.cnf
├── reverse-proxy/
├── monitoring/
└── backup/
```

- Named volumes cho MySQL, MinIO, Qdrant, Ollama models; chủ động đánh dấu bind mount/permission khi cần.
- `.env.example` chỉ có placeholder, `.env` không commit. Secrets từ môi trường/secret files với least privilege.
- Healthchecks cho MySQL, Backend, AI, OCR (readiness nên tách liveness khi model load lâu).
- `depends_on` giúp điều phối start nhưng **không thay** retry/health logic.
- Resource limits cho Ollama/OCR; đo RAM/CPU trước khi chạy model lớn; OCR nặng nên queue và giới hạn concurrency.
- Container non-root/readonly rootfs khi có thể; image tags/digests pin cho release ổn định.

## Networking & security

- Chỉ HTTPS Backend (và frontend nếu self-host) lộ Internet; rate limit tại edge + API.
- Service-to-service auth bắt buộc cho AI ↔ Backend tools và AI ↔ OCR; không dựa vào network-only trust.
- MinIO root/admin chỉ để setup; ứng dụng dùng credentials/scoped policy riêng.
- Qdrant/Ollama không mở ra public; bind loopback khi cần debug và dùng tunnel/VPN có xác thực nếu truy cập xa.
- MySQL chỉ chấp nhận user với quyền theo DB; migration credentials tách runtime credentials khi khả thi.
- Bảo vệ upload file: malware/type/size limits; backup encrypt và test restore.

## Runbook vận hành

```bash
# Chạy ở repository root sau khi xem lại compose và .env
# Không copy lệnh vô điều kiện sang production.
docker compose -f infra/compose.yaml config
docker compose -f infra/compose.yaml ps
docker compose -f infra/compose.yaml logs --tail=100 backend
docker compose -f infra/compose.yaml up -d --build backend ai-service
# Không dùng 'down -v' vì sẽ xóa volumes dữ liệu.
```

**Phải kiểm tra path và tên services trong repository thật** trước khi dùng lệnh; các câu lệnh trên là mẫu cấu hình.

## Reliability, job & incident response

- Jobs có lease/status/idempotency/retries, không đặt lịch reminder chỉ trong web request process; xử lý server reboot.
- Trường hợp AI/OCR unavailable: backend task/calendars vẫn hoạt động; lỗi gọn, không treo UI.
- Correlation ID xuyên frontend/backend/AI/OCR; log JSON, redaction secrets và privacy by default.
- Tạo procedure cho backup MySQL/MinIO/Qdrant, kiểm tra disk fullness, backup failure, snapshot mismatch.
- Restore test định kỳ vào môi trường test, tránh coi snapshot đã tồn tại là đủ.
- Khi nâng Docker image MinIO/PaddleOCR/Python cần test tương thích version và chuẩn bị rollback.

## Definition of Done

- [ ] `docker compose config` hợp lệ; secrets không vào source.
- [ ] Chỉ đúng public endpoints được exposed, internal network cô lập.
- [ ] Persistent volumes có backup và restore test.
- [ ] Healthchecks, timeouts, logs, resource limits phù hợp host.
- [ ] Core API hoạt động khi AI/OCR hoặc Ollama tạm unavailable.
