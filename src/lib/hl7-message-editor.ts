import type { MessageContext } from './types';

async function updateMessageSegment(
    endpoint: string,
    message: MessageContext,
    segmentName: string,
    segmentIndex: number
) {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...message, segmentName, segmentIndex }),
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to update HL7 segment:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: errorMessage };
    }
}

export function duplicateMessageSegment(message: MessageContext, segmentName: string, segmentIndex: number) {
    return updateMessageSegment('/api/duplicate-message-segment', message, segmentName, segmentIndex);
}

export function deleteMessageSegment(message: MessageContext, segmentName: string, segmentIndex: number) {
    return updateMessageSegment('/api/delete-message-segment', message, segmentName, segmentIndex);
}