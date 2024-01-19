import mustache from "mustache";
import fetch from "node-fetch";
import {Config} from "./config";
import {decodeGraphQLResponse} from "../share/util";

/**
 * Load positions from graphQL
 * @example
 * ```ts
 *  // load all positions
 *  const positions = await loadPositions("0x000b64153316d84a652973a43b096a460384f988");
 *  console.log("positions", positions);
 *
 *  // load positions of a pool
 *  const positions = await loadPositions("0x000b64153316d84a652973a43b096a460384f988", "0xe8489d514aef77c5730dde4eac46b8f2d9ffd21c");
 *  console.log("positions", positions);
 * ```
 * @access https://graph-arbitrum.equation.org/subgraphs/name/equation-arbitrum/graphql?query=++++query+Positions+%7B%0A++++++++positions%28%0A++++++++++where%3A+%7Baccount%3A+%220x000b64153316d84a652973a43b096a460384f988%22%2C+pool%3A+%220xe8489d514aef77c5730dde4eac46b8f2d9ffd21c%22%2C+size_gt%3A+%220%22%7D%0A++++++++%29+%7B%0A++++++++++account%0A++++++++++entryBlockNumber%0A++++++++++entryPrice%0A++++++++++entryPriceX96%0A++++++++++entryTime%0A++++++++++entryTxHash%0A++++++++++fundingFee%0A++++++++++fundingRateGrowthX96%0A++++++++++id%0A++++++++++lastBlockNumber%0A++++++++++lastBlockTimestamp%0A++++++++++lastTxHash%0A++++++++++leverage%0A++++++++++liquidity%0A++++++++++margin%0A++++++++++marginDecreased%0A++++++++++marginIncreased%0A++++++++++positionHistoryID%0A++++++++++realizedPnL%0A++++++++++side%0A++++++++++size%0A++++++++++tradingFee%0A++++++++++tradingFeeByClosing%0A++++++++++pool+%7B%0A++++++++++++id%0A++++++++++%7D%0A++++++++%7D%0A++++++%7D
 * @param account The address of the account
 * @param pool The address of the pool, not the token. Optional.
 * @returns
 */
export async function loadPositions(account: string, pool?: string) {
    const obj = {
        account: account,
        pool: pool,
    };
    const query = mustache.render(
        `
    query Positions {
        positions(
          where: {account: "{{account}}", {{#pool}} pool: "{{pool}}", {{/pool}} size_gt: "0"}
        ) {
          account
          entryBlockNumber
          entryPrice
          entryPriceX96
          entryTime
          entryTxHash
          fundingFee
          fundingRateGrowthX96
          id
          lastBlockNumber
          lastBlockTimestamp
          lastTxHash
          leverage
          liquidity
          margin
          marginDecreased
          marginIncreased
          positionHistoryID
          realizedPnL
          side
          size
          tradingFee
          tradingFeeByClosing
          pool {
            id
          }
        }
      }
    `,
        obj,
    );
    const response = await fetch(`${Config.graphQLEndpoint}`, {
        method: "POST",
        body: JSON.stringify({
            query: query,
        }),
        headers: {"Content-Type": "application/json"},
    });
    return (await decodeGraphQLResponse(response)).positions;
}
