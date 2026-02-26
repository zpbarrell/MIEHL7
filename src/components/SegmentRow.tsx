import { memo } from 'react';
import type { ParsedSegment } from '../lib/types';
import { getSegmentDefinition } from '../lib/field-dictionary';
import { FieldCell } from './FieldCell';
import './SegmentRow.css';

interface SegmentRowProps {
    segment: ParsedSegment;
    index: number;
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

export const SegmentRow = memo(function SegmentRow({ segment, index }: SegmentRowProps) {
    const segDef = getSegmentDefinition(segment.name);
    const badgeColor = SEGMENT_COLORS[segment.name] || 'var(--segment-default)';
    const fieldCount = segment.fields.filter((f, i) => i > 0 && f.value).length;

    return (
        <div
            className="segment-row animate-fade-in-up"
            style={{ animationDelay: `${index * 30}ms` }}
        >
            {/* Segment badge */}
            <div className="segment-row__badge-col">
                <div
                    className="segment-row__badge"
                    style={{ '--badge-color': badgeColor } as React.CSSProperties}
                    title={segDef ? `${segDef.name}: ${segDef.description}` : segment.name}
                >
                    {segment.name}
                </div>
                {segDef && (
                    <div className="segment-row__badge-label" title={segDef.name}>
                        {segDef.name}
                    </div>
                )}
            </div>

            {/* Fields */}
            <div className="segment-row__fields">
                {segment.fields.map((field, fieldIdx) => (
                    <span key={fieldIdx} className="segment-row__field-wrapper">
                        <FieldCell
                            field={field}
                            segmentName={segment.name}
                            fieldIndex={fieldIdx}
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
