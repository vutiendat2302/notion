---
name: ocr
description: "Triển khai OCR Service độc lập Python 3.12 với PaddleOCR, PP-StructureV3, OpenCV/Pillow, xử lý screenshot/ảnh/PDF scan/bảng biểu và OCR pipeline bảo mật."
---

# OCR & Document Understanding Skill

## Khi nào dùng

Khi thêm OCR từ ảnh, screenshot, PDF scan, nhận dạng bảng, layout tài liệu, xử lý text tiếng Việt, chất lượng OCR, document ingestion hoặc kết nối OCR với AI Service.

## Kiến trúc và runtime

- **OCR Service độc lập**, FastAPI nội bộ + Python **3.12** để có vùng tương thích thư viện tốt; không ép dùng Python 3.14 như Backend/AI.
- OCR engine: **PaddleOCR 3.x** với model phù hợp tiếng Việt; **PP-StructureV3** cho layout/table khi cần.
- Xử lý ảnh: **Pillow, OpenCV**; PDF text extraction: **PyMuPDF** hoặc thư viện đã được chốt.
- CPU-first, memory bounded, tách model nhẹ và model nặng; cấu hình thread/concurrency thực tế qua benchmark.
- OCR là chuyển đổi từ ảnh → **text và cấu trúc**; diễn giải nghiệp vụ là trách nhiệm AI Service/Backend.

## Sơ đồ luồng

```text
Client upload → Backend auth/metadata → MinIO object key
                   │ creates ingestion job
                   ▼
              AI document pipeline
                   │ internal token & scoped file grant
                   ▼
              OCR Service (CPU)
                ├─ text-first PDF extraction nếu file có text layer
                ├─ basic image OCR
                └─ layout/table OCR nếu phát hiện cấu trúc phức tạp
                   │
                   ▼
              OCRResult JSON (blocks/boxes/confidence)
                   │
             AI parses drafts/embeddings → Backend preview
```

## Input handling

1. Validate **file_id**, permission, MIME thực tế/magic bytes, size/pages/pixels, checksum.
2. Normalize EXIF orientation, RGB/grayscale, resize hợp lý, crop/deskew khi có bằng chứng tăng độ chính xác.
3. Phân loại ảnh: screenshot chat, trang văn bản, bảng, tài liệu nhiều cột, ảnh không có text, PDF scan/text.
4. PDF có text layer: ưu tiên đọc text layer, chỉ OCR trang thiếu chất lượng, tránh OCR mọi trang vô ích.
5. Bảng/biểu mẫu: ưu tiên giữ **row/column structure**, bounding boxes, page location; không nối toàn bộ text thành một chuỗi nếu mất quan hệ ô.
6. Tài liệu dài: xử lý async job, page batch, timeout/page limit, partial failure và resume.
7. Fallback vision model local chỉ dùng khi cần hiểu hình/diagram ngoài khả năng OCR và máy đủ tài nguyên.

## Output Contract tham khảo

```json
{
  "schema_version": "1.0",
  "job_id": "<id>",
  "file_id": "<id>",
  "engine": "paddleocr",
  "engine_version": "<pinned-version>",
  "status": "completed",
  "pages": [{
    "page_number": 1,
    "width": 1240,
    "height": 1754,
    "blocks": [{
      "type": "text",
      "text": "Học IELTS vào thứ Hai",
      "bbox": [80, 180, 520, 220],
      "confidence": 0.92,
      "language": "vi"
    }],
    "tables": []
  }],
  "warnings": []
}
```

**Không cam kết mỗi model đều trả confidence chuẩn hóa cùng một cách**; giữ raw/model-specific score và tài liệu chuẩn hóa riêng nếu có. Không suy diễn `bbox` theo một hệ tọa độ khi chưa chốt rõ pixels/normalized và thứ tự coordinate.

## Chất lượng, độ tin cậy và lỗi

- Có thể `completed`, `partial`, `failed`, `unsupported`. Metadata job/state nằm trong MySQL AI metadata hoặc pipeline job store được duyệt.
- Confidence thấp ở **date/time, số, tên riêng** → hỏi người dùng hoặc bắt buộc preview; không tự tạo/update task từ OCR sai.
- Test ảnh mờ, nghiêng, cắt mất text, chữ nhỏ, tiếng Việt có dấu, ánh sáng xấu, ảnh màn hình, bảng nhiều cột, PDF scan nhiều trang.
- Đối với bảng, so sánh cấu trúc cells đúng, không chỉ word error rate.
- OCR phải giữ provenance (file/page/block/bbox) cho RAG citations và QA.
- Không cho file được upload ảnh hưởng shell command, file path traversal hoặc model invocation options.

## Triển khai

```text
ocr-service/
├── app/
│   ├── main.py
│   ├── api/
│   ├── core/
│   ├── services/
│   ├── engines/           # text_ocr, layout, table
│   ├── preprocessing/
│   ├── schemas/
│   └── adapters/          # minio/s3, ai callbacks nếu cần
├── tests/
├── pyproject.toml
└── Dockerfile
```

- Chạy container user không phải root khi khả thi, mount volumes rõ quyền; model cache tách khỏi output.
- Không exposed port OCR public; chỉ private Docker network và service auth.
- Pin/check PaddleOCR/Paddle runtime tương thích container image trước khi promote.
- Hạn chế RAM/CPU và concurrency; batch jobs không làm backend chết khi OCR nặng.

## Definition of Done

- [ ] OCR được cả ảnh tiếng Việt đơn giản và ít nhất một PDF scan; bảng biểu test riêng khi module được bật.
- [ ] Không mất provenance, hỗ trợ retry và xử lý partial result.
- [ ] Ảnh có ngày/giờ thiếu rõ ràng không tự biến thành task đúng sai.
- [ ] Service nội bộ được auth, có file size/pages/timeouts.
- [ ] Benchmark CPU/RAM và regression fixtures cho ảnh OCR mẫu.
