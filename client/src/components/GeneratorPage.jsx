import React, { useState, useCallback } from 'react';
import { Wand2, Loader2, ArrowLeft, Save, BookOpen, X, Clock } from 'lucide-react';
import MermaidRenderer from './MermaidRenderer';

const API_URL = import.meta.env.VITE_API_URL ?? '';

const GeneratorPage = ({ onBack }) => {
    const [prompt, setPrompt] = useState('');
    const [type, setType] = useState('graph TD');
    const [loading, setLoading] = useState(false);
    const [diagramCode, setDiagramCode] = useState('');
    const [svgContent, setSvgContent] = useState(null);
    const [error, setError] = useState(null);

    // Save state
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Saved diagrams panel
    const [showSaved, setShowSaved] = useState(false);
    const [savedDiagrams, setSavedDiagrams] = useState([]);
    const [loadingSaved, setLoadingSaved] = useState(false);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        setError(null);
        setDiagramCode('');
        setSvgContent(null);
        setSaveSuccess(false);

        try {
            const response = await fetch(`${API_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, type }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to generate diagram');
            setDiagramCode(data.mermaidCode);
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!diagramCode) return;
        setSaving(true);
        try {
            const response = await fetch(`${API_URL}/api/diagrams/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, type, mermaidCode: diagramCode, svgContent }),
            });
            if (!response.ok) throw new Error('Failed to save');
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            setError('Failed to save diagram: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleOpenSaved = async () => {
        setShowSaved(true);
        setLoadingSaved(true);
        try {
            const response = await fetch(`${API_URL}/api/diagrams`);
            const data = await response.json();
            setSavedDiagrams(data.diagrams || []);
        } catch {
            setSavedDiagrams([]);
        } finally {
            setLoadingSaved(false);
        }
    };

    const handleLoadDiagram = async (id) => {
        try {
            const response = await fetch(`${API_URL}/api/diagrams/${id}`);
            const data = await response.json();
            setPrompt(data.prompt);
            setType(data.type);
            setDiagramCode(data.mermaid_code);
            setShowSaved(false);
        } catch {
            setError('Failed to load diagram');
        }
    };

    const handleSvgReady = useCallback((svg) => setSvgContent(svg), []);

    const typeLabels = {
        'graph TD': 'Flowchart',
        'sequenceDiagram': 'Sequence',
        'classDiagram': 'Class',
        'stateDiagram': 'State',
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600" title="Back to Home">
                            <ArrowLeft size={20} />
                        </button>
                        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">AI</div>
                        <h1 className="font-bold text-xl text-gray-900">Diagram Maker</h1>
                    </div>
                    <button
                        onClick={handleOpenSaved}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <BookOpen size={16} />
                        My Diagrams
                    </button>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 flex flex-col lg:flex-row gap-8">
                {/* Left Panel */}
                <div className="w-full lg:w-1/3 flex flex-col gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Diagram Type</label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">Describe your diagram</label>
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
                            {loading ? <><Loader2 className="animate-spin" size={20} />Generating...</> : <><Wand2 size={20} />Generate Diagram</>}
                        </button>

                        {diagramCode && (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className={`mt-3 w-full py-3 px-4 font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                                    saveSuccess
                                        ? 'bg-green-500 text-white'
                                        : 'bg-white border-2 border-orange-500 text-orange-500 hover:bg-orange-50'
                                }`}
                            >
                                {saving ? <><Loader2 className="animate-spin" size={20} />Saving...</> :
                                 saveSuccess ? '✓ Saved!' :
                                 <><Save size={20} />Save Diagram</>}
                            </button>
                        )}

                        {error && (
                            <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>
                        )}
                    </div>
                </div>

                {/* Right Panel */}
                <div className="w-full lg:w-2/3">
                    {diagramCode ? (
                        <MermaidRenderer code={diagramCode} onSvgReady={handleSvgReady} />
                    ) : (
                        <div className="h-full min-h-[400px] bg-white rounded-xl shadow-sm border border-gray-200 border-dashed flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <Wand2 size={32} className="text-gray-300" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Generate</h3>
                            <p className="max-w-sm">Select a diagram type and describe your workflow on the left to generate a professional diagram instantly.</p>
                        </div>
                    )}
                </div>
            </main>

            {/* My Diagrams Drawer */}
            {showSaved && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowSaved(false)} />
                    <div className="relative ml-auto w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
                        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900">My Diagrams</h2>
                            <button onClick={() => setShowSaved(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {loadingSaved ? (
                                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-orange-500" size={28} /></div>
                            ) : savedDiagrams.length === 0 ? (
                                <div className="text-center text-gray-400 py-12">
                                    <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
                                    <p>No saved diagrams yet.</p>
                                    <p className="text-sm mt-1">Generate and save a diagram to see it here.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {savedDiagrams.map((d) => (
                                        <button
                                            key={d.id}
                                            onClick={() => handleLoadDiagram(d.id)}
                                            className="w-full text-left p-4 bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-xl transition-all"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="font-medium text-gray-900 text-sm line-clamp-2">{d.prompt}</p>
                                                <span className="shrink-0 text-xs font-semibold px-2 py-1 bg-orange-100 text-orange-600 rounded-full">{typeLabels[d.type] || d.type}</span>
                                            </div>
                                            <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                                                <Clock size={12} />
                                                {new Date(d.created_at).toLocaleString()}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GeneratorPage;
