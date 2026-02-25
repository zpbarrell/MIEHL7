import type { ParsedMessage } from '../lib/types';
import { formatHL7Timestamp } from '../lib/hl7-parser';
import './MessageSelector.css';

interface MessageSelectorProps {
    inventory: Record<string, string[]>;
    currentVendor: string;
    currentType: string;
    onSelect: (vendor: string, type: string) => void;
}

export function MessageSelector({ inventory, currentVendor, currentType, onSelect }: MessageSelectorProps) {
    const vendors = Object.keys(inventory);
    if (vendors.length === 0) return null;

    const availableTypes = inventory[currentVendor] || [];

    return (
        <div className="message-selector">
            <div className="message-selector__vendors">
                <div className="message-selector__label">Vendor Library</div>
                <div className="message-selector__vendor-list">
                    {vendors.map(v => (
                        <button
                            key={v}
                            className={`message-selector__vendor-btn ${v === currentVendor ? 'message-selector__vendor-btn--active' : ''}`}
                            onClick={() => onSelect(v, inventory[v][0])}
                        >
                            <span className="message-selector__vendor-icon">{v === 'Default' ? '📦' : '🏢'}</span>
                            {v}
                        </button>
                    ))}
                </div>
            </div>

            {availableTypes.length > 0 && (
                <div className="message-selector__types">
                    <div className="message-selector__tabs">
                        {availableTypes.map(type => (
                            <button
                                key={type}
                                className={`message-selector__tab ${type === currentType ? 'message-selector__tab--active' : ''}`}
                                onClick={() => onSelect(currentVendor, type)}
                            >
                                <span className="message-selector__tab-type">{type}</span>
                                <span className="message-selector__tab-info">Message Definition</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
