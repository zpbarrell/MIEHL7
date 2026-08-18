import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { ParsedSegment, HL7Flow, MessageContext } from '../lib/types';
import { getSegmentDefinition, hasSegmentEmrConfig } from '../lib/field-dictionary';
import { FieldCell } from './FieldCell';
import { SegmentTooltip } from './SegmentTooltip';
import './SegmentRow.css';

interface SegmentRowProps {
    segment: ParsedSegment;
    index: number;
    flow: HL7Flow;
    messageContext: MessageContext;
    onMessageFieldUpdated: () => void;
}

const SEGMENT_COLORS: Record<string, string> = {
    MSH: 'var(--segment-msh)',
    PID: 'var(--segment-pid)',
    PV1: 'var(--segment-pid)',
    ORC: 'var(--segment-orc)',
    OBR: 'var(--segment-obr)',
    OBX: 'var(--segment-obx)',
    AL1: 'var(--segment-al1)',
    DG1: 'var(--segment-dg1)',
    IN1: 'var(--segment-in1)',
};

export const SegmentRow = memo(function SegmentRow({ segment, index, flow, messageContext, onMessageFieldUpdated }: SegmentRowProps) {
    const [showTooltip, setShowTooltip] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
    const [segmentMetadataVersion, setSegmentMetadataVersion] = useState(0);
    const badgeRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const isHoveringTooltipRef = useRef(false);
    const segDef = getSegmentDefinition(segment.name);
    const badgeColor = SEGMENT_COLORS[segment.name] || 'var(--segment-default)';
    const fieldCount = segment.fields.filter((f, i) => i > 0 && f.value).length;
    const hasMetadata = hasSegmentEmrConfig(segment.name, flow);

    useEffect(() => {
        return () => clearTimeout(timeoutRef.current);
    }, []);

    const closeTooltipWithDelay = useCallback(() => {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (!isPinned && !isHoveringTooltipRef.current) {
                setShowTooltip(false);
            }
        }, 150);
    }, [isPinned]);

    const handleMouseEnter = useCallback(() => {
        clearTimeout(timeoutRef.current);
        if (!isPinned && badgeRef.current) {
            setAnchorRect(badgeRef.current.getBoundingClientRect());
            setShowTooltip(true);
        }
    }, [isPinned]);

    const handleMouseLeave = useCallback(() => {
        if (!isPinned) {
            closeTooltipWithDelay();
        }
    }, [closeTooltipWithDelay, isPinned]);

    const handleTooltipHoverStart = useCallback(() => {
        isHoveringTooltipRef.current = true;
        clearTimeout(timeoutRef.current);
    }, []);

    const handleTooltipHoverEnd = useCallback(() => {
        isHoveringTooltipRef.current = false;
        if (!isPinned) {
            closeTooltipWithDelay();
        }
    }, [closeTooltipWithDelay, isPinned]);

    const handleClick = useCallback((event: React.MouseEvent) => {
        event.stopPropagation();
        if (badgeRef.current) {
            setAnchorRect(badgeRef.current.getBoundingClientRect());
            setShowTooltip(true);
            setIsPinned(true);
        }
    }, []);

    const handleTooltipClose = useCallback(() => {
        setShowTooltip(false);
        setIsPinned(false);
    }, []);

    const handleConfigUpdated = useCallback(() => {
        setSegmentMetadataVersion(version => version + 1);
    }, []);

    useEffect(() => {
        if (!isPinned) {
            return;
        }

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.closest('.segment-tooltip')) return;
            if (badgeRef.current && badgeRef.current.contains(target)) return;
            handleTooltipClose();
        };

        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 10);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [handleTooltipClose, isPinned]);

    return (
        <div
            className="segment-row animate-fade-in-up"
            style={{ animationDelay: `${index * 30}ms` }}
        >
            {/* Segment badge */}
            <div className="segment-row__badge-col">
                <div
                    ref={badgeRef}
                    className={`segment-row__badge ${hasMetadata ? 'segment-row__badge--configured' : ''} ${isPinned ? 'segment-row__badge--pinned' : ''}`}
                    style={{ '--badge-color': badgeColor } as React.CSSProperties}
                    title={segDef ? `${segDef.name}: ${segDef.description}` : segment.name}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onClick={handleClick}
                >
                    {segment.name}
                    {hasMetadata && <span className="segment-row__badge-dot" />}
                </div>
                {segDef && (
                    <div className="segment-row__badge-label" title={segDef.name}>
                        {segDef.name}
                    </div>
                )}
                {showTooltip && anchorRect && (
                    <SegmentTooltip
                        key={`${segment.name}-${flow}-${segmentMetadataVersion}`}
                        segmentName={segment.name}
                        flow={flow}
                        anchorRect={anchorRect}
                        isPinned={isPinned}
                        onHoverStart={handleTooltipHoverStart}
                        onHoverEnd={handleTooltipHoverEnd}
                        onConfigUpdated={handleConfigUpdated}
                        onClose={handleTooltipClose}
                    />
                )}
            </div>

            {/* Fields */}
            <div className="segment-row__fields">
                {segment.fields.map((field, fieldIdx) => (
                    <span key={fieldIdx} className="segment-row__field-wrapper">
                        <FieldCell
                            field={field}
                            segmentName={segment.name}
                            segmentIndex={index}
                            fieldIndex={fieldIdx}
                            flow={flow}
                            messageContext={messageContext}
                            onMessageFieldUpdated={onMessageFieldUpdated}
                        />
                        {fieldIdx > 0 && fieldIdx < segment.fields.length - 1 && (
                            <span className="segment-row__pipe">|</span>
                        )}
                    </span>
                ))}
            </div>

            {/* Field count indicator */}
            <div className="segment-row__meta">
                <span className="segment-row__field-count">{fieldCount}</span>
            </div>
        </div>
    );
});
