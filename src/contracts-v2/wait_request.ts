import fetch from "node-fetch";
import {ContractTransaction} from "ethers";
import {Config} from "./config";
import {decodeAPIServerResponse} from "../share/util";

export async function waitIncreaseRequest(market: string, txPromise: Promise<ContractTransaction>) {
    return waitRequest(txPromise, async (tx) => {
        const response = await fetch(`${Config.apiServerEndpoint}/v1/positions`, {
            method: "POST",
            body: JSON.stringify({
                account: tx.from,
                market: market,
                hashes: [tx.hash],
            }),
            headers: {"Content-Type": "application/json"},
        });
        const requests = (await decodeAPIServerResponse(response)).requests_by_hashes;
        if (requests === null || requests.length === 0) {
            return null;
        }
        return {
            status: requests[0].status,
            executedHash: requests[0].executed_hash,
            cancelledHash: requests[0].cancelled_hash,
            raw: requests,
        };
    });
}

export async function waitDecreaseRequest(market: string, txPromise: Promise<ContractTransaction>) {
    return waitIncreaseRequest(market, txPromise);
}

export async function waitIncreaseLiquidityRequest(market: string, txPromise: Promise<ContractTransaction>) {
    return waitRequest(txPromise, async (tx) => {
        const response = await fetch(`${Config.apiServerEndpoint}/v1/liquidity-positions`, {
            method: "POST",
            body: JSON.stringify({
                account: tx.from,
                market: market,
                hashes: [tx.hash],
            }),
            headers: {"Content-Type": "application/json"},
        });
        const requests = (await decodeAPIServerResponse(response)).requests_by_hashes;
        if (requests === null || requests.length === 0) {
            return null;
        }
        return {
            status: requests[0].status,
            executedHash: requests[0].executed_hash,
            cancelledHash: requests[0].cancelled_hash,
            raw: requests,
        };
    });
}

export async function waitDecreaseLiquidityRequest(market: string, txPromise: Promise<ContractTransaction>) {
    return waitIncreaseLiquidityRequest(market, txPromise);
}

export async function waitOrderBookRequest(market: string, txPromise: Promise<ContractTransaction>) {
    return waitRequest(txPromise, async (tx) => {
        const response = await fetch(`${Config.apiServerEndpoint}/v1/orders`, {
            method: "POST",
            body: JSON.stringify({
                account: tx.from,
                market: market,
                status: "OPENED",
                hashes: [tx.hash],
            }),
            headers: {"Content-Type": "application/json"},
        });
        const requests = (await decodeAPIServerResponse(response)).requests_by_hashes;
        if (requests === null || requests.length === 0) {
            return null;
        }
        return {
            status: "EXECUTED", // always executed for order book
            executedHash: requests[0].executed_hash,
            cancelledHash: requests[0].cancelled_hash,
            raw: requests,
        };
    });
}

async function waitRequest(
    txPromise: Promise<ContractTransaction>,
    doQuery: (
        tx: ContractTransaction,
    ) => Promise<{executedHash: string; cancelledHash: string; status: string; raw: any | undefined} | null>,
): Promise<any> {
    const tx = await txPromise;
    const receipt = await tx.wait();
    console.debug(`create request success, tx hash ${tx.hash}, status ${receipt.status}`);
    if (receipt.status !== 1) {
        throw new Error(`create request failed, tx hash ${tx.hash}, status ${receipt.status}`);
    }

    return new Promise((resolve, reject) => {
        let times = 0;
        const id = setInterval(async () => {
            times += 1;
            console.debug(`wait request ${times} times`);

            const rejectIfNeeded = () => {
                if (times >= Config.maxWaitTimes) {
                    clearInterval(id);
                    reject(new Error("wait request timeout"));
                }
            };

            const res = await doQuery(tx);
            if (res === null) {
                rejectIfNeeded();
                return;
            }

            if (res.status === "EXECUTED") {
                clearInterval(id);

                console.debug(`request executed, tx hash ${tx.hash}, executed hash ${res.executedHash}`);

                resolve(res);
                return;
            } else if (res.status === "CANCELLED") {
                clearInterval(id);

                reject(new Error(`request cancelled, tx hash ${tx.hash}, cancelled hash ${res.cancelledHash}`));
                return;
            }

            rejectIfNeeded();
        }, Config.waitInterval);
    });
}
