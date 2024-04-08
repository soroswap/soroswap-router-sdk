import { Address, Networks, scValToNative, xdr } from "@stellar/stellar-sdk";
import { Protocols } from "../constants";
import { CurrencyAmount, Pair, Token } from "../entities";
import { contractInvoke } from "../utils/contractInvoke/contractInvoke";
import { SorobanContextType } from "../utils/contractInvoke/types";
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
 * Represents the network to name mapping.
 * */
export const networkToName: { [key: string]: string } = {
  [Networks.TESTNET]: "TESTNET",
  [Networks.STANDALONE]: "STANDALONE",
  [Networks.FUTURENET]: "FUTURENET",
  [Networks.PUBLIC]: "MAINNET",
};

/**
 * Provides functionality to fetch and cache pairs from a backend API, based on the specified blockchain network.
 *
 * ```typescript
 * const pairProvider = new PairProvider(Networks.TESTNET, "https://api.example.com", "api-key", 20);
 * ```
 */
export class PairProvider {
  private _network: Networks;
  private _backendUrl: string;
  private _backendApiKey: string;
  private _cache: {
    [x: string]: { pairs: Pair[]; timestamp: number };
  };
  private _cacheInSeconds: number;
  private _shouldUseBackend: boolean;
  /**
   * Initializes a new instance of the PairProvider.
   *
   * @param network The blockchain network ID to operate on.
   * @param backendUrl The backend URL used to fetch pair information.
   * @param backendApiKey The API key for authenticating with the backend.
   * @param cacheInSeconds (Optional) The time in seconds to cache pair data, defaulting to 20 seconds.
   */
  constructor(
    network: Networks,
    backendUrl: string,
    backendApiKey: string,
    cacheInSeconds: number,
    shouldUseBackend: boolean
  ) {
    this._network = network;
    this._backendUrl = backendUrl;
    this._backendApiKey = backendApiKey;
    this._cacheInSeconds = cacheInSeconds;
    this._cache = {};
    this._shouldUseBackend = shouldUseBackend;
  }

  /**
   * Fetches all pairs from the backend API, caching them to reduce API calls. If cached pairs are still valid, returns them instead of fetching anew.
   *
   * @param protocols (Optional) The protocols to fetch pairs for, defaulting to SOROSWAP.
   * @returns A promise that resolves to an array of Pair instances representing all pairs fetched from the backend, or an empty array in case of an error.
   */
  public async getPairsFromBackend(
    protocols: Protocols[] = [Protocols.SOROSWAP]
  ): Promise<Pair[]> {
    const networkName = networkToName[this._network];

    const aggProtocols = protocols.reduce(
      (acc, protocol) => acc + `&protocols=${protocol}`,
      ""
    );

    let endpointUrl = `${this._backendUrl}/pairs/all?network=${networkName}${aggProtocols}`;

    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        apiKey: this._backendApiKey,
        "Content-Type": "application/json",
      },
    });

    const apiPairs: PairFromApi[] = await response.json();

    const allPairs = apiPairs.map((pair) => {
      const token0 = new Token(this._network, pair.token0, 7);
      const token1 = new Token(this._network, pair.token1, 7);

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
   * @param address0 The address of the first token in the pair.
   * @param address1 The address of the second token in the pair.
   * @param factoryAddress The address of the factory contract.
   * @param sorobanContext The Soroban context to use for the contract invocation.
   * @returns A promise that resolves to an array of Pair instances representing the pair fetched from the blockchain, or null in case of an error.
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

      const token0 = new Token(this._network, token0String, 7);
      const token1 = new Token(this._network, token1String, 7);

      const pair = new Pair(
        CurrencyAmount.fromRawAmount(token0, reserve0?.toString() || "0"),
        CurrencyAmount.fromRawAmount(token1, reserve1?.toString() || "0")
      );

      return [pair];
    } catch (error) {
      return null;
    }
  }

  /**
   * Returns pairs wether from backend or blockchain
   * If the network is testnet or public and shouldUseBackend is true, it will try to fetch from the backend first, and if it fails, it will fetch from the blockchain
   * If the network is standalone or futurenet, it will fetch from the blockchain
   *
   * @param address0 The address of the first token in the pair.
   * @param address1 The address of the second token in the pair.
   * @param factoryAddress The address of the factory contract.
   * @param sorobanContext The Soroban context to use for the contract invocation.
   * @param protocols (Optional) The protocols to fetch pairs for, defaulting to SOROSWAP.
   * @returns A promise that resolves to an array of Pair instances representing the pair fetched from the backend or blockchain, or null in case of an error.
   */
  public async getAllPairs(
    address0: string,
    address1: string,
    factoryAddress: string | undefined,
    sorobanContext: SorobanContextType | undefined,
    protocols: Protocols[]
  ): Promise<Pair[] | null> {
    const sortedProtocols = protocols.sort();

    const cacheKey = `${this._network}/${address0}/${address1}/${factoryAddress}/${sortedProtocols}`;

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

    if (
      (this._network === Networks.TESTNET ||
        this._network === Networks.PUBLIC) &&
      this._shouldUseBackend
    ) {
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
