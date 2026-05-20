import axios from 'axios';

const rawBaseUrl = import.meta.env.VITE_API_URL?.trim();
const baseURL = rawBaseUrl ? rawBaseUrl.replace(/\/$/, '') : '/api';

export const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
