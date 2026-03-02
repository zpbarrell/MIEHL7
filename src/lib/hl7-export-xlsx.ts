import type { HL7Flow, ParsedMessage } from './types';
import { getEmrConfig, getFieldDefinition, getSegmentDefinition, isEmrConfigurable } from './field-dictionary';

function sanitizeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'hl7-export';
}

function stripExtension(name: string): string {
    return name.replace(/\.[^.]+$/, '');
}

function buildFieldComment(
    segmentName: string,
    fieldIndex: number,
    position: string,
    flow: HL7Flow
): string {
    const segmentDef = getSegmentDefinition(segmentName);
    const fieldDef = getFieldDefinition(segmentName, fieldIndex);
    const emrConfig = getEmrConfig(position, flow);
    const emrEnabled = isEmrConfigurable(position, flow);

    const lines: string[] = [
        `Position: ${position}`,
        `Segment: ${segmentDef?.name || segmentName}`,
        `Field: ${fieldDef?.name || `Field ${fieldIndex}`}`,
        `Required: ${fieldDef?.required ? 'Yes' : 'No'}`,
    ];

    if (fieldDef?.dataType) lines.push(`Data Type: ${fieldDef.dataType}`);
    if (fieldDef?.maxLength) lines.push(`Max Length: ${fieldDef.maxLength}`);
    if (fieldDef?.description) lines.push(`Description: ${fieldDef.description}`);

    lines.push(`EMR Configurable: ${emrEnabled ? 'Yes' : 'No'}`);
    if (emrConfig?.emrLocation) lines.push(`EMR Location: ${emrConfig.emrLocation}`);
    if (emrConfig?.notes) lines.push(`EMR Notes: ${emrConfig.notes}`);

    return lines.join('\n');
}

export async function exportMessageAsXlsx(
    message: ParsedMessage,
    flow: HL7Flow,
    preferredName?: string
): Promise<void> {
    const { Workbook } = await import('exceljs');
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('HL7 Message');

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
            const comment = buildFieldComment(segment.name, fieldIndex, field.position, flow);
            cell.note = comment;

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
