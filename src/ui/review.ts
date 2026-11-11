/* eslint-disable @typescript-eslint/no-explicit-any */
// Prompt review popup.

import { ctx } from '../core/context';

// Prompt review popup with a Regenerate button that asks the LLM for a new prompt without closing.
export async function reviewPrompt(prompt: string, note: string, isH3: boolean, rewrite: () => Promise<string>): Promise<string | null> {
    const c = ctx();
    let busy = false;
    let closed = false;
    // eslint-disable-next-line prefer-const
    let popup: any;
    const regenerate = async (event: Event) => {
        if (busy) return;
        busy = true;
        const button = event.currentTarget as HTMLElement;
        const label = button.querySelector('span');
        const input: HTMLTextAreaElement = popup.mainInput;
        button.classList.add('disabled');
        input.disabled = true;
        if (label) label.textContent = 'Regenerating…';
        try {
            const next = await rewrite();
            if (!closed) input.value = next;
        } catch (error: any) {
            toastr.error(String(error?.message ?? error), 'Scene Video');
        } finally {
            busy = false;
            button.classList.remove('disabled');
            input.disabled = false;
            if (label) label.textContent = 'Regenerate';
        }
    };
    popup = new c.Popup(`<h3>Video prompt</h3>${note}`, c.POPUP_TYPE.INPUT, prompt, {
        rows: isH3 ? 18 : 10,
        okButton: 'Generate',
        cancelButton: 'Cancel',
        wide: true,
        customButtons: [{ text: 'Regenerate', icon: 'fa-rotate', tooltip: 'Ask the LLM for a new prompt', action: regenerate }],
        onClosing: () => !busy || confirm('The prompt is still being regenerated. Close anyway?'),
        onClose: () => { closed = true; },
    });
    const value = await popup.show();
    if (value === '') return '';
    return value ? String(value) : null;
}
