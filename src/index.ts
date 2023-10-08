import {ethers} from "ethers";
import {calculateFundingRate} from "./funding_rate";
import {loadPool} from "./pool";
import {calculatePremiumRate} from "./premium_rate";
import {loadPrice} from "./price";
import "dotenv/config";
import {ERC20__factory, PositionRouter__factory, Router__factory, OrderBook__factory} from "../typechain-types";
import {SIDE_LONG} from "./side";
import {mulDivUp} from "./util";
import {BASIS_POINTS_DIVISOR} from "./constants";
import {waitDecreaseRequest, waitIncreaseRequest, waitOrderBookRequest} from "./wait_request";
import {loadPositions} from "./position";

async function main() {
    const poolID = "0x5dcbeceb35a0e781ed60d859a97bf239ba5bf7dc";
    const poolData = await loadPool(poolID);
    console.log("poolData", poolData);

    let priceData = await loadPrice(poolData.token.id);
    console.log("priceData", priceData);

    const fundingRate = calculateFundingRate(poolData, new Date());
    console.log("fundingRate", fundingRate);

    const premiumRate = calculatePremiumRate(poolData);
    console.log("premiumRate", premiumRate);

    const provider = new ethers.providers.JsonRpcProvider("https://arbitrum-goerli.publicnode.com");
    const wallet = new ethers.Wallet(`${process.env.PRIVATE_KEY}`, provider);
    console.log("your address:", wallet.address);

    const Router = Router__factory.connect("0xcb4010f59be885E4A8c85143d78e612EC143FBd6", wallet);
    const PositionRouter = PositionRouter__factory.connect("0xA9e98bE3a42724E763B521AE16F6923d2b6597E3", wallet);
    const OrderBook = OrderBook__factory.connect("0x7A41fF48ab803D1991Deb2Fa56229534c86436a1", wallet);
    const USD = ERC20__factory.connect("0x58e7F6b126eCC1A694B19062317b60Cf474E3D17", wallet);

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

    const executionFee = await PositionRouter.minExecutionFee();
    console.log("executionFee", ethers.utils.formatEther(executionFee));
    let marketPriceX96 = BigInt(priceData.market_price_x96);
    const slippage = 1_000_000n; // 1%

    // increase position
    const increaseResponse = await waitIncreaseRequest(
        PositionRouter.createIncreasePosition(
            poolID,
            SIDE_LONG,
            300n * 10n ** 6n, // margin
            1n * 10n ** 18n, // size
            mulDivUp(marketPriceX96, BASIS_POINTS_DIVISOR + slippage, BASIS_POINTS_DIVISOR), // acceptable trade price
            {
                value: executionFee,
            },
        ),
    );
    console.log("increaseResponse", increaseResponse);

    priceData = await loadPrice(poolData.token.id);
    console.log("priceData", priceData);
    marketPriceX96 = BigInt(priceData.market_price_x96);

    // decrease position
    const decreaseResponse = await waitDecreaseRequest(
        PositionRouter.createDecreasePosition(
            poolID,
            SIDE_LONG,
            100n * 10n ** 6n, // margin
            1n * 10n ** 18n, // size
            mulDivUp(marketPriceX96, BASIS_POINTS_DIVISOR - slippage, BASIS_POINTS_DIVISOR),
            wallet.address, // receiver
            {
                value: executionFee,
            },
        ),
    );
    console.log("decreaseResponse", decreaseResponse);

    priceData = await loadPrice(poolData.token.id);
    console.log("priceData", priceData);
    marketPriceX96 = BigInt(priceData.market_price_x96);

    let orderBookExecutionFee = await OrderBook.minExecutionFee();
    console.log("orderBookExecutionFee", ethers.utils.formatEther(orderBookExecutionFee));
    // create limit order
    const orders = await waitOrderBookRequest(
        OrderBook.createIncreaseOrder(
            poolID,
            SIDE_LONG,
            300n * 10n ** 6n, // margin
            1n * 10n ** 18n, // size
            mulDivUp(marketPriceX96, BASIS_POINTS_DIVISOR - slippage * 2n, BASIS_POINTS_DIVISOR), // acceptable trigger price
            false, // greater than or equal to trigger price if `true` and vice versa
            mulDivUp(marketPriceX96, BASIS_POINTS_DIVISOR - slippage, BASIS_POINTS_DIVISOR), // acceptable trade price
            {
                value: orderBookExecutionFee,
            },
        ),
    );

    // cancel limit order
    const tx = await OrderBook.cancelIncreaseOrder(orders[0].index, wallet.address);
    const receipt = await tx.wait();
    console.debug(`cancel order success, tx hash ${tx.hash}, status ${receipt.status}`);

    // load positions
    const positions = await loadPositions(wallet.address);
    for (let position of positions) {
        console.log("position", position);
    }
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
