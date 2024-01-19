import Decimal from "decimal.js";
import {Q96} from "../share/constants";
import {isLong} from "../share/side";

/**
 * Calculate the premium rate of the pool.
 * @example
 * ```ts
 *  const poolID = "0xe8489d514aef77c5730dde4eac46b8f2d9ffd21c";
 *  const poolData = await loadPool(poolID);
 *  const premiumRate = calculatePremiumRate(poolData);
 *  console.log("premiumRate", premiumRate);
 * ```
 * @param pool The pool data from graphQL
 */
export function calculatePremiumRate(pool: any): {premiumRateX96: bigint; premiumRate: Decimal} {
    const priceState = pool.priceState;
    let premiumRateX96 = BigInt(priceState.premiumRateX96);

    const position = pool.globalLiquidityPosition;
    premiumRateX96 = isLong(position.side) ? -premiumRateX96 : premiumRateX96;
    return {
        premiumRateX96,
        premiumRate: new Decimal(premiumRateX96.toString()).div(Q96.toString()),
    };
}
