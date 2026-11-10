import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { message } from '@ctzhian/ui';
import i18n from '@/i18n';

type BasicResponse<T> = {
  data: T;
  success: boolean;
  message: string;
};

type ErrorResponse = {
  data: unknown;
  success: boolean;
  message: string;
};

type Response<T> = BasicResponse<T> | ErrorResponse;

const request = <T>(options: AxiosRequestConfig): Promise<T> => {
  const token = localStorage.getItem('kfw_admin_token') || '';
  const config = {
    baseURL: window.__BASENAME__ || '/',
    timeout: 0,
    withCredentials: true,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
  const service: AxiosInstance = axios.create(config);
  service.interceptors.response.use(
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    (response: AxiosResponse<Response<T>>) => {
      if (response.status === 200) {
        const res = response.data;
        if (res.success) {
          return res.data;
        }
        message.error(res.message || i18n.t('common.networkError'));
        return Promise.reject(res);
      }
      message.error(response.statusText || i18n.t('common.networkError'));
      return Promise.reject(response);
    },
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        window.location.href = window.__BASENAME__ + '/login';
        localStorage.removeItem('kfw_admin_token');
      }
      message.error(
        error.response?.statusText || i18n.t('common.networkError'),
      );
      return Promise.reject(error.response);
    },
  );

  return service(options);
};

export default request;
