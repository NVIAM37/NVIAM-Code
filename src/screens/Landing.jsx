import React, { useState, useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from '../config/axios'
import { UserContext } from '../context/user.context'
import { motion, AnimatePresence } from 'framer-motion'

import { notify } from '../utils/notifications'

const Landing = () => {
    const { setUser } = useContext(UserContext)
    const navigate = useNavigate()
    const location = useLocation()

    const [isLogin, setIsLogin] = useState(location.pathname !== '/register')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)

    const handleSubmit = (e) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)

        const endpoint = isLogin ? '/users/login' : '/users/register'

        axios.post(endpoint, { email, password })
            .then((res) => {
                localStorage.setItem('token', res.data.token)
                setUser(res.data.user)
                navigate('/')
                notify.success(isLogin ? "Welcome back, Agent." : "Agent Initialized.");
            })
            .catch((err) => {
                console.error(err)
                const msg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || "Something went wrong";
                // setError(msg) // Keep inline or replace? User asked for notifications. Using both is safest or just notify.
                // Requirement: "Remove browser alert() ... Use non-blocking notification/toast system".
                // Inline is non-blocking. But consistency suggests toasts.
                notify.error(msg);
            })
            .finally(() => {
                setIsLoading(false)
            })
    }

    const features = [
        { icon: 'ri-code-box-line', text: 'Instant Runtime', sub: 'Run JS & Python code instantly' },
        { icon: 'ri-robot-2-line', text: 'AI Assistant', sub: 'Smart code completion & fixes' },
        { icon: 'ri-group-line', text: 'Real-time Collab', sub: 'Code together with your team' }
    ]

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#0a0a0a]">
            {/* Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse delay-75"></div>

            <div className="container mx-auto flex flex-col md:flex-row items-center justify-center gap-12 px-6 z-10 w-full h-full">

                {/* Left Side: Hero */}
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                    className="w-full md:w-1/2 text-white space-y-6 md:space-y-8 text-center md:text-left pt-10 md:pt-0"
                >
                    <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600 block mb-2">NVIAM CODE</span>
                        Collaborate in <br />
                        <span className="text-white">
                            Real-Time
                        </span>.
                    </h1>
                    <p className="text-lg md:text-xl text-gray-300 font-light max-w-lg mx-auto md:mx-0">
                        A lightweight, collaborative IDE for running JavaScript and Python directly in your browser.
                    </p>

                    <div className="flex flex-wrap justify-center md:justify-start gap-4 md:gap-6 mt-8">
                        {features.map((f, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 + (i * 0.1) }}
                                className="glass p-3 md:p-4 rounded-xl flex flex-col items-center justify-center w-28 md:w-32 text-center hover:bg-white/10 transition-colors"
                            >
                                <i className={`${f.icon} text-2xl md:text-3xl mb-2 text-cyan-400`}></i>
                                <span className="text-xs md:text-sm font-semibold">{f.text}</span>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Right Side: Auth Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="w-full md:w-1/2 max-w-md"
                >
                    <div className="glass-card p-8 w-full relative overflow-hidden">
                        {/* Decorative shine */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50"></div>

                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold text-white mb-2">{isLogin ? 'Welcome Back' : 'Join the Force'}</h2>
                            <p className="text-gray-400 text-sm">Enter your credentials to access the grid.</p>
                        </div>

                        {error && (
                            <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded mb-4 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <input
                                    type="email"
                                    placeholder="Agent ID (Email)"
                                    className="input-glass"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <input
                                    type="password"
                                    placeholder="Access Code (Password)"
                                    className="input-glass"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="neon-button w-full mt-4 flex justify-center items-center"
                            >
                                {isLoading ? (
                                    <i className="ri-loader-4-line animate-spin text-xl"></i>
                                ) : (
                                    isLogin ? 'Enter System' : 'Initialize Agent'
                                )}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <button
                                onClick={() => { 
                                    const nextState = !isLogin;
                                    setIsLogin(nextState); 
                                    setError(null); 
                                    // Optional: Update URL to match state, or just keep it dynamic
                                    navigate(nextState ? '/login' : '/register');
                                }}
                                className="text-cyan-400 text-sm hover:text-cyan-300 hover:underline transition-all"
                            >
                                {isLogin ? "New user? Create an account" : "Already have an ID? Sign In"}
                            </button>
                        </div>

                    </div>
                </motion.div>

            </div>
        </div>
    )
}

export default Landing
