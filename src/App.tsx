import { useState, useCallback, useEffect } from 'react';
import type { ParsedMessage } from './lib/types';
import { parseHL7Message, readHL7File } from './lib/hl7-parser';
import { DropZone } from './components/DropZone';
import { MessageSelector } from './components/MessageSelector';
import { HL7Viewer } from './components/HL7Viewer';
import sampleMessageRaw from './data/messages/sample-orm.hl7?raw';
import './App.css';

function App() {
  const [messages, setMessages] = useState<ParsedMessage[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Load sample message on mount
  useEffect(() => {
    if (sampleMessageRaw) {
      const parsed = parseHL7Message(sampleMessageRaw, 'sample-orm.hl7');
      setMessages([parsed]);
    }
  }, []);

  const handleFilesDropped = useCallback(async (files: File[]) => {
    setIsLoading(true);
    try {
      const newMessages: ParsedMessage[] = [];
      for (const file of files) {
        const text = await readHL7File(file);
        const parsed = parseHL7Message(text, file.name);
        newMessages.push(parsed);
      }
      setMessages(prev => {
        const updated = [...prev, ...newMessages];
        setActiveIndex(updated.length - 1); // Switch to last imported
        return updated;
      });
    } catch (err) {
      console.error('Failed to parse HL7 file:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelectMessage = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const handleRemoveMessage = useCallback((index: number) => {
    setMessages(prev => {
      const updated = prev.filter((_, i) => i !== index);
      return updated;
    });
    setActiveIndex(prev => {
      if (prev >= messages.length - 1) return Math.max(0, messages.length - 2);
      if (prev > index) return prev - 1;
      return prev;
    });
  }, [messages.length]);

  const activeMessage = messages[activeIndex];

  // Summary stats
  const totalSegments = activeMessage?.segments.length || 0;
  const totalFields = activeMessage?.segments.reduce((sum, seg) => sum + seg.fields.length - 1, 0) || 0;

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
            Messages: <span className="app-header__stat-value">{messages.length}</span>
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
        messages={messages}
        activeIndex={activeIndex}
        onSelect={handleSelectMessage}
        onRemove={handleRemoveMessage}
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
    </div>
  );
}

export default App;
