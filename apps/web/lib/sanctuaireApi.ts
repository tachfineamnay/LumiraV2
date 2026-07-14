import axios from 'axios';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Axios instance for Sanctuaire (client portal) API calls.
 * Browser requests go through the Next.js BFF (/api/bff) which attaches
 * the httpOnly session cookie. Server-side calls hit the API directly.
 */
const sanctuaireApi = axios.create({
    baseURL: typeof window !== 'undefined' ? '/api/bff' : `${apiUrl}/api`,
    withCredentials: true,
});

export default sanctuaireApi;
