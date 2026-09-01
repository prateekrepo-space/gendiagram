import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Download } from 'lucide-react';
import { saveAs } from 'file-saver';

mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });

const MermaidRenderer = ({ code, onSvgReady }) => {
    const [svgContent, setSvgContent] = useState('');
    const [error, setError] = useState(null);
    const [showFormatMenu, setShowFormatMenu] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const renderDiagram = async () => {
            if (!code) return;
            try {
                setError(null);
                const id = `mermaid-${Date.now()}`;
                const { svg } = await mermaid.render(id, code);
                setSvgContent(svg);
                onSvgReady?.(svg);  // Notify parent with the rendered SVG
            } catch (err) {
                console.error('Mermaid render error:', err);
                setError('Failed to render diagram. The generated code might be invalid.');
                onSvgReady?.(null);
            }
        };
        renderDiagram();
    }, [code]);

    const downloadSVG = () => {
        if (!svgContent) return;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        saveAs(blob, `diagram_${timestamp}.svg`);
        setShowFormatMenu(false);
    };

    const downloadPNG = () => {
        if (!svgContent) return;
        try {
            const svg = containerRef.current?.querySelector('svg');
            if (!svg) return;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const { width, height } = svg.getBoundingClientRect();
            const scale = 2;
            canvas.width = (width || 800) * scale;
            canvas.height = (height || 600) * scale;
            const svgData = new XMLSerializer().serializeToString(svg);
            const svgUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
            const img = new Image();
            img.onload = () => {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                        saveAs(blob, `diagram_${timestamp}.png`);
                        setShowFormatMenu(false);
                    }
                }, 'image/png', 1.0);
            };
            img.src = svgUrl;
        } catch (err) {
            console.error('PNG download error:', err);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-700">Preview</h3>
                    <div className="relative">
                        <button
                            onClick={() => setShowFormatMenu(!showFormatMenu)}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors shadow-sm"
                        >
                            <Download size={18} />
                            Download
                        </button>
                        {showFormatMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                                <button onClick={downloadSVG} className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100">
                                    <div className="font-medium text-gray-900">SVG Format</div>
                                </button>
                                <button onClick={downloadPNG} className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors">
                                    <div className="font-medium text-gray-900">PNG Format</div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div ref={containerRef} className="p-8 flex justify-center items-center min-h-[300px] overflow-auto bg-white">
                    {error ? (
                        <div className="text-red-500 bg-red-50 p-4 rounded-lg border border-red-100">{error}</div>
                    ) : (
                        <div dangerouslySetInnerHTML={{ __html: svgContent }} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default MermaidRenderer;
