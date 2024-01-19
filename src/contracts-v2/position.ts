import fetch from "node-fetch";
import {Config} from "./config";
import {decodeAPIServerResponse} from "../share/util";

/**
 * Load positions from api server
 * @example
 * ```ts
 *  // load all liquidity positions
 *  const positions = await loadLiquidityPositions("0x000b64153316d84a652973a43b096a460384f988");
 *  console.log("positions", positions);
 *
 *  // load positions of a market
 *  const positions = await loadLiquidityPositions("0x000b64153316d84a652973a43b096a460384f988", "0xe8489d514aef77c5730dde4eac46b8f2d9ffd21c");
 *  console.log("positions", positions);
 * ```
 * @param account The address of the account
 * @param market The address of the market. Optional.
 */
export async function loadLiquidityPositions(account: string, market?: string) {
    const response = await fetch(`${Config.apiServerEndpoint}/v1/liquidity-positions`, {
        method: "POST",
        body: JSON.stringify({
            account: account,
            market: market,
        }),
        headers: {"Content-Type": "application/json"},
    });
    return (await decodeAPIServerResponse(response)).liquidity_positions;
}

/**
 * Load positions from api server
 * @example
 * ```ts
 *  // load all positions
 *  const positions = await loadPositions("0x000b64153316d84a652973a43b096a460384f988");
 *  console.log("positions", positions);
 *
 *  // load positions of a market
 *  const positions = await loadPositions("0x000b64153316d84a652973a43b096a460384f988", "0xe8489d514aef77c5730dde4eac46b8f2d9ffd21c");
 *  console.log("positions", positions);
 * ```
 * @param account The address of the account
 * @param market The address of the market. Optional.
 */
export async function loadPositions(account: string, market?: string) {
    const response = await fetch(`${Config.apiServerEndpoint}/v1/positions`, {
        method: "POST",
        body: JSON.stringify({
            account: account,
            market: market,
        }),
        headers: {"Content-Type": "application/json"},
    });
    return (await decodeAPIServerResponse(response)).positions;
}
