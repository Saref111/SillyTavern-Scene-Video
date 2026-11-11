import './style.css';
import { onButtonClick, onCharacterMessageRendered } from './chat/events';
import { syncButtons } from './chat/button';
import { trackSelection } from './chat/selection';
import { registerSlashCommand } from './chat/slash-command';
import { BUTTON_CLASS, ctx } from './core/context';
import { settings } from './core/settings';
import { initSettingsUI } from './ui/settings';
import { openCardsPopup } from './ui/cards';

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

    // Appearance cards are also one click away in the extensions (magic wand) menu.
    $('#extensionsMenu').append(`
        <div id="scene_video_cards_menu" class="list-group-item flex-container flexGap5 interactable" tabindex="0">
            <div class="fa-solid fa-id-card extensionsMenuExtensionButton"></div>
            <span>Appearance cards</span>
        </div>`);
    $('#scene_video_cards_menu').on('click', () => openCardsPopup());

    c.eventSource.on(c.eventTypes.CHAT_CHANGED, () => syncButtons());
    c.eventSource.on(c.eventTypes.CHARACTER_MESSAGE_RENDERED, onCharacterMessageRendered);
}

init();
