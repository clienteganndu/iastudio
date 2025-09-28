import React from 'react';

interface FunctionCardProps {
    icon: string;
    name: string;
    isActive: boolean;
    onClick: () => void;
}

const FunctionCard: React.FC<FunctionCardProps> = ({ icon, name, isActive, onClick }) => {
    const baseClasses = "flex flex-col items-center justify-center p-4 rounded-lg cursor-pointer transition-all duration-200 transform hover:scale-105 active:scale-95";
    const activeClasses = "bg-purple-600 text-white shadow-lg";
    const inactiveClasses = "bg-gray-700 hover:bg-gray-600";

    return (
        <div
            className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
            onClick={onClick}
        >
            <div className="text-3xl mb-2">{icon}</div>
            <div className="text-sm font-medium">{name}</div>
        </div>
    );
};

export default FunctionCard;