import Decimal from "decimal.js";
import {
    ADJUST_FUNDING_RATE_INTERVAL,
    BASIS_POINTS_DIVISOR,
    PREMIUM_RATE_CLAMP_BOUNDARY_X96,
    Q96,
    SAMPLE_PREMIUM_RATE_INTERVAL,
    USD_DECIMALS,
} from "./constants";
import {isLong} from "./side";
import {ceilDiv, mulDivUp, toBigInt} from "./util";
import {loadPool} from "./pool";

/**
 * Calculate the funding rate of the pool.
 * @example
 * ```ts
 *  const poolID = "0xe8489d514aef77c5730dde4eac46b8f2d9ffd21c";
 *  const poolData = await loadPool(poolID);
 *  const fundingRate = calculateFundingRate(poolData, new Date());
 *  console.log("fundingRate", fundingRate);
 * ```
 * @param pool The pool data from graphQL
 * @param currentTime The current time
 */
export function calculateFundingRate(pool: any, currentTime: Date): {fundingRateX96: bigint; fundingRate: Decimal} {
    const sample = pool.globalFundingRateSample;
    const position = pool.globalLiquidityPosition;
    const priceState = pool.priceState;
    const token = pool.token;
    const interestRate = BigInt(token.interestRate);
    let lastAdjustFundingRateTime = BigInt(pool.globalPosition.lastAdjustFundingRateTime);

    let currentTimestamp = BigInt(Math.floor(currentTime.getTime() / 1000));

    if (lastAdjustFundingRateTime + ADJUST_FUNDING_RATE_INTERVAL < currentTimestamp) {
        lastAdjustFundingRateTime = currentTimestamp - (currentTimestamp % ADJUST_FUNDING_RATE_INTERVAL);
        sample.cumulativePremiumRate = "0";
        sample.cumulativePremiumRateX96 = "0";
        sample.sampleCount = 0;
    }

    sample.cumulativePremiumRateX96 = BigInt(sample.cumulativePremiumRateX96);
    sample.sampleCount = BigInt(sample.sampleCount);

    const lastSamplingTime = lastAdjustFundingRateTime + sample.sampleCount * SAMPLE_PREMIUM_RATE_INTERVAL;
    const timeDelta = currentTimestamp - lastSamplingTime;

    const liquidity = toBigInt(position.liquidity, USD_DECIMALS);
    const maxPriceImpactLiquidity = BigInt(token.maxPriceImpactLiquidity);
    let premiumRateX96 = BigInt(priceState.premiumRateX96);
    premiumRateX96 =
        liquidity > maxPriceImpactLiquidity
            ? mulDivUp(premiumRateX96, maxPriceImpactLiquidity, liquidity)
            : premiumRateX96;

    premiumRateX96 = isLong(position.side) ? -premiumRateX96 : premiumRateX96;

    const sampleCountDelta = timeDelta / SAMPLE_PREMIUM_RATE_INTERVAL;
    const sampleCountAfter = sample.sampleCount + sampleCountDelta;
    const cumulativePremiumRateDeltaX96 =
        premiumRateX96 * (((sample.sampleCount + 1n + sampleCountAfter) * sampleCountDelta) >> 1n);
    const cumulativePremiumRateX96 = sample.cumulativePremiumRateX96 + cumulativePremiumRateDeltaX96;

    // sampleCountAfter * (1 + sampleCountAfter) / 2
    const denominator = 8n * ((BigInt(sampleCountAfter) * (1n + BigInt(sampleCountAfter))) / 2n);
    const premiumRateAvgX96 =
        cumulativePremiumRateX96 >= 0n
            ? ceilDiv(cumulativePremiumRateX96, denominator)
            : -ceilDiv(-BigInt(cumulativePremiumRateX96), denominator);

    const fundingRateDeltaX96 = premiumRateAvgX96 + clamp(premiumRateAvgX96, interestRate);
    return {
        fundingRateX96: fundingRateDeltaX96,
        fundingRate: new Decimal(fundingRateDeltaX96.toString()).div(Q96.toString()),
    };
}

function clamp(premiumRateAvgX96: bigint, interestRate: bigint): bigint {
    const interestRateX96 = mulDivUp(interestRate, Q96, BASIS_POINTS_DIVISOR);
    const rateDeltaX96 = interestRateX96 - premiumRateAvgX96;
    if (rateDeltaX96 > PREMIUM_RATE_CLAMP_BOUNDARY_X96) {
        return PREMIUM_RATE_CLAMP_BOUNDARY_X96;
    } else if (rateDeltaX96 < -PREMIUM_RATE_CLAMP_BOUNDARY_X96) {
        return -PREMIUM_RATE_CLAMP_BOUNDARY_X96;
    } else {
        return rateDeltaX96;
    }
}

async function main() {
    const poolID = "0xfdd12164c0ed5a588dac73c6d401cc08500c6a4c";
    const poolData = await loadPool(poolID);
    const fundingRate = calculateFundingRate(poolData, new Date());
    console.log("fundingRate", fundingRate);
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
