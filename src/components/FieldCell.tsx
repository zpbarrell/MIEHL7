import { useState, useRef, useCallback, useEffect, memo } from 'react';
import type { ParsedField, HL7Flow, MessageContext } from '../lib/types';
import { isEmrConfigurable, getFieldLabel, saveMessageFieldValue } from '../lib/field-dictionary';
import { FieldTooltip } from './FieldTooltip';
import './FieldCell.css';

interface FieldCellProps {
    field: ParsedField;
    segmentName: string;
    segmentIndex: number;
    fieldIndex: number;
    flow: HL7Flow;
    messageContext: MessageContext;
    onMessageFieldUpdated: () => void;
}

export const FieldCell = memo(function FieldCell({ field, segmentName, segmentIndex, fieldIndex, flow, messageContext, onMessageFieldUpdated }: FieldCellProps) {
    const [showTooltip, setShowTooltip] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editValue, setEditValue] = useState(field.value || '');
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
    const cellRef = useRef<HTMLSpanElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const isHoveringTooltipRef = useRef(false);

    // Cleanup hover timeout on unmount
    useEffect(() => {
        return () => clearTimeout(timeoutRef.current);
    }, []);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const emrConfigurable = isEmrConfigurable(`${segmentName}.${fieldIndex}`, flow);
    const label = getFieldLabel(`${segmentName}.${fieldIndex}`);

    const closeTooltipWithDelay = useCallback(() => {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (!isPinned && !isHoveringTooltipRef.current) {
                setShowTooltip(false);
            }
        }, 150);
    }, [isPinned]);

    // Hover to preview
    const handleMouseEnter = useCallback(() => {
        clearTimeout(timeoutRef.current);
        if (!isPinned && cellRef.current) {
            setAnchorRect(cellRef.current.getBoundingClientRect());
            setShowTooltip(true);
        }
    }, [isPinned]);

    const handleMouseLeave = useCallback(() => {
        if (!isPinned) {
            closeTooltipWithDelay();
        }
    }, [isPinned, closeTooltipWithDelay]);

    const handleTooltipHoverStart = useCallback(() => {
        isHoveringTooltipRef.current = true;
        clearTimeout(timeoutRef.current);
    }, []);

    const handleTooltipHoverEnd = useCallback(() => {
        isHoveringTooltipRef.current = false;
        if (!isPinned) {
            closeTooltipWithDelay();
        }
    }, [isPinned, closeTooltipWithDelay]);

    // Click to pin
    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (isEditing) return;
        if (cellRef.current) {
            setAnchorRect(cellRef.current.getBoundingClientRect());
            setShowTooltip(true);
            setIsPinned(true);
        }
    }, [isEditing]);

    const handleDoubleClick = useCallback((event: React.MouseEvent) => {
        event.stopPropagation();
        if (segmentName === 'MSH' && fieldIndex === 1) return;
        clearTimeout(timeoutRef.current);
        setShowTooltip(false);
        setIsPinned(false);
        setEditValue(field.value || '');
        setIsEditing(true);
    }, [field.value, fieldIndex, segmentName]);

    const handleEditCancel = useCallback(() => {
        setEditValue(field.value || '');
        setIsEditing(false);
    }, [field.value]);

    const handleEditSave = useCallback(async () => {
        if (isSaving) return;
        if (editValue === (field.value || '')) {
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        try {
            const result = await saveMessageFieldValue(
                messageContext,
                segmentName,
                segmentIndex,
                fieldIndex,
                editValue
            );
            if (result.success) {
                setIsEditing(false);
                onMessageFieldUpdated();
            } else {
                alert(`Failed to save field: ${result.message || result.error || 'Unknown server error'}`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            alert(`Failed to save field: ${message}`);
        } finally {
            setIsSaving(false);
        }
    }, [editValue, field.value, fieldIndex, isSaving, messageContext, onMessageFieldUpdated, segmentIndex, segmentName]);

    // Close when pinned — triggered by clicking outside or pressing Escape
    const handleTooltipClose = useCallback(() => {
        setShowTooltip(false);
        setIsPinned(false);
    }, []);

    // Close pinned tooltip when clicking outside
    useEffect(() => {
        if (!isPinned) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Don't close if clicking inside the tooltip itself
            if (target.closest('.field-tooltip')) return;
            // Don't close if clicking the cell itself (toggle is handled by handleClick)
            if (cellRef.current && cellRef.current.contains(target)) return;
            handleTooltipClose();
        };

        // Slight delay to avoid closing immediately from the same click
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 10);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isPinned, handleTooltipClose]);

    // Skip rendering the segment name "field" (index 0)
    if (fieldIndex === 0) return null;

    // Special handling for MSH.1 (field separator)
    if (segmentName === 'MSH' && fieldIndex === 1) {
        return <span className="field-cell field-cell--separator">|</span>;
    }

    const isEmpty = !field.value || field.value.trim() === '';

    return (
        <>
            {isEditing ? (
                <input
                    ref={inputRef}
                    className="field-cell__editor"
                    value={editValue}
                    aria-label={`Edit ${label}`}
                    disabled={isSaving}
                    onChange={(event) => setEditValue(event.target.value)}
                    onBlur={() => { void handleEditSave(); }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            void handleEditSave();
                        } else if (event.key === 'Escape') {
                            event.preventDefault();
                            handleEditCancel();
                        }
                    }}
                    onClick={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => event.stopPropagation()}
                />
            ) : (
                <span
                    ref={cellRef}
                    className={`field-cell ${emrConfigurable ? 'field-cell--emr' : ''} ${isEmpty ? 'field-cell--empty' : ''} ${isPinned ? 'field-cell--pinned' : ''}`}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onClick={handleClick}
                    onDoubleClick={handleDoubleClick}
                    data-position={field.position}
                    title={`${label} (double-click to edit)`}
                >
                    <span className="field-cell__value">
                        {field.value || '\u00A0'}
                    </span>
                    {emrConfigurable && <span className="field-cell__emr-dot" />}
                </span>
            )}
            {showTooltip && anchorRect && (
                <FieldTooltip
                    field={field}
                    segmentName={segmentName}
                    segmentIndex={segmentIndex}
                    fieldIndex={fieldIndex}
                    flow={flow}
                    messageContext={messageContext}
                    anchorRect={anchorRect}
                    isPinned={isPinned}
                    onHoverStart={handleTooltipHoverStart}
                    onHoverEnd={handleTooltipHoverEnd}
                    onMessageFieldUpdated={onMessageFieldUpdated}
                    onClose={handleTooltipClose}
                />
            )}
        </>
    );
});
