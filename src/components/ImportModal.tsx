import { useState } from 'react';
import './ImportModal.css';

interface ImportModalProps {
    fileContent: string;
    fileName: string;
    existingVendors: string[];
    onSave: (vendor: string, type: string) => void;
    onCancel: () => void;
    isLoading?: boolean;
}

const MESSAGE_TYPES = ['ORM', 'ORU', 'ADT', 'SIU', 'DFT', 'MDM', 'MFN'];

export function ImportModal({ fileContent, fileName, existingVendors, onSave, onCancel, isLoading }: ImportModalProps) {
    const defaultVendor = existingVendors.length > 0 ? existingVendors[0] : '';
    const [vendor, setVendor] = useState(defaultVendor);
    const [isNewVendor, setIsNewVendor] = useState(existingVendors.length === 0);
    const [newVendorName, setNewVendorName] = useState('');
    const [messageType, setMessageType] = useState('ORM');

    const handleSave = () => {
        const finalVendor = isNewVendor ? newVendorName.trim() : vendor;
        if (!finalVendor || !messageType) return;
        onSave(finalVendor, messageType);
    };

    const isSaveDisabled = isNewVendor ? !newVendorName.trim() : !vendor;

    return (
        <div className="import-modal" onClick={onCancel}>
            <div className="import-modal__content glass-card" onClick={e => e.stopPropagation()}>
                <div className="import-modal__header">
                    <span className="import-modal__icon">📥</span>
                    <h2 className="import-modal__title">Import HL7 Message</h2>
                </div>

                <div className="import-modal__body">
                    <div className="import-modal__field">
                        <label className="import-modal__label">Vendor</label>
                        {!isNewVendor ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <select
                                    className="import-modal__select"
                                    style={{ flex: 1 }}
                                    value={vendor}
                                    onChange={e => setVendor(e.target.value)}
                                >
                                    <option value="">Select Vendor...</option>
                                    {existingVendors.map(v => (
                                        <option key={v} value={v}>{v}</option>
                                    ))}
                                </select>
                                <button
                                    className="import-modal__btn import-modal__btn--cancel"
                                    style={{ padding: '0 12px' }}
                                    onClick={() => setIsNewVendor(true)}
                                >
                                    + New
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    className="import-modal__input"
                                    style={{ flex: 1 }}
                                    placeholder="Enter vendor name..."
                                    value={newVendorName}
                                    onChange={e => setNewVendorName(e.target.value)}
                                    autoFocus
                                />
                                {existingVendors.length > 0 && (
                                    <button
                                        className="import-modal__btn import-modal__btn--cancel"
                                        style={{ padding: '0 12px' }}
                                        onClick={() => setIsNewVendor(false)}
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="import-modal__field">
                        <label className="import-modal__label">Message Type</label>
                        <select
                            className="import-modal__select"
                            value={messageType}
                            onChange={e => setMessageType(e.target.value)}
                        >
                            {MESSAGE_TYPES.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>

                    <div className="import-modal__field">
                        <label className="import-modal__label">Source File: {fileName}</label>
                        <div className="import-modal__preview">
                            {fileContent}
                        </div>
                    </div>
                </div>

                <div className="import-modal__footer">
                    <button className="import-modal__btn import-modal__btn--cancel" onClick={onCancel} disabled={isLoading}>
                        Cancel
                    </button>
                    <button
                        className="import-modal__btn import-modal__btn--save"
                        onClick={handleSave}
                        disabled={isSaveDisabled || isLoading}
                    >
                        {isLoading ? 'Saving...' : 'Save to Library'}
                    </button>
                </div>
            </div>
        </div>
    );
}
