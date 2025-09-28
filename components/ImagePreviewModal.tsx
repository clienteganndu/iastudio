import React, { useCallback } from 'react';

interface ImagePreviewModalProps {
    imageUrl: string;
    onClose: () => void;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ imageUrl, onClose }) => {

    const handleDownload = useCallback(() => {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `ai-ganndu-variation-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [imageUrl]);

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
        >
            <div className="relative bg-gray-900 p-4 rounded-xl shadow-2xl max-w-4xl max-h-[90vh] flex flex-col animate-scaleIn">
                <img 
                    src={imageUrl} 
                    alt="Image Preview" 
                    className="w-full h-auto object-contain rounded-lg"
                />
                <div className="absolute top-4 right-4 flex space-x-2">
                    <button 
                        className="h-10 w-10 bg-gray-700 hover:bg-purple-600 rounded-full flex items-center justify-center transition" 
                        title="Download" 
                        onClick={handleDownload}
                        aria-label="Download Image"
                    >
                        💾
                    </button>
                    <button 
                        className="h-10 w-10 bg-gray-700 hover:bg-red-600 rounded-full flex items-center justify-center transition" 
                        title="Fechar" 
                        onClick={onClose}
                        aria-label="Close Preview"
                    >
                        ❌
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImagePreviewModal;