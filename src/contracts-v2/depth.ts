import Decimal from "decimal.js";
import {BASIS_POINTS_DIVISOR, Q96, TOKEN_DECIMALS, USD_DECIMALS} from "../share/constants";
import {flipSide, isLong} from "../share/side";
import {min, mulDiv, toBigInt, toDecimal, toPriceDecimal} from "../share/util";

export interface Depth {
    premiumRateRangeX96: {left: bigint; right: bigint};
    marketPriceRangeX96: {left: bigint; right: bigint};
    tradePriceX96: bigint;
    tradePrice: Decimal;
    size: Decimal;
    total: Decimal;
}

/**
 * Calculate the depth of the market.
 * @example
 * ```ts
 *  const marketID = "0xbB6c466a26CECdbA3d7437704bfc34E112D27B83";
 *  const marketData = await loadMarket(marketID);
 *  const priceData = await loadPrice(marketID);
 *  const depth = calculateDepth(marketData, BigInt(priceData.index_price_x96));
 *  console.log("depth", depth);
 * ```
 * @param market The market data from api server
 * @param indexPriceX96 The index price of the token
 */
export function calculateDepth(market: any, indexPriceX96: bigint): {bids: Depth[]; asks: Depth[]} {
    const priceState = market.price_state;
    const priceVertices = convertPriceVertices(priceState);
    const position = market.global_liquidity_position;

    const currentIndex = searchCurrentIndex(priceVertices, BigInt(priceState.premium_rate_x96));

    const oppositeSidePriceVertices = transformPriceVerticesToOppositeSide(market, currentIndex, priceVertices);
    console.log(priceVertices, oppositeSidePriceVertices);

    const depths = transformPriceVerticesToDepth(
        toBigInt(position.net_size, TOKEN_DECIMALS),
        BigInt(priceState.premium_rate_x96),
        indexPriceX96,
        position.side,
        priceVertices,
        0n,
        currentIndex == 0 ? 1 : currentIndex,
    );

    let {depths: oppositeSideDepths, sizeTotal: oppositeSideSizeTotal} = transformUsedPriceVerticesToDepth(
        toBigInt(position.net_size, TOKEN_DECIMALS),
        BigInt(priceState.premium_rate_x96),
        indexPriceX96,
        position.side,
        currentIndex,
        priceVertices,
        priceState.liquidation_buffer_net_sizes.map((item: string) => BigInt(item)),
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
        if (premiumRateX96 > prev.premium_rate_x96 && premiumRateX96 <= next.premium_rate_x96) {
            currentIndex = i;
            break;
        }
    }
    return currentIndex;
}

function transformPriceVerticesToOppositeSide(market: any, currentIndex: number, priceVertices: any[]) {
    const priceState = market.price_state;
    const position = market.global_liquidity_position;

    let oppositeSidePriceVertices = [];
    if (currentIndex > 0 && priceState.pending_vertex_index > 0) {
        const indexPriceUsedX96 = BigInt(priceState.index_price_used_x96);
        const priceVerticesConfig = convertPriceVerticesConfig(market.market_config.price_config);
        const liquidity = min(
            toBigInt(position.liquidity, USD_DECIMALS),
            BigInt(market.market_config.price_config.max_price_impact_liquidity),
        );

        oppositeSidePriceVertices.push(priceVertices[0]);
        for (let i = 1; i <= priceState.pending_vertex_index; i++) {
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
        if (priceState.pending_vertex_index < priceVertices.length - 1) {
            const prev = oppositeSidePriceVertices[priceState.pending_vertex_index];
            const next = priceVertices[priceState.pending_vertex_index + 1];
            if (next.size <= prev.size || next.premiumRateX96 <= prev.premiumRateX96) {
                for (let i = priceState.pending_vertex_index + 1; i < priceVertices.length; i++) {
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
    let i = 0;
    for (let item of priceState.price_vertices) {
        target.push({
            id: i++,
            size: toBigInt(item.size, TOKEN_DECIMALS),
            premiumRateX96: BigInt(item.premium_rate_x96),
            raw: item,
        });
    }
    return target;
}

function convertPriceVerticesConfig(priceConfig: any) {
    const target = [];
    for (let item of priceConfig.vertices) {
        target.push({
            id: parseInt(item.id.split(":")[1]),
            balanceRate: BigInt(item.balance_rate),
            premiumRate: BigInt(item.premium_rate),
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
