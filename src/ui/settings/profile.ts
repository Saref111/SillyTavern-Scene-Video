// LLM connection profile selector of the settings panel.

import { ctx } from '../../core/context';
import { save, settings } from '../../core/settings';

// Connection profiles come from SillyTavern's Connection Manager; the empty option means the chat connection.
export function initProfileSelect() {
    const service = ctx().ConnectionManagerRequestService;
    const label = () => $('#scene_video_profile option[value=""]').text('Same as chat (current connection)');
    try {
        if (!service) throw new Error('not available');
        service.handleDropdown('#scene_video_profile', settings().promptProfile, (profile?: { id: string }) => {
            settings().promptProfile = profile?.id ?? '';
            save();
            label();
        });
        label();
        // The saved profile may have been deleted.
        if (($('#scene_video_profile').val() ?? '') !== settings().promptProfile) {
            settings().promptProfile = '';
            save();
        }
    } catch {
        settings().promptProfile = '';
        $('#scene_video_profile').prop('disabled', true).empty().append('<option value="">Same as chat (current connection)</option>');
        $('#scene_video_profile_hint').text('Enable the Connection Manager extension to choose a separate LLM for prompts.');
    }
}
