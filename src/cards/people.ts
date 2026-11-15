/* eslint-disable @typescript-eslint/no-explicit-any */
// People of the current chat who can have an appearance card: the character(s), the user's persona
// and extra people of the story added by the user.

import { MAX_EXTRA_PEOPLE } from '../defaults';
import type { ExtraPerson } from '../defaults';
import { ctx } from '../core/context';
import { save, settings } from '../core/settings';

export interface Person {
    /** Key in settings.cards: "char:<avatar>", "persona:<avatar>" or "extra:<scope>:<id>". */
    key: string;
    name: string;
    kind: 'character' | 'persona' | 'extra';
    /** Thumbnail for the cards list; empty for extra people. */
    thumbnail: string;
    /** Full avatar image, usable as a card; empty for extra people. */
    avatarUrl: string;
    /** Appearance text the LLM draws the card from. */
    description: string;
    /** Set for extra people. */
    extra?: ExtraPerson;
}

// The persona's avatar isn't part of SillyTavern's extension context, so it's read from the personas module.
const PERSONAS_MODULE = '/scripts/personas.js';

async function personaAvatar(): Promise<string> {
    try {
        const mod: any = await import(/* webpackIgnore: true */ PERSONAS_MODULE);
        return String(mod.user_avatar || '');
    } catch {
        return '';
    }
}

/** Extra people belong to the open character or group, so they show up in all of its chats. */
export function chatScope(): string | null {
    const c = ctx();
    if (c.groupId) return `group:${c.groupId}`;
    const avatar = c.characterId !== undefined ? c.characters[c.characterId]?.avatar : undefined;
    return avatar ? `char:${avatar}` : null;
}

export function extraPeople(): ExtraPerson[] {
    const scope = chatScope();
    return scope ? (settings().extraPeople[scope] ?? []) : [];
}

export function addExtraPerson(): ExtraPerson | null {
    const scope = chatScope();
    if (!scope) return null;
    const s = settings();
    const list = s.extraPeople[scope] ??= [];
    if (list.length >= MAX_EXTRA_PEOPLE) return null;
    const person = { id: Date.now().toString(36), name: `Person ${list.length + 1}`, description: '' };
    list.push(person);
    save();
    return person;
}

export function updateExtraPerson(id: string, patch: Partial<Omit<ExtraPerson, 'id'>>) {
    const person = extraPeople().find(p => p.id === id);
    if (!person) return;
    Object.assign(person, patch);
    save();
}

export function removeExtraPerson(id: string) {
    const scope = chatScope();
    if (!scope) return;
    const s = settings();
    s.extraPeople[scope] = (s.extraPeople[scope] ?? []).filter(p => p.id !== id);
    delete s.cards[`extra:${scope}:${id}`];
    delete s.cardRefs[`extra:${scope}:${id}`];
    save();
}

export async function chatPeople(): Promise<Person[]> {
    const c = ctx();
    const people: Person[] = [];
    const avatars: string[] = c.groupId
        ? (c.groups.find((g: any) => g.id === c.groupId)?.members ?? [])
        : (c.characterId !== undefined && c.characters[c.characterId] ? [c.characters[c.characterId].avatar] : []);

    for (const avatar of avatars) {
        const ch = c.characters.find((x: any) => x.avatar === avatar);
        if (!ch) continue;
        people.push({
            key: `char:${avatar}`,
            name: ch.name,
            kind: 'character',
            thumbnail: c.getThumbnailUrl('avatar', avatar),
            avatarUrl: `/characters/${encodeURIComponent(avatar)}`,
            description: c.substituteParams(String(ch.description ?? ch.data?.description ?? '')),
        });
    }

    const persona = await personaAvatar();
    if (persona) {
        let description = '';
        try {
            description = c.substituteParams(String(c.getCharacterCardFields?.()?.persona ?? ''));
        } catch {
            // no persona description
        }
        people.push({
            key: `persona:${persona}`,
            name: c.name1 || 'You',
            kind: 'persona',
            thumbnail: c.getThumbnailUrl('persona', persona),
            avatarUrl: `/User Avatars/${encodeURIComponent(persona)}`,
            description,
        });
    }

    const scope = chatScope();
    for (const extra of extraPeople()) {
        people.push({
            key: `extra:${scope}:${extra.id}`,
            name: extra.name,
            kind: 'extra',
            thumbnail: '',
            avatarUrl: '',
            description: extra.description,
            extra,
        });
    }
    return people;
}
