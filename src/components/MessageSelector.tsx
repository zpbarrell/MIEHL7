import './MessageSelector.css';

interface MessageSelectorProps {
    inventory: Record<string, Record<string, Record<string, string[]>>>;
    currentDirection: string;
    currentType: string;
    currentVendor: string;
    currentFilename: string;
    onSelect: (direction: string, type: string, v: string, filename: string) => void;
    onDelete: (direction: string, type: string, v: string, filename: string) => void;
    onDirectionChange: (direction: string) => void;
}

export function MessageSelector({
    inventory,
    currentDirection,
    currentType,
    currentVendor,
    currentFilename,
    onSelect,
    onDelete,
    onDirectionChange
}: MessageSelectorProps) {
    const directions = Object.keys(inventory);
    if (directions.length === 0) return null;

    // Get types for the current direction
    const typeGroups = inventory[currentDirection] || {};

    return (
        <div className="message-selector">
            {/* Level 1: Direction Toggle */}
            <div className="message-selector__directions">
                <div className="message-selector__direction-tabs">
                    {['Inbound', 'Outbound'].map(d => (
                        <button
                            key={d}
                            className={`message-selector__direction-btn ${d === currentDirection ? 'active' : ''}`}
                            onClick={() => onDirectionChange(d)}
                        >
                            {d === 'Inbound' ? '📥' : '📤'} {d}
                        </button>
                    ))}
                </div>
            </div>

            {/* Level 2 & 3: Types and Files */}
            <div className="message-selector__library">
                {Object.keys(typeGroups).length === 0 ? (
                    <div className="message-selector__empty">No messages found in {currentDirection}</div>
                ) : (
                    Object.entries(typeGroups).sort().map(([type, vendors]) => (
                        <div key={type} className="message-selector__type-group">
                            <div className="message-selector__type-header">{type} Messages</div>
                            <div className="message-selector__tabs">
                                {Object.entries(vendors).map(([vendor, labels]) => (
                                    labels.map(label => {
                                        const isActive =
                                            type === currentType &&
                                            vendor === currentVendor &&
                                            label === currentFilename;

                                        return (
                                            <button
                                                key={`${vendor}-${label}`}
                                                className={`message-selector__tab ${isActive ? 'message-selector__tab--active' : ''}`}
                                                onClick={() => onSelect(currentDirection, type, vendor, label)}
                                            >
                                                <span className="message-selector__tab-type">{vendor}</span>
                                                <span className="message-selector__tab-info">{label}</span>
                                                <button
                                                    className="message-selector__tab-delete"
                                                    title="Delete Message"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm(`Are you sure you want to delete "${vendor} - ${label}"?`)) {
                                                            onDelete(currentDirection, type, vendor, label);
                                                        }
                                                    }}
                                                >
                                                    ×
                                                </button>
                                            </button>
                                        );
                                    })
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
