import React, { useContext, useState, useEffect } from 'react'
import { UserContext } from '../context/user.context'
import axios from "../config/axios"
import { useNavigate } from 'react-router-dom'

const Home = () => {

    const { user } = useContext(UserContext)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [projectName, setProjectName] = useState('')
    const [project, setProject] = useState([])

    const navigate = useNavigate()

    function createProject(e) {
        e.preventDefault()
        // console.log({ projectName })

        axios.post('/projects/create', {
            name: projectName,
        })
            .then((res) => {
                // console.log(res)
                setIsModalOpen(false)
                setProject([...project, res.data])
            })
            .catch((error) => {
                console.error(error)
            })
    }

    useEffect(() => {
        axios.get('/projects/all').then((res) => {
            setProject(res.data.projects)

        }).catch(err => {
            console.error(err)
        })

    }, [])


    const folderInputRef = React.useRef(null)

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files)
        if (files.length === 0) return

        const fileTree = {}
        const folderName = files[0].webkitRelativePath.split('/')[0]

        // Filter valid files
        const maxFiles = 50; // Safety limit
        let processedCount = 0;

        const filteredFiles = files.filter(file => {
            const pathParts = file.webkitRelativePath.split('/');
            return !pathParts.some(part => ['node_modules', '.git', 'dist', 'build', 'coverage'].includes(part));
        });

        if (filteredFiles.length > maxFiles) {
            if (!window.confirm(`You are importing ${filteredFiles.length} files. This might take a while. Continue?`)) return;
        }

        const readFile = (file) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    resolve({
                        path: file.webkitRelativePath,
                        content: event.target.result
                    });
                };
                reader.onerror = reject;
                reader.readAsText(file);
            });
        };

        try {
            const results = await Promise.all(filteredFiles.map(readFile));

            results.forEach(({ path, content }) => {
                // path: Folder/sub/file.js
                // We want to store it relative to project root. 
                // Currently project root IS the folder. 
                // So key should be "sub/file.js" or "file.js"
                // The webkitRelativePath includes the root folder name.
                // e.g. "MyProject/src/index.js".
                // If we want "src/index.js", we strip the first part.

                const relativePath = path.split('/').slice(1).join('/');
                if (relativePath) {
                    fileTree[relativePath] = {
                        file: {
                            contents: content
                        }
                    }
                }
            });

            // Send to Backend
            axios.post('/projects/import', {
                name: folderName,
                fileTree
            }).then(res => {
                navigate(`/project`, {
                    state: { project: res.data }
                })
            }).catch(err => {
                console.error(err);
                alert("Import failed: " + err.message);
            })

        } catch (error) {
            console.error("Error reading files:", error);
            alert("Error reading files");
        }
    }

    return (
        <main className='p-4'>
            <div className="projects flex flex-wrap gap-3">
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="project p-4 border border-slate-300 rounded-md">
                    New Project
                    <i className="ri-link ml-2"></i>
                </button>

                <button
                    onClick={() => folderInputRef.current.click()}
                    className="project p-4 border border-slate-300 rounded-md">
                    Import Project
                    <i className="ri-folder-upload-line ml-2"></i>
                </button>

                <input
                    type="file"
                    ref={folderInputRef}
                    className="hidden"
                    webkitdirectory="true"
                    directory=""
                    multiple
                    onChange={handleFileUpload}
                />

                {
                    project.map((project) => (
                        <div key={project._id}
                            onClick={() => {
                                navigate(`/project`, {
                                    state: { project }
                                })
                            }}
                            className="project flex flex-col gap-2 cursor-pointer p-4 border border-slate-300 rounded-md min-w-52 hover:bg-slate-200">
                            <h2
                                className='font-semibold'
                            >{project.name}</h2>

                            <div className="flex gap-2">
                                <p> <small> <i className="ri-user-line"></i> Collaborators</small> :</p>
                                {project.users.length}
                            </div>

                        </div>
                    ))
                }


            </div>

            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white p-6 rounded-md shadow-md w-1/3">
                        <h2 className="text-xl mb-4">Create New Project</h2>
                        <form onSubmit={createProject}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700">Project Name</label>
                                <input
                                    onChange={(e) => setProjectName(e.target.value)}
                                    value={projectName}
                                    type="text" className="mt-1 block w-full p-2 border border-gray-300 rounded-md" required />
                            </div>
                            <div className="flex justify-end">
                                <button type="button" className="mr-2 px-4 py-2 bg-gray-300 rounded-md" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}


        </main>
    )
}

export default Home