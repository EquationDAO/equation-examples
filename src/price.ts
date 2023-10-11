import fetch from "node-fetch";
import {Config} from "./config";
import {decodeAPIServerResponse} from "./util";

/**
 * load price data from api server
 * @example
 * ```ts
 *  {
 *      address: '0xECF628c20E5E1C0e0A90226d60FAd547AF850E0F',
 *      market_price_x96: '123108664984260826597',
 *      market_price: '1553.849806400548395765',
 *      min_market_price_x96: '123108664984260826597',
 *      min_market_price: '1553.849806400548395765',
 *      max_market_price_x96: '123108664984260826597',
 *      max_market_price: '1553.849806400548395765',
 *      index_price_x96: '123111717402352687768',
 *      index_price: '1553.888333333333333316',
 *      min_index_price_x96: '123111717402352687768',
 *      min_index_price: '1553.888333333333333316',
 *      max_index_price_x96: '123111717402352687768',
 *      max_index_price: '1553.888333333333333316'
 *  }
 * ```
 * @access https://api-arbitrum-goerli.equation.org/v1/tokens/0xECF628c20E5E1C0e0A90226d60FAd547AF850E0F
 * @param address The address of the token, not the pool.
 */
export async function loadPrice(address: string) {
    const response = await fetch(`${Config.apiServerEndpoint}/v1/tokens/${address}`, {method: "GET"});
    return decodeAPIServerResponse(response);
}
