import type { FieldDefinition, ComponentDefinition, EmrConfigEntry, SegmentDefinitions } from './types';

// Import all segment definitions (Base defaults)
import MSH_JSON from '../data/field-definitions/MSH.json';
import PID_JSON from '../data/field-definitions/PID.json';
import ORC_JSON from '../data/field-definitions/ORC.json';
import OBR_JSON from '../data/field-definitions/OBR.json';
import OBX_JSON from '../data/field-definitions/OBX.json';
import AL1_JSON from '../data/field-definitions/AL1.json';
import DG1_JSON from '../data/field-definitions/DG1.json';
import IN1_JSON from '../data/field-definitions/IN1.json';

// Import EMR config (Base defaults)
import emrConfig_JSON from '../data/emr-config/configurable-fields.json';

// Build lookup maps (Mutable state)
const segmentMap = new Map<string, SegmentDefinitions>();
const emrConfigMap = new Map<string, EmrConfigEntry>();

// Initialize with bundled defaults
const allSegments: SegmentDefinitions[] = [MSH_JSON, PID_JSON, ORC_JSON, OBR_JSON, OBX_JSON, AL1_JSON, DG1_JSON, IN1_JSON];
allSegments.forEach(seg => {
    segmentMap.set(seg.segment, seg as SegmentDefinitions);
});

emrConfig_JSON.entries.forEach(entry => {
    emrConfigMap.set(entry.fieldPosition, entry as EmrConfigEntry);
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
export function isEmrConfigurable(position: string): boolean {
    if (emrConfigMap.has(position)) return true;
    const parts = position.split('.');
    if (parts.length === 3) {
        const parentPosition = `${parts[0]}.${parts[1]}`;
        return emrConfigMap.has(parentPosition);
    }
    return false;
}

/**
 * Get EMR configuration entry
 */
export function getEmrConfig(position: string): EmrConfigEntry | undefined {
    const exact = emrConfigMap.get(position);
    if (exact) return exact;
    const parts = position.split('.');
    if (parts.length === 3) {
        const parentPosition = `${parts[0]}.${parts[1]}`;
        return emrConfigMap.get(parentPosition);
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

export async function saveEmrUpdate(position: string, data: Partial<EmrConfigEntry>) {
    try {
        const res = await fetch('/api/update-emr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position, ...data })
        });
        const result = await res.json();

        if (result.success && result.data) {
            // Update local memory map
            emrConfigMap.set(position, result.data as EmrConfigEntry);
        }
        return result;
    } catch (err) {
        console.error('Failed to save EMR update:', err);
        const error = err instanceof Error ? err.message : String(err);
        return { success: false, error };
    }
}
