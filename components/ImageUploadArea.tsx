import React, { useState } from 'react';

interface ImageUploadAreaProps {
    id: string;
    onImageUpload: (file: File) => void;
    previewSrc: string | null;
    title: string;
    subtitle?: string;
    className?: string;
}

const ImageUploadArea: React.FC<ImageUploadAreaProps> = ({ id, onImageUpload, previewSrc, title, subtitle, className }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            onImageUpload(event.target.files[0]);
        }
    };

    const handleLabelClick = () => {
        document.getElementById(id)?.click();
    };

    const handleDrag = (e: React.DragEvent<HTMLDivElement>, dragging: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(dragging);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onImageUpload(e.dataTransfer.files[0]);
        }
    };

    const dragClasses = isDragging ? 'border-purple-500 bg-gray-800 border-solid' : 'border-gray-600 hover:border-purple-500 border-dashed';

    return (
        <div
            className={`relative border-2 rounded-lg p-6 text-center cursor-pointer transition-colors duration-200 ${dragClasses} ${className || ''}`}
            onClick={handleLabelClick}
            onDragEnter={(e) => handleDrag(e, true)}
            onDragLeave={(e) => handleDrag(e, false)}
            onDragOver={(e) => handleDrag(e, true)}
            onDrop={handleDrop}
        >
            <input
                type="file"
                id={id}
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
            />
            {previewSrc ? (
                <img id={`${id}-preview`} src={previewSrc} alt="Preview" className="image-preview absolute inset-0 w-full h-full object-cover rounded-lg pointer-events-none" />
            ) : (
                <div className="flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-4xl text-gray-500 mb-2">📁</div>
                    <p className="font-semibold text-gray-300">{isDragging ? 'Solte para carregar' : title}</p>
                    {subtitle && !isDragging && <p className="upload-text text-xs text-gray-400 mt-1">{subtitle}</p>}
                </div>
            )}
        </div>
    );
};

export default ImageUploadArea;
