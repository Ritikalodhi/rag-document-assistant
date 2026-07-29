import api from './api';
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '@/types';

const AUTH_PATH = '/api/auth';

export const authService = {
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>(`${AUTH_PATH}/register`, data);
    return response.data;
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>(`${AUTH_PATH}/login`, data);
    return response.data;
  },

  async me(): Promise<User> {
    const response = await api.get<User>(`${AUTH_PATH}/me`);
    return response.data;
  },
};