import { apiRequest } from "@/lib/api/client";
import type { User } from "@/types/domain";

export async function fetchCurrentUser(): Promise<User> {
  return apiRequest<User>("/users/me");
}
