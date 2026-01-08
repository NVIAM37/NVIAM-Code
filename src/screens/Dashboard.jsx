import React, { useContext, useState, useEffect } from 'react'
import { UserContext } from '../context/user.context'
import axios from "../config/axios"
import { useNavigate } from 'react-router-dom'
import { Tilt } from 'react-tilt'
import { motion } from 'framer-motion'
import { notify } from '../utils/notifications'

const Dashboard = () => {

    const { user } = useContext(UserContext)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [projectName, setProjectName] = useState('')
    const [projects, setProjects] = useState([])
    const [quote, setQuote] = useState("Initializing system...")

    const navigate = useNavigate()
    const folderInputRef = React.useRef(null)

    if (!user) {
         return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#141414] text-white font-mono">
                <div className="text-xs uppercase tracking-widest animate-pulse text-gray-500">Wait...</div>
            </div>
         )
    }

    // AI Tips / Quotes Ticker
    useEffect(() => {
        const quotes = [
            "AI Tip: Use 'Explain' to understand complex regex.",
            "Quote: 'Code is like humor. When you have to explain it, it’s bad.'",
            "System Status: All systems nominal.",
            "AI Tip: Refactor early, refactor often.",
            "Reminder: Drink water, engineer."
        ];
        let i = 0;
        setQuote(quotes[0]);
        const interval = setInterval(() => {
            i = (i + 1) % quotes.length;
            setQuote(quotes[i]);
        }, 5000);
        return () => clearInterval(interval);
    }, []);


    // Fetch Projects
    useEffect(() => {
        axios.get('/projects/all').then((res) => {
            // Safety Net: Strictly filter projects where the user is actually a member.
            // This handles any potential backend "leak" or stale data issues.
            const userProjects = res.data.projects.filter(p => {
                return p.users.some(uId => String(uId) === String(user._id));
            });
            setProjects(userProjects)
        }).catch(err => {
            console.error(err)
        })
    }, [user._id])

    function createProject(e) {
        e.preventDefault()
        axios.post('/projects/create', { name: projectName })
            .then((res) => {
                setIsModalOpen(false)
                setProjects([...projects, res.data])
                setProjectName('')
            })
            .catch((error) => console.error(error))
    }

    function joinProject(e) {
        e.preventDefault()
        let projectId = joinProjectId.trim();
        // Simple extraction if full URL is pasted
        if (projectId.includes('/project/')) {
            projectId = projectId.split('/project/')[1].split('/')[0];
        }
        
        setIsJoinModalOpen(false);
        navigate(`/project/${projectId}`, { 
            state: { projectId: projectId } 
        })
    }
    
    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files)
        if (files.length === 0) return

        const fileTree = {}
        const folderName = files[0].webkitRelativePath.split('/')[0]

        // Basic filtering and reading...
        const readFile = (file) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => resolve({ path: file.webkitRelativePath, content: event.target.result });
                reader.onerror = reject;
                reader.readAsText(file);
            });
        };

        try {
            // Confirm if large
            if (files.length > 50 && !window.confirm(`Importing ${files.length} files?`)) return;

            const filteredFiles = files.filter(file => {
                const parts = file.webkitRelativePath.split('/');
                return !parts.some(p => ['node_modules', '.git', 'dist'].includes(p));
            });

            const results = await Promise.all(filteredFiles.map(readFile));

            results.forEach(({ path, content }) => {
                const relativePath = path.split('/').slice(1).join('/');
                if (relativePath) {
                    fileTree[relativePath] = { file: { contents: content } }
                }
            });

            axios.post('/projects/import', { name: folderName, fileTree })
                .then(res => navigate(`/project`, { state: { project: res.data } }))
                .catch(err => notify.error("Import failed: " + err.message));

        } catch (error) {
            console.error(error);
            notify.error("Error reading files");
        }
    }

    const deleteProject = async (projectId, e) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;
        
        try {
            await axios.delete(`/projects/delete/${projectId}`);
            setProjects(projects.filter(p => p._id !== projectId));
        } catch (err) {
            console.error('Delete failed:', err);
            notify.error('Failed to delete project: ' + (err.response?.data?.error || err.message));
        }
    }


    return (
        <div className="min-h-screen bg-[#141414] text-white flex flex-col font-sans selection:bg-cyan-500 selection:text-black">

            {/* Header */}
            <header className="glass-strip h-16 flex items-center justify-between px-6 z-20 sticky top-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden text-gray-400 hover:text-white transition-colors">
                        <i className="ri-menu-4-line text-2xl"></i>
                    </button>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 p-[2px] transition-transform hover:scale-110">
                        <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                            <i className="ri-user-fill"></i>
                        </div>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-none">{user?.email?.split('@')[0] || "Agent"}</h1>
                        <span className="text-xs text-green-400">● Online</span>
                    </div>
                </div>

                <div className="hidden md:flex flex-1 mx-12 justify-center">
                    <div className="glass px-4 py-1 rounded-full text-xs text-cyan-300 font-mono tracking-wide w-96 text-center overflow-hidden whitespace-nowrap">
                        {quote}
                    </div>
                </div>

                <button onClick={() => { localStorage.removeItem('token'); navigate('/login'); }} className="text-gray-400 hover:text-white transition-colors">
                    <i className="ri-logout-box-r-line text-xl"></i>
                </button>
            </header>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 flex md:hidden">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
                    <motion.div 
                        initial={{ x: -300 }} 
                        animate={{ x: 0 }} 
                        exit={{ x: -300 }}
                        className="w-72 bg-[#181818] border-r border-white/10 h-full p-6 flex flex-col gap-6 relative z-10"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Menu</h2>
                            <button onClick={() => setIsMobileMenuOpen(false)}><i className="ri-close-line text-2xl text-gray-400"></i></button>
                        </div>
                        
                        <div className="glass-card p-6 flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 mb-3 p-[2px]">
                                <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user?.email}`} alt="avatar" className="w-full h-full rounded-full bg-black" crossOrigin="anonymous" />
                            </div>
                            <h2 className="text-lg font-bold">{user?.email?.split('@')[0]}</h2>
                            <span className="text-xs text-purple-400 uppercase tracking-widest mb-2">Level 5 Engineer</span>
                            <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden mb-2">
                                <div className="bg-gradient-to-r from-cyan-500 to-purple-500 w-[70%] h-full"></div>
                            </div>
                            <span className="text-xs text-gray-500 w-full text-right">XP 3500 / 5000</span>
                        </div>

                        <div className="glass-card p-6 space-y-4">
                            <h3 className="text-gray-400 text-sm uppercase font-bold">Statistics</h3>
                            <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                                <span>Projects</span>
                                <span className="text-cyan-400 font-mono text-lg">{projects.length}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                                <span>Files</span>
                                <span className="text-purple-400 font-mono text-lg">
                                    {projects.reduce((acc, curr) => acc + Object.keys(curr.fileTree || {}).length, 0)}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            <main className="flex-grow flex flex-col md:flex-row p-6 gap-6 relative">
                {/* Background Decor */}
                <div className="absolute top-20 right-20 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl"></div>

                {/* Left Panel: Stats */}
                <motion.aside
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="hidden md:flex flex-col w-72 gap-6 flex-shrink-0"
                >
                    <div className="glass-card p-6 flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 mb-4 p-[2px] shadow-[0_0_20px_rgba(0,243,255,0.3)]">
                            <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user?.email}`} alt="avatar" className="w-full h-full rounded-full bg-black" crossOrigin="anonymous" />
                        </div>
                        <h2 className="text-xl font-bold">{user?.email?.split('@')[0]}</h2>
                        <span className="text-xs text-purple-400 uppercase tracking-widest mb-4">Level 5 Engineer</span>

                        <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden mb-2">
                            <div className="bg-gradient-to-r from-cyan-500 to-purple-500 w-[70%] h-full"></div>
                        </div>
                        <span className="text-xs text-gray-500 w-full text-right">XP 3500 / 5000</span>
                    </div>

                    <div className="glass-card p-6 space-y-4">
                        <h3 className="text-gray-400 text-sm uppercase font-bold">Statistics</h3>
                        <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                            <span>Projects</span>
                            <span className="text-cyan-400 font-mono text-lg">{projects.length}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                            <span>Files</span>
                            <span className="text-purple-400 font-mono text-lg">
                                {projects.reduce((acc, curr) => acc + Object.keys(curr.fileTree || {}).length, 0)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span>Collaborators</span>
                            <span className="text-green-400 font-mono text-lg">
                                {new Set(projects.flatMap(p => p.users)).size}
                            </span>
                        </div>
                    </div>
                </motion.aside>

                {/* Main Content: Projects Grid */}
                <section className="flex-1">
                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <h2 className="text-3xl font-bold mb-1">Projects</h2>
                            <p className="text-gray-400 text-sm">Select a timeline to intervene.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">


                        {/* New Project Card */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setIsModalOpen(true)}
                            className="h-64 rounded-2xl border-2 border-dashed border-gray-600 flex flex-col items-center justify-center gap-2 hover:border-cyan-500 hover:bg-cyan-500/5 transition-all group"
                        >
                            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-black transition-colors">
                                <i className="ri-add-line text-2xl"></i>
                            </div>
                            <span className="text-gray-400 group-hover:text-cyan-400 font-semibold">Initialize New Project</span>
                        </motion.button>



                        {/* Import Project Card */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => folderInputRef.current.click()}
                            className="h-64 rounded-2xl border-2 border-dashed border-gray-600 flex flex-col items-center justify-center gap-2 hover:border-purple-500 hover:bg-purple-500/5 transition-all group"
                        >
                            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-black transition-colors">
                                <i className="ri-upload-cloud-line text-2xl"></i>
                            </div>
                            <span className="text-gray-400 group-hover:text-purple-400 font-semibold">Import Existing</span>
                            <input
                                type="file"
                                ref={folderInputRef}
                                className="hidden"
                                webkitdirectory="true"
                                directory=""
                                multiple
                                onChange={handleFileUpload}
                            />
                        </motion.button>


                        {/* Project Cards */}
                        {projects.map((proj, index) => (
                            <Tilt key={proj._id} options={{ max: 15, scale: 1.02 }} className="h-64">
                                <div className="glass-card h-full p-4 md:p-6 flex flex-col justify-between group relative overflow-hidden hover:border-cyan-500/30 transition-colors">
                                    <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                                        <i className="ri-code-s-slash-line text-4xl text-gray-700 group-hover:text-cyan-500/20"></i>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-bold group-hover:text-cyan-400 transition-colors mb-2">{proj.name}</h3>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <i className="ri-user-line"></i> {proj.users.length} Collaborators
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                navigate(`/project/${proj._id}`, {
                                                    state: { project: proj }
                                                })
                                            }} className="flex-grow py-2 rounded border border-gray-700 hover:bg-cyan-500/10 hover:border-cyan-500 hover:text-cyan-400 transition-all text-sm font-semibold flex items-center justify-center gap-2"
                                        >
                                            Open IDE <i className="ri-arrow-right-line"></i>
                                        </button>
                                        {proj.users[0] === user._id && (
                                            <button
                                                onClick={(e) => deleteProject(proj._id, e)}
                                                className="px-3 py-2 rounded border border-red-500/30 hover:bg-red-500/20 hover:border-red-500 text-red-400 hover:text-red-300 transition-all text-xs"
                                                title="Delete Project"
                                            >
                                                <i className="ri-delete-bin-line"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </Tilt>
                        ))}

                    </div>
                </section>

                {/* Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 p-4">
                        <div className="glass-card p-6 md:p-8 w-full max-w-sm">
                            <h2 className="text-2xl font-bold mb-6">Initialize</h2>
                            <form onSubmit={createProject} className="space-y-6">
                                <div>
                                    <input
                                        autoFocus
                                        onChange={(e) => setProjectName(e.target.value)}
                                        value={projectName}
                                        type="text"
                                        placeholder="Project Name"
                                        className="input-glass"
                                        required
                                    />
                                </div>
                                <div className="flex justify-end gap-4">
                                    <button
                                        type="button"
                                        className="px-4 py-2 text-gray-400 hover:text-white"
                                        onClick={() => setIsModalOpen(false)}
                                    >
                                        Abort
                                    </button>
                                    <button
                                        type="submit"
                                        className="neon-button px-6 py-2 rounded text-sm"
                                    >
                                        Create
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}


            </main>
        </div>
    )
}

export default Dashboard
