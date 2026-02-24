import type { ParsedMessage } from '../lib/types';
import { formatHL7Timestamp } from '../lib/hl7-parser';
import './MessageSelector.css';

interface MessageSelectorProps {
    messages: ParsedMessage[];
    activeIndex: number;
    onSelect: (index: number) => void;
    onRemove: (index: number) => void;
}

export function MessageSelector({ messages, activeIndex, onSelect, onRemove }: MessageSelectorProps) {
    if (messages.length === 0) return null;

    return (
        <div className="message-selector">
            <div className="message-selector__label">Messages</div>
            <div className="message-selector__tabs">
                {messages.map((msg, idx) => (
                    <button
                        key={idx}
                        className={`message-selector__tab ${idx === activeIndex ? 'message-selector__tab--active' : ''}`}
                        onClick={() => onSelect(idx)}
                    >
                        <span className="message-selector__tab-type">
                            {msg.messageType || 'Unknown'}
                        </span>
                        <span className="message-selector__tab-info">
                            {msg.fileName ||
                                (msg.timestamp ? formatHL7Timestamp(msg.timestamp) : `Message ${idx + 1}`)}
                        </span>
                        {messages.length > 1 && (
                            <button
                                className="message-selector__tab-close"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove(idx);
                                }}
                                title="Remove message"
                            >
                                ×
                            </button>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
