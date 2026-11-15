// Saved appearance cards.

import type { AppearanceCard } from '../defaults';
import { save, settings } from '../core/settings';

export function getCard(key: string): AppearanceCard | undefined {
    return settings().cards[key];
}

export function setCard(key: string, card: AppearanceCard) {
    settings().cards[key] = card;
    save();
}

export function removeCard(key: string) {
    delete settings().cards[key];
    save();
}

/** The reference picture for drawing this person's card, if one was chosen. */
export function getReference(key: string): string | undefined {
    return settings().cardRefs[key] || undefined;
}

export function setReference(key: string, image: string) {
    settings().cardRefs[key] = image;
    save();
}

export function removeReference(key: string) {
    delete settings().cardRefs[key];
    save();
}
