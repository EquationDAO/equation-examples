import fetch from "node-fetch";
import {Config} from "./config";
import {decodeAPIServerResponse} from "../share/util";

/**
 * load price data from api server
 * @example
 * ```ts
 * {
 *    "id": 2,
 *    "address": "0x23EEF5f7A8b37b2310e9aC9611E35fa999143810",
 *    "market_price_x96": "188956527944421047415",
 *    "market_price": "2384.966682906486408802",
 *    "min_market_price_x96": "188956527944421047415",
 *    "min_market_price": "2384.966682906486408802",
 *    "max_market_price_x96": "188956527944421047415",
 *    "max_market_price": "2384.966682906486408802",
 *    "index_price_x96": "188670645038030999197",
 *    "index_price": "2381.358333333333333322",
 *    "min_index_price_x96": "188670645038030999197",
 *    "min_index_price": "2381.358333333333333322",
 *    "max_index_price_x96": "188670645038030999197",
 *    "max_index_price": "2381.358333333333333322"
 * }
 * ```
 * @access https://api-arbitrum.equation.org/v1/tokens/0x23eef5f7a8b37b2310e9ac9611e35fa999143810
 * @param address The address of the token, not the pool.
 */
export async function loadPrice(address: string) {
    const response = await fetch(`${Config.apiServerEndpoint}/v1/tokens/${address}`, {method: "GET"});
    return decodeAPIServerResponse(response);
}
