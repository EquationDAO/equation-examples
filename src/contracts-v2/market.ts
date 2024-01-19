import fetch from "node-fetch";
import {Config} from "./config";
import {decodeAPIServerResponse} from "../share/util";

/**
 * Load market data from api server
 *
 * @param address The address of the market
 */
export async function loadMarket(address: string) {
    const response = await fetch(`${Config.apiServerEndpoint}/v1/markets/${address}`, {
        method: "GET",
    });
    return await decodeAPIServerResponse(response);
}
