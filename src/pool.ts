import fetch from "node-fetch";
import {Config} from "./config";
import {decodeGraphQLResponse} from "./util";

/**
 * Load pool data from graphQL
 *  * @example
 * ```ts
 *  const poolID = "0xe8489d514aef77c5730dde4eac46b8f2d9ffd21c";
 *  const poolData = await loadPool(poolID);
 *  console.log("poolData", poolData);
 * ```
 * @access https://graph-arbitrum.equation.org/subgraphs/name/equation-arbitrum/graphql?query=query+Pool+%7B%0A++pool%28id%3A+%220xe8489d514aef77c5730dde4eac46b8f2d9ffd21c%22%29+%7B%0A++++id%0A++++protocolFee%0A++++referralFee%0A++++riskBufferFundGovUsed%0A++++totalProtocolFee%0A++++totalReferralFee%0A++++volume%0A++++volumeUSD%0A++++token+%7B%0A++++++id%0A++++++decimals%0A++++++name%0A++++++symbol%0A++++++interestRate%0A++++++liquidationExecutionFee%0A++++++liquidationFeeRatePerPosition%0A++++++liquidationVertexIndex%0A++++++liquidityFeeRate%0A++++++maxFundingRate%0A++++++maxLeveragePerLiquidityPosition%0A++++++maxLeveragePerPosition%0A++++++protocolFeeRate%0A++++++referralDiscountRate%0A++++++referralParentReturnFeeRate%0A++++++referralReturnFeeRate%0A++++++tradingFeeRate%0A++++++minMarginPerPosition%0A++++++minMarginPerLiquidityPosition%0A++++++maxRiskRatePerLiquidityPosition%0A++++++maxPriceImpactLiquidity%0A++++++vertices%28orderBy%3A+id%2C+orderDirection%3A+asc%29+%7B%0A++++++++balanceRate%0A++++++++id%0A++++++++premiumRate%0A++++++%7D%0A++++%7D%0A++++priceState+%7B%0A++++++id%0A++++++indexPriceUsedX96%0A++++++liquidationBufferNetSizes%0A++++++pendingVertexIndex%0A++++++premiumRateX96%0A++++++priceVertices%28orderBy%3A+id%2C+orderDirection%3A+asc%29+%7B%0A++++++++size%0A++++++++premiumRateX96%0A++++++++id%0A++++++%7D%0A++++%7D%0A++++globalFundingRateSample+%7B%0A++++++cumulativePremiumRate%0A++++++cumulativePremiumRateX96%0A++++++sampleCount%0A++++%7D%0A++++globalLiquidityPosition+%7B%0A++++++tradingFee%0A++++++side%0A++++++realizedProfitGrowthX64%0A++++++realizedProfitGrowth%0A++++++realizedProfit%0A++++++netSize%0A++++++margin%0A++++++liquidity%0A++++++liquidationBufferNetSize%0A++++++entryPriceX96%0A++++++entryPrice%0A++++%7D%0A++++globalPosition+%7B%0A++++++fundingRate%0A++++++fundingRateX96%0A++++++lastAdjustFundingRateTime%0A++++++longFundingRateGrowth%0A++++++longFundingRateGrowthX96%0A++++++longSize%0A++++++margin%0A++++++shortFundingRateGrowth%0A++++++shortFundingRateGrowthX96%0A++++++shortSize%0A++++%7D%0A++++globalRiskBufferFund+%7B%0A++++++liquidity%0A++++++riskBufferFund%0A++++%7D%0A++++globalUnrealizedLossMetrics+%7B%0A++++++lastZeroLossTime%0A++++++liquidity%0A++++++liquidityTimesUnrealizedLoss%0A++++%7D%0A++%7D%0A%7D
 * @param address The address of the pool, not the token.
 */
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
