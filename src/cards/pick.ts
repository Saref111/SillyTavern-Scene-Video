// Choosing which cards go into a clip: the LLM picks the people who are on screen, at most MAX_CARDS.

import { CARD_PICK_INSTRUCTION, MAX_CARDS } from '../defaults';
import type { AppearanceCard, SceneVideoSettings } from '../defaults';
import { cleanLlmOutput } from '../prompt/format';
import { callLlm } from '../prompt/llm';
import { buildSceneContext } from '../prompt/scene';
import { chatPeople } from './people';
import type { Person } from './people';
import { imageToBase64 } from './create';

export interface CardRef {
    person: Person;
    card: AppearanceCard;
}

/** People of the chat who have a card. The persona's card is never used for first-person POV. */
export async function cardCandidates(s: SceneVideoSettings): Promise<CardRef[]> {
    const people = await chatPeople();
    return people
        .filter(p => s.cards[p.key]?.image)
        .filter(p => !(p.kind === 'persona' && s.cameraMode === 'pov'))
        .map(person => ({ person, card: s.cards[person.key] }));
}

export async function pickCards(messageId: number, s: SceneVideoSettings, candidates: CardRef[], focus?: string, direction?: string): Promise<CardRef[]> {
    if (!candidates.length) return [];
    const list = candidates.map((c, i) => `${i + 1}. ${c.person.name} (${c.person.kind === 'persona' ? 'the user' : c.person.kind === 'extra' ? 'a person in the story' : 'a character'})`).join('\n');
    const system = CARD_PICK_INSTRUCTION.replaceAll('{{max}}', String(MAX_CARDS));
    const scene = buildSceneContext(messageId, s, focus, direction);
    const answer = cleanLlmOutput(await callLlm(s, system, `${scene}\n\n[People with reference pictures]\n${list}\n\nAnswer now.`, 30));
    const picked: CardRef[] = [];
    for (const match of answer.matchAll(/\d+/g)) {
        const ref = candidates[Number(match[0]) - 1];
        if (ref && !picked.includes(ref)) picked.push(ref);
        if (picked.length >= MAX_CARDS) break;
    }
    console.debug('[Scene Video] cards', answer, picked.map(r => r.person.name));
    return picked;
}

/** The card pictures as base64, in the order of their <Picture N> tags. */
export async function loadReferences(refs: CardRef[]): Promise<{ data: string; format: string }[]> {
    return Promise.all(refs.map(r => imageToBase64(r.card.image.startsWith('/') ? r.card.image : `/${r.card.image}`)));
}
