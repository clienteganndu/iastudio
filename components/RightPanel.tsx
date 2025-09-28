import React, { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import { ImageFile } from '../types';

interface RightPanelProps {
    isLoading: boolean;
    isUpscaling: boolean;
    generatedImage: string | null;
    variationBaseImage: ImageFile | null;
    generatedVariations: (string | null | 'error')[];
    generatedMockups: (string | null | 'error')[];
    onEdit: () => void;
    onUpscale: () => void;
    onVariationClick: (imageUrl: string) => void;
    onGenerateMockupVariations: (imageUrl: string) => void;
    onSaveToFavorites: (imageUrl: string) => void;
    downloadFormat: 'image/png' | 'image/jpeg' | 'application/pdf';
}

const FILTERS = {
    'Original': 'none',
    'Grayscale': 'grayscale(100%)',
    'Sepia': 'sepia(100%)',
    'Vintage': 'sepia(60%) contrast(1.1) brightness(0.9)',
};
type FilterType = keyof typeof FILTERS;


const RightPanel: React.FC<RightPanelProps> = ({ 
    isLoading, 
    isUpscaling, 
    generatedImage, 
    variationBaseImage,
    generatedVariations,
    generatedMockups,
    onEdit, 
    onUpscale,
    onVariationClick,
    onGenerateMockupVariations,
    onSaveToFavorites,
    downloadFormat 
}) => {
    const [activeFilter, setActiveFilter] = useState<FilterType>('Original');

    useEffect(() => {
        // Reset filter when a new image is generated
        if (generatedImage) {
            setActiveFilter('Original');
        }
    }, [generatedImage]);

    const handleDownload = useCallback((imageUrl?: string) => {
        const urlToDownload = imageUrl || generatedImage;
        if (!urlToDownload) return;

        const filenameBase = `ai-ganndu-studio-${Date.now()}`;
        const filterValue = !imageUrl ? FILTERS[activeFilter] : 'none';

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            if (filterValue !== 'none') {
                ctx.filter = filterValue;
            }
            ctx.drawImage(img, 0, 0);

            if (downloadFormat === 'application/pdf' && !imageUrl) {
                const orientation = img.width > img.height ? 'l' : 'p';
                const pdf = new jsPDF({
                    orientation,
                    unit: 'px',
                    format: [img.width, img.height]
                });
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, img.width, img.height);
                pdf.save(`${filenameBase}.pdf`);
            } else {
                const mimeType = urlToDownload.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png';
                const extension = mimeType.split('/')[1] || 'png';
                const finalImageURL = canvas.toDataURL(mimeType);
                
                const link = document.createElement('a');
                link.href = finalImageURL;
                link.download = `${filenameBase}.${extension}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        };
        img.src = urlToDownload;
    }, [generatedImage, activeFilter, downloadFormat]);

    const renderVariationGrid = () => (
        <div className="w-full h-full p-4 flex flex-col animate-fadeIn">
            <h2 className="text-xl font-semibold text-purple-400 mb-4 text-center flex-shrink-0">Resultados da Geração</h2>
            {variationBaseImage && (
                <div className="mb-4 text-center flex-shrink-0">
                    <h3 className="text-lg font-semibold text-gray-300 mb-2">Original</h3>
                    <img 
                        src={`data:${variationBaseImage.mimeType};base64,${variationBaseImage.base64}`} 
                        alt="Original" 
                        className="rounded-lg shadow-lg mx-auto h-32 object-contain"
                    />
                </div>
            )}
            <div className="flex-grow relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="flex w-full space-x-6 overflow-x-auto p-4">
                        {generatedVariations.map((variation, index) => (
                            <div key={index} className="relative group bg-gray-800 rounded-lg shadow-lg overflow-hidden aspect-square animate-scaleIn w-72 flex-shrink-0">
                                {variation === 'error' ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-red-400">
                                        <span className="text-4xl" role="img" aria-label="Error">⚠️</span>
                                        <p className="mt-2 text-sm">Falha ao gerar</p>
                                    </div>
                                ) : variation ? (
                                    <>
                                        <img src={variation} alt={`Variação ${index + 1}`} className="w-full h-full object-cover"/>
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center space-x-4">
                                            <button className="h-12 w-12 bg-purple-600 hover:bg-purple-700 rounded-full flex items-center justify-center transition transform hover:scale-110 active:scale-95" title="Ampliar" aria-label={`Ampliar variação ${index + 1}`} onClick={() => onVariationClick(variation)}>
                                                <span role="img" aria-hidden="true" className="text-2xl">🔎</span>
                                            </button>
                                            <button className="h-12 w-12 bg-gray-600 hover:bg-gray-700 rounded-full flex items-center justify-center transition transform hover:scale-110 active:scale-95" title="Download" aria-label={`Download variação ${index + 1}`} onClick={() => handleDownload(variation)}>
                                                <span role="img" aria-hidden="true" className="text-2xl">💾</span>
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                     <div className="w-full h-full flex flex-col items-center justify-center">
                                        <div className="loading-spinner w-10 h-10 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="mt-2 text-sm text-gray-400">Gerando...</p>
                                     </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
    
    const renderMockupGrid = () => (
        <div className="w-full h-full p-4 flex flex-col animate-fadeIn">
            <h2 className="text-xl font-semibold text-purple-400 mb-4 text-center flex-shrink-0">Seus Mockups Gerados</h2>
            <div className="flex-grow relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="flex w-full space-x-6 overflow-x-auto p-4">
                        {generatedMockups.map((mockup, index) => (
                            <div key={index} className="relative group bg-gray-800 rounded-lg shadow-lg overflow-hidden aspect-square animate-scaleIn w-72 flex-shrink-0">
                                {mockup === 'error' ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-red-400"><span className="text-4xl" role="img" aria-label="Error">⚠️</span><p className="mt-2 text-sm">Falha ao gerar</p></div>
                                ) : mockup ? (
                                    <>
                                        <img src={mockup} alt={`Mockup ${index + 1}`} className="w-full h-full object-cover"/>
                                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center space-y-3 p-4">
                                            <button className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 rounded-md text-sm font-semibold transition transform hover:scale-105 active:scale-95" onClick={() => onGenerateMockupVariations(mockup)}>🔄 Gerar Variações</button>
                                            <button className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-500 rounded-md text-sm font-semibold transition transform hover:scale-105 active:scale-95" onClick={() => handleDownload(mockup)}>💾 Baixar Mockup</button>
                                            <button className="w-full py-2 px-4 bg-pink-600 hover:bg-pink-700 rounded-md text-sm font-semibold transition transform hover:scale-105 active:scale-95" onClick={() => onSaveToFavorites(mockup)}>❤️ Salvar nos Favoritos</button>
                                        </div>
                                    </>
                                ) : (
                                     <div className="w-full h-full flex flex-col items-center justify-center">
                                        <div className="loading-spinner w-10 h-10 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="mt-2 text-sm text-gray-400">Gerando...</p>
                                     </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderContent = () => {
        if (generatedMockups.length > 0) return renderMockupGrid();
        if (generatedVariations.length > 0) return renderVariationGrid();

        if (isLoading || isUpscaling) {
            return (
                <div id="loadingContainer" className="loading-container flex flex-col items-center text-center">
                    <div className="loading-spinner w-16 h-16 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                    <p className="loading-text mt-4 text-lg animate-fadeIn">{isUpscaling ? 'Ampliando imagem 4x...' : 'Gerando sua imagem...'}</p>
                </div>
            );
        }

        if (!generatedImage) {
            return (
                <div id="resultPlaceholder" className="result-placeholder text-center text-gray-500">
                    <div className="result-placeholder-icon text-6xl mb-4">🎨</div>
                    <p>Sua obra de arte aparecerá aqui</p>
                </div>
            );
        }

        return (
             <div id="imageContainer" className="image-container relative w-full h-full max-w-2xl max-h-2xl flex items-center justify-center group animate-scaleIn">
                <img id="generatedImage" src={generatedImage} alt="Generated Art" className="generated-image rounded-lg shadow-2xl object-contain max-w-full max-h-full transition-all duration-300" style={{ filter: FILTERS[activeFilter] }}/>
                <div className="absolute bottom-4 flex flex-col items-center space-y-2">
                    <div className="filter-controls bg-black/50 backdrop-blur-sm p-1 rounded-full flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                         {(Object.keys(FILTERS) as FilterType[]).map((name) => (
                            <button key={name} onClick={() => setActiveFilter(name)} className={`px-3 py-1 text-xs rounded-full transition active:scale-95 ${activeFilter === name ? 'bg-purple-600 text-white' : 'bg-transparent text-gray-300 hover:bg-gray-700'}`} title={`Apply ${name} filter`}>{name}</button>
                        ))}
                    </div>
                    <div className="image-actions bg-black/50 backdrop-blur-sm p-2 rounded-full flex space-x-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button className="action-btn h-10 w-10 bg-gray-700 hover:bg-purple-600 rounded-full flex items-center justify-center transition hover:scale-110 active:scale-95" title="Editar" onClick={onEdit}>✏️</button>
                        <button className="action-btn h-10 w-10 bg-gray-700 hover:bg-purple-600 rounded-full flex items-center justify-center transition hover:scale-110 active:scale-95" title="Upscale 4x" onClick={onUpscale}>🚀</button>
                        <button className="action-btn h-10 w-10 bg-gray-700 hover:bg-purple-600 rounded-full flex items-center justify-center transition hover:scale-110 active:scale-95" title="Download" onClick={() => handleDownload()}>💾</button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="right-panel flex-grow flex items-center justify-center p-6 bg-gray-900/80 backdrop-blur-sm h-full">
            {renderContent()}
        </div>
    );
};

export default RightPanel;