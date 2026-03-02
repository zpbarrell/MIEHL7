import type { FieldDefinition, ComponentDefinition, EmrConfigEntry, SegmentDefinitions, HL7Flow, MessageContext } from './types';

// Import all segment definitions (Base defaults)
import MSH_JSON from '../data/field-definitions/MSH.json';
import PID_JSON from '../data/field-definitions/PID.json';
import ORC_JSON from '../data/field-definitions/ORC.json';
import OBR_JSON from '../data/field-definitions/OBR.json';
import OBX_JSON from '../data/field-definitions/OBX.json';
import AL1_JSON from '../data/field-definitions/AL1.json';
import DG1_JSON from '../data/field-definitions/DG1.json';
import IN1_JSON from '../data/field-definitions/IN1.json';
import PV1_JSON from '../data/field-definitions/PV1.json';
import NTE_JSON from '../data/field-definitions/NTE.json';
import EVN_JSON from '../data/field-definitions/EVN.json';
import PR1_JSON from '../data/field-definitions/PR1.json';
import FT1_JSON from '../data/field-definitions/FT1.json';
import GT1_JSON from '../data/field-definitions/GT1.json';

// Import EMR config (Base defaults)
import emrConfig_JSON from '../data/emr-config/configurable-fields.json';

// Build lookup maps (Mutable state)
const segmentMap = new Map<string, SegmentDefinitions>();
const emrConfigMap = new Map<string, EmrConfigEntry>();

function normalizeFlow(flow?: HL7Flow): HL7Flow {
    return flow === 'Inbound' ? 'Inbound' : 'Outbound';
}

function getEmrKey(position: string, flow?: HL7Flow): string {
    return `${normalizeFlow(flow)}::${position}`;
}

function isEntryEnabled(entry?: EmrConfigEntry): boolean {
    return !!entry && entry.enabled !== false;
}

// Initialize with bundled defaults
const allSegments: SegmentDefinitions[] = [
    MSH_JSON,
    PID_JSON,
    ORC_JSON,
    OBR_JSON,
    OBX_JSON,
    AL1_JSON,
    DG1_JSON,
    IN1_JSON,
    PV1_JSON,
    NTE_JSON,
    EVN_JSON,
    PR1_JSON,
    FT1_JSON,
    GT1_JSON
];
allSegments.forEach(seg => {
    segmentMap.set(seg.segment, seg as SegmentDefinitions);
});

emrConfig_JSON.entries.forEach(entry => {
    const normalized = {
        ...(entry as EmrConfigEntry),
        flow: normalizeFlow((entry as EmrConfigEntry).flow)
    };
    emrConfigMap.set(getEmrKey(normalized.fieldPosition, normalized.flow), normalized);
});

/**
 * Get the segment-level definition
 */
export function getSegmentDefinition(segmentName: string): SegmentDefinitions | undefined {
    return segmentMap.get(segmentName);
}

/**
 * Get the field definition
 */
export function getFieldDefinition(segmentName: string, fieldIndex: number): FieldDefinition | undefined {
    const seg = segmentMap.get(segmentName);
    if (!seg) return undefined;
    return seg.fields.find(f => f.field === fieldIndex);
}

/**
 * Get a component definition
 */
export function getComponentDefinition(
    segmentName: string,
    fieldIndex: number,
    componentIndex: number
): ComponentDefinition | undefined {
    const field = getFieldDefinition(segmentName, fieldIndex);
    if (!field || !field.components) return undefined;
    return field.components.find(c => c.position === componentIndex);
}


/**
 * Check if a field position is EMR-configurable
 */
export function isEmrConfigurable(position: string, flow?: HL7Flow): boolean {
    const resolvedFlow = normalizeFlow(flow);
    const exact = emrConfigMap.get(getEmrKey(position, resolvedFlow));
    if (isEntryEnabled(exact)) return true;
    const parts = position.split('.');
    if (parts.length === 3) {
        const parentPosition = `${parts[0]}.${parts[1]}`;
        const parent = emrConfigMap.get(getEmrKey(parentPosition, resolvedFlow));
        return isEntryEnabled(parent);
    }
    return false;
}

/**
 * Get EMR configuration entry
 */
export function getEmrConfig(position: string, flow?: HL7Flow): EmrConfigEntry | undefined {
    const resolvedFlow = normalizeFlow(flow);
    const exact = emrConfigMap.get(getEmrKey(position, resolvedFlow));
    if (exact) return exact;
    const parts = position.split('.');
    if (parts.length === 3) {
        const parentPosition = `${parts[0]}.${parts[1]}`;
        return emrConfigMap.get(getEmrKey(parentPosition, resolvedFlow));
    }
    return undefined;
}

/**
 * Get a human-readable label
 */
export function getFieldLabel(position: string): string {
    const parts = position.split('.');
    if (parts.length < 2) return position;

    const segmentName = parts[0];
    const fieldIndex = parseInt(parts[1], 10);
    const field = getFieldDefinition(segmentName, fieldIndex);

    if (!field) return position;

    if (parts.length === 3) {
        const componentIndex = parseInt(parts[2], 10);
        const component = getComponentDefinition(segmentName, fieldIndex, componentIndex);
        if (component) {
            return `${field.name} › ${component.name}`;
        }
    }

    return field.name;
}

/**
 * Get all known segment names
 */
export function getKnownSegments(): string[] {
    return Array.from(segmentMap.keys());
}

/**
 * SAVE ACTIONS (Calls Sidecar API)
 */

export async function saveFieldUpdate(segment: string, fieldIndex: number, name: string, description: string) {
    try {
        const res = await fetch('/api/update-field', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ segment, fieldIndex, name, description })
        });
        const result = await res.json();

        if (result.success) {
            // Update local memory map
            const field = getFieldDefinition(segment, fieldIndex);
            if (field) {
                field.name = name;
                field.description = description;
            }
        }
        return result;
    } catch (err) {
        console.error('Failed to save field update:', err);
        const error = err instanceof Error ? err.message : String(err);
        return { success: false, error };
    }
}

export async function saveEmrUpdate(position: string, flow: HL7Flow, data: Partial<EmrConfigEntry>) {
    const resolvedFlow = normalizeFlow(flow);
    try {
        const res = await fetch('/api/update-emr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position, flow: resolvedFlow, ...data })
        });
        const result = await res.json();

        if (result.success && result.data) {
            // Update local memory map
            const entry = {
                ...(result.data as EmrConfigEntry),
                flow: normalizeFlow((result.data as EmrConfigEntry).flow || resolvedFlow)
            };
            emrConfigMap.set(getEmrKey(position, entry.flow), entry);
        }
        return result;
    } catch (err) {
        console.error('Failed to save EMR update:', err);
        const error = err instanceof Error ? err.message : String(err);
        return { success: false, error };
    }
}
export async function deleteEmrUpdate(position: string, flow: HL7Flow) {
    const resolvedFlow = normalizeFlow(flow);
    try {
        const res = await fetch('/api/delete-emr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position, flow: resolvedFlow })
        });
        const result = await res.json();

        if (result.success) {
            // Remove from local memory map
            emrConfigMap.delete(getEmrKey(position, resolvedFlow));
        }
        return result;
    } catch (err) {
        console.error('Failed to delete EMR update:', err);
        const error = err instanceof Error ? err.message : String(err);
        return { success: false, error };
    }
}

export async function saveMessageFieldValue(
    message: MessageContext,
    segmentName: string,
    segmentIndex: number,
    fieldIndex: number,
    value: string
) {
    try {
        const res = await fetch('/api/update-message-field', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...message,
                segmentName,
                segmentIndex,
                fieldIndex,
                value,
            })
        });
        return await res.json();
    } catch (err) {
        console.error('Failed to save message field value:', err);
        const error = err instanceof Error ? err.message : String(err);
        return { success: false, error };
    }
}
