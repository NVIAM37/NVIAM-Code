import React, { useState, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserContext } from '../context/user.context'
import axios from '../config/axios'
import { notify } from '../utils/notifications'
import { motion } from 'framer-motion'

const Register = () => {

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const { setUser } = useContext(UserContext)
    const navigate = useNavigate()

    function submitHandler(e) {
        e.preventDefault()
        setIsLoading(true)

        axios.post('/users/register', {
            email,
            password
        }).then((res) => {
            localStorage.setItem('token', res.data.token)
            setUser(res.data.user)
            navigate('/')
            notify.success("Agent Initialized Successfully.");
        }).catch((err) => {
            const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || "Registration failed.";
            notify.error(msg);
        }).finally(() => {
            setIsLoading(false)
        })
    }


    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#0a0a0a] font-sans">
             {/* Background Orbs */}
             <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl animate-pulse"></div>
             <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse delay-75"></div>

            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="glass-card p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10 m-4"
            >
                <div className="text-center mb-8">
                     <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-600 mb-2 tracking-tighter">JOIN THE GRID</h1>
                     <p className="text-gray-400 text-sm font-medium">Create New Identity</p>
                </div>

                <form onSubmit={submitHandler} className="space-y-6">
                    <div>
                        <label className="block text-cyan-400 text-xs font-bold uppercase tracking-widest mb-2 ml-1">Email</label>
                        <input
                            onChange={(e) => setEmail(e.target.value)}
                            type="email"
                            required
                            className="input-glass"
                            placeholder="Enter your email"
                        />
                    </div>
                    <div>
                        <label className="block text-purple-400 text-xs font-bold uppercase tracking-widest mb-2 ml-1">Password</label>
                        <input
                            onChange={(e) => setPassword(e.target.value)}
                            type="password"
                            required
                            className="input-glass"
                            placeholder="Create a password"
                        />
                    </div>
                    
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="neon-button variant-purple w-full mt-6 flex justify-center items-center group"
                    >
                         {isLoading ? <i className="ri-loader-4-line animate-spin text-xl"></i> : <span className="flex items-center gap-2">Initialize Agent <i className="ri-user-add-line group-hover:scale-110 transition-transform"></i></span>}
                    </button>
                </form>

                <p className="text-gray-500 text-sm mt-8 text-center">
                    Already have an identity? <Link to="/login" className="text-purple-400 hover:text-purple-300 font-bold hover:underline transition-colors">Login</Link>
                </p>
            </motion.div>
        </div>
    )
}

export default Register