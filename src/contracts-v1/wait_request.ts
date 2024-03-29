import fetch from "node-fetch";
import {Config} from "./config";
import {decodeGraphQLResponse} from "../share/util";
import {ContractTransaction} from "ethers";

export async function waitIncreaseRequest(txPromise: Promise<ContractTransaction>) {
    return waitRequest(
        txPromise,
        (tx) => `
    query Requests {
        requests: increasePositionRequests(
          where: {createdHash: "${tx.hash}"}
        ) {
          acceptableTradePrice
          acceptableTradePriceX96
          account
          cancelledHash
          createdHash
          executedHash
          executionFee
          id
          index
          marginDelta
          pool
          side
          sizeDelta
          status
        }
      }
    `,
    );
}

export async function waitDecreaseRequest(txPromise: Promise<ContractTransaction>) {
    return waitRequest(
        txPromise,
        (tx) => `
    query Requests {
        requests: decreasePositionRequests(
          where: {createdHash: "${tx.hash}"}
        ) {
          acceptableTradePriceX96
          account
          cancelledHash
          createdHash
          executedHash
          executionFee
          acceptableTradePrice
          id
          index
          marginDelta
          pool
          receiver
          side
          sizeDelta
          status
        }
      }
    `,
    );
}

export async function waitOrderBookRequest(txPromise: Promise<ContractTransaction>) {
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

            const response = await fetch(`${Config.graphQLEndpoint}`, {
                method: "POST",
                body: JSON.stringify({
                    query: `
                    query Orders {
                        orders(
                          where: {createdHash: "${tx.hash}"}
                          orderBy: index
                          orderDirection: asc
                        ) {
                          acceptableTradePrice
                          acceptableTradePriceX96
                          account
                          cancelledHash
                          cancelledTimestamp
                          createdHash
                          createdTimestamp
                          executedHash
                          executedTimestamp
                          id
                          index
                          lastOperationTimestamp
                          marginDelta
                          receiver
                          side
                          sizeDelta
                          status
                          triggerAbove
                          triggerMarketPrice
                          triggerMarketPriceX96
                          type
                          updatedHash
                          updatedTimestamp
                        }
                      }
                    `,
                }),
                headers: {"Content-Type": "application/json"},
            });

            const requests = (await decodeGraphQLResponse(response)).orders;
            if (requests.length === 0) {
                rejectIfNeeded();
                return;
            }

            resolve(requests);
        }, Config.waitInterval);
    });
}

/**
 * Wait for the request to be executed or cancelled. If the request is executed, return the request.
 * If the request is cancelled or timeout, reject the promise.
 * @param txPromise The promise of the transaction
 * @param queryBuilder The function to build the query string
 */
async function waitRequest(txPromise: Promise<ContractTransaction>, queryBuilder: (tx: ContractTransaction) => string) {
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

            const response = await fetch(`${Config.graphQLEndpoint}`, {
                method: "POST",
                body: JSON.stringify({query: queryBuilder(tx)}),
                headers: {"Content-Type": "application/json"},
            });
            const requests = (await decodeGraphQLResponse(response)).requests;
            if (requests.length === 0) {
                rejectIfNeeded();
                return;
            }
            const request = requests[0];
            if (request.status === "Executed") {
                clearInterval(id);

                console.debug(`request executed, tx hash ${tx.hash}, executed hash ${request.executedHash}`);

                resolve(request);
                return;
            } else if (request.status === "Cancelled") {
                clearInterval(id);

                reject(`request cancelled, tx hash ${tx.hash}, cancelled hash ${request.cancelledHash}`);
                return;
            }

            rejectIfNeeded();
        }, Config.waitInterval);
    });
}
