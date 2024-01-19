import fetch from "node-fetch";
import {Config} from "./config";
import {decodeAPIServerResponse} from "../share/util";

/**
 * load price data from api server
 * @example
 * ```ts
 * {
 *    "address": "0xbB6c466a26CECdbA3d7437704bfc34E112D27B83",
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
 * @access https://api-v2-arbitrum.equation.org/v1/prices/0xbB6c466a26CECdbA3d7437704bfc34E112D27B83
 * @param address The address of the market
 */
export async function loadPrice(address: string) {
    const response = await fetch(`${Config.apiServerEndpoint}/v1/prices/${address}`, {method: "GET"});
    return decodeAPIServerResponse(response);
}
