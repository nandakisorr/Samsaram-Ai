import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiError } from '../types';

// API base URL - adjust based on your backend URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

class ApiClient {
  private client: AxiosInstance;

    constructor() {
      this.client = axios.create({
        baseURL: API_BASE_URL,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        withCredentials: false,
        timeout: 60000,
      });

    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // Token expired or unauthorized
        if (error.response?.status === 401) {
          this.clearToken();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  private getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private clearToken(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }

  // Generic request methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }

  // Helper to extract data or throw error
  async handleResponse<T>(promise: Promise<AxiosResponse<T>>): Promise<T> {
    try {
      const response = await promise;
      return response.data;
    } catch (error: any) {
      const apiError: ApiError = {
        detail: error.response?.data?.detail || error.message || 'Unknown error',
        status_code: error.response?.status,
      };
      throw apiError;
    }
  }
}

export const apiClient = new ApiClient();

// Export singleton for use across modules
export default apiClient;
