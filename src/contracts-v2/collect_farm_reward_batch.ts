import "dotenv/config";
import fetch from "node-fetch";
import {ethers} from "ethers";
import {decodeAPIServerResponse} from "../share/util";
import {RewardCollector__factory} from "../../typechain-types/factories/contracts-v2";

const rpc = "https://arbitrum.llamarpc.com";

async function main() {
    if (process.env.PRIVATE_KEY === undefined) {
        throw new Error("You MUST set PRIVATE_KEY in .env file");
    }

    const provider = new ethers.providers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(`${process.env.PRIVATE_KEY}`, provider);
    console.log("your address:", wallet.address);

    const account = wallet.address;
    const rewardType = "V2_LIQUIDITY";
    const lockupPeriod = 360; // 0 for no lockup, 90 for 90 days lockup, 180 for 180 days lockup, 360 for 360 days lockup
    const response = await await fetch(
        `https://api-arbitrum.equation.trade/v1/farm/claim-v2?account=${account}&reward_type=${rewardType}&lockup_period=${lockupPeriod}`,
        {
            method: "GET",
        },
    );
    const calldata = (await decodeAPIServerResponse(response)).calldata;
    console.log("calldata: ", calldata);
    if (!calldata) {
        console.log("No reward to claim");
        return;
    }

    const RewardCollector = RewardCollector__factory.connect("0x1eB79ac7f26a667CD3A40888f6c92f22877A0d8d", wallet);
    const tx = await RewardCollector.multicall([calldata]);
    console.log("Reward claim success, tx hash", tx.hash);
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
