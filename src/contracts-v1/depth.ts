import Decimal from "decimal.js";
import {BASIS_POINTS_DIVISOR, Q96, TOKEN_DECIMALS, USD_DECIMALS} from "./constants";
import {flipSide, isLong} from "./side";
import {min, mulDiv, toBigInt, toDecimal, toPriceDecimal} from "./util";

export interface Depth {
    premiumRateRangeX96: {left: bigint; right: bigint};
    marketPriceRangeX96: {left: bigint; right: bigint};
    tradePriceX96: bigint;
    tradePrice: Decimal;
    size: Decimal;
    total: Decimal;
}

/**
 * Calculate the depth of the pool.
 * @example
 * ```ts
 *  const poolID = "0xe8489d514aef77c5730dde4eac46b8f2d9ffd21c";
 *  const poolData = await loadPool(poolID);
 *  const priceData = await loadPrice(poolData.token.id);
 *  const depth = calculateDepth(poolData, BigInt(priceData.index_price_x96));
 *  console.log("depth", depth);
 * ```
 * @param pool The pool data from graphQL
 * @param indexPriceX96 The index price of the token
 */
export function calculateDepth(pool: any, indexPriceX96: bigint): {bids: Depth[]; asks: Depth[]} {
    const priceState = pool.priceState;
    const priceVertices = convertPriceVertices(priceState);
    const position = pool.globalLiquidityPosition;

    const currentIndex = searchCurrentIndex(priceVertices, BigInt(priceState.premiumRateX96));

    const oppositeSidePriceVertices = transformPriceVerticesToOppositeSide(pool, currentIndex, priceVertices);
    console.log(priceVertices, oppositeSidePriceVertices);

    const depths = transformPriceVerticesToDepth(
        toBigInt(position.netSize, TOKEN_DECIMALS),
        BigInt(priceState.premiumRateX96),
        indexPriceX96,
        position.side,
        priceVertices,
        0n,
        currentIndex == 0 ? 1 : currentIndex,
    );

    let {depths: oppositeSideDepths, sizeTotal: oppositeSideSizeTotal} = transformUsedPriceVerticesToDepth(
        toBigInt(position.netSize, TOKEN_DECIMALS),
        BigInt(priceState.premiumRateX96),
        indexPriceX96,
        position.side,
        currentIndex,
        priceVertices,
        priceState.liquidationBufferNetSizes.map((item: string) => BigInt(item)),
    );

    oppositeSideDepths = [
        ...oppositeSideDepths,
        ...transformPriceVerticesToDepth(
            0n,
            0n,
            indexPriceX96,
            flipSide(position.side),
            oppositeSidePriceVertices,
            oppositeSideSizeTotal,
            0,
        ),
    ];

    if (isLong(position.side)) {
        return {bids: depths, asks: oppositeSideDepths};
    } else {
        return {bids: oppositeSideDepths, asks: depths};
    }
}

function searchCurrentIndex(priceVertices: any, premiumRateX96: bigint) {
    let currentIndex = 0;
    for (let i = 1; i < priceVertices.length; i++) {
        const prev = priceVertices[i - 1];
        const next = priceVertices[i];
        if (premiumRateX96 > prev.premiumRateX96 && premiumRateX96 <= next.premiumRateX96) {
            currentIndex = i;
            break;
        }
    }
    return currentIndex;
}

function transformPriceVerticesToOppositeSide(pool: any, currentIndex: number, priceVertices: any[]) {
    const token = pool.token;
    const priceState = pool.priceState;
    const position = pool.globalLiquidityPosition;

    let oppositeSidePriceVertices = [];
    if (currentIndex > 0 && priceState.pendingVertexIndex > 0) {
        const indexPriceUsedX96 = BigInt(priceState.indexPriceUsedX96);
        const priceVerticesConfig = convertPriceVerticesConfig(token);
        const liquidity = min(toBigInt(position.liquidity, USD_DECIMALS), BigInt(token.maxPriceImpactLiquidity));

        oppositeSidePriceVertices.push(priceVertices[0]);
        for (let i = 1; i <= priceState.pendingVertexIndex; i++) {
            oppositeSidePriceVertices.push({
                id: i,
                ...calculatePriceVertex(
                    priceVerticesConfig[i].balanceRate,
                    priceVerticesConfig[i].premiumRate,
                    liquidity,
                    indexPriceUsedX96,
                ),
            });
        }
        if (priceState.pendingVertexIndex < priceVertices.length - 1) {
            const prev = oppositeSidePriceVertices[priceState.pendingVertexIndex];
            const next = priceVertices[priceState.pendingVertexIndex + 1];
            if (next.size <= prev.size || next.premiumRateX96 <= prev.premiumRateX96) {
                for (let i = priceState.pendingVertexIndex + 1; i < priceVertices.length; i++) {
                    oppositeSidePriceVertices.push({
                        id: i,
                        ...calculatePriceVertex(
                            priceVerticesConfig[i].balanceRate,
                            priceVerticesConfig[i].premiumRate,
                            liquidity,
                            indexPriceUsedX96,
                        ),
                    });
                }
            }
        }
        if (oppositeSidePriceVertices.length != priceVertices.length) {
            for (let i = oppositeSidePriceVertices.length; i < priceVertices.length; i++) {
                oppositeSidePriceVertices.push(priceVertices[i]);
            }
        }
    } else {
        oppositeSidePriceVertices = priceVertices;
    }

    return oppositeSidePriceVertices;
}

function transformPriceVerticesToDepth(
    netSize: bigint,
    premiumRateX96: bigint,
    indexPriceX96: bigint,
    side: number,
    priceVertices: any[],
    startSizeTotal: bigint,
    startIndex: number,
) {
    let sizeTotal = startSizeTotal;
    const depths = [];
    for (let i = startIndex; i < priceVertices.length; i++) {
        const right = priceVertices[i];
        const sizeAvailable = right.size - netSize;

        sizeTotal += sizeAvailable;

        if (sizeAvailable > 0n) {
            const depth = {
                premiumRateRangeX96: {
                    left: normalizePremiumRateX96(premiumRateX96, side),
                    right: normalizePremiumRateX96(right.premiumRateX96, side),
                },
                marketPriceRangeX96: {
                    left: calculateMarketPriceX96(indexPriceX96, premiumRateX96, side),
                    right: calculateMarketPriceX96(indexPriceX96, right.premiumRateX96, side),
                },
                tradePriceX96: 0n,
                tradePrice: new Decimal(0),
                size: toDecimal(sizeAvailable, TOKEN_DECIMALS),
                total: toDecimal(sizeTotal, TOKEN_DECIMALS),
            };
            depth.tradePriceX96 = calculateTradePriceX96(depth.marketPriceRangeX96);
            depth.tradePrice = toPriceDecimal(depth.tradePriceX96);
            depths.push(depth);
        }

        premiumRateX96 = right.premiumRateX96;
        netSize = right.size;
    }

    return depths;
}

function transformUsedPriceVerticesToDepth(
    netSize: bigint,
    premiumRateX96: bigint,
    indexPriceX96: bigint,
    side: number,
    currentIndex: number,
    priceVertices: any[],
    bufferNetSizes: bigint[],
) {
    let sizeTotal = 0n;
    const depths = [];
    for (let i = currentIndex; i > 0; i--) {
        const left = priceVertices[i - 1];

        // use buffer net size
        {
            if (bufferNetSizes[i] > 0n) {
                const sizeAvailable = bufferNetSizes[i];

                sizeTotal += sizeAvailable;

                const depth = {
                    premiumRateRangeX96: {
                        left: normalizePremiumRateX96(left.premiumRateX96, side),
                        right: normalizePremiumRateX96(left.premiumRateX96, side),
                    },
                    marketPriceRangeX96: {
                        left: calculateMarketPriceX96(indexPriceX96, left.premiumRateX96, side),
                        right: calculateMarketPriceX96(indexPriceX96, left.premiumRateX96, side),
                    },
                    tradePriceX96: 0n,
                    tradePrice: new Decimal(0),
                    size: toDecimal(sizeAvailable, TOKEN_DECIMALS),
                    total: toDecimal(sizeTotal, TOKEN_DECIMALS),
                };
                depth.tradePriceX96 = calculateTradePriceX96(depth.marketPriceRangeX96);
                depth.tradePrice = toPriceDecimal(depth.tradePriceX96);
                depths.push(depth);
            }
        }

        const sizeAvailable = netSize - left.size;

        sizeTotal += sizeAvailable;

        if (sizeAvailable > 0n) {
            const depth = {
                premiumRateRangeX96: {
                    left: normalizePremiumRateX96(premiumRateX96, side),
                    right: normalizePremiumRateX96(left.premiumRateX96, side),
                },
                marketPriceRangeX96: {
                    left: calculateMarketPriceX96(indexPriceX96, premiumRateX96, side),
                    right: calculateMarketPriceX96(indexPriceX96, left.premiumRateX96, side),
                },
                tradePriceX96: 0n,
                tradePrice: new Decimal(0),
                size: toDecimal(sizeAvailable, TOKEN_DECIMALS),
                total: toDecimal(sizeTotal, TOKEN_DECIMALS),
            };
            depth.tradePriceX96 = calculateTradePriceX96(depth.marketPriceRangeX96);
            depth.tradePrice = toPriceDecimal(depth.tradePriceX96);
            depths.push(depth);
        }
    }
    return {depths, sizeTotal};
}

function convertPriceVertices(priceState: any) {
    const target = [];
    for (let item of priceState.priceVertices) {
        target.push({
            id: parseInt(item.id.split(":")[1]),
            size: toBigInt(item.size, TOKEN_DECIMALS),
            premiumRateX96: BigInt(item.premiumRateX96),
            raw: item,
        });
    }
    return target;
}

function convertPriceVerticesConfig(token: any) {
    const target = [];
    for (let item of token.vertices) {
        target.push({
            id: parseInt(item.id.split(":")[1]),
            balanceRate: BigInt(item.balanceRate),
            premiumRate: BigInt(item.premiumRate),
            raw: item,
        });
    }
    return target;
}

function calculatePriceVertex(balanceRate: bigint, premiumRate: bigint, liquidity: bigint, indexPriceX96: bigint) {
    const balanceRateX96 = (Q96 * balanceRate) / BASIS_POINTS_DIVISOR;
    const size = mulDiv(balanceRateX96, liquidity, indexPriceX96);
    const premiumRateX96 = (Q96 * premiumRate) / BASIS_POINTS_DIVISOR;
    return {size, premiumRateX96};
}

function normalizePremiumRateX96(premiumRateX96: bigint, side: number) {
    return isLong(side) ? -premiumRateX96 : premiumRateX96;
}

function calculateMarketPriceX96(indexPriceX96: bigint, premiumRateX96: bigint, side: number) {
    if (isLong(side)) {
        return mulDiv(indexPriceX96, Q96 - premiumRateX96, Q96);
    } else {
        return mulDiv(indexPriceX96, Q96 + premiumRateX96, Q96);
    }
}

function calculateTradePriceX96(priceRangeX96: {left: bigint; right: bigint}) {
    return (priceRangeX96.left + priceRangeX96.right) / 2n;
}
