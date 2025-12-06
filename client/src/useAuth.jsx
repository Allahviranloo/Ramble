// useAuth.jsx
import { useState, useEffect, use } from 'react';

const USER_ID_KEY = 'auth_userId';
const TOKEN_KEY = 'auth_token';

export const useAuth = () => {
    const [userId, setUserId] = useState(() => localStorage.getItem(USER_ID_KEY));
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
    const isAuthenticated = !!userId;

    useEffect(() => {
        if (userId) {
            localStorage.setItem(USER_ID_KEY, userId);
            localStorage.setItem(TOKEN_KEY, token);
        } else {
            localStorage.removeItem(USER_ID_KEY);
            localStorage.removeItem(TOKEN_KEY);
        }
    }, [userId, token]);

    const login = (newUserId, newToken) => {
        setUserId(newUserId);
        setToken(newToken);
    };

    const logout = async () => {
        try {
            await fetch('http://localhost:5000/api/logout', {method: 'POST'});
        } catch (error) {
            console.error('Logout didn\'t reach server:', error);
        }

        setUserId(null);
        setToken(null);
    };

    return { userId, token, isAuthenticated, login, logout };
};