import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { HL7Flow, SegmentEmrConfigEntry } from '../lib/types';
import { deleteSegmentEmrUpdate, getSegmentDefinition, getSegmentEmrConfig, saveSegmentEmrUpdate } from '../lib/field-dictionary';
import './FieldTooltip.css';
import './SegmentTooltip.css';

interface SegmentTooltipProps {
    segmentName: string;
    flow: HL7Flow;
    anchorRect: DOMRect;
    isPinned: boolean;
    onHoverStart?: () => void;
    onHoverEnd?: () => void;
    onConfigUpdated?: () => void;
    onClose: () => void;
}

interface EditableSegmentFields {
    emrLocation: string;
    emrNotes: string;
    imagePaths: string[];
}

export function SegmentTooltip({
    segmentName,
    flow,
    anchorRect,
    isPinned,
    onHoverStart,
    onHoverEnd,
    onConfigUpdated,
    onClose,
}: SegmentTooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [hasMovedManually, setHasMovedManually] = useState(false);
    const [magnifiedImage, setMagnifiedImage] = useState<string | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const draggingOffset = useRef({ x: 0, y: 0 });

    const segDef = getSegmentDefinition(segmentName);
    const initialConfig = getSegmentEmrConfig(segmentName, flow);
    const [localConfig, setLocalConfig] = useState<SegmentEmrConfigEntry | undefined>(initialConfig);
    const [editFields, setEditFields] = useState<EditableSegmentFields>({
        emrLocation: initialConfig?.emrLocation || '',
        emrNotes: initialConfig?.notes || '',
        imagePaths: initialConfig?.imagePaths || [],
    });

    const localEnabled = !!localConfig && localConfig.enabled !== false;

    useEffect(() => {
        if (!tooltipRef.current || isDragging || hasMovedManually) {
            return;
        }

        const updatePosition = () => {
            if (!tooltipRef.current || isDragging) {
                return;
            }

            const tooltipRect = tooltipRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let top = anchorRect.bottom + 8;
            let left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;

            if (left < 12) left = 12;
            if (left + tooltipRect.width > viewportWidth - 12) {
                left = viewportWidth - tooltipRect.width - 12;
            }

            if (top + tooltipRect.height > viewportHeight - 12) {
                const spaceAbove = anchorRect.top - 12;
                const spaceBelow = viewportHeight - anchorRect.bottom - 12;
                if (spaceAbove > spaceBelow) {
                    top = Math.max(12, anchorRect.top - tooltipRect.height - 8);
                }
            }

            if (top < 12) top = 12;
            setPosition({ top, left });
            if (!isVisible) {
                requestAnimationFrame(() => setIsVisible(true));
            }
        };

        updatePosition();
        const resizeObserver = new ResizeObserver(updatePosition);
        resizeObserver.observe(tooltipRef.current);
        return () => resizeObserver.disconnect();
    }, [anchorRect, hasMovedManually, isDragging, isEditing, isVisible]);

    useEffect(() => {
        if (!isDragging) {
            return;
        }

        const handleMouseMove = (event: MouseEvent) => {
            setPosition({
                top: event.clientY - draggingOffset.current.y,
                left: event.clientX - draggingOffset.current.x,
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') {
                return;
            }

            if (magnifiedImage) {
                setMagnifiedImage(null);
                return;
            }

            if (isEditing) {
                handleCancel();
                return;
            }

            onClose();
        };

        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isEditing, magnifiedImage, onClose]);

    const handleDragStart = (event: React.MouseEvent) => {
        if (!isPinned) {
            return;
        }
        if ((event.target as HTMLElement).closest('button, input, textarea')) {
            return;
        }

        const rect = tooltipRef.current?.getBoundingClientRect();
        if (!rect) {
            return;
        }

        draggingOffset.current = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
        setIsDragging(true);
        setHasMovedManually(true);
    };

    const handleMouseEnter = () => {
        onHoverStart?.();
    };

    const handleMouseLeave = () => {
        onHoverEnd?.();
        if (!isPinned) {
            onClose();
        }
    };

    const handleToggleEmr = async () => {
        if (!isPinned) {
            return;
        }

        setIsSaving(true);
        try {
            if (localConfig) {
                const response = await saveSegmentEmrUpdate(segmentName, flow, {
                    segmentName: segDef?.name || segmentName,
                    emrLocation: localConfig.emrLocation || '',
                    notes: localConfig.notes || '',
                    imagePaths: localConfig.imagePaths || [],
                    enabled: !localEnabled,
                });

                if (response.success && response.data) {
                    setLocalConfig({
                        ...response.data,
                        enabled: !localEnabled,
                    });
                    onConfigUpdated?.();
                } else {
                    alert(`Failed to toggle segment metadata: ${response.message || response.error || 'Unknown error'}`);
                }
            } else {
                const response = await saveSegmentEmrUpdate(segmentName, flow, {
                    segmentName: segDef?.name || segmentName,
                    emrLocation: '',
                    notes: '',
                    imagePaths: [],
                    enabled: true,
                });

                if (response.success && response.data) {
                    setLocalConfig({
                        ...response.data,
                        enabled: true,
                    });
                    setEditFields({ emrLocation: '', emrNotes: '', imagePaths: [] });
                    onConfigUpdated?.();
                } else {
                    alert(`Failed to enable segment metadata: ${response.message || response.error || 'Unknown error'}`);
                }
            }
        } catch (err) {
            console.error('Segment metadata toggle failed:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async (event: React.MouseEvent) => {
        event.stopPropagation();
        setIsSaving(true);
        try {
            const response = await saveSegmentEmrUpdate(segmentName, flow, {
                segmentName: segDef?.name || segmentName,
                emrLocation: editFields.emrLocation,
                notes: editFields.emrNotes,
                imagePaths: editFields.imagePaths,
                enabled: localConfig?.enabled ?? true,
            });

            if (response.success && response.data) {
                const savedConfig = response.data as SegmentEmrConfigEntry;
                setLocalConfig(savedConfig);
                setEditFields({
                    emrLocation: savedConfig.emrLocation || '',
                    emrNotes: savedConfig.notes || '',
                    imagePaths: savedConfig.imagePaths || [],
                });
                setIsEditing(false);
                onConfigUpdated?.();
            } else {
                alert(`Failed to save segment metadata: ${response.message || response.error || 'Unknown error'}`);
            }
        } catch (err: any) {
            console.error('Segment metadata save failed:', err);
            alert(`Failed to save segment metadata: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setEditFields({
            emrLocation: localConfig?.emrLocation || '',
            emrNotes: localConfig?.notes || '',
            imagePaths: localConfig?.imagePaths || [],
        });
        setIsEditing(false);
    };

    const handleDelete = async (event: React.MouseEvent) => {
        event.stopPropagation();
        if (!localConfig) {
            return;
        }

        setIsSaving(true);
        try {
            const response = await deleteSegmentEmrUpdate(segmentName, flow);
            if (response.success) {
                setLocalConfig(undefined);
                setEditFields({ emrLocation: '', emrNotes: '', imagePaths: [] });
                setIsEditing(false);
                onConfigUpdated?.();
            } else {
                alert(`Failed to delete segment metadata: ${response.message || response.error || 'Unknown error'}`);
            }
        } catch (err: any) {
            console.error('Segment metadata delete failed:', err);
            alert(`Failed to delete segment metadata: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteImage = (index: number) => {
        setEditFields(prev => ({
            ...prev,
            imagePaths: prev.imagePaths.filter((_, imageIndex) => imageIndex !== index),
        }));
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                continue;
            }

            const reader = new FileReader();
            reader.onload = loadEvent => {
                const base64 = loadEvent.target?.result as string;
                setEditFields(prev => ({
                    ...prev,
                    imagePaths: [...prev.imagePaths, base64].slice(0, 3),
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files || []);
        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                continue;
            }

            const reader = new FileReader();
            reader.onload = loadEvent => {
                const base64 = loadEvent.target?.result as string;
                setEditFields(prev => ({
                    ...prev,
                    imagePaths: [...prev.imagePaths, base64].slice(0, 3),
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const tooltipContent = (
        <div
            ref={tooltipRef}
            className={`field-tooltip segment-tooltip ${isVisible ? 'field-tooltip--visible' : ''} ${localEnabled ? 'field-tooltip--emr' : ''} ${isPinned ? 'field-tooltip--pinned' : ''}`}
            style={{ top: position.top, left: position.left }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={event => event.stopPropagation()}
        >
            <div className="field-tooltip__header" onMouseDown={handleDragStart}>
                <div className="field-tooltip__header-top">
                    <div className="field-tooltip__position">
                        <code>{segmentName}</code>
                        <span className="field-tooltip__datatype">SEGMENT</span>
                        {isPinned && <span className="field-tooltip__pinned-badge">Pinned</span>}
                    </div>
                    <div className="field-tooltip__actions">
                        {isPinned && (
                            <div className="field-tooltip__emr-toggle-wrap">
                                <span className="field-tooltip__emr-toggle-label">EMR Setup</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={localEnabled}
                                        onChange={handleToggleEmr}
                                        disabled={isSaving}
                                    />
                                    <span className="slider"></span>
                                </label>
                            </div>
                        )}
                        {isPinned && !isEditing && (
                            <button
                                className="field-tooltip__edit-btn"
                                onClick={() => setIsEditing(true)}
                                title="Edit segment metadata"
                            >
                                Edit
                            </button>
                        )}
                        {isPinned && (
                            <button className="field-tooltip__close-btn" onClick={onClose} title="Close">
                                x
                            </button>
                        )}
                    </div>
                </div>
                <div className="field-tooltip__name">{segDef?.name || segmentName}</div>
                <div className="field-tooltip__segment-info">{segDef?.description || 'No segment description available.'}</div>
            </div>

            {localEnabled && (
                <div className="field-tooltip__emr-badge">
                    <span className="field-tooltip__emr-icon">Config</span>
                    Segment metadata attached
                </div>
            )}

            <div className="field-tooltip__section">
                <div className="field-tooltip__section-label">Segment Description</div>
                <div className="field-tooltip__description">{segDef?.description || 'No segment description available.'}</div>
            </div>

            {(localEnabled || isEditing) && (
                <div className="field-tooltip__section field-tooltip__emr-section">
                    <div className="field-tooltip__section-label">EMR Mapping</div>
                    {isEditing ? (
                        <>
                            <input
                                className="field-tooltip__edit-input"
                                value={editFields.emrLocation}
                                onChange={event => setEditFields(prev => ({ ...prev, emrLocation: event.target.value }))}
                                placeholder="EMR location path"
                            />
                            <label className="field-tooltip__edit-label" style={{ marginTop: '8px' }}>Notes</label>
                            <textarea
                                className="field-tooltip__edit-textarea"
                                value={editFields.emrNotes}
                                onChange={event => setEditFields(prev => ({ ...prev, emrNotes: event.target.value }))}
                                placeholder="Configuration notes"
                                rows={3}
                            />
                            <label className="field-tooltip__edit-label" style={{ marginTop: '8px' }}>EMR Screenshots (Max 3)</label>
                            <div className="field-tooltip__image-gallery">
                                {editFields.imagePaths.map((img, index) => (
                                    <div key={index} className="gallery-item" onClick={() => setMagnifiedImage(img)}>
                                        <img src={img} alt={`Preview ${index + 1}`} />
                                        <button
                                            className="delete-image-btn"
                                            onClick={event => {
                                                event.stopPropagation();
                                                handleDeleteImage(index);
                                            }}
                                            title="Remove image"
                                        >
                                            x
                                        </button>
                                    </div>
                                ))}
                                {editFields.imagePaths.length < 3 && (
                                    <div
                                        className="field-tooltip__dropzone"
                                        onDragOver={event => event.preventDefault()}
                                        onDrop={handleDrop}
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/*';
                                            input.multiple = true;
                                            input.onchange = changeEvent => handleFileSelect(changeEvent as unknown as React.ChangeEvent<HTMLInputElement>);
                                            input.click();
                                        }}
                                    >
                                        <div className="field-tooltip__image-empty">
                                            <span>Add Image</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="field-tooltip__emr-location">{localConfig?.emrLocation || 'No EMR location recorded.'}</div>
                            {localConfig?.notes && <div className="field-tooltip__emr-notes">{localConfig.notes}</div>}
                            {localConfig?.imagePaths && localConfig.imagePaths.length > 0 && (
                                <div className="field-tooltip__image-gallery" style={{ marginTop: '12px' }}>
                                    {localConfig.imagePaths.map((img, index) => (
                                        <div key={index} className="gallery-item" onClick={() => setMagnifiedImage(img)}>
                                            <img
                                                src={img}
                                                alt={`Segment screenshot ${index + 1}`}
                                                onError={event => {
                                                    (event.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {magnifiedImage && (
                <div className="lightbox" onClick={event => {
                    event.stopPropagation();
                    setMagnifiedImage(null);
                }}>
                    <div className="lightbox__content" onClick={event => event.stopPropagation()}>
                        <img src={magnifiedImage} alt="Magnified segment metadata" className="lightbox__img" />
                    </div>
                </div>
            )}

            {isEditing && (
                <div className="field-tooltip__edit-actions">
                    <button className="field-tooltip__save-btn" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button className="field-tooltip__cancel-btn" onClick={handleCancel} disabled={isSaving}>
                        Cancel
                    </button>
                    {localConfig && (
                        <button className="segment-tooltip__delete-btn" onClick={handleDelete} disabled={isSaving}>
                            Delete
                        </button>
                    )}
                </div>
            )}
        </div>
    );

    return createPortal(tooltipContent, document.body);
}