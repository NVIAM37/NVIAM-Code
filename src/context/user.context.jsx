import React, { createContext, useState, useEffect } from 'react';
import axios from '../config/axios';

// Create the UserContext
export const UserContext = createContext();

// Create a provider component
export const UserProvider = ({ children }) => {
    const [ user, setUser ] = useState(null);
    const [ loading, setLoading ] = useState(true);

    useEffect(() => {
        // Safety timeout: If backend hangs or network fails, release loading state after 5 seconds
        // This prevents the "Black Screen" (Eternal Spinner) issue.
        const timer = setTimeout(() => {
            setLoading(prev => {
                if (prev) { 
                    console.warn("Session check timed out. Defaulting to logout.");
                    setUser(null);
                    localStorage.removeItem('token');
                    return false; 
                }
                return prev;
            });
        }, 5000);

        // Check for session via Cookie (HttpOnly)
        axios.get('/users/profile')
            .then(res => {
                setUser(res.data.user);
                // Sync token for Scoket.io usage
                if (res.data.token) {
                    localStorage.setItem('token', res.data.token);
                }
                setLoading(false);
            })
            .catch((err) => {
                console.error("Session restore failed:", err);
                setUser(null);
                setLoading(false);
                // Explicitly clear stale token if session is invalid
                localStorage.removeItem('token'); 
                
                if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
                     window.location.href = '/login'; 
                }
            });
    }, []);

    return (
        <UserContext.Provider value={{ user, setUser, loading }}>
            {children}
        </UserContext.Provider>
    );
};


