import React, { useContext, useEffect, useState } from 'react'
import { useNavigate, Navigate, useLocation } from 'react-router-dom'
import { UserContext } from '../context/user.context'

const UserAuth = ({ children }) => {

    const context = useContext(UserContext)
    const location = useLocation() 

    if (!context) {
        console.error("CRITICAL: UserContext is undefined in UserAuth. Check UserProvider.");
        return <div className="p-4 bg-red-900 text-white font-mono">System Error: Auth Context Missing.</div>;
    }

    const { user, loading } = context;

    if (loading) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#1e1e1e] text-white">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <div className="text-xs font-mono text-gray-400 uppercase tracking-widest animate-pulse">Initializing System...</div>
            </div>
        )
    }

    if (!user) {
        // Pass current location to login so we can redirect back
        return <Navigate to="/login" state={{ from: location }} replace /> 
    }

    // Only render children if user exists
    return <>{children}</>
}

export default UserAuth