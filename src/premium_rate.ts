import Decimal from "decimal.js";
import {Q96} from "./constants";
import {isLong} from "./side";

export function calculatePremiumRate(pool: any) {
    const priceState = pool.priceState;
    let premiumRateX96 = BigInt(priceState.premiumRateX96);

    const position = pool.globalLiquidityPosition;
    premiumRateX96 = isLong(position.side) ? Q96 - premiumRateX96 : Q96 + premiumRateX96;
    return {
        premiumRateX96,
        premiumRate: new Decimal(premiumRateX96.toString()).div(Q96.toString()),
    };
}
