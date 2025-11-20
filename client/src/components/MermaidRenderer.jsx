import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Download } from 'lucide-react';
import { saveAs } from 'file-saver';

mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
});

const MermaidRenderer = ({ code }) => {
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
            } catch (err) {
                console.error('Mermaid render error:', err);
                setError('Failed to render diagram. The code might be invalid.');
            }
        };

        renderDiagram();
    }, [code]);

    const downloadSVG = () => {
        if (!svgContent) return;
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `diagram_${timestamp}.svg`;
            const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
            saveAs(blob, filename);
            setShowFormatMenu(false);
        } catch (error) {
            console.error('Error downloading SVG:', error);
        }
    };

    const downloadPNG = () => {
        if (!svgContent) {
            alert('No diagram to download');
            return;
        }

        try {
            const svg = containerRef.current.querySelector('svg');
            if (!svg) {
                alert('SVG element not found');
                return;
            }

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Get SVG dimensions
            const svgRect = svg.getBoundingClientRect();
            const width = svgRect.width || 800;
            const height = svgRect.height || 600;

            const scale = 2;
            canvas.width = width * scale;
            canvas.height = height * scale;

            // Convert SVG to data URL
            const svgData = new XMLSerializer().serializeToString(svg);
            const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));

            const img = new Image();

            img.onload = () => {
                try {
                    // Draw white background
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    // Draw SVG
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // Convert to blob and download
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                            const filename = `diagram_${timestamp}.png`;
                            saveAs(blob, filename);
                            setShowFormatMenu(false);
                        } else {
                            alert('Failed to create PNG blob');
                        }
                    }, 'image/png', 1.0);
                } catch (err) {
                    console.error('Canvas drawing error:', err);
                    alert('Error drawing to canvas: ' + err.message);
                }
            };

            img.onerror = (err) => {
                console.error('Image load error:', err);
                alert('Failed to load SVG image for PNG conversion');
            };

            img.src = svgDataUrl;

        } catch (error) {
            console.error('Error downloading PNG:', error);
            alert('PNG download error: ' + error.message);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
            {/* Diagram Preview */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-700">Preview</h3>

                    {/* Single Download Button with Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowFormatMenu(!showFormatMenu)}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors shadow-sm"
                        >
                            <Download size={18} />
                            Download
                        </button>

                        {/* Format Selection Dropdown */}
                        {showFormatMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                                <button
                                    onClick={downloadSVG}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
                                >
                                    <div className="font-medium text-gray-900">SVG Format</div>
                                </button>
                                <button
                                    onClick={downloadPNG}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="font-medium text-gray-900">PNG Format</div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div
                    ref={containerRef}
                    className="p-8 flex justify-center items-center min-h-[300px] overflow-auto bg-white"
                >
                    {error ? (
                        <div className="text-red-500 bg-red-50 p-4 rounded-lg border border-red-100">
                            {error}
                        </div>
                    ) : (
                        <div dangerouslySetInnerHTML={{ __html: svgContent }} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default MermaidRenderer;
