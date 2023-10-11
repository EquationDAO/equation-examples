import fetch from "node-fetch";
import {Config} from "./config";
import {decodeGraphQLResponse} from "./util";

// load pools
export async function loadPool(address: string) {
    const response = await fetch(`${Config.graphQLEndpoint}`, {
        method: "POST",
        body: JSON.stringify({
            query: `
            query Pool {
              pool(id: "${address}") {
                id
                protocolFee
                referralFee
                riskBufferFundGovUsed
                totalProtocolFee
                totalReferralFee
                volume
                volumeUSD
                token {
                  id
                  decimals
                  name
                  symbol
                  interestRate
                  liquidationExecutionFee
                  liquidationFeeRatePerPosition
                  liquidationVertexIndex
                  liquidityFeeRate
                  maxFundingRate
                  maxLeveragePerLiquidityPosition
                  maxLeveragePerPosition
                  protocolFeeRate
                  referralDiscountRate
                  referralParentReturnFeeRate
                  referralReturnFeeRate
                  tradingFeeRate
                  minMarginPerPosition
                  minMarginPerLiquidityPosition
                  maxRiskRatePerLiquidityPosition
                  maxPriceImpactLiquidity
                  vertices(orderBy: id, orderDirection: asc) {
                    balanceRate
                    id
                    premiumRate
                  }
                }
                priceState {
                  id
                  indexPriceUsedX96
                  liquidationBufferNetSizes
                  pendingVertexIndex
                  premiumRateX96
                  priceVertices(orderBy: id, orderDirection: asc) {
                    size
                    premiumRateX96
                    id
                  }
                }
                globalFundingRateSample {
                  cumulativePremiumRate
                  cumulativePremiumRateX96
                  sampleCount
                }
                globalLiquidityPosition {
                  tradingFee
                  side
                  realizedProfitGrowthX64
                  realizedProfitGrowth
                  realizedProfit
                  netSize
                  margin
                  liquidity
                  liquidationBufferNetSize
                  entryPriceX96
                  entryPrice
                }
                globalPosition {
                  fundingRate
                  fundingRateX96
                  lastAdjustFundingRateTime
                  longFundingRateGrowth
                  longFundingRateGrowthX96
                  longSize
                  margin
                  shortFundingRateGrowth
                  shortFundingRateGrowthX96
                  shortSize
                }
                globalRiskBufferFund {
                  liquidity
                  riskBufferFund
                }
                globalUnrealizedLossMetrics {
                  lastZeroLossTime
                  liquidity
                  liquidityTimesUnrealizedLoss
                }
              }
            }
    `,
        }),
        headers: {"Content-Type": "application/json"},
    });
    return (await decodeGraphQLResponse(response)).pool;
}
