import Decimal from "decimal.js";
import {Q96} from "../share/constants";
import {mulDivUp} from "../share/util";

/**
 * Calculate the premium rate of the market.
 * @example
 * ```ts
 *  const marketID = "0xbB6c466a26CECdbA3d7437704bfc34E112D27B83";
 *  const market = await loadMarket(marketID);
 *  let priceData = await loadPrice(marketID);
 *  const premiumRate = calculatePremiumRate(market, priceData.max_index_price_x96);
 *  console.log("premiumRate", premiumRate);
 * ```
 * @param market The market data from api server
 * @param indexPriceX96 The index price of the market
 */
export async function calculatePremiumRate(market: any, indexPriceX96: bigint) {
    const priceState = market.price_state;
    let actualPremiumRateX96;
    if (priceState.premium_rate_x96 && indexPriceX96) {
        actualPremiumRateX96 = mulDivUp(
            BigInt(priceState.premium_rate_x96),
            BigInt(priceState.basis_index_price_x96),
            indexPriceX96,
        );
    } else {
        actualPremiumRateX96 = 0n;
    }
    return {
        premiumRateX96: actualPremiumRateX96,
        premiumRate: new Decimal(actualPremiumRateX96.toString()).div(Q96.toString()),
    };
}
