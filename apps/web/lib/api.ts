import axios from 'axios';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
    baseURL: `${apiUrl}/api`,
});

api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        // Check for expert_token first (admin routes), then lumira_token (sanctuaire)
        const expertToken = localStorage.getItem('expert_token');
        const lumiraToken = localStorage.getItem('lumira_token');
        const token = expertToken || lumiraToken;
        
        if (token && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

export default api;
