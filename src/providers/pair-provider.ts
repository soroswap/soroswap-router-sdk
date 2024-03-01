import { ChainId, Protocols } from "../constants";
import { contractInvoke } from "@soroban-react/contracts";
import { SorobanContextType } from "@soroban-react/core";
import { Token, Pair, CurrencyAmount } from "../entities";
import { Address, scValToNative, xdr } from "stellar-sdk";

/**
 * @ignore
 * Represents a pair as returned from the API, including token addresses and reserves.
 */
export interface PairFromApi {
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
}

/**
 * @ignore
 * Maps ChainId to its corresponding network name.
 */
export const chainIdToName = {
  [ChainId.TESTNET]: "testnet",
  [ChainId.STANDALONE]: "standalone",
  [ChainId.FUTURENET]: "futurenet",
};

/**
 * Provides functionality to fetch and cache pairs from a backend API, based on the specified blockchain network.
 *
 * ```typescript
 * const pairProvider = new PairProvider(ChainId.TESTNET, "https://api.example.com", "api-key", 20);
 * ```
 */
export class PairProvider {
  private _chainId: ChainId;
  private _backendUrl: string;
  private _backendApiKey: string;
  private _cache: {
    [x: string]: { pairs: Pair[]; timestamp: number };
  };
  private _cacheInSeconds: number;
  /**
   * Initializes a new instance of the PairProvider.
   *
   * @param chainId The blockchain network ID to operate on.
   * @param backendUrl The backend URL used to fetch pair information.
   * @param backendApiKey The API key for authenticating with the backend.
   * @param cacheInSeconds (Optional) The time in seconds to cache pair data, defaulting to 20 seconds.
   */
  constructor(
    chainId: ChainId,
    backendUrl: string,
    backendApiKey: string,
    cacheInSeconds: number = 20
  ) {
    this._chainId = chainId;
    this._backendUrl = backendUrl;
    this._backendApiKey = backendApiKey;
    this._cacheInSeconds = cacheInSeconds;
    this._cache = {};
  }

  /**
   * Fetches all pairs from the backend API, caching them to reduce API calls. If cached pairs are still valid, returns them instead of fetching anew.
   *
   * @returns A promise that resolves to an array of Pair instances representing all pairs fetched from the backend, or an empty array in case of an error.
   */
  public async getPairsFromBackend(
    protocols: Protocols[] = [Protocols.SOROSWAP]
  ): Promise<Pair[]> {
    const chainName = chainIdToName[this._chainId];

    const aggProtocols = protocols.reduce(
      (acc, protocol) => acc + `&protocols=${protocol}`,
      ""
    );

    let endpointUrl = `${this._backendUrl}/pairs/all?network=${chainName}${aggProtocols}`;

    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        apiKey: this._backendApiKey,
        "Content-Type": "application/json",
      },
    });

    const apiPairs: PairFromApi[] = await response.json();

    const allPairs = apiPairs.map((pair) => {
      const token0 = new Token(this._chainId, pair.token0, 7);
      const token1 = new Token(this._chainId, pair.token1, 7);

      const newPair = new Pair(
        CurrencyAmount.fromRawAmount(token0, pair.reserve0),
        CurrencyAmount.fromRawAmount(token1, pair.reserve1)
      );

      return newPair;
    });

    return allPairs;
  }

  /**
   *
   * Fetches a pair from the blockchain, caching it to reduce API calls. If cached pair is still valid, returns it instead of fetching anew.
   *
   * @param address0
   * @param address1
   * @param factoryAddress
   * @param sorobanContext
   * @returns
   */
  public async getPairFromBlockchain(
    address0: string,
    address1: string,
    factoryAddress: string | undefined,
    sorobanContext: SorobanContextType | undefined
  ): Promise<Pair[] | null> {
    if (!factoryAddress || !sorobanContext) return null;

    try {
      const response = await contractInvoke({
        contractAddress: factoryAddress,
        method: "get_pair",
        args: [
          new Address(address0).toScVal(),
          new Address(address1).toScVal(),
        ],
        sorobanContext,
      });

      const pairAddress = scValToNative(response as xdr.ScVal) as string;

      if (!pairAddress) return null;

      const reserves_scval = await contractInvoke({
        contractAddress: pairAddress,
        method: "get_reserves",
        args: [],
        sorobanContext,
      });

      const reserves: string = scValToNative(reserves_scval as xdr.ScVal);

      const reserve0 = reserves[0];
      const reserve1 = reserves[1];

      const token0_scval = await contractInvoke({
        contractAddress: pairAddress,
        method: "token_0",
        args: [],
        sorobanContext,
      });

      const token0String: string = scValToNative(token0_scval as xdr.ScVal);

      const token1_scval = await contractInvoke({
        contractAddress: pairAddress,
        method: "token_1",
        args: [],
        sorobanContext,
      });
      const token1String: string = scValToNative(token1_scval as xdr.ScVal);

      const token0 = new Token(this._chainId, token0String, 7);
      const token1 = new Token(this._chainId, token1String, 7);

      const pair = new Pair(
        CurrencyAmount.fromRawAmount(token0, reserve0?.toString() || "0"),
        CurrencyAmount.fromRawAmount(token1, reserve1?.toString() || "0")
      );

      return [pair];
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  public async getAllPairs(
    address0: string,
    address1: string,
    factoryAddress: string | undefined,
    sorobanContext: SorobanContextType | undefined,
    protocols: Protocols[]
  ): Promise<Pair[] | null> {
    const sortedProtocols = protocols.sort();

    const cacheKey = `${this._chainId}/${address0}/${address1}/${factoryAddress}/${sortedProtocols}`;

    const cacheDuration = this._cacheInSeconds * 1000;

    const now = Date.now();

    const cache = this._cache?.[cacheKey];

    if (cache && now - cache.timestamp < cacheDuration) {
      return cache?.pairs;
    }

    const getFromBlockchain = async () => {
      const pairs = await this.getPairFromBlockchain(
        address0,
        address1,
        factoryAddress,
        sorobanContext
      );

      this._cache[cacheKey] = { pairs: pairs ?? [], timestamp: Date.now() };

      return pairs;
    };

    if (this._chainId === ChainId.TESTNET) {
      try {
        const pairs = await this.getPairsFromBackend(protocols);

        this._cache[cacheKey] = { pairs, timestamp: Date.now() };

        return pairs;
      } catch (error) {
        return getFromBlockchain();
      }
    } else {
      return getFromBlockchain();
    }
  }

  public resetCache() {
    this._cache = {};
  }
}
