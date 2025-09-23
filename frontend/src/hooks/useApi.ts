import { useMemo } from 'react';
import axios from 'axios';
import { useAuth } from './useAuth';

export const useApi = () => {
  const { token, logout } = useAuth();

  return useMemo(() => {
    const instance = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
    });

    instance.interceptors.request.use((config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      },
    );

    return instance;
  }, [token, logout]);
};
