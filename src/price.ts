import fetch from "node-fetch";
import {Config} from "./config";
import {decodeAPIServerResponse} from "./util";

export async function loadPrice(address: string) {
    const response = await fetch(`${Config.apiServerEndpoint}/v1/tokens/${address}`, {method: "GET"});
    return decodeAPIServerResponse(response);
}
