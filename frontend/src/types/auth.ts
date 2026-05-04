export type Role = "admin" | "researcher" | "pathologist";

export interface UserProfile {
  id: string;
  full_name: string | null;
  role: Role;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: UserProfile;
}