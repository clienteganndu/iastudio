import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ImageFile } from '../types';

interface MaskEditorProps {
    baseImageSrc: string;
    onSave: (mask: ImageFile) => void;
    onClose: () => void;
}

const MaskEditor: React.FC<MaskEditorProps> = ({ baseImageSrc, onSave, onClose }) => {
    const imageCanvasRef = useRef<HTMLCanvasElement>(null);
    const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [brushSize, setBrushSize] = useState(40);
    const [isErasing, setIsErasing] = useState(false);

    // Effect to set up the canvases and draw the base image
    useEffect(() => {
        const imageCanvas = imageCanvasRef.current;
        const drawingCanvas = drawingCanvasRef.current;
        const ctx = imageCanvas?.getContext('2d');
        if (!imageCanvas || !drawingCanvas || !ctx) return;

        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.src = baseImageSrc;
        image.onload = () => {
            const maxWidth = window.innerWidth * 0.8;
            const maxHeight = window.innerHeight * 0.65;
            const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
            const w = image.width * ratio;
            const h = image.height * ratio;
            
            imageCanvas.width = w;
            imageCanvas.height = h;
            drawingCanvas.width = w;
            drawingCanvas.height = h;

            ctx.drawImage(image, 0, 0, w, h);
        };
    }, [baseImageSrc]);

    const getCanvasCoordinates = (event: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
        const canvas = drawingCanvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    };

    const drawOnCanvas = useCallback((x: number, y: number) => {
        const ctx = drawingCanvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
        ctx.fillStyle = isErasing ? '#000' : 'rgba(236, 72, 153, 0.7)'; // Use solid black for eraser, pink for brush
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
    }, [brushSize, isErasing]);

    const startDrawing = (event: React.MouseEvent<HTMLCanvasElement>) => {
        const coords = getCanvasCoordinates(event);
        if (coords) {
            setIsDrawing(true);
            drawOnCanvas(coords.x, coords.y);
        }
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const ctx = drawingCanvasRef.current?.getContext('2d');
        if (ctx) ctx.beginPath(); // Reset the path
    };

    const draw = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const coords = getCanvasCoordinates(event);
        if (coords) {
            drawOnCanvas(coords.x, coords.y);
        }
    };

    const handleSave = () => {
        const canvas = drawingCanvasRef.current;
        if (!canvas) return;

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = canvas.width;
        maskCanvas.height = canvas.height;
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) return;
        
        const drawingCtx = canvas.getContext('2d');
        if (!drawingCtx) return;
        const imageData = drawingCtx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        const maskImageData = maskCtx.createImageData(maskCanvas.width, maskCanvas.height);
        for (let i = 0; i < data.length; i += 4) {
            // If alpha channel is > 0, it means it was drawn on
            if (data[i + 3] > 0) {
                maskImageData.data[i] = 255;     // R
                maskImageData.data[i + 1] = 255; // G
                maskImageData.data[i + 2] = 255; // B
                maskImageData.data[i + 3] = 255; // A
            } else {
                 maskImageData.data[i] = 0;
                 maskImageData.data[i+1] = 0;
                 maskImageData.data[i+2] = 0;
                 maskImageData.data[i+3] = 255;
            }
        }
        maskCtx.putImageData(maskImageData, 0, 0);

        const dataUrl = maskCanvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        onSave({ base64, mimeType: 'image/png' });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="mask-editor-title">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-4xl flex flex-col items-center animate-scaleIn">
                <h2 id="mask-editor-title" className="text-2xl font-bold mb-2 text-purple-400">Criar Máscara</h2>
                <p className="text-gray-400 mb-4 text-center">Pinte a área que você deseja modificar. Use a borracha para corrigir.</p>
                <div className="controls w-full flex flex-wrap justify-center items-center gap-4 mb-4">
                    <div className="flex items-center gap-2">
                        <label htmlFor="brushSize" className="text-white">Tamanho:</label>
                        <input
                            type="range" id="brushSize" min="2" max="100" value={brushSize}
                            onChange={(e) => setBrushSize(Number(e.target.value))} className="w-32"
                            aria-label="Tamanho do Pincel"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsErasing(false)} className={`px-4 py-2 text-sm rounded transition ${!isErasing ? 'bg-purple-600' : 'bg-gray-600 hover:bg-gray-500'}`} aria-pressed={!isErasing}>🖌️ Pincel</button>
                        <button onClick={() => setIsErasing(true)} className={`px-4 py-2 text-sm rounded transition ${isErasing ? 'bg-purple-600' : 'bg-gray-600 hover:bg-gray-500'}`} aria-pressed={isErasing}>🧼 Borracha</button>
                    </div>
                </div>
                <div className="relative w-auto h-auto">
                    <canvas ref={imageCanvasRef} className="rounded-lg" aria-label="Imagem base"></canvas>
                    <canvas
                        ref={drawingCanvasRef}
                        className="absolute top-0 left-0 rounded-lg cursor-crosshair"
                        onMouseDown={startDrawing}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onMouseMove={draw}
                        aria-label="Área de desenho da máscara"
                    />
                </div>
                <div className="actions mt-6 flex space-x-4">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition">Cancelar</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-md transition">Salvar Máscara</button>
                </div>
            </div>
        </div>
    );
};

export default MaskEditor;