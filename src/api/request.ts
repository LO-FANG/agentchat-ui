import axios from 'axios';

// 使用 Vite 环境变量配置基础路径
const baseURL = import.meta.env.VITE_API_BASE_URL;

// 创建 axios 实例
const request = axios.create({
  baseURL,
  timeout: 10000, // 请求超时时间
  withCredentials: true, // 允许跨域携带 cookie (如 Session ID)
});

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    // 如果是请求 blob 类型的二进制文件，直接返回 response
    // 这样在调用处可以使用 response.data 获取 Blob 对象
    if (response.config.responseType === 'blob') {
      return response;
    }

    // 根据后端的接口结构进行统一的数据处理
    // 后端统一返回格式为 ApiResponseResult<T>
    const res = response.data;

    if (typeof res === 'boolean') {
      return {
        success: true,
        code: 200,
        msg: 'success',
        cost: 0,
        data: res,
      };
    }
    
    // 如果 success 为 false 或者 code 不为 200 (根据您的后端习惯而定)
    if (!res.success) {
      // 可以在这里进行全局错误提示
      const error: any = new Error(res.msg || '请求失败');
      error.code = res.code;
      error.response = { data: res };
      return Promise.reject(error);
    }
    return res;
  },
  (error) => {
    // 处理 HTTP 错误，如 401 认证失败
    if (error.response?.status === 401) {
      // localStorage.removeItem('token');
      // window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default request;
