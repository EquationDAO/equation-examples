export const SIDE_LONG = 1;
export const SIDE_SHORT = 2;

export function isLong(side: number): boolean {
    return side === SIDE_LONG;
}

export function isShort(side: number): boolean {
    return !isLong(side);
}
