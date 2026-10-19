const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const NAME_TYPES = new Set(['PN', 'XPN', 'XCN', 'XON']);
const ADDRESS_TYPES = new Set(['AD', 'XAD']);
const PHONE_TYPES = new Set(['TN', 'XTN']);

const NK1_SENSITIVE_FIELDS = new Map([
    [2, 'name'],
    [4, 'address'],
    [5, 'phone'],
    [6, 'phone'],
    [30, 'name'],
    [31, 'phone'],
]);

const classifyField = (field) => {
    const type = String(field.dataType || '').toUpperCase();
    const name = String(field.name || '');

    if (NAME_TYPES.has(type) || /\b(name|person|provider|doctor|physician|observer)\b/i.test(name)) {
        return type === 'XCN' ? 'xcn' : type === 'XON' ? 'xon' : 'name';
    }
    if (ADDRESS_TYPES.has(type) || /\baddress\b/i.test(name)) return 'address';
    if (PHONE_TYPES.has(type) || /\b(phone|telephone|email)\b/i.test(name)) return 'phone';
    return null;
};

const replacementFor = (kind, segmentName, fieldNumber) => {
    if (segmentName === 'PID' && fieldNumber === 5) return 'ANONYMOUS^PATIENT^^^^^L';
    if (kind === 'xcn') return '^ANONYMOUS^PERSON';
    if (kind === 'xon') return 'ANONYMOUS ORGANIZATION';
    if (kind === 'name') return 'ANONYMOUS^PERSON';
    if (kind === 'address') return '100 SAMPLE ST^^SAMPLE CITY^ZZ^00000^US';
    if (kind === 'phone') return '5555550100^PRN^PH';
    return '';
};

const getLineBreak = (content) => {
    if (content.includes('\r\n')) return '\r\n';
    if (content.includes('\n')) return '\n';
    return '\r';
};

export function anonymizeHl7Content(content, definitions = []) {
    const lineBreak = getLineBreak(content);
    const trailingBreak = /(\r\n|\n|\r)$/.test(content);
    const bySegment = new Map();

    for (const definition of definitions) {
        const fields = new Map();
        for (const field of definition.fields || []) {
            const kind = classifyField(field);
            if (kind) fields.set(Number(field.field), kind);
        }
        bySegment.set(String(definition.segment || '').toUpperCase(), fields);
    }

    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const segments = normalized.split('\n').filter(Boolean);
    const updatedSegments = segments.map((segment) => {
        const parts = segment.split('|');
        const segmentName = String(parts[0] || '').toUpperCase();
        const fields = bySegment.get(segmentName) || new Map();
        const offset = segmentName === 'MSH' ? -1 : 0;

        if (segmentName === 'NK1') {
            for (const [fieldNumber, kind] of NK1_SENSITIVE_FIELDS) {
                fields.set(fieldNumber, kind);
            }
        }

        for (const [fieldNumber, kind] of fields) {
            const fieldIndex = fieldNumber + offset;
            if (fieldIndex > 0 && fieldIndex < parts.length) {
                parts[fieldIndex] = replacementFor(kind, segmentName, fieldNumber);
            }
        }

        if (segmentName === 'PID') {
            if (parts.length > 7) parts[7] = '19000101';
            if (parts.length > 19) parts[19] = '';
        }

        return parts.join('|').replace(EMAIL_PATTERN, 'anonymous@example.invalid');
    });

    return updatedSegments.join(lineBreak) + (trailingBreak ? lineBreak : '');
}