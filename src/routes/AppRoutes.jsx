import React from 'react'
import { Route, BrowserRouter, Routes } from 'react-router-dom'
import Landing from '../screens/Landing'
import Dashboard from '../screens/Dashboard'
import Project from '../screens/Project'
import UserAuth from '../auth/UserAuth'

const AppRoutes = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<UserAuth><Dashboard /></UserAuth>} />
                <Route path="/login" element={<Landing />} />
                <Route path="/register" element={<Landing />} />
                <Route path="/project/:projectId" element={<UserAuth><Project /></UserAuth>} />
            </Routes>
        </BrowserRouter>
    )
}

export default AppRoutes