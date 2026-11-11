import './style.css';
import { onButtonClick, onCharacterMessageRendered } from './chat/events';
import { syncButtons } from './chat/button';
import { trackSelection } from './chat/selection';
import { registerSlashCommand } from './chat/slash-command';
import { BUTTON_CLASS, ctx } from './core/context';
import { settings } from './core/settings';
import { initSettingsUI } from './ui/settings';

export { generateSceneVideo } from './generation';
export { resolvePromptFormat } from './prompt';

function init() {
    const c = ctx();
    settings();
    initSettingsUI();
    syncButtons();
    registerSlashCommand();
    trackSelection();

    $(document).on('click', `.${BUTTON_CLASS}`, onButtonClick);

    c.eventSource.on(c.eventTypes.CHAT_CHANGED, () => syncButtons());
    c.eventSource.on(c.eventTypes.CHARACTER_MESSAGE_RENDERED, onCharacterMessageRendered);
}

init();
