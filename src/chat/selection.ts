// Remembers text selected in a message, so the clip can film just that fragment.

// Opening the message menu clears the text selection, so the last selection inside a message is kept
// until the user clicks somewhere other than that message's buttons.
let lastSelection: { messageId: number; text: string } | null = null;

export function trackSelection() {
    document.addEventListener('selectionchange', () => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (!sel || !text || !sel.anchorNode || !sel.focusNode) return;
        const anchor = $(sel.anchorNode).closest('#chat .mes .mes_text');
        const focus = $(sel.focusNode).closest('#chat .mes .mes_text');
        if (!anchor.length || anchor[0] !== focus[0]) return;
        const messageId = Number(anchor.closest('.mes').attr('mesid'));
        if (!Number.isNaN(messageId)) lastSelection = { messageId, text };
    });
    document.addEventListener('pointerdown', (event) => {
        if (!lastSelection) return;
        const target = $(event.target as HTMLElement);
        const mes = target.closest('#chat .mes');
        const onOwnButtons = Number(mes.attr('mesid')) === lastSelection.messageId && target.closest('.mes_buttons, .extraMesButtons').length > 0;
        if (!onOwnButtons) lastSelection = null;
    }, true);
}

export function takeSelection(messageId: number): string | undefined {
    const current = window.getSelection()?.toString().trim();
    const text = lastSelection?.messageId === messageId ? lastSelection.text : undefined;
    lastSelection = null;
    return text || current || undefined;
}
