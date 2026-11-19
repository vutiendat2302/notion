---
name: mobile
description: "Hướng dẫn phần iOS giai đoạn sau: React Native + Expo, dùng chung FastAPI, push/local notifications, SideStore cài riêng iPhone iOS 18 và kiểm thử ký ứng dụng."
---

# iOS / React Native — Future Delivery Skill

## Khi nào dùng

Chỉ dùng khi đến giai đoạn phát triển ứng dụng iPhone native, build IPA, notifications, sync hoặc triển khai SideStore. **Không tự khởi tạo mobile app ở giai đoạn Web MVP nếu user chưa yêu cầu.**

## Stack và ràng buộc

- React Native + Expo + TypeScript cho UI native; dùng chung backend REST/OpenAPI client với Web ở mức hợp lý.
- iPhone chạy iOS 18.x, dùng cá nhân, không phát hành App Store giai đoạn đầu.
- Cài IPA qua SideStore; **Apple ID miễn phí vẫn có giới hạn chứng chỉ khoảng 7 ngày**, SideStore chỉ hỗ trợ làm mới/tự refresh khi điều kiện cho phép. Không hứa ký vĩnh viễn.
- Ubuntu viết code được nhưng công cụ build native iOS thông thường cần macOS/cloud macOS phù hợp; **không hứa Expo cloud build IPA free Apple signing mà chưa xác minh entitlement**.
- Local notifications và remote APNs có điều kiện, quyền hạn và signing khác nhau; phải test trên máy thật.

## Product & UX compatibility

- Giữ Intelligent Minimalism/Soft Blue, nhưng dùng navigation/touch/gestures theo iOS, không ép giao diện web vào native.
- Nội dung Today, Tasks, Calendar, Reminder và Focus được ưu tiên cho màn hình nhỏ.
- Các lệnh update vẫn đi qua Backend, không đồng bộ trực tiếp DB.
- Thiết kế offline queue/cache rõ `pending/synced/conflict` nếu yêu cầu offline; không tự coi client cache là nguồn sự thật.

## Checklist triển khai

1. Kiểm tra iPhone model, iOS minor version, build/sign/install workflow tương thích thực tế.
2. Bắt đầu bằng Expo app shell, auth, typed API client, Today, Task details.
3. Phân biệt local notification được OS lên lịch trên thiết bị với server push thông qua APNs.
4. Lưu device installation/subscription ở Backend; revoke token khi logout hoặc device thay đổi.
5. Test timezone change, timezone travel, background app, offline, notification tap/deeplink.
6. Kiểm tra SideStore refresh/expiry bằng test thật; có backup workflow cài lại IPA.
7. Không bao giờ embed Backend secrets, MinIO credentials, AI provider keys trong app.

## Definition of Done

- [ ] Tính năng native có trên máy iPhone thật, không chỉ Expo simulator.
- [ ] Không cần app iOS trực tiếp gọi AI Service/OCR/MySQL.
- [ ] Trạng thái auth, sync, notification được kiểm thử sau sign refresh/reinstall.
- [ ] Chi phí Apple, giới hạn signing và khả năng notifications được mô tả trung thực.
