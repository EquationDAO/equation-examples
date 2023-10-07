import {ethers} from "ethers";
import {calculateFundingRate} from "./funding_rate";
import {loadPool} from "./pool";
import {calculatePremiumRate} from "./premium_rate";
import {loadPrice} from "./price";
import "dotenv/config";
import {ERC20__factory, PositionRouter__factory, Router__factory} from "../typechain-types";
import {SIDE_LONG} from "./side";
import {mulDivUp} from "./util";
import {BASIS_POINTS_DIVISOR} from "./constants";
import {waitDecreaseRequest, waitIncreaseRequest} from "./wait_request";

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
    const USD = ERC20__factory.connect("0x58e7F6b126eCC1A694B19062317b60Cf474E3D17", wallet);

    // approve plugin to modify your position
    const isApproved = await Router.isPluginApproved(wallet.address, PositionRouter.address);
    if (!isApproved) {
        await Router.approvePlugin(PositionRouter.address);
        console.log("approve plugin success");
    } else {
        console.log("plugin already approved");
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
    const marketPriceX96 = BigInt(priceData.market_price_x96);
    const slippage = 1_000_000n; // 1%

    // increase position
    const increaseResponse = await waitIncreaseRequest(
        PositionRouter.createIncreasePosition(
            poolID,
            SIDE_LONG,
            300n * 10n ** 6n, // margin
            1n * 10n ** 18n, // size
            mulDivUp(marketPriceX96, BASIS_POINTS_DIVISOR + slippage, BASIS_POINTS_DIVISOR),
            {
                value: executionFee,
            },
        ),
    );
    console.log("increaseResponse", increaseResponse);

    priceData = await loadPrice(poolData.token.id);
    console.log("priceData", priceData);

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
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
