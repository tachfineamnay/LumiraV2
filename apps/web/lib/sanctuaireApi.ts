import axios from 'axios';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Axios instance for Sanctuaire (client portal) API calls.
 * Uses 'sanctuaire_token' for authentication.
 */
const sanctuaireApi = axios.create({
    baseURL: `${apiUrl}/api`,
});

sanctuaireApi.interceptors.request.use((config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('sanctuaire_token') : null;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default sanctuaireApi;
