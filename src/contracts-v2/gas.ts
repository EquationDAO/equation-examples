import fetch from "node-fetch";
import {Config} from "./config";
import {decodeAPIServerResponse} from "../share/util";

/**
 * Load gas config from api server
 * @example
 * ```json
 * {
 *   "order_execution_fee": "400000000000000",
 *   "position_execution_fee": "300000000000000"
 * }
 * ```
 */
export async function loadGasConfig() {
    const response = await fetch(`${Config.apiServerEndpoint}/v1/contract/gas-config`, {
        method: "GET",
    });
    return await decodeAPIServerResponse(response);
}
