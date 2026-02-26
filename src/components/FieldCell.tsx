import { useState, useRef, useCallback, useEffect, memo } from 'react';
import type { ParsedField } from '../lib/types';
import { isEmrConfigurable, getFieldLabel } from '../lib/field-dictionary';
import { FieldTooltip } from './FieldTooltip';
import './FieldCell.css';

interface FieldCellProps {
    field: ParsedField;
    segmentName: string;
    fieldIndex: number;
}

export const FieldCell = memo(function FieldCell({ field, segmentName, fieldIndex }: FieldCellProps) {
    const [showTooltip, setShowTooltip] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
    const cellRef = useRef<HTMLSpanElement>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Cleanup hover timeout on unmount
    useEffect(() => {
        return () => clearTimeout(timeoutRef.current);
    }, []);

    const emrConfigurable = isEmrConfigurable(`${segmentName}.${fieldIndex}`);
    const label = getFieldLabel(`${segmentName}.${fieldIndex}`);

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
            timeoutRef.current = setTimeout(() => {
                setShowTooltip(false);
            }, 150);
        }
    }, [isPinned]);

    // Click to pin
    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (cellRef.current) {
            setAnchorRect(cellRef.current.getBoundingClientRect());
            setShowTooltip(true);
            setIsPinned(true);
        }
    }, []);

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
            <span
                ref={cellRef}
                className={`field-cell ${emrConfigurable ? 'field-cell--emr' : ''} ${isEmpty ? 'field-cell--empty' : ''} ${isPinned ? 'field-cell--pinned' : ''}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
                data-position={field.position}
                title={label}
            >
                <span className="field-cell__value">
                    {field.value || '\u00A0'}
                </span>
                {emrConfigurable && <span className="field-cell__emr-dot" />}
            </span>
            {showTooltip && anchorRect && (
                <FieldTooltip
                    field={field}
                    segmentName={segmentName}
                    fieldIndex={fieldIndex}
                    anchorRect={anchorRect}
                    isPinned={isPinned}
                    onClose={handleTooltipClose}
                />
            )}
        </>
    );
});
