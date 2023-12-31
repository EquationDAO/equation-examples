export const SIDE_LONG = 1;
export const SIDE_SHORT = 2;

export function isLong(side: number): boolean {
    return side === SIDE_LONG;
}

export function isShort(side: number): boolean {
    return !isLong(side);
}

export function flipSide(side: number): number {
    return isLong(side) ? SIDE_SHORT : SIDE_LONG;
}
