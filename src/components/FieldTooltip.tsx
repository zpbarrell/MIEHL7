import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ParsedField } from '../lib/types';
import { getFieldDefinition, getComponentDefinition, isEmrConfigurable, getEmrConfig, getSegmentDefinition, saveFieldUpdate, saveEmrUpdate, deleteEmrUpdate } from '../lib/field-dictionary';
import './FieldTooltip.css';

interface FieldTooltipProps {
    field: ParsedField;
    segmentName: string;
    fieldIndex: number;
    anchorRect: DOMRect;
    isPinned: boolean;
    onClose: () => void;
}

interface EditableFields {
    name: string;
    description: string;
    emrLocation: string;
    emrNotes: string;
}

export const FieldTooltip: React.FC<FieldTooltipProps> = ({
    field,
    segmentName,
    fieldIndex,
    anchorRect,
    onClose,
    isPinned = false
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const tooltipRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fieldDef = getFieldDefinition(segmentName, fieldIndex);
    const segDef = getSegmentDefinition(segmentName);

    const initialEmrConfig = getEmrConfig(field.position);
    const [localEmrConfig, setLocalEmrConfig] = useState(initialEmrConfig);
    const emrConfigurable = !!localEmrConfig || isEmrConfigurable(field.position);

    const [editFields, setEditFields] = useState<EditableFields & { imagePaths: string[] }>({
        name: fieldDef?.name || '',
        description: fieldDef?.description || '',
        emrLocation: localEmrConfig?.emrLocation || '',
        emrNotes: localEmrConfig?.notes || '',
        imagePaths: localEmrConfig?.imagePaths || [],
    });

    const [isDragging, setIsDragging] = useState(false);
    const [hasMovedManually, setHasMovedManually] = useState(false);
    const [magnifiedImage, setMagnifiedImage] = useState<string | null>(null);
    const draggingOffset = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (!tooltipRef.current || isDragging || hasMovedManually) return;

        const updatePosition = () => {
            if (!tooltipRef.current || isDragging) return;
            const tooltip = tooltipRef.current;
            const tooltipRect = tooltip.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Preferred position: below the anchor
            let top = anchorRect.bottom + 8;
            let left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;

            // Horizontal boundary check
            if (left < 12) left = 12;
            if (left + tooltipRect.width > viewportWidth - 12) {
                left = viewportWidth - tooltipRect.width - 12;
            }

            // Vertical boundary check: Flip to top if bottom overflows
            if (top + tooltipRect.height > viewportHeight - 12) {
                const spaceAbove = anchorRect.top - 12;
                const spaceBelow = viewportHeight - anchorRect.bottom - 12;

                if (spaceAbove > spaceBelow) {
                    // More space above, flip to top
                    top = Math.max(12, anchorRect.top - tooltipRect.height - 8);
                }
            }

            // Final safety check for top
            if (top < 12) top = 12;

            setPosition({ top, left });
            if (!isVisible) {
                requestAnimationFrame(() => setIsVisible(true));
            }
        };

        updatePosition();

        // Listen for size changes (editing mode, images loading, etc.)
        const resizeObserver = new ResizeObserver(() => {
            updatePosition();
        });
        resizeObserver.observe(tooltipRef.current);

        return () => resizeObserver.disconnect();
    }, [anchorRect, isEditing, isVisible, isDragging, hasMovedManually]);

    // Handle Dragging logic
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            setPosition({
                top: e.clientY - draggingOffset.current.y,
                left: e.clientX - draggingOffset.current.x
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

    const handleDragStart = (e: React.MouseEvent) => {
        if (!isPinned) return;

        // Don't drag if clicking buttons or inputs/textareas
        if ((e.target as HTMLElement).closest('button, input, textarea')) return;

        const rect = tooltipRef.current?.getBoundingClientRect();
        if (rect) {
            draggingOffset.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            setIsDragging(true);
            setHasMovedManually(true);
        }
    };

    // Close on escape
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (magnifiedImage) {
                    setMagnifiedImage(null);
                } else if (isEditing) {
                    setIsEditing(false);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose, isEditing, magnifiedImage]);

    const handleMouseLeave = () => {
        // Only auto-close on mouse leave if NOT pinned
        if (!isPinned) {
            onClose();
        }
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            const newImages = [...editFields.imagePaths];
            for (const file of files) {
                if (file.type.startsWith('image/') && newImages.length < 3) {
                    const reader = new FileReader();
                    reader.onload = (loadEvt) => {
                        const base64 = loadEvt.target?.result as string;
                        setEditFields(prev => ({
                            ...prev,
                            imagePaths: [...prev.imagePaths, base64].slice(0, 3)
                        }));
                    };
                    reader.readAsDataURL(file);
                }
            }
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            const newImages = [...editFields.imagePaths];
            for (const file of files) {
                if (file.type.startsWith('image/') && newImages.length < 3) {
                    const reader = new FileReader();
                    reader.onload = (loadEvt) => {
                        const base64 = loadEvt.target?.result as string;
                        setEditFields(prev => ({
                            ...prev,
                            imagePaths: [...prev.imagePaths, base64].slice(0, 3)
                        }));
                    };
                    reader.readAsDataURL(file);
                }
            }
        }
    };

    const handleDeleteImage = (index: number) => {
        setEditFields(prev => ({
            ...prev,
            imagePaths: prev.imagePaths.filter((_, i) => i !== index)
        }));
    };

    const handleToggleEmr = async () => {
        if (!isPinned) return;

        setIsSaving(true);
        try {
            if (localEmrConfig) {
                // Toggle OFF
                // Use the exact position from the config entry to ensure successful deletion
                const targetPosition = localEmrConfig.fieldPosition || field.position;
                const res = await deleteEmrUpdate(targetPosition);
                if (res.success) {
                    setLocalEmrConfig(undefined);
                } else {
                    alert(`Failed to remove EMR config: ${res.message}`);
                }
            } else {
                // Toggle ON
                const res = await saveEmrUpdate(field.position, {
                    fieldName: editFields.name || fieldDef?.name || field.position,
                    emrLocation: '',
                    notes: '',
                    imagePaths: []
                });
                if (res.success && res.data) {
                    setLocalEmrConfig(res.data);
                    // Also sync edit fields
                    setEditFields(prev => ({
                        ...prev,
                        emrLocation: '',
                        emrNotes: '',
                        imagePaths: []
                    }));
                } else {
                    alert(`Failed to enable EMR config: ${res.message}`);
                }
            }
        } catch (err) {
            console.error('Toggle EMR failed:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsSaving(true);
        try {
            // 1. Save Field Definition updates
            const fieldRes = await saveFieldUpdate(segmentName, fieldIndex, editFields.name, editFields.description);

            // 2. Save EMR Config updates (including images)
            const emrRes = await saveEmrUpdate(field.position, {
                fieldName: editFields.name,
                emrLocation: editFields.emrLocation,
                notes: editFields.emrNotes,
                imagePaths: editFields.imagePaths
            });

            if (fieldRes.success && emrRes.success) {
                // Sync state with saved data
                const savedEmr = emrRes.data;
                if (savedEmr) {
                    setEditFields({
                        name: savedEmr.fieldName || '',
                        description: editFields.description,
                        emrLocation: savedEmr.emrLocation || '',
                        emrNotes: savedEmr.notes || '',
                        imagePaths: savedEmr.imagePaths || [],
                    });
                }
                setIsEditing(false);
            } else {
                const errorMsg = fieldRes.message || emrRes.message || 'Unknown server error';
                alert(`Failed to save updates: ${errorMsg}`);
            }
        } catch (err: any) {
            console.error('Save failed:', err);
            alert(`Failed to save updates: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Reset to original values
        setEditFields({
            name: fieldDef?.name || '',
            description: fieldDef?.description || '',
            emrLocation: localEmrConfig?.emrLocation || '',
            emrNotes: localEmrConfig?.notes || '',
            imagePaths: localEmrConfig?.imagePaths || [],
        });
        setIsEditing(false);
    };

    const handleInputChange = (key: keyof EditableFields, value: string) => {
        setEditFields(prev => ({ ...prev, [key]: value }));
    };

    const tooltipContent = (
        <div
            ref={tooltipRef}
            className={`field-tooltip ${isVisible ? 'field-tooltip--visible' : ''} ${emrConfigurable ? 'field-tooltip--emr' : ''} ${isPinned ? 'field-tooltip--pinned' : ''}`}
            style={{ top: position.top, left: position.left }}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="field-tooltip__header" onMouseDown={handleDragStart}>
                <div className="field-tooltip__header-top">
                    <div className="field-tooltip__position">
                        <code>{field.position}</code>
                        {fieldDef?.dataType && (
                            <span className="field-tooltip__datatype">{fieldDef.dataType}</span>
                        )}
                        {isPinned && (
                            <span className="field-tooltip__pinned-badge">📌 Pinned</span>
                        )}
                    </div>
                    <div className="field-tooltip__actions">
                        {isPinned && (
                            <div className="field-tooltip__emr-toggle-wrap">
                                <span className="field-tooltip__emr-toggle-label">EMR Setup</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={!!localEmrConfig}
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
                                onClick={handleEditClick}
                                title="Edit field details"
                            >
                                ✏️ Edit
                            </button>
                        )}
                        {isPinned && (
                            <button
                                className="field-tooltip__close-btn"
                                onClick={onClose}
                                title="Close"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {isEditing ? (
                    <div className="field-tooltip__edit-field">
                        <label className="field-tooltip__edit-label">Field Name</label>
                        <input
                            className="field-tooltip__edit-input"
                            value={editFields.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            placeholder="Field name"
                        />
                    </div>
                ) : (
                    <div className="field-tooltip__name">
                        {fieldDef?.name || 'Unknown Field'}
                    </div>
                )}
                {segDef && !isEditing && (
                    <div className="field-tooltip__segment-info">
                        {segDef.name}
                    </div>
                )}
            </div>

            {/* EMR Badge */}
            {emrConfigurable && (
                <div className="field-tooltip__emr-badge">
                    <span className="field-tooltip__emr-icon">⚙</span>
                    EMR Configurable
                </div>
            )}

            {/* Value */}
            <div className="field-tooltip__section">
                <div className="field-tooltip__section-label">Current Value</div>
                <div className="field-tooltip__value">
                    <code>{field.value || '(empty)'}</code>
                </div>
            </div>

            {/* Description */}
            {(fieldDef?.description || isEditing) && (
                <div className="field-tooltip__section">
                    <div className="field-tooltip__section-label">Description</div>
                    {isEditing ? (
                        <textarea
                            className="field-tooltip__edit-textarea"
                            value={editFields.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            placeholder="Field description"
                            rows={3}
                        />
                    ) : (
                        <div className="field-tooltip__description">{fieldDef?.description}</div>
                    )}
                </div>
            )}

            {/* Components breakdown */}
            {field.components.length > 1 && fieldDef?.components && !isEditing && (
                <div className="field-tooltip__section">
                    <div className="field-tooltip__section-label">Components</div>
                    <div className="field-tooltip__components">
                        {field.components.map((comp, i) => {
                            const compDef = getComponentDefinition(segmentName, fieldIndex, i + 1);
                            if (!comp.value) return null;
                            return (
                                <div key={i} className="field-tooltip__component">
                                    <span className="field-tooltip__component-pos">{comp.position}</span>
                                    <span className="field-tooltip__component-name">
                                        {compDef?.name || `Component ${i + 1}`}
                                    </span>
                                    <code className="field-tooltip__component-value">{comp.value}</code>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* EMR Configuration Details */}
            {(localEmrConfig || (isEditing && localEmrConfig)) && (
                <div className="field-tooltip__section field-tooltip__emr-section">
                    <div className="field-tooltip__section-label">
                        <span className="field-tooltip__emr-icon">📍</span> EMR Configuration Location
                    </div>
                    {isEditing ? (
                        <>
                            <input
                                className="field-tooltip__edit-input"
                                value={editFields.emrLocation}
                                onChange={(e) => handleInputChange('emrLocation', e.target.value)}
                                placeholder="EMR location path"
                            />
                            <label className="field-tooltip__edit-label" style={{ marginTop: '8px' }}>Notes</label>
                            <textarea
                                className="field-tooltip__edit-textarea"
                                value={editFields.emrNotes}
                                onChange={(e) => handleInputChange('emrNotes', e.target.value)}
                                placeholder="Configuration notes"
                                rows={2}
                            />

                            <label className="field-tooltip__edit-label" style={{ marginTop: '8px' }}>EMR Screenshots (Max 3)</label>
                            <div className="field-tooltip__image-gallery">
                                {editFields.imagePaths.map((img: string, idx: number) => (
                                    <div key={idx} className="gallery-item" onClick={() => setMagnifiedImage(img)}>
                                        <img src={img} alt={`Preview ${idx + 1}`} />
                                        <button
                                            className="delete-image-btn"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteImage(idx); }}
                                            title="Remove image"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                                {editFields.imagePaths.length < 3 && (
                                    <div
                                        className="field-tooltip__dropzone"
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={handleDrop}
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/*';
                                            input.multiple = true;
                                            input.onchange = (e) => handleFileSelect(e as any);
                                            input.click();
                                        }}
                                    >
                                        <div className="field-tooltip__image-empty">
                                            <span>📸</span>
                                            <span>Add Image</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="field-tooltip__emr-location">{localEmrConfig?.emrLocation}</div>
                            {localEmrConfig?.notes && (
                                <div className="field-tooltip__emr-notes">{localEmrConfig.notes}</div>
                            )}

                            {/* Read-only Gallery */}
                            {localEmrConfig?.imagePaths && localEmrConfig.imagePaths.length > 0 && (
                                <div className="field-tooltip__image-gallery" style={{ marginTop: '12px' }}>
                                    {localEmrConfig.imagePaths.map((img: string, idx: number) => (
                                        <div key={idx} className="gallery-item" onClick={() => setMagnifiedImage(img)}>
                                            <img
                                                src={img}
                                                alt={`EMR screenshot ${idx + 1}`}
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Lightbox Modal */}
            {magnifiedImage && (
                <div className="lightbox" onClick={(e) => {
                    e.stopPropagation();
                    setMagnifiedImage(null);
                }}>
                    <div className="lightbox__content" onClick={(e) => e.stopPropagation()}>
                        <img src={magnifiedImage} alt="Magnified view" className="lightbox__img" />
                    </div>
                </div>
            )}

            {/* Edit actions */}
            {isEditing && (
                <div className="field-tooltip__edit-actions">
                    <button
                        className="field-tooltip__save-btn"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? '⏳ Saving...' : '💾 Save'}
                    </button>
                    <button
                        className="field-tooltip__cancel-btn"
                        onClick={handleCancel}
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* Field metadata */}
            {fieldDef && !isEditing && (
                <div className="field-tooltip__footer">
                    {fieldDef.required && <span className="field-tooltip__tag field-tooltip__tag--required">Required</span>}
                    {fieldDef.maxLength && <span className="field-tooltip__tag">Max: {fieldDef.maxLength}</span>}
                    <span className="field-tooltip__tag">{fieldDef.dataType}</span>
                </div>
            )}
        </div>
    );

    return createPortal(tooltipContent, document.body);
}

