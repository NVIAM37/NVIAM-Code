import React, { Component } from 'react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught Error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-screen w-screen bg-black text-white flex flex-col items-center justify-center p-8 font-mono">
                    <h1 className="text-red-500 text-2xl font-bold mb-4">CRITICAL SYSTEM FAILURE</h1>
                    <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-lg max-w-2xl w-full overflow-auto">
                        <p className="text-red-300 font-bold mb-2">{this.state.error?.toString()}</p>
                        <pre className="text-xs text-red-200/50 whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</pre>
                    </div>
                    <button 
                        onClick={() => { localStorage.clear(); window.location.href = '/login'; }} 
                        className="mt-8 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded font-bold uppercase tracking-widest"
                    >
                        Hard Reset System
                    </button>
                    <p className="mt-4 text-xs text-gray-500">This error has been logged. Please report to engineering.</p>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
