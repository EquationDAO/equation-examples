import "dotenv/config";
import {ethers} from "ethers";
import {calculateDepth} from "./depth";
import {loadMarket} from "./market";
import {calculatePremiumRate} from "./premium_rate";
import {loadPrice} from "./price";
import {
    OrderBook__factory,
    PositionRouter__factory,
    Router__factory,
} from "../../typechain-types/factories/contracts-v2";
import {ERC20__factory} from "../../typechain-types";
import {loadGasConfig} from "./gas";
import {
    waitDecreaseLiquidityRequest,
    waitDecreaseRequest,
    waitIncreaseLiquidityRequest,
    waitIncreaseRequest,
    waitOrderBookRequest,
} from "./wait_request";
import {SIDE_LONG} from "../share/side";
import {mulDivUp} from "../share/util";
import {BASIS_POINTS_DIVISOR} from "../share/constants";
import {loadLiquidityPositions, loadPositions} from "./position";
import {OrderBook, PositionRouter} from "../../typechain-types/contracts-v2";

const rpc = "https://arbitrum.llamarpc.com";
const marketID = "0xA3185AC5F655a2a93769fe83A63c82A192405A54"; // STX
const slippage = 1_000_000n; // 1%

async function main() {
    const marketData = await loadMarket(marketID);
    console.log("marketData", marketData);

    let priceData = await loadPrice(marketID);
    console.log("priceData", priceData);

    const fundingRate = marketData.price_state.funding_rate;
    console.log("fundingRate", fundingRate);

    const premiumRate = calculatePremiumRate(marketData, BigInt(priceData.max_index_price_x96));
    console.log("premiumRate", premiumRate);

    const depth = calculateDepth(marketData, BigInt(priceData.index_price_x96));
    console.log("depth", depth);

    const {PositionRouter, OrderBook, wallet} = await example_approvePlugin();

    await example_position(wallet, PositionRouter);

    await example_limitOrder(wallet, OrderBook);

    await example_liquidityPosition(wallet, PositionRouter);
}

/**
 * Example of increasing and decreasing a position
 */
async function example_position(wallet: ethers.Wallet, positionRouter: PositionRouter) {
    const gasConfig = await loadGasConfig();

    let priceData = await loadPrice(marketID);

    let marketPriceX96 = BigInt(priceData.market_price_x96);
    // increase position
    const increaseResponse = await waitIncreaseRequest(
        marketID,
        positionRouter.createIncreasePosition(
            marketID,
            SIDE_LONG,
            300n * 10n ** 6n, // margin
            1n * 10n ** 18n, // size
            mulDivUp(marketPriceX96, BASIS_POINTS_DIVISOR + slippage, BASIS_POINTS_DIVISOR), // acceptable trade price
            {
                value: BigInt(gasConfig.position_execution_fee),
            },
        ),
    );
    console.log("increaseResponse", increaseResponse);

    priceData = await loadPrice(marketID);
    marketPriceX96 = BigInt(priceData.market_price_x96);

    // decrease position
    const decreasePosition = await waitDecreaseRequest(
        marketID,
        positionRouter.createDecreasePosition(
            marketID,
            SIDE_LONG,
            100n * 10n ** 6n, // margin
            1n * 10n ** 18n, // size
            mulDivUp(marketPriceX96, BASIS_POINTS_DIVISOR - slippage, BASIS_POINTS_DIVISOR),
            wallet.address, // receiver
            {
                value: BigInt(gasConfig.position_execution_fee),
            },
        ),
    );
    console.log("decreaseResponse", decreasePosition);

    priceData = await loadPrice(marketID);
    marketPriceX96 = BigInt(priceData.market_price_x96);

    // load positions
    const positions = await loadPositions(wallet.address);
    for (let position of positions) {
        console.log("position", position);
    }
}

/**
 * Example of increasing and decreasing a liquidity position
 */
async function example_liquidityPosition(wallet: ethers.Wallet, positionRouter: PositionRouter) {
    const gasConfig = await loadGasConfig();

    // increase liquidity position
    const increaseResponse = await waitIncreaseLiquidityRequest(
        marketID,
        positionRouter.createIncreaseLiquidityPosition(
            marketID,
            20n * 10n ** 6n, // margin 20 USD
            200n * 10n ** 6n, // liquidity 200 USD
            20n * 10n ** 6n, // acceptable min margin after increase
            {
                value: BigInt(gasConfig.position_execution_fee),
            },
        ),
    );
    console.log("increaseResponse", increaseResponse);

    // decrease liquidity position
    const decreasePosition = await waitDecreaseLiquidityRequest(
        marketID,
        positionRouter.createDecreaseLiquidityPosition(
            marketID,
            10n * 10n ** 6n, // margin 10 USD
            150n * 10n ** 6n, // liquidity 150 USD
            5n * 10n ** 6n, // acceptable min margin after decrease
            wallet.address,
            {
                value: BigInt(gasConfig.position_execution_fee),
            },
        ),
    );
    console.log("decreaseResponse", decreasePosition);

    // load positions
    const liquidityPositions = await loadLiquidityPositions(wallet.address);
    for (let position of liquidityPositions) {
        console.log("liquidityPosition", position);
    }
}

/**
 * Example of creating a limit order and canceling it
 */
async function example_limitOrder(wallet: ethers.Wallet, orderBook: OrderBook) {
    const gasConfig = await loadGasConfig();

    let priceData = await loadPrice(marketID);
    const marketPriceX96 = BigInt(priceData.market_price_x96);

    // create limit order
    const res = await waitOrderBookRequest(
        marketID,
        orderBook.createIncreaseOrder(
            marketID,
            SIDE_LONG,
            300n * 10n ** 6n, // margin
            1n * 10n ** 18n, // size
            mulDivUp(marketPriceX96, BASIS_POINTS_DIVISOR - slippage * 2n, BASIS_POINTS_DIVISOR), // acceptable trigger price
            false, // greater than or equal to trigger price if `true` and vice versa
            mulDivUp(marketPriceX96, BASIS_POINTS_DIVISOR - slippage, BASIS_POINTS_DIVISOR), // acceptable trade price
            {
                value: BigInt(gasConfig.order_execution_fee),
            },
        ),
    );

    // cancel limit order
    const tx = await orderBook.cancelIncreaseOrder(res.raw[0].index, wallet.address);
    const receipt = await tx.wait();
    console.debug(`cancel order success, tx hash ${tx.hash}, status ${receipt.status}`);
}

/**
 * Example of approving plugins to modify your positions and spending USD
 */
async function example_approvePlugin() {
    if (process.env.PRIVATE_KEY === undefined) {
        throw new Error("You MUST set PRIVATE_KEY in .env file");
    }

    const provider = new ethers.providers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(`${process.env.PRIVATE_KEY}`, provider);
    console.log("your address:", wallet.address);

    const Router = Router__factory.connect("0x6903c646D737Ea7EFC78B515050F3bBa9808D2F8", wallet);
    const PositionRouter = PositionRouter__factory.connect("0x0C2e09f9a752a0C9E2E9218aB239d212cdE6afd3", wallet);
    const OrderBook = OrderBook__factory.connect("0xF0cffc35eD6A82646fC0465f7c92C31a1A884D21", wallet);
    const USD = ERC20__factory.connect("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", wallet);

    // approve plugin to modify your position
    let isApproved = await Router.isPluginApproved(wallet.address, PositionRouter.address);
    if (!isApproved) {
        await Router.approvePlugin(PositionRouter.address);
        console.log("approve PositionRouter success");
    } else {
        console.log("PositionRouter already approved");
    }
    isApproved = await Router.isPluginApproved(wallet.address, OrderBook.address);
    if (!isApproved) {
        await Router.approvePlugin(OrderBook.address);
        console.log("approve OrderBook success");
    } else {
        console.log("OrderBook already approved");
    }

    // approve USD to Router
    const allowance = await USD.allowance(wallet.address, Router.address);
    if (allowance.toBigInt() !== 2n ** 256n - 1n) {
        await USD.approve(Router.address, 2n ** 256n - 1n);
        console.log("approve USD success");
    } else {
        console.log("USD already approved");
    }

    return {wallet, Router, PositionRouter, OrderBook, USD};
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
