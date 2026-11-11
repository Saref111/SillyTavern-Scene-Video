/* eslint-disable @typescript-eslint/no-explicit-any */
// Appearance cards popup: one row per person of the open chat, plus extra people of the story.

import { CARD_ASPECTS, CARD_PROMPT_VERSION, CARD_RESOLUTIONS, MAX_CARDS, MAX_EXTRA_PEOPLE, cardPixels } from '../defaults';
import { cardFromAvatar, cardFromFile, confirmCardPrompt, drawWithSillyTavern, drawWithWaveSpeed, writeCardPrompt } from '../cards/create';
import { addExtraPerson, chatPeople, chatScope, extraPeople, removeExtraPerson, updateExtraPerson } from '../cards/people';
import type { Person } from '../cards/people';
import { getCard, removeCard } from '../cards/store';
import { ctx } from '../core/context';
import { save, settings } from '../core/settings';
import { escapeHtml } from '../core/text';

let people: Person[] = [];
let busyKey: string | null = null;
let root: any = null;
let fileTarget: Person | null = null;

const KIND_LABEL: Record<Person['kind'], string> = {
    character: 'character',
    persona: 'your persona',
    extra: 'person in the story',
};

function rowHtml(p: Person): string {
    const card = getCard(p.key);
    const picture = card
        ? `<a href="${escapeHtml(card.image)}" target="_blank" rel="noopener"><img class="scene-video-card-img" src="${escapeHtml(card.image)}" alt="" /></a>`
        : '<div class="scene-video-card-img scene-video-card-empty fa-solid fa-user"></div>';
    const busy = busyKey === p.key ? ' <i class="fa-solid fa-spinner fa-spin"></i>' : '';
    const heading = p.extra
        ? `<input class="text_pole" data-extra-field="name" value="${escapeHtml(p.extra.name)}" placeholder="Name" /> <small>${KIND_LABEL[p.kind]}</small>${busy}`
        : `<b>${escapeHtml(p.name)}</b> <small>${KIND_LABEL[p.kind]}</small>${busy}`;
    const description = p.extra
        ? `<textarea class="text_pole" rows="2" data-extra-field="description" placeholder="Appearance: age, build, hair, face, usual clothes. Empty: the LLM takes it from the recent story.">${escapeHtml(p.extra.description)}</textarea>`
        : '';
    return `
<div class="scene-video-card" data-key="${escapeHtml(p.key)}">
    ${picture}
    <div class="flex1">
        <div class="scene-video-card-head">${heading}</div>
        ${description}
        <div class="flex-container flexGap5">
            <div class="menu_button menu_button_icon" data-card="st" title="Draw a sheet from a description with SillyTavern's Image Generation"><i class="fa-solid fa-paintbrush"></i>ST</div>
            <div class="menu_button menu_button_icon" data-card="wavespeed" title="Draw a sheet from a description with the WaveSpeed image model from the settings"><i class="fa-solid fa-paintbrush"></i>WaveSpeed</div>
            <div class="menu_button fa-solid fa-upload" data-card="file" title="Use a picture from your computer"></div>
            ${p.avatarUrl ? '<div class="menu_button fa-solid fa-id-badge" data-card="avatar" title="Use the avatar as is"></div>' : ''}
            ${card ? '<div class="menu_button fa-solid fa-image" data-card="remove" title="Remove the picture"></div>' : ''}
            ${p.extra ? '<div class="menu_button fa-solid fa-trash" data-card="delete" title="Delete this person"></div>' : ''}
        </div>
    </div>
</div>`;
}

async function render() {
    if (!root) return;
    people = await chatPeople();
    const list = root.find('.scene-video-cards-list');
    if (!chatScope()) {
        list.html('<small class="scene-video-hint">Open a chat to make cards for its characters, your persona and other people of the story.</small>');
        root.find('[data-card="add"]').hide();
        return;
    }
    list.html(people.map(rowHtml).join(''));
    root.find('[data-card="add"]').toggle(extraPeople().length < MAX_EXTRA_PEOPLE);
}

async function run(person: Person, action: () => Promise<void>) {
    if (busyKey) return;
    busyKey = person.key;
    await render();
    try {
        await action();
        toastr.success(`The appearance card for ${person.name} was saved.`, 'Scene Video');
    } catch (error: any) {
        toastr.error(String(error?.message ?? error), 'Scene Video');
    } finally {
        busyKey = null;
        await render();
    }
}

async function draw(person: Person, source: 'st' | 'wavespeed') {
    const saved = getCard(person.key);
    let prompt = saved?.promptVersion === CARD_PROMPT_VERSION ? (saved.prompt ?? '') : '';
    if (!prompt) {
        const toast = toastr.info(`Writing the picture prompt for ${person.name}…`, 'Scene Video', { timeOut: 0, extendedTimeOut: 0 });
        try {
            prompt = await writeCardPrompt(person);
        } catch (error: any) {
            toastr.error(String(error?.message ?? error), 'Scene Video');
            return;
        } finally {
            toastr.clear(toast);
        }
    }
    const final = await confirmCardPrompt(person, prompt);
    if (!final) return;
    await run(person, () => source === 'st' ? drawWithSillyTavern(person, final) : drawWithWaveSpeed(person, final));
}

function personOf(el: HTMLElement): Person | undefined {
    const key = $(el).closest('.scene-video-card').data('key');
    return people.find(p => p.key === key);
}

async function onAction(this: HTMLElement) {
    const action = this.dataset.card;
    if (action === 'add') {
        if (addExtraPerson()) await render();
        return;
    }
    const person = personOf(this);
    if (!person || busyKey) return;
    switch (action) {
        case 'st': return draw(person, 'st');
        case 'wavespeed': return draw(person, 'wavespeed');
        case 'avatar': return run(person, () => cardFromAvatar(person));
        case 'file':
            fileTarget = person;
            root?.find('.scene-video-card-file').val('').trigger('click');
            return;
        case 'remove':
            removeCard(person.key);
            return render();
        case 'delete':
            if (person.extra && await ctx().Popup.show.confirm('Scene Video', `Delete ${escapeHtml(person.name)} and their card?`)) {
                removeExtraPerson(person.extra.id);
                await render();
            }
            return;
    }
}

/** Opens the appearance cards of the current chat. */
export async function openCardsPopup() {
    const c = ctx();
    root = $(`
<div class="scene-video-cards-popup">
    <h3>Appearance cards</h3>
    <small class="scene-video-hint">Reference pictures that keep faces and bodies the same in every clip. <b>ST</b> and <b>WaveSpeed</b> draw a character sheet from a description the LLM writes. For each clip the LLM sends the cards of the people on screen, at most ${MAX_CARDS}; your persona's card is skipped in first-person POV. Add up to ${MAX_EXTRA_PEOPLE} other people of the story; they stay with this character or group.</small>
    <div class="scene-video-card-size flex-container flexGap5 alignItemsCenter">
        <label>Picture shape <select class="text_pole" data-size="cardAspect">${CARD_ASPECTS.map(a => `<option value="${a}">${a}</option>`).join('')}</select></label>
        <label>Resolution <select class="text_pole" data-size="cardResolution">${Object.keys(CARD_RESOLUTIONS).map(r => `<option value="${r}">${r}</option>`).join('')}</select></label>
        <small class="scene-video-card-pixels"></small>
    </div>
    <div class="scene-video-cards-list"></div>
    <div class="menu_button menu_button_icon" data-card="add"><i class="fa-solid fa-user-plus"></i>Add person</div>
    <input type="file" class="scene-video-card-file" accept="image/png,image/jpeg,image/webp" hidden />
</div>`);

    const showPixels = () => {
        const s = settings();
        const { width, height } = cardPixels(s.cardAspect, s.cardResolution);
        root.find('.scene-video-card-pixels').text(`≈ ${width}×${height}`);
    };
    root.find('[data-size]').each(function (this: HTMLSelectElement) {
        this.value = (settings() as any)[this.dataset.size!];
    });
    root.on('change', '[data-size]', function (this: HTMLSelectElement) {
        (settings() as any)[this.dataset.size!] = this.value;
        save();
        showPixels();
    });
    showPixels();
    root.on('click', '[data-card]', onAction);
    root.on('change', '[data-extra-field]', function (this: HTMLInputElement) {
        const person = personOf(this);
        if (!person?.extra) return;
        const field = this.dataset.extraField as 'name' | 'description';
        const value = field === 'name' ? (this.value.trim() || person.extra.name) : this.value.trim();
        updateExtraPerson(person.extra.id, { [field]: value });
        if (field === 'name') person.name = value;
        else person.description = value;
    });
    root.on('change', '.scene-video-card-file', function (this: HTMLInputElement) {
        const file = this.files?.[0];
        const person = fileTarget;
        fileTarget = null;
        if (file && person) run(person, () => cardFromFile(person, file));
    });

    await render();
    await new c.Popup(root[0], c.POPUP_TYPE.TEXT, '', { wide: true, allowVerticalScrolling: true, okButton: 'Close' }).show();
    root = null;
}
