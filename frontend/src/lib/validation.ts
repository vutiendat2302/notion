const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,48}[a-zA-Z0-9]$/;
const VN_PHONE_REGEX = /^(0[35789][0-9]{8}|(\+84|84)[35789][0-9]{8})$/;
const E164_PHONE_REGEX = /^\+[1-9][0-9]{7,14}$/;

export function validateEmail(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (
    value.length > 254 ||
    !EMAIL_REGEX.test(value) ||
    value.includes("..") ||
    value.startsWith(".") ||
    value.includes("@.") ||
    value.includes(".@")
  ) {
    return "Email không đúng định dạng.";
  }
  return null;
}

export function validatePhone(raw: string): string | null {
  const cleaned = raw.trim().replace(/[\s.\-()]+/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+84")) {
    return VN_PHONE_REGEX.test(cleaned)
      ? null
      : "Số điện thoại Việt Nam không hợp lệ (ví dụ: 0912345678).";
  }
  if (cleaned.startsWith("+")) {
    return E164_PHONE_REGEX.test(cleaned) ? null : "Số điện thoại quốc tế không hợp lệ.";
  }
  if (!VN_PHONE_REGEX.test(cleaned)) {
    return "Số điện thoại không hợp lệ (ví dụ: 0912345678).";
  }
  return null;
}

export function validateUsername(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (
    value.length < 3 ||
    value.length > 50 ||
    value.includes("@") ||
    value.includes("..") ||
    /^\d+$/.test(value) ||
    !USERNAME_REGEX.test(value)
  ) {
    return "Tên tài khoản dài 3–50 ký tự, chỉ gồm chữ, số, '.', '_', '-' và không chỉ gồm số.";
  }
  return null;
}
