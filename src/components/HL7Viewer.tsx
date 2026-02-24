import type { ParsedMessage } from '../lib/types';
import { SegmentRow } from './SegmentRow';
import './HL7Viewer.css';

interface HL7ViewerProps {
    message: ParsedMessage;
}

export function HL7Viewer({ message }: HL7ViewerProps) {
    if (!message || !message.segments.length) {
        return (
            <div className="hl7-viewer glass-card hl7-viewer--empty">
                <div className="hl7-viewer__empty-state">
                    <div className="hl7-viewer__empty-icon">📋</div>
                    <p className="hl7-viewer__empty-text">No message loaded</p>
                    <p className="hl7-viewer__empty-hint">
                        Drag & drop an .hl7 file above or load a sample message
                    </p>
                </div>
            </div>
        );
    }

    // Group summary
    const segmentCounts = new Map<string, number>();
    message.segments.forEach(seg => {
        segmentCounts.set(seg.name, (segmentCounts.get(seg.name) || 0) + 1);
    });

    return (
        <div className="hl7-viewer glass-card animate-scale-in">
            {/* Viewer header */}
            <div className="hl7-viewer__header">
                <div className="hl7-viewer__header-left">
                    <h3 className="hl7-viewer__title">Message Viewer</h3>
                    <div className="hl7-viewer__message-type">
                        <code>{message.messageType || 'Unknown'}</code>
                    </div>
                </div>
                <div className="hl7-viewer__header-right">
                    <div className="hl7-viewer__segment-chips">
                        {Array.from(segmentCounts.entries()).map(([name, count]) => (
                            <span key={name} className="hl7-viewer__segment-chip">
                                {name}
                                {count > 1 && <span className="hl7-viewer__segment-chip-count">×{count}</span>}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="hl7-viewer__legend">
                <span className="hl7-viewer__legend-item">
                    <span className="hl7-viewer__legend-dot hl7-viewer__legend-dot--field" />
                    Hover for field details
                </span>
                <span className="hl7-viewer__legend-item">
                    <span className="hl7-viewer__legend-dot hl7-viewer__legend-dot--emr" />
                    EMR Configurable
                </span>
            </div>

            {/* Segments */}
            <div className="hl7-viewer__segments">
                {message.segments.map((segment, idx) => (
                    <SegmentRow key={idx} segment={segment} index={idx} />
                ))}
            </div>
        </div>
    );
}
