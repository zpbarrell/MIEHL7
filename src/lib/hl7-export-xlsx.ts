import type { HL7Flow, ParsedMessage } from './types';
import { getEmrConfig, getFieldDefinition, getSegmentDefinition, isEmrConfigurable } from './field-dictionary';

function sanitizeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'hl7-export';
}

function stripExtension(name: string): string {
    return name.replace(/\.[^.]+$/, '');
}

function getComponentsSummary(
    segmentName: string,
    fieldIndex: number,
    field: ParsedMessage['segments'][number]['fields'][number]
): string {
    const fieldDef = getFieldDefinition(segmentName, fieldIndex);
    if (!fieldDef?.components?.length) return '';

    return field.components
        .map((component, index) => {
            const componentDef = fieldDef.components?.find(definition => definition.position === index + 1);
            const componentName = componentDef?.name || `Component ${index + 1}`;
            return `${component.position}: ${componentName} = ${component.value || '(empty)'}`;
        })
        .join('\n');
}

function getFieldNotes(segmentName: string, fieldIndex: number, position: string, flow: HL7Flow): string {
    const fieldDef = getFieldDefinition(segmentName, fieldIndex);
    const emrConfig = getEmrConfig(position, flow);
    const notes: string[] = [];

    if (fieldDef?.description) notes.push(fieldDef.description);
    if (emrConfig?.emrLocation) notes.push(`EMR Location: ${emrConfig.emrLocation}`);
    if (emrConfig?.notes) notes.push(`EMR Notes: ${emrConfig.notes}`);

    return notes.join('\n');
}

export async function exportMessageAsXlsx(
    message: ParsedMessage,
    flow: HL7Flow,
    preferredName?: string
): Promise<void> {
    const { Workbook } = await import('exceljs');
    const workbook = new Workbook();
    const mappingWorksheet = workbook.addWorksheet('HL7 Mapping');
    const worksheet = workbook.addWorksheet('HL7 Message');

    const mappingHeader = [
        'Segment',
        'Position',
        'Field Name',
        'Components',
        'Supported',
        'Required',
        'EMR Configurable',
        'Data Type',
        'Max Length',
        'Notes',
    ];
    mappingWorksheet.addRow(mappingHeader);

    const mappingHeaderRow = mappingWorksheet.getRow(1);
    mappingHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    mappingHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    mappingHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F2937' },
    };

    message.segments.forEach((segment, segmentIndex) => {
        for (let fieldIndex = 1; fieldIndex < segment.fields.length; fieldIndex += 1) {
            const field = segment.fields[fieldIndex];
            const fieldDef = getFieldDefinition(segment.name, fieldIndex);
            const position = field.position;
            const emrEnabled = isEmrConfigurable(position, flow);
            const mappingRow = mappingWorksheet.addRow([
                segment.name,
                position,
                fieldDef?.name || `Field ${fieldIndex}`,
                getComponentsSummary(segment.name, fieldIndex, field),
                fieldDef ? 'Yes' : 'No',
                fieldDef ? (fieldDef.required ? 'Yes' : 'No') : 'Unknown',
                emrEnabled ? 'Yes' : 'No',
                fieldDef?.dataType || '',
                fieldDef?.maxLength ?? '',
                getFieldNotes(segment.name, fieldIndex, position, flow),
            ]);

            mappingRow.alignment = { vertical: 'top', wrapText: true };
            if (emrEnabled) {
                mappingRow.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFDE68A' },
                };
            }
            mappingRow.getCell(1).font = { bold: true };
            mappingRow.getCell(2).font = { bold: true };
            mappingRow.getCell(4).note = `Segment Index: ${segmentIndex}\nField Value: ${field.value || '(empty)'}`;
        }
    });

    mappingWorksheet.autoFilter = {
        from: 'A1',
        to: `J${mappingWorksheet.rowCount}`,
    };
    mappingWorksheet.views = [{ state: 'frozen', ySplit: 1 }];
    mappingWorksheet.columns = [
        { width: 12 },
        { width: 14 },
        { width: 28 },
        { width: 42 },
        { width: 12 },
        { width: 12 },
        { width: 18 },
        { width: 14 },
        { width: 14 },
        { width: 60 },
    ];

    const maxFieldCount = Math.max(
        0,
        ...message.segments.map((segment) => Math.max(0, segment.fields.length - 1))
    );

    const header = ['Segment'];
    for (let i = 1; i <= maxFieldCount; i += 1) {
        header.push(`Field ${i}`);
    }
    worksheet.addRow(header);

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    message.segments.forEach((segment, segmentIndex) => {
        const rowValues: (string | null)[] = [segment.name];
        for (let fieldIndex = 1; fieldIndex <= maxFieldCount; fieldIndex += 1) {
            rowValues.push(segment.fields[fieldIndex]?.value || '');
        }

        const row = worksheet.addRow(rowValues);
        row.getCell(1).font = { bold: true };

        for (let fieldIndex = 1; fieldIndex < segment.fields.length; fieldIndex += 1) {
            const field = segment.fields[fieldIndex];
            const colIndex = fieldIndex + 1;
            const cell = row.getCell(colIndex);
            const fieldDef = getFieldDefinition(segment.name, fieldIndex);
            cell.note = [
                `Position: ${field.position}`,
                `Segment: ${getSegmentDefinition(segment.name)?.name || segment.name}`,
                `Field: ${fieldDef?.name || `Field ${fieldIndex}`}`,
                `Supported: ${fieldDef ? 'Yes' : 'No'}`,
                `Required: ${fieldDef ? (fieldDef.required ? 'Yes' : 'No') : 'Unknown'}`,
                `EMR Configurable: ${isEmrConfigurable(field.position, flow) ? 'Yes' : 'No'}`,
                `Data Type: ${fieldDef?.dataType || 'Unknown'}`,
                `Max Length: ${fieldDef?.maxLength ?? 'Unknown'}`,
                `Notes: ${getFieldNotes(segment.name, fieldIndex, field.position, flow) || 'None'}`,
            ].join('\n');

            if (isEmrConfigurable(field.position, flow)) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFDE68A' },
                };
            }
        }

        const segmentCell = row.getCell(1);
        segmentCell.note = `Segment Index: ${segmentIndex}\nSegment Name: ${segment.name}`;
    });

    worksheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
    worksheet.columns = [
        { width: 14 },
        ...Array.from({ length: maxFieldCount }, () => ({ width: 22 })),
    ];

    const baseName = sanitizeFileName(stripExtension(preferredName || message.fileName || 'hl7-export'));
    const fileName = `${baseName}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

export function exportMessageAsHl7(
    message: ParsedMessage,
    preferredName?: string
): void {
    const baseName = sanitizeFileName(stripExtension(preferredName || message.fileName || 'hl7-export'));
    const fileName = `${baseName}.hl7`;
    const content = message.raw || '';

    const blob = new Blob([content], {
        type: 'text/plain;charset=utf-8',
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}
