import { useState, useCallback, useRef } from 'react';
import './DropZone.css';

interface DropZoneProps {
    onFilesDropped: (files: File[]) => void;
    isLoading?: boolean;
}

export function DropZone({ onFilesDropped, isLoading }: DropZoneProps) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [dragCount, setDragCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragCount(prev => prev + 1);
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragCount(prev => {
            const newCount = prev - 1;
            if (newCount <= 0) {
                setIsDragOver(false);
                return 0;
            }
            return newCount;
        });
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        setDragCount(0);

        const files = Array.from(e.dataTransfer.files);
        const validFiles = files.filter(f =>
            f.name.endsWith('.hl7') ||
            f.name.endsWith('.txt') ||
            f.type === 'text/plain'
        );

        if (validFiles.length > 0) {
            onFilesDropped(validFiles);
        }
    }, [onFilesDropped]);

    const handleClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            onFilesDropped(Array.from(files));
        }
        // Reset so same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [onFilesDropped]);

    return (
        <div
            className={`dropzone glass-card ${isDragOver ? 'dropzone--active' : ''} ${isLoading ? 'dropzone--loading' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleClick}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept=".hl7,.txt"
                multiple
                className="dropzone__input"
                onChange={handleFileInput}
            />

            <div className="dropzone__content">
                {isLoading ? (
                    <>
                        <div className="dropzone__spinner" />
                        <p className="dropzone__text">Parsing message...</p>
                    </>
                ) : isDragOver ? (
                    <>
                        <div className="dropzone__icon dropzone__icon--active">📥</div>
                        <p className="dropzone__text">Drop your HL7 file here</p>
                    </>
                ) : (
                    <>
                        <div className="dropzone__icon">📂</div>
                        <p className="dropzone__text">
                            Drag & drop <code>.hl7</code> files here
                        </p>
                        <p className="dropzone__hint">or click to browse</p>
                    </>
                )}
            </div>

            {/* Animated border */}
            {isDragOver && <div className="dropzone__glow" />}
        </div>
    );
}
