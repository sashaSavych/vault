import type { Account } from '../../core/models/account';

export function normalizeAccountCardId(cardId: string): string {
  const digits = cardId.replace(/\D/g, '');
  if (digits.length === 0) {
    return '';
  }
  return digits.slice(-4).padStart(4, '0');
}

export function parseCardIdsInput(value: string): string[] {
  const ids = value
    .split(/[\s,;]+/)
    .map((part) => normalizeAccountCardId(part.trim()))
    .filter(Boolean);

  return [...new Set(ids)];
}

export function formatCardIdsInput(cardIds: string[]): string {
  return cardIds.map(normalizeAccountCardId).filter(Boolean).join(', ');
}

export function isValidCardIds(cardIds: string[]): boolean {
  return cardIds.length > 0 && cardIds.every((id) => /^\d{4}$/.test(id));
}

export function accountMatchesCardLast4(account: Account, cardLast4: string): boolean {
  return account.cardIds.some((cardId) => normalizeAccountCardId(cardId) === cardLast4);
}
