import type { ParsedMessage, ParsedSegment, ParsedField, ParsedComponent } from './types';

/**
 * Parse a raw HL7 v2.x message string into a structured ParsedMessage.
 *
 * Handles:
 *  - Field separator: |
 *  - Component separator: ^
 *  - Repetition separator: ~
 *  - Subcomponent separator: &
 *  - Escape character: \
 */
export function parseHL7Message(raw: string, fileName?: string): ParsedMessage {
    const normalized = raw.replace(/\r\n/g, '\r').replace(/\n/g, '\r');
    const segmentStrings = normalized.split('\r').filter(s => s.trim().length > 0);

    const segments: ParsedSegment[] = segmentStrings.map(segStr => parseSegment(segStr));

    // Extract message type from MSH.9
    let messageType = '';
    let timestamp = '';
    const msh = segments.find(s => s.name === 'MSH');
    if (msh) {
        // MSH.9 is the message type (index 8 because MSH.1 is the field separator itself)
        if (msh.fields[8]) {
            messageType = msh.fields[8].value;
        }
        // MSH.7 is the timestamp
        if (msh.fields[6]) {
            timestamp = msh.fields[6].value;
        }
    }

    return {
        segments,
        messageType,
        timestamp,
        raw,
        fileName,
    };
}

function parseSegment(raw: string): ParsedSegment {
    const segmentName = raw.substring(0, 3);
    const isMSH = segmentName === 'MSH';

    let fieldStrings: string[];

    if (isMSH) {
        // MSH is special: MSH.1 is the field separator "|" itself
        // MSH.2 is the encoding characters "^~\&"
        // We split from position 4 onward
        fieldStrings = ['MSH', '|', ...raw.substring(4).split('|')];
    } else {
        fieldStrings = raw.split('|');
    }

    const fields: ParsedField[] = fieldStrings.map((fieldStr, index) => {
        const position = `${segmentName}.${index}`;
        return parseField(fieldStr, position);
    });

    return {
        name: segmentName,
        fields,
        raw,
    };
}

function parseField(raw: string, position: string): ParsedField {
    // Handle repetitions
    const repetitions = raw.split('~');

    // Parse components from the first (or only) value
    const componentStrings = raw.split('^');
    const components: ParsedComponent[] = componentStrings.map((comp, index) => ({
        value: comp,
        position: `${position}.${index + 1}`,
    }));

    return {
        position,
        value: raw,
        components,
        repetitions,
        raw,
    };
}

/**
 * Format an HL7 timestamp (HL7 format: YYYYMMDDHHmmss) into a readable string.
 */
export function formatHL7Timestamp(ts: string): string {
    if (!ts || ts.length < 8) return ts;
    const year = ts.substring(0, 4);
    const month = ts.substring(4, 6);
    const day = ts.substring(6, 8);
    const hour = ts.length >= 10 ? ts.substring(8, 10) : '00';
    const min = ts.length >= 12 ? ts.substring(10, 12) : '00';
    const sec = ts.length >= 14 ? ts.substring(12, 14) : '00';
    return `${year}-${month}-${day} ${hour}:${min}:${sec}`;
}

/**
 * Read a .hl7 file and return its text content.
 */
export function readHL7File(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            resolve(text);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}
