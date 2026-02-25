import { useState, useCallback, useEffect } from 'react';
import type { ParsedMessage } from './lib/types';
import { parseHL7Message } from './lib/hl7-parser';
import { DropZone } from './components/DropZone';
import { MessageSelector } from './components/MessageSelector';
import { HL7Viewer } from './components/HL7Viewer';
import { ImportModal } from './components/ImportModal';
import './App.css';

function App() {
  const [inventory, setInventory] = useState<Record<string, string[]>>({});
  const [currentVendor, setCurrentVendor] = useState<string>('');
  const [currentFilename, setCurrentFilename] = useState<string>('');
  const [activeMessage, setActiveMessage] = useState<ParsedMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [importingFile, setImportingFile] = useState<{ content: string; name: string } | null>(null);

  // Load inventory on mount
  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async (selectLatest?: { vendor: string, filename: string }) => {
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (data.success) {
        setInventory(data.inventory);

        // Pick what to load
        if (selectLatest) {
          setCurrentVendor(selectLatest.vendor);
          setCurrentFilename(selectLatest.filename);
          loadMessage(selectLatest.vendor, selectLatest.filename);
        } else if (Object.keys(data.inventory).length > 0) {
          const vendors = Object.keys(data.inventory);
          const firstVendor = vendors[0];
          const firstFilename = data.inventory[firstVendor][0];
          if (firstVendor && firstFilename) {
            setCurrentVendor(firstVendor);
            setCurrentFilename(firstFilename);
            loadMessage(firstVendor, firstFilename);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load inventory:', err);
    }
  };

  const loadMessage = async (vendor: string, filename: string) => {
    if (!vendor || !filename) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/get-hl7', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor, filename })
      });
      const data = await res.json();
      if (data.success && data.content) {
        const parsed = parseHL7Message(data.content, `${filename}.hl7`);
        setActiveMessage(parsed);
      }
    } catch (err) {
      console.error('Failed to fetch HL7 content:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilesDropped = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0]; // Process one at a time for categorization
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setImportingFile({ content, name: file.name });
    };
    reader.readAsText(file);
  }, []);

  const handleModalSave = async (vendor: string, type: string, label: string) => {
    if (!importingFile) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/save-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor,
          type,
          label,
          content: importingFile.content
        })
      });
      const data = await res.json();
      if (data.success) {
        setImportingFile(null);
        // The filename on server is generated as "{type} - {label}"
        const safeLabel = label.trim().replace(/[^a-z0-9 _-]/gi, '') || `Imported ${new Date().toLocaleDateString().replace(/\//g, '-')}`;
        const filename = `${type} - ${safeLabel}`;
        await loadInventory({ vendor, filename });
      } else {
        alert(`Failed to save: ${data.message}`);
      }
    } catch (err: any) {
      console.error('Save message failed:', err);
      alert(`Network error: Could not connect to sidecar server. ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectVendorFilename = (vendor: string, filename: string) => {
    setCurrentVendor(vendor);
    setCurrentFilename(filename);
    loadMessage(vendor, filename);
  };

  const handleDeleteMessage = async (vendor: string, filename: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/delete-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor, filename })
      });
      const data = await res.json();
      if (data.success) {
        // Refresh inventory
        const resEnv = await fetch('/api/inventory');
        const dataEnv = await resEnv.json();
        if (dataEnv.success) {
          setInventory(dataEnv.inventory);

          // If we deleted the active message, pick something else
          if (filename === currentFilename && vendor === currentVendor) {
            const vendors = Object.keys(dataEnv.inventory);
            if (vendors.length > 0) {
              const nextVendor = dataEnv.inventory[vendor] ? vendor : vendors[0];
              const nextFilename = dataEnv.inventory[nextVendor][0];
              if (nextFilename) {
                setCurrentVendor(nextVendor);
                setCurrentFilename(nextFilename);
                loadMessage(nextVendor, nextFilename);
              } else {
                setActiveMessage(null);
                setCurrentFilename('');
              }
            } else {
              setActiveMessage(null);
              setCurrentVendor('');
              setCurrentFilename('');
            }
          }
        }
      } else {
        alert(`Failed to delete: ${data.message}`);
      }
    } catch (err: any) {
      console.error('Delete message failed:', err);
      alert(`Network error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Summary stats
  const totalSegments = activeMessage?.segments.length || 0;
  const totalFields = activeMessage?.segments.reduce((sum: number, seg: any) => sum + seg.fields.length - 1, 0) || 0;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-header__logo">
          <div className="app-header__icon">⚡</div>
          <div>
            <div className="app-header__title">MIEHL7</div>
            <div className="app-header__subtitle">HL7 Message Viewer & Analyzer</div>
          </div>
        </div>
        <div className="app-header__stats">
          <div className="app-header__stat">
            Vendors: <span className="app-header__stat-value">{Object.keys(inventory).length}</span>
          </div>
          <div className="app-header__stat">
            Total Messages: <span className="app-header__stat-value">{Object.values(inventory).flat().length}</span>
          </div>
          <div className="app-header__stat">
            Segments: <span className="app-header__stat-value">{totalSegments}</span>
          </div>
          <div className="app-header__stat">
            Fields: <span className="app-header__stat-value">{totalFields}</span>
          </div>
        </div>
      </header>

      {/* Drop zone */}
      <DropZone onFilesDropped={handleFilesDropped} isLoading={isLoading} />

      {/* Message selector */}
      <MessageSelector
        inventory={inventory}
        currentVendor={currentVendor}
        currentFilename={currentFilename}
        onSelect={handleSelectVendorFilename}
        onDelete={handleDeleteMessage}
      />

      {/* HL7 Viewer */}
      {activeMessage ? (
        <HL7Viewer message={activeMessage} />
      ) : (
        <div className="app-welcome glass-card animate-fade-in-up">
          <div className="app-welcome__content">
            <div className="app-welcome__icon">🏥</div>
            <h2 className="app-welcome__title">Welcome to MIEHL7</h2>
            <p className="app-welcome__description">
              An interactive HL7 message viewer with field-level metadata,
              EMR configuration mapping, and drag-and-drop import.
            </p>
            <div className="app-welcome__features">
              <div className="app-welcome__feature">
                <span className="app-welcome__feature-icon">🔍</span>
                <span>Hover fields for deep metadata</span>
              </div>
              <div className="app-welcome__feature">
                <span className="app-welcome__feature-icon">🟡</span>
                <span>EMR-configurable field highlighting</span>
              </div>
              <div className="app-welcome__feature">
                <span className="app-welcome__feature-icon">📂</span>
                <span>Drag & drop .hl7 file import</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <span>MIEHL7 — HL7 v2.x Message Viewer</span>
        <span className="app-footer__dot">•</span>
        <span>Hover over fields for details</span>
        <span className="app-footer__dot">•</span>
        <span className="app-footer__emr-hint">
          <span className="app-footer__emr-dot" />
          Yellow = EMR Configurable
        </span>
      </footer>

      {/* Import Modal */}
      {importingFile && (
        <ImportModal
          fileContent={importingFile.content}
          fileName={importingFile.name}
          existingVendors={Object.keys(inventory)}
          onSave={handleModalSave}
          onCancel={() => setImportingFile(null)}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

export default App;
