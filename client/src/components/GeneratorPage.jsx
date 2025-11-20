import React, { useState } from 'react';
import { Wand2, Loader2, ArrowLeft } from 'lucide-react';
import MermaidRenderer from './MermaidRenderer';

const GeneratorPage = ({ onBack }) => {
    const [prompt, setPrompt] = useState('');
    const [type, setType] = useState('graph TD');
    const [loading, setLoading] = useState(false);
    const [diagramCode, setDiagramCode] = useState('');
    const [error, setError] = useState(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setLoading(true);
        setError(null);
        setDiagramCode('');

        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const response = await fetch(`${API_URL}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt, type }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate diagram');
            }

            setDiagramCode(data.mermaidCode);
        } catch (err) {
            console.error('Generation error:', err);
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
                            title="Back to Home"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">
                            AI
                        </div>
                        <h1 className="font-bold text-xl text-gray-900">Diagram Maker</h1>
                    </div>
                    <div className="text-sm text-gray-500">
                        Create diagrams with AI
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 flex flex-col lg:flex-row gap-8">
                {/* Left Panel: Controls */}
                <div className="w-full lg:w-1/3 flex flex-col gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Diagram Type
                        </label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                        >
                            <option value="graph TD">Flowchart (Top-Down)</option>
                            <option value="sequenceDiagram">Sequence Diagram</option>
                            <option value="classDiagram">Class Diagram</option>
                            <option value="stateDiagram">State Diagram</option>
                        </select>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Describe your diagram
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g., A user logs in, the system validates credentials, and redirects to dashboard..."
                            className="w-full flex-1 min-h-[200px] p-4 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none transition-all mb-4"
                        />

                        <button
                            onClick={handleGenerate}
                            disabled={loading || !prompt.trim()}
                            className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Wand2 size={20} />
                                    Generate Diagram
                                </>
                            )}
                        </button>

                        {error && (
                            <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                                {error}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Preview */}
                <div className="w-full lg:w-2/3">
                    {diagramCode ? (
                        <MermaidRenderer code={diagramCode} />
                    ) : (
                        <div className="h-full min-h-[400px] bg-white rounded-xl shadow-sm border border-gray-200 border-dashed flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <Wand2 size={32} className="text-gray-300" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Generate</h3>
                            <p className="max-w-sm">
                                Select a diagram type and describe your workflow on the left to generate a professional diagram instantly.
                            </p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default GeneratorPage;
