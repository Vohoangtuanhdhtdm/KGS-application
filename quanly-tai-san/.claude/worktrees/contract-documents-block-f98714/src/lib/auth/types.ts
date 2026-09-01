export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  roles: string[];
  emailConfirmed: boolean;
  bio?: string | null;
  phoneNumber?: string | null;
  createdAt?: string;
}

export interface AuthResponse {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  roles: string[];
  emailConfirmed: boolean;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface ProblemDetails {
  status?: number;
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  status: number;
  detail: string;
  problem: ProblemDetails;
  constructor(status: number, problem: ProblemDetails) {
    super(problem.detail || problem.title || `HTTP ${status}`);
    this.status = status;
    this.detail = problem.detail || problem.title || `Lỗi ${status}`;
    this.problem = problem;
  }
}
