import type { ParsedMessage } from '../lib/types';
import { formatHL7Timestamp } from '../lib/hl7-parser';
import './MessageSelector.css';

interface MessageSelectorProps {
    inventory: Record<string, string[]>;
    currentVendor: string;
    currentFilename: string;
    onSelect: (vendor: string, filename: string) => void;
    onDelete: (vendor: string, filename: string) => void;
}

export function MessageSelector({ inventory, currentVendor, currentFilename, onSelect, onDelete }: MessageSelectorProps) {
    const vendors = Object.keys(inventory);
    if (vendors.length === 0) return null;

    const availableFiles = inventory[currentVendor] || [];

    // Group files by HL7 Type (the part before the " - ")
    const grouped = availableFiles.reduce((acc, filename) => {
        const [type, ...rest] = filename.split(' - ');
        const label = rest.join(' - ') || 'Untitled';
        if (!acc[type]) acc[type] = [];
        acc[type].push({ filename, label });
        return acc;
    }, {} as Record<string, { filename: string; label: string }[]>);

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

            {Object.keys(grouped).length > 0 && (
                <div className="message-selector__types">
                    {Object.entries(grouped).map(([type, files]) => (
                        <div key={type} className="message-selector__type-group">
                            <div className="message-selector__type-header">{type} Messages</div>
                            <div className="message-selector__tabs">
                                {files.map(({ filename, label }) => (
                                    <button
                                        key={filename}
                                        className={`message-selector__tab ${filename === currentFilename ? 'message-selector__tab--active' : ''}`}
                                        onClick={() => onSelect(currentVendor, filename)}
                                    >
                                        <span className="message-selector__tab-type">{type}</span>
                                        <span className="message-selector__tab-info">{label}</span>
                                        <button
                                            className="message-selector__tab-delete"
                                            title="Delete Message"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm(`Are you sure you want to delete "${filename}"?`)) {
                                                    onDelete(currentVendor, filename);
                                                }
                                            }}
                                        >
                                            ×
                                        </button>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
