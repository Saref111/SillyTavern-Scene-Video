// The video button in each message's menu.

import { BUTTON_CLASS } from '../core/context';
import { settings } from '../core/settings';

export const BUTTON_HTML = `<div title="Generate scene video (select text in the message first to film just that fragment)" class="mes_button ${BUTTON_CLASS} fa-solid fa-video"></div>`;

export function syncButtons() {
    const show = settings().enabled;
    const targets = $('#message_template .extraMesButtons, #chat .mes .extraMesButtons');
    targets.each(function (this: HTMLElement) {
        const el = $(this);
        const has = el.find(`.${BUTTON_CLASS}`).length > 0;
        if (show && !has) el.prepend(BUTTON_HTML);
        if (!show && has) el.find(`.${BUTTON_CLASS}`).remove();
    });
}

export function setBusy(messageId: number, busy: boolean) {
    $(`#chat .mes[mesid="${messageId}"] .${BUTTON_CLASS}`).toggleClass('scene-video-busy', busy);
}
