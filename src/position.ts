import mustache from "mustache";
import fetch from "node-fetch";
import {Config} from "./config";
import {decodeGraphQLResponse} from "./util";

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
