import {Response} from "node-fetch";
import Decimal from "decimal.js";
import {TOKEN_DECIMALS, USD_DECIMALS} from "./constants";

export async function decodeGraphQLResponse(response: Response) {
    const json = await response.json();
    if (json.error) {
        throw new Error(`GraphQL server error: ${json.error}`);
    }
    if (json.errors) {
        throw new Error(`GraphQL server error: ${json.errors[0].message}`);
    }
    return json.data;
}

export async function decodeAPIServerResponse(response: Response) {
    const json = await response.json();
    if (json.code !== 200) {
        throw new Error(`API server error: ${json.message}`);
    }
    return json.data;
}

export function toBigInt(value: string, decimals: number) {
    return BigInt(new Decimal(value).mul(new Decimal(10).pow(decimals)).toFixed(0));
}

export function toDecimal(value: bigint, decimals: number) {
    return new Decimal(value.toString()).div(new Decimal(10).pow(decimals));
}

export function toPriceDecimal(priceX96: bigint) {
    return new Decimal(priceX96.toString())
        .div(new Decimal(2).pow(96))
        .mul(new Decimal(10).pow(TOKEN_DECIMALS))
        .div(new Decimal(10).pow(USD_DECIMALS));
}

export function mulDiv(a: bigint, b: bigint, c: bigint) {
    return (a * b) / c;
}

export function mulDivUp(a: bigint, b: bigint, c: bigint) {
    let mulAns = a * b;
    let divAns = mulAns / c;
    if (mulAns % c !== 0n) {
        divAns += 1n;
    }
    return divAns;
}

export function ceilDiv(a: bigint, b: bigint) {
    if (b === 0n) {
        return a / b;
    }

    return a === 0n ? 0n : (a - 1n) / b + 1n;
}

export function min(a: bigint, b: bigint) {
    return a < b ? a : b;
}

export function max(a: bigint, b: bigint) {
    return a > b ? a : b;
}

export function abs(a: bigint) {
    return a >= 0n ? a : -a;
}
