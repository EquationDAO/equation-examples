import Decimal from "decimal.js";
import {
    ADJUST_FUNDING_RATE_INTERVAL,
    BASIS_POINTS_DIVISOR,
    PREMIUM_RATE_AVG_DENOMINATOR,
    PREMIUM_RATE_CLAMP_BOUNDARY_X96,
    Q96,
    SAMPLE_PREMIUM_RATE_INTERVAL,
} from "./constants";
import {isLong} from "./side";
import {ceilDiv, mulDivUp, toBigInt} from "./util";

export function calculateFundingRate(pool: any, currentTime: Date) {
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
    // next hour
    currentTimestamp = lastAdjustFundingRateTime + ADJUST_FUNDING_RATE_INTERVAL;

    sample.cumulativePremiumRateX96 = BigInt(sample.cumulativePremiumRateX96);
    sample.sampleCount = BigInt(sample.sampleCount);

    const lastSamplingTime = lastAdjustFundingRateTime + sample.sampleCount * SAMPLE_PREMIUM_RATE_INTERVAL;
    const timeDelta = currentTimestamp - lastSamplingTime;

    const liquidity = toBigInt(position.liquidity, token.decimals);
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

    const premiumRateAvgX96 =
        cumulativePremiumRateX96 >= 0n
            ? ceilDiv(cumulativePremiumRateX96, PREMIUM_RATE_AVG_DENOMINATOR)
            : -ceilDiv(-BigInt(cumulativePremiumRateX96), PREMIUM_RATE_AVG_DENOMINATOR);

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