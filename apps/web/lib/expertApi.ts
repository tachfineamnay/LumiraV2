import axios from 'axios';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Axios instance for Expert Desk (admin) API calls.
 * Uses 'expert_token' for authentication only.
 */
const expertApi = axios.create({
  baseURL: `${apiUrl}/api`,
});

expertApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('expert_token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

expertApi.interceptors.response.use((response) => {
  /**
   * The current Studio launch handler was built for the former synchronous
   * /process-order endpoint. Production now returns immediately after the
   * durable job is queued. Reuse the handler's existing background/polling
   * branch until the Studio has fully migrated to the production control API.
   */
  if (
    response.config.url === '/expert/process-order' &&
    response.data?.accepted === true &&
    typeof response.data?.jobId === 'string'
  ) {
    const queued = Object.assign(new Error('timeout: génération mise en file'), {
      code: 'ECONNABORTED',
      jobId: response.data.jobId,
    });
    return Promise.reject(queued);
  }

  return response;
});

export default expertApi;
