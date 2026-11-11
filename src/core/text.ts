// Small text helpers.

export function cleanText(text: string): string {
    return String(text ?? '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

export function truncate(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function escapeHtml(text: unknown): string {
    return String(text ?? '').replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
}
