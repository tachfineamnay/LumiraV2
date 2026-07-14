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

export default expertApi;
