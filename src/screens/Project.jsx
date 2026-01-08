import React, { useState, useEffect, useContext, useRef } from 'react'
import { UserContext } from '../context/user.context'
import { useNavigate, useLocation, useParams, Navigate } from 'react-router-dom'
import axios from '../config/axios'
import { initializeSocket, receiveMessage, sendMessage, getSocket } from '../config/socket'
import Markdown from 'markdown-to-jsx'
import Editor from '@monaco-editor/react'
import Split from 'react-split'
import prettier from "prettier/standalone";
import parserBabel from "prettier/plugins/babel";
import * as parserEstree from "prettier/plugins/estree";
import { getWebContainer } from '../config/webcontainer'
import { generatePreviewHtml } from '../utils/previewUtil'
import { notify } from '../utils/notifications'

const Project = () => {
    const location = useLocation()
    const { projectId } = useParams()
    const navigate = useNavigate()

    // UI States
    // Removed isModalOpen (Invite User Modal)
    const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false)
    const [project, setProject] = useState(location.state?.project) 
    // Derive projectId from state or params, rename to avoid conflict
    const derivedProjectId = projectId || location.state?.projectId || project?._id;
    const [loadingProject, setLoadingProject] = useState(!project && !!derivedProjectId)
    const [message, setMessage] = useState('')
    const { user } = useContext(UserContext)
    const messageBox = useRef(null)

    // Editor & File States
    const [messages, setMessages] = useState([]) 
    const [fileTree, setFileTree] = useState(location.state?.project?.fileTree || {})
    const [currentFile, setCurrentFile] = useState(null)
    const [openFiles, setOpenFiles] = useState([])
    const [isSocketConnected, setIsSocketConnected] = useState(false)
    const [webContainer, setWebContainer] = useState(null)
    const [runOutput, setRunOutput] = useState("")
    const [isOutputPanelOpen, setIsOutputPanelOpen] = useState(false)
    const [activeOutputTab, setActiveOutputTab] = useState('console')
    const [previewUrl, setPreviewUrl] = useState(null)
    const [isAiMode, setIsAiMode] = useState(false)
    const [newFileName, setNewFileName] = useState('')
    const [activeSidePanel, setActiveSidePanel] = useState('files')
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false) // Mobile Drawer State
    const [pyodide, setPyodide] = useState(null) // Python Runtime
    const pyodideReady = useRef(false)
    const saveTimeoutRef = useRef(null)

    // --- STRICT COLLABORATION STATE ---
    const [isCollaborating, setIsCollaborating] = useState(false)
    const [roomId, setRoomId] = useState(null)
    const [roomInput, setRoomInput] = useState('')
    const [roomUsers, setRoomUsers] = useState([])

    const activeCursors = useRef(new Map())
    const editorRef = useRef(null)
    const monacoInstance = useRef(null)
    const cursorDecorations = useRef([])
    const fileTreeRef = useRef(fileTree) // Sync Ref
    const [activeFileUsers, setActiveFileUsers] = useState({}) // { [socketId]: { file, email, _id, color } }


    useEffect(() => {
        fileTreeRef.current = fileTree;
    }, [fileTree])

    // Track Mobile State for Layout
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => {
             setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Load Pyodide
    useEffect(() => {
        if (!pyodideReady.current) {
            const script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js";
            script.onload = async () => {
                try {
                    const py = await window.loadPyodide();
                    setPyodide(py);
                    pyodideReady.current = true;
                    console.log("Pyodide Ready");
                } catch (e) {
                    console.error("Pyodide Load Error", e);
                }
            };
            document.body.appendChild(script);
        }
    }, [])

    // ... (rest of effects) ...

    // --- DATA FETCHING & EFFECTS ---
    
    // Auto-scroll Chat
    useEffect(() => {
        if (messageBox.current) {
            setTimeout(() => {
                messageBox.current.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }, [messages, activeSidePanel])

    // Save before unload
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            // Synchronous save on unload
            if (project?._id && fileTreeRef.current) {
                navigator.sendBeacon(`/projects/update-file-tree/${project._id}`, JSON.stringify({ fileTree: fileTreeRef.current }));
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [project?._id]);

    // Fetch Project (Always fetch to ensure fresh data)
    useEffect(() => {
        if (derivedProjectId) {
            axios.get(`/projects/get-project/${derivedProjectId}`)
                .then(res => {
                    setProject(res.data.project)
                    setFileTree(res.data.project.fileTree || {})
                    setMessages(res.data.project.messages || [])
                    setLoadingProject(false)
                })
                .catch(err => {
                    console.error("Failed to load project:", err);
                    notify.error("Project not found or access denied.");
                    navigate('/'); // Redirect on failure
                    setLoadingProject(false)
                });
        } else {
            setLoadingProject(false)
        }
    }, [derivedProjectId, navigate])

    // Early return if no project - redirect to dashboard (after loading is done)
    if (!project?._id && !loadingProject) {
         return <Navigate to="/" />
    }

    // --- SOCKET LOGIC ---
    useEffect(() => {
        if (!project?._id || !user?._id) return;
        
        const socket = initializeSocket(String(project._id));

        socket.on('connect', () => {
             console.log("Socket connected (Idle Mode)");
             setIsSocketConnected(true);
        });

        socket.on('disconnect', () => {
             console.log("Socket disconnected");
             setIsSocketConnected(false);
             setIsCollaborating(false);
             setRoomId(null);
             setRoomUsers([]);
        });

        // 1. Room Events
        socket.on('room-created', ({ roomId }) => {
            console.log("Room Created:", roomId);
            setRoomId(roomId);
            setIsCollaborating(true);
        });

        socket.on('room-joined', ({ roomId }) => {
            console.log("Room Joined:", roomId);
            setRoomId(roomId);
            setIsCollaborating(true);
        });

        socket.on('room-users', (users) => {
            console.log("Room Users Updated:", users);
            setRoomUsers(users);
        });

        socket.on('error', ({ message }) => {
            notify.error(message);
        });

        // 2. Sync Reqs
        socket.on('request-sync', ({ socketId }) => {
            sendMessage('sync-file-tree', { socketId, fileTree: fileTreeRef.current });
        });

        socket.on('sync-file-tree', ({ fileTree }) => {
            setFileTree(fileTree);
            webContainer?.mount(fileTree);
            notify.success("Workspace Synced to Host.");
        });

        socket.on('project-output', ({ output, isError, isStart }) => {
            if (isStart) {
                setRunOutput(output);
                setIsOutputPanelOpen(true);
                setActiveOutputTab('console');
            } else {
               setRunOutput(prev => prev + output);
            }
        });

        // 3. Collaborative Events
        receiveMessage('project-write', data => {
             setFileTree(prev => {
                if (data.file && prev[data.file]) {
                    return {
                        ...prev,
                        [data.file]: { ...prev[data.file], file: { contents: data.content } }
                    };
                }
                return prev;
            });
        });

        receiveMessage('project-cursor-move', (data) => {
            if (data.userId === user?._id) return;
            activeCursors.current.set(data.userId, {
                ...data,
                color: getRandomColor(),
                name: data.email
            });
            if (editorRef.current) updateCursorDecorations(editorRef.current);
        });

        receiveMessage('project-message', data => {
             setMessages(prev => [...prev, data]);
        });

        receiveMessage('project-file-change', data => {
            setActiveFileUsers(prev => ({
                ...prev,
                [data.socketId]: { 
                    file: data.file, 
                    ...data.sender, 
                    color: getRandomColor() 
                }
            }));
        });


        // WebContainer setup
        if (!webContainer) {
            getWebContainer().then(container => {
                setWebContainer(container)
            })
        }

        return () => {
            socket.off('project-write');
            socket.off('project-cursor-move');
            socket.off('project-message');
            socket.off('room-created');
            socket.off('room-joined');
            socket.off('room-users');
        }
    }, [project?._id, user?._id]);

    // Broadcast File Change
    useEffect(() => {
        if (isCollaborating && currentFile && user) {
            sendMessage('project-file-change', { 
                file: currentFile, 
                sender: { _id: user._id, email: user.email } 
            });
        }
    }, [currentFile, isCollaborating, user]);



    // --- ACTIONS ---
    const createRoom = () => {
        sendMessage('create-room', { projectId: project._id });
    }

    const joinRoom = () => {
        if(!roomInput) return;
        sendMessage('join-room', { roomId: roomInput });
    }

    const leaveRoom = () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        if (project._id && fileTree) {
            axios.put(`/projects/update-file-tree/${project._id}`, { fileTree })
                .catch(err => console.error('Failed to save on collab exit:', err));
        }
        sendMessage('leave-room', {});
        setIsCollaborating(false);
        setRoomId(null);
        setRoomUsers([]);
        notify.info("Left room.");
    }

    const sendMessageToAi = () => {
        if (!message.trim()) return;
        const msgPayload = {
            message: message.includes('@ai') ? message : '@ai ' + message,
            sender: { _id: user._id, email: user.email }
        };
        sendMessage('project-message', msgPayload);
        setMessages(prev => [...prev, msgPayload]);
        setMessage('');
    }
    
    // helper
    const getRandomColor = () => {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
        return color;
    }

    const updateCursorDecorations = (editor) => {
        if (!editor || !editor.getModel() || !monacoInstance.current) return;
        const newDecorations = [];
        activeCursors.current.forEach((data, userId) => {
            if (userId === user?._id) return;
            // logic to create styles would be here, simplifying for restoration
            newDecorations.push({
                range: new monacoInstance.current.Range(data.cursor.lineNumber, data.cursor.column, data.cursor.lineNumber, data.cursor.column),
                options: { className: `cursor-${userId}`, stickiness: monacoInstance.current.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges }
            });
        });
        cursorDecorations.current = editor.deltaDecorations(cursorDecorations.current, newDecorations);
    }


    // --- HANDLERS ---

    const handleEditorChange = (value) => {
        if (!currentFile) return;
        setFileTree(prev => ({
            ...prev,
            [currentFile]: {
                ...prev[currentFile],
                file: { ...prev[currentFile].file, contents: value }
            }
        }));
        if (isCollaborating) {
            sendMessage('project-write', { file: currentFile, content: value });
        }
        
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            const currentTree = fileTreeRef.current; 
            const updatedFileTree = { 
                ...currentTree, 
                [currentFile]: { 
                    ...currentTree[currentFile], 
                    file: { ...currentTree[currentFile].file, contents: value } 
                } 
            };
            axios.put(`/projects/update-file-tree/${project._id}`, { fileTree: updatedFileTree })
                .catch(err => console.error('Failed to save file:', err));
        }, 1000);
    };

    const handleEditorMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoInstance.current = monaco;
        editor.onDidChangeCursorPosition(e => {
            if (isCollaborating) {
                sendMessage('project-cursor-move', {
                    cursor: { lineNumber: e.position.lineNumber, column: e.position.column },
                    roomId
                });
            }
        });
    }

    const createNewFile = () => {
        if (!newFileName) return;
        const newFileTree = { ...fileTree, [newFileName]: { file: { contents: '' } } };
        setFileTree(newFileTree);
        setOpenFiles([...openFiles, newFileName]);
        setCurrentFile(newFileName);
        setIsNewFileModalOpen(false);
        setNewFileName('');
        axios.put(`/projects/update-file-tree/${project._id}`, { fileTree: newFileTree }).catch(console.error);
    };

    const runProject = async () => {
        setIsOutputPanelOpen(true);
        setActiveOutputTab('console');
        const ext = currentFile?.split('.').pop() || '';
        
        if (ext === 'js' && webContainer) {
            setRunOutput("Starting (Node.js)...\n");
            try {
                await webContainer.mount(fileTree);
                const process = await webContainer.spawn('node', [currentFile]);
                process.output.pipeTo(new WritableStream({
                    write(data) { setRunOutput(prev => prev + data) }
                }));
            } catch(e) { setRunOutput("Error: " + e.message) }
            return;
        }

        if (ext === 'py' && pyodide) {
            setRunOutput("Starting (Python)...\n");
            try {
                pyodide.setStdout({ batched: (msg) => setRunOutput(prev => prev + msg + '\n') });
                const code = fileTree[currentFile]?.file.contents || '';
                await pyodide.runPythonAsync(code);
                setRunOutput(prev => prev + "\n[Exited]");
            } catch(e) { setRunOutput(prev => prev + "\nError: " + e.message); }
            return;
        }

        setRunOutput("Sending to Server...\n");
        try {
             const socket = getSocket();
             await axios.post('/projects/run', {
                 projectId: project._id, code: fileTree, runFile: currentFile, roomId, socketId: socket.id
             });
        } catch (err) { setRunOutput("Error: " + err.message); }
    };

    const formatCode = async () => {
        if (!currentFile || !fileTree[currentFile]) return;
        try {
            const formatted = await prettier.format(fileTree[currentFile].file.contents, {
                parser: 'babel', plugins: [parserBabel, parserEstree]
            });
            handleEditorChange(formatted);
        } catch (e) { notify.error("Format schema/parse error"); }
    };

    const handlePreview = () => {
        if (!currentFile || !currentFile.endsWith('.html')) return notify.warning("Only HTML supported");
        const blob = new Blob([fileTree[currentFile]?.file.contents || ""], { type: 'text/html' });
        setPreviewUrl(URL.createObjectURL(blob));
        setActiveOutputTab('web');
        setIsOutputPanelOpen(true);
    };

    const handleExplainSelected = () => {
        const editor = editorRef.current;
        if (!editor) return;
        const selection = editor.getModel().getValueInRange(editor.getSelection());
        if (!selection) return notify.warning("Select code!");
        setActiveSidePanel('ai');
        setMessages(prev => [...prev, { message: `Analyze:\n\`\`\`\n${selection}\n\`\`\``, sender: { _id: 'system', email: 'System' } }]);
        sendMessage('project-message', { message: `@ai Explain:\n${selection}`, sender: { _id: user._id, email: user.email } });
    };

    const handleAskAiToFix = () => {}; // Placeholder

    // Editor Props
    const editorProps = {
        currentFile,
        openFiles,
        setOpenFiles,
        setCurrentFile,
        fileTree,
        handleEditorChange,
        handleEditorMount,
        handleExplainSelected,
        formatCode,
        handlePreview,
        runProject,
        isOutputPanelOpen,
        setIsOutputPanelOpen,
        handleAskAiToFix,
        runOutput,
        activeOutputTab,
        setActiveOutputTab,
        previewUrl,
        users: roomUsers, 
        onlineUsers: roomUsers.map(u => u._id),
        setIsMobileMenuOpen
    };

    return (
        <main className="flex h-screen w-full bg-[#1e1e1e] text-white overflow-hidden">
            <aside className="hidden md:flex w-12 bg-[#181818] border-r border-white/5 flex-col items-center py-4 gap-4 z-10 flex-shrink-0">
                <button onClick={() => navigate('/')} className="p-2 rounded-lg text-gray-500 hover:text-white transition-colors hover:bg-white/5" title="Back to Dashboard">
                    <i className="ri-arrow-left-line text-lg"></i>
                </button>
                <div className="w-6 h-px bg-white/10 my-1"></div>
                
                <button onClick={() => setActiveSidePanel('files')} className={`p-2 rounded-lg transition-colors ${activeSidePanel === 'files' ? 'text-blue-400 bg-white/5' : 'text-gray-500 hover:text-white'}`} title="Files">
                    <i className="ri-folder-line text-lg"></i>
                </button>
                <button onClick={() => setActiveSidePanel('users')} className={`p-2 rounded-lg transition-colors ${activeSidePanel === 'users' ? 'text-blue-400 bg-white/5' : 'text-gray-500 hover:text-white'}`} title="Collaboration">
                    <i className="ri-group-line text-lg"></i>
                </button>
                <button onClick={() => setActiveSidePanel('ai')} className={`p-2 rounded-lg transition-colors ${activeSidePanel === 'ai' ? 'text-blue-400 bg-white/5' : 'text-gray-500 hover:text-white'}`} title="AI Assistant">
                    <i className="ri-robot-2-line text-lg"></i>
                </button>
            </aside>

            {/* CONDITIONAL LAYOUT: Mobile vs Desktop */}
            {isMobile ? (
                // MOBILE LAYOUT: Direct Editor (No Split Pane)
                <div className="flex-grow flex flex-col h-full overflow-hidden relative">
                     <EditorArea {...editorProps} />
                </div>
            ) : (
                // DESKTOP LAYOUT: Split Pane
                <Split className="flex-grow flex overflow-hidden" sizes={activeSidePanel ? [20, 80] : [0, 100]} gutterSize={2} minSize={0} snapOffset={0}>
                     <section className={`flex flex-col h-full bg-[#252526] border-r border-white/5 min-w-[250px] ${!activeSidePanel && 'hidden'}`}>
                        <div className="flex-grow overflow-hidden relative">
                            {activeSidePanel === 'files' && (
                                <div className="p-4 h-full overflow-y-auto custom-scrollbar">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Files</span>
                                            {project?.isCollaborative && <span className="bg-purple-500/10 text-purple-400 text-[9px] px-1.5 py-0.5 rounded border border-purple-500/20">COLLAB</span>}
                                        </div>
                                        <i onClick={() => setIsNewFileModalOpen(true)} className="ri-add-line cursor-pointer text-gray-500 hover:text-white"></i>
                                    </div>
                                    {Object.keys(fileTree).length === 0 && <div className="text-xs text-gray-600 italic">No files created</div>}
                                    {Object.keys(fileTree).sort().map(f => {
                                        const usersHere = Object.values(activeFileUsers).filter(u => u.file === f && u._id !== user._id);
                                        return (
                                            <div key={f} onClick={() => { setCurrentFile(f); if(!openFiles.includes(f)) setOpenFiles([...openFiles, f]); }} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer truncate mb-1 transition-colors ${currentFile === f ? 'text-blue-400 bg-blue-500/10' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                                                <i className="ri-file-code-line text-gray-500"></i>
                                                <span className="truncate flex-grow">{f}</span>
                                                {usersHere.length > 0 && (
                                                    <div className="flex -space-x-1">
                                                        {usersHere.map((u, i) => (
                                                            <div key={i} className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white border border-[#252526] shadow-sm" style={{backgroundColor: u.color}} title={u.email}>
                                                                {u.email[0].toUpperCase()}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}

                                </div>
                            )}

                        {activeSidePanel === 'ai' && (
                             <div className="flex flex-col h-full animate-in fade-in slide-in-from-left-4">
                                <div className="p-4 border-b border-white/5 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">AI Assistant</span>
                                    <div className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/20">BETA</div>
                                </div>
                                <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-3" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
                                     {messages.length === 0 && (
                                         <div className="text-center text-gray-600 text-xs mt-10">
                                             <i className="ri-robot-2-line text-4xl mb-2 opacity-50"></i>
                                             <p>Ask me to write code, explain logic, or fix bugs.</p>
                                         </div>
                                     )}
                                     {messages.map((msg, i) => {
                                         const isAi = msg.sender?._id === 'ai' || msg.sender?._id === 'system';
                                         return (
                                             <div key={i} className={`p-3 rounded-xl text-xs max-w-[90%] leading-relaxed shadow-sm break-words whitespace-pre-wrap ${isAi ? 'self-start bg-blue-600/10 text-blue-100 border border-blue-600/20' : 'self-end bg-white/5 text-gray-300'}`}>
                                                {isAi ? <Markdown>{msg.message}</Markdown> : msg.message}
                                             </div>
                                         )
                                     })}
                                     <div ref={messageBox}></div>
                                </div>
                                <div className="p-4 border-t border-white/5 bg-[#252526]">
                                     <div className="flex bg-black/30 rounded-xl border border-white/10 overflow-hidden focus-within:border-blue-500 transition-colors p-1">
                                         <input 
                                            value={message}
                                            onChange={e => setMessage(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && sendMessageToAi()}
                                            placeholder="Ask AI..."
                                            className="flex-grow bg-transparent p-2 text-xs outline-none text-white pl-3"
                                         />
                                         <button onClick={sendMessageToAi} className="px-3 text-gray-400 hover:text-white transition-colors"><i className="ri-send-plane-fill"></i></button>
                                     </div>
                                </div>
                             </div>
                        )}
                                {activeSidePanel === 'users' && (
                                <div className="p-4">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-6">Collaboration</h3>
                                    
                                    {!isCollaborating ? (
                                        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
                                            
                                            {/* CREATE ROOM */}
                                            <div className="bg-blue-600/10 p-5 rounded-2xl border border-blue-600/20 shadow-lg shadow-blue-900/10">
                                                <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white mb-3 shadow-md">
                                                    <i className="ri-broadcast-fill text-xl"></i>
                                                </div>
                                                <h4 className="text-white text-sm font-bold mb-1">Create Room</h4>
                                                <p className="text-[10px] text-blue-200 mb-4 leading-relaxed opacity-80">
                                                    Start a live session. You will become the Host.
                                                </p>
                                                <button 
                                                    onClick={createRoom}
                                                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-blue-600/20"
                                                >
                                                    Go Live
                                                </button>
                                            </div>

                                            <div className="relative flex py-2 items-center">
                                                <div className="flex-grow border-t border-gray-700"></div>
                                                <span className="flex-shrink-0 mx-4 text-gray-600 text-[10px] font-mono">OR JOIN</span>
                                                <div className="flex-grow border-t border-gray-700"></div>
                                            </div>

                                            {/* JOIN ROOM */}
                                            <div className="bg-[#1e1e1e] p-5 rounded-2xl border border-white/5">
                                                <h4 className="text-gray-300 text-xs font-bold mb-3">Join Existing Room</h4>
                                                <div className="flex flex-col gap-3">
                                                    <input 
                                                        value={roomInput}
                                                        onChange={e => setRoomInput(e.target.value)}
                                                        placeholder="Enter Room ID"
                                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-blue-500 font-mono text-center tracking-widest transition-all"
                                                    />
                                                    <button 
                                                        onClick={joinRoom}
                                                        disabled={!roomInput}
                                                        className="w-full py-3 bg-gray-700 hover:bg-white hover:text-black disabled:opacity-50 disabled:hover:bg-gray-700 disabled:hover:text-white text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                                                    >
                                                        Connect
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col h-full animate-in fade-in">
                                            {/* ACTIVE HEADER */}
                                            <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl mb-6 relative overflow-hidden">
                                                 <div className="absolute top-0 right-0 p-2 opacity-20">
                                                    <i className="ri-wifi-line text-4xl text-green-500"></i>
                                                 </div>
                                                 <div className="text-[10px] text-green-400 font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                                    Live Session
                                                 </div>
                                                 <div className="text-3xl font-mono font-bold text-white tracking-wider my-2">{roomId}</div>
                                                 <button 
                                                    onClick={() => {navigator.clipboard.writeText(roomId); notify.success("Copied!");}}
                                                    className="flex items-center gap-2 text-[10px] text-green-300 hover:text-white transition-colors cursor-pointer"
                                                 >
                                                    <i className="ri-file-copy-line"></i> Copy ID
                                                 </button>
                                            </div>

                                            {/* USERS LIST */}
                                            <div className="flex-grow overflow-y-auto">
                                                <h3 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3">In Room ({roomUsers.length})</h3>
                                                <div className="flex flex-col gap-2">
                                                    {roomUsers.map(u => (
                                                        <div key={u.socketId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center border border-white/10 text-xs font-bold shadow-inner">
                                                                {u.email[0].toUpperCase()}
                                                            </div>
                                                            <div className="flex-grow min-w-0">
                                                                <div className="text-xs font-bold text-gray-200 truncate">
                                                                    {u.email} {u._id === user._id && <span className="text-blue-500">(You)</span>}
                                                                </div>
                                                                <div className="text-[9px] text-gray-600 font-mono truncate">
                                                                    ID: {u._id.slice(-4)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* LEAVE BUTTON */}
                                            <div className="mt-4 pt-4 border-t border-white/10">
                                                <button 
                                                    onClick={leaveRoom}
                                                    className="w-full py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 hover:border-transparent rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                                >
                                                    <i className="ri-logout-box-r-line"></i> Leave Room
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}


                        </div>
                    </section>
                    <EditorArea {...editorProps} setIsMobileMenuOpen={setIsMobileMenuOpen} />
                </Split>
            )}

            {/* Mobile Drawer Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
                    <div className="relative w-72 bg-[#252526] h-full shadow-2xl border-r border-white/10 flex flex-col animate-in slide-in-from-left duration-200">
                         
                         {/* Drawer Header */}
                         <div className="flex justify-between items-center p-4 border-b border-white/5">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                Menu
                            </span>
                            <button onClick={() => setIsMobileMenuOpen(false)}><i className="ri-close-line text-lg text-gray-400"></i></button>
                        </div>

                        {/* Navigation Tabs (Mobile Only) */}
                        <div className="flex border-b border-white/5 bg-[#1e1e1e]">
                            <button 
                                onClick={() => setActiveSidePanel('files')} 
                                className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${activeSidePanel === 'files' ? 'text-blue-400 border-b-2 border-blue-400 bg-white/5' : 'text-gray-500 hover:text-white'}`}
                            >
                                Files
                            </button>
                            <button 
                                onClick={() => setActiveSidePanel('users')} 
                                className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${activeSidePanel === 'users' ? 'text-blue-400 border-b-2 border-blue-400 bg-white/5' : 'text-gray-500 hover:text-white'}`}
                            >
                                Team
                            </button>
                            <button 
                                onClick={() => setActiveSidePanel('ai')} 
                                className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${activeSidePanel === 'ai' ? 'text-blue-400 border-b-2 border-blue-400 bg-white/5' : 'text-gray-500 hover:text-white'}`}
                            >
                                AI
                            </button>
                        </div>

                        <div className="flex-grow overflow-hidden relative">
                             {/* Reusing the same render logic by conditionally rendering based on activeSidePanel state */}
                             {activeSidePanel === 'files' && (
                                <div className="p-4 h-full overflow-y-auto custom-scrollbar">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Files</span>
                                        </div>
                                        <i onClick={() => setIsNewFileModalOpen(true)} className="ri-add-line cursor-pointer text-gray-500 hover:text-white"></i>
                                    </div>
                                    {Object.keys(fileTree).length === 0 && <div className="text-xs text-gray-600 italic">No files created</div>}
                                    {Object.keys(fileTree).sort().map(f => (
                                        <div key={f} onClick={() => { setCurrentFile(f); if(!openFiles.includes(f)) setOpenFiles([...openFiles, f]); setIsMobileMenuOpen(false); }} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer truncate mb-1 transition-colors ${currentFile === f ? 'text-blue-400 bg-blue-500/10' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                                            <i className="ri-file-code-line text-gray-500"></i>{f}
                                        </div>
                                    ))}
                                </div>
                             )}
                             {activeSidePanel === 'users' && (
                                <div className="p-4">
                                     <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-6">Collaboration</h3>
                                     {!isCollaborating ? (
                                         <div className="flex flex-col gap-6">
                                             <div className="bg-blue-600/10 p-5 rounded-2xl border border-blue-600/20">
                                                 <button onClick={createRoom} className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest">Go Live</button>
                                             </div>
                                             <div className="bg-[#1e1e1e] p-5 rounded-2xl border border-white/5">
                                                 <input value={roomInput} onChange={e => setRoomInput(e.target.value)} placeholder="Room ID" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-xs mb-3 outline-none focus:border-blue-500" />
                                                 <button onClick={joinRoom} disabled={!roomInput} className="w-full py-3 bg-gray-700 text-white rounded-xl text-xs font-black uppercase tracking-widest">Connect</button>
                                             </div>
                                         </div>
                                     ) : (
                                        <div className="flex flex-col gap-4">
                                            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                                                <div className="text-xs text-green-400 font-bold mb-2">Live Session</div>
                                                <div className="text-xl font-mono text-white mb-2">{roomId}</div>
                                                <button onClick={() => {navigator.clipboard.writeText(roomId); notify.success("Copied!")}} className="text-xs text-green-300 underline">Copy ID</button>
                                            </div>
                                            <div className="flex-grow">
                                                <h4 className="text-[10px] uppercase text-gray-500 font-bold mb-2">Users</h4>
                                                {roomUsers.map(u => (
                                                    <div key={u.socketId} className="flex items-center gap-2 py-1 text-xs text-gray-300">
                                                        <span className="w-2 h-2 rounded-full bg-green-500"></span> {u.email}
                                                    </div>
                                                ))}
                                            </div>
                                            <button onClick={leaveRoom} className="w-full py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-black uppercase">Leave Room</button>
                                        </div>
                                     )}
                                </div>
                             )}
                             {activeSidePanel === 'ai' && (
                                 <div className="flex flex-col h-full">
                                    <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-3">
                                         {messages.map((msg, i) => (
                                             <div key={i} className={`p-3 rounded-xl text-xs max-w-[90%] break-words whitespace-pre-wrap ${msg.sender?._id === 'system' || msg.sender?._id === 'ai' ? 'self-start bg-blue-600/10 text-blue-100' : 'self-end bg-white/5 text-gray-300'}`}>
                                                {msg.sender?._id === 'ai' || msg.sender?._id === 'system' ? <Markdown>{msg.message}</Markdown> : msg.message}
                                             </div>
                                         ))}
                                    </div>
                                    <div className="p-4 bg-[#252526] border-t border-white/5">
                                        <div className="flex bg-black/30 rounded-xl border border-white/10 p-1">
                                            <input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessageToAi()} placeholder="Ask AI..." className="flex-grow bg-transparent p-2 text-xs outline-none text-white pl-3" />
                                            <button onClick={sendMessageToAi} className="px-3 text-gray-400"><i className="ri-send-plane-fill"></i></button>
                                        </div>
                                    </div>
                                 </div>
                             )}
                        </div>
                    </div>
                </div>
            )}
            {isNewFileModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                    <div className="bg-[#252526] p-8 rounded-3xl w-full max-w-sm border border-white/10 shadow-2xl scale-in-center">
                        <h2 className="text-xs font-black uppercase tracking-[4px] mb-6 text-gray-500">New Data stream</h2>
                        <input value={newFileName} onChange={e => setNewFileName(e.target.value)} autoFocus placeholder="Stream Name (e.g., core.js)" className="w-full bg-[#1e1e1e] p-4 rounded-2xl text-sm border border-transparent focus:border-blue-500/50 outline-none mb-8" />
                        <div className="flex justify-end gap-4"><button onClick={() => setIsNewFileModalOpen(false)} className="text-gray-500 font-bold text-xs uppercase hover:text-white transition-colors">Abort</button><button onClick={createNewFile} className="bg-blue-600 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/40">Initialize</button></div>
                    </div>
                </div>
            )}

            {/* Lobby Overlay */}


            {/* Modal Removed: Add User Modal */}

            {/* Preview Modal Removed (Unified Panel) */}
        </main>
    )
}

const EditorArea = ({ currentFile, openFiles, setOpenFiles, setCurrentFile, fileTree, handleEditorChange, handleEditorMount, handleExplainSelected, formatCode, handlePreview, runProject, isOutputPanelOpen, setIsOutputPanelOpen, handleAskAiToFix, runOutput, activeOutputTab, setActiveOutputTab, previewUrl, users, onlineUsers, setIsMobileMenuOpen }) => {
    const getLang = (f) => {
        const ext = f?.split('.').pop();
        return { js: 'javascript', jsx: 'javascript', ts: 'typescript', html: 'html', css: 'css', py: 'python', java: 'java' }[ext] || 'plaintext';
    }
    return (
        <div className="flex flex-col h-full overflow-hidden w-full">
            <div className="flex bg-[#252526] border-b border-white/5 h-10 items-end">
                {/* Mobile Menu Toggle - Fixed */}
                <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden px-4 h-full flex items-center justify-center text-gray-400 hover:text-white border-r border-white/5 transition-colors bg-[#252526] z-10">
                    <i className="ri-menu-2-line"></i>
                </button>
                
                {/* Scrollable Files */}
                <div className="flex overflow-x-auto no-scrollbar items-end flex-grow h-full">
                    {openFiles.map((f, index) => (
                        <div key={index} onClick={() => setCurrentFile(f)} className={`px-4 py-2 cursor-pointer flex items-center gap-2 text-[11px] font-bold border-r border-white/5 transition-all h-full min-w-fit ${currentFile === f ? 'bg-[#1e1e1e] text-blue-400 border-t border-t-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>
                            <span>{f}</span>
                            <i onClick={(e) => { e.stopPropagation(); const next = openFiles.filter(o => o !== f); setOpenFiles(next); if (currentFile === f) setCurrentFile(next[0] || null); }} className="ri-close-line hover:text-white ml-2 opacity-50"></i>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between p-2 px-4 md:px-6 gap-2 md:gap-6 border-b border-white/5 bg-[#1e1e1e]">
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">Active:</span>
                    <div className="flex -space-x-2">
                        {Array.from(onlineUsers).map(uid => {
                            const u = users.find(user => user._id === uid);
                            if (!u) return null;
                            return (
                                <div key={uid} className="w-6 h-6 rounded-full bg-blue-500 border border-[#1e1e1e] flex items-center justify-center text-[8px] font-black text-white" title={u.email}>
                                    {u.email[0].toUpperCase()}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="flex gap-4 w-full md:w-auto overflow-x-auto no-scrollbar pb-2 md:pb-0">
                    <button onClick={runProject} className="text-[10px] font-black uppercase tracking-widest text-green-500 flex items-center gap-2 hover:brightness-125 transition-all whitespace-nowrap"><i className="ri-play-fill text-lg"></i> Run</button>
                    <button onClick={handlePreview} className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2 hover:brightness-125 transition-all whitespace-nowrap"><i className="ri-global-line text-lg"></i> Preview HTML</button>
                    <button onClick={formatCode} className="text-[10px] font-black uppercase tracking-widest text-yellow-500 flex items-center gap-2 hover:brightness-125 transition-all whitespace-nowrap"><i className="ri-code-s-slash-line text-lg"></i> Format</button>
                    <button onClick={handleExplainSelected} className="text-[10px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-2 hover:brightness-125 transition-all whitespace-nowrap"><i className="ri-psychotherapy-line text-lg"></i> Explain</button>
                </div>
            </div>
            {/* Unified Output Panel */}
            <Split className="flex-grow flex flex-col overflow-hidden" sizes={isOutputPanelOpen ? [60, 40] : [99.9, 0.1]} direction="vertical" gutterSize={isOutputPanelOpen ? 4 : 0}>
                <div className="flex-grow relative bg-black">
                    {currentFile ? (
                        <Editor height="100%" language={getLang(currentFile)} theme="vs-dark" value={fileTree[currentFile]?.file.contents || ''} onChange={handleEditorChange} onMount={handleEditorMount} options={{ minimap: { enabled: false }, fontSize: 13, padding: { top: 20 }, smoothScrolling: true, fontFamily: "'JetBrains Mono', monospace" }} />
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-600 uppercase tracking-[15px] text-[15px] animate-pulse">NVIAM IDE</div>
                    )}
                </div>
                
                <div className={`bg-[#1e1e1e] flex flex-col overflow-hidden ${isOutputPanelOpen ? 'h-full border-t border-white/5' : 'h-0'}`}>
                    <div className="flex items-center justify-between bg-[#252526] px-4 py-2 border-b border-black/20">
                         <div className="flex gap-4">
                             <button onClick={() => setActiveOutputTab('console')} className={`text-xs font-bold uppercase tracking-widest ${activeOutputTab === 'console' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>Console</button>
                             <button onClick={() => setActiveOutputTab('web')} className={`text-xs font-bold uppercase tracking-widest ${activeOutputTab === 'web' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>Web Preview</button>
                         </div>
                         <button onClick={() => setIsOutputPanelOpen(false)}><i className="ri-close-line text-gray-500 hover:text-white"></i></button>
                    </div>
                    <div className="flex-grow overflow-auto p-4 bg-black font-mono text-xs">
                         {activeOutputTab === 'console' && (
                             <pre className="text-gray-300 whitespace-pre-wrap">{runOutput || 'No output. Click "Run" to execute.'}</pre>
                         )}
                         {activeOutputTab === 'web' && (
                             <div className="bg-white h-full w-full rounded-md overflow-hidden">
                                 {previewUrl ? <iframe src={previewUrl} className="w-full h-full border-none" /> : <div className="h-full flex items-center justify-center text-gray-500">No HTML Preview Available</div>}
                             </div>
                         )}
                    </div>
                </div>
            </Split>
        </div>
    )
}

export default Project