// useAuth.jsx
import { useState, useEffect } from 'react';

const USER_ID_KEY = 'auth_userId';
const TOKEN_KEY = 'auth_token';

export const useAuth = () => {
    const [userId, setUserId] = useState(() => localStorage.getItem(USER_ID_KEY));
    const isAuthenticated = !!userId;

    useEffect(() => {
        if (userId) {
            localStorage.setItem(USER_ID_KEY, userId);
        } else {
            localStorage.removeItem(USER_ID_KEY);
        }
    }, [userId]);

    const login = (newUserId) => {
        setUserId(newUserId);
    };

    const logout = async () => {
        try {
            await fetch('http://localhost:5000/api/logout', {
                method: 'POST',
                credentials: 'include' 
            });
        } catch (error) {
            console.error('Logout didn\'t reach server:', error);
        }
        setUserId(null);
    };

    return { userId, isAuthenticated, login, logout };
};