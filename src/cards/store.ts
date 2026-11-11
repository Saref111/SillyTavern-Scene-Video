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
