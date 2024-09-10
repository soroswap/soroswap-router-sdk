import { Address, Networks, scValToNative, xdr } from "@stellar/stellar-sdk";
import { Protocols } from "../constants";
import { CurrencyAmount, Pair, Token } from "../entities";
import { contractInvoke } from "../utils/contractInvoke/contractInvoke";
import { SorobanContextType } from "../utils/contractInvoke/types";
import { parseScval } from "../utils/parseScvalAddress";
import { GetPairsFns } from "../router/router";
/**
 * @ignore
 * Represents a pair as returned from the API, including token addresses and reserves.
 */
export interface PairFromApi {
  tokenA: string;
  tokenB: string;
  reserveA: string;
  reserveB: string;
  protocol?: Protocols;
  fee?: string;
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

interface PairProviderOptions {
  network: Networks;
  cacheInSeconds: number;
  getPairsFns?: GetPairsFns;
}

/**
 * Provides functionality to fetch and cache pairs from a backend API, based on the specified blockchain network.
 *
 * ```typescript
 * const pairProvider = new PairProvider(Networks.TESTNET, "https://api.example.com", "api-key", 20);
 * ```
 */
export class PairProvider {
  private _network: Networks;
  private _cache: {
    [x: string]: { pairs: Pair[]; timestamp: number };
  };
  private _cacheInSeconds: number;
  public getPairsFns?: GetPairsFns;

  /**
   * Initializes a new instance of the PairProvider.
   *
   * @param network The blockchain network ID to operate on.
   * @param cacheInSeconds (Optional) The time in seconds to cache pair data, defaulting to 20 seconds.
   */
  constructor(opts: PairProviderOptions) {
    this._network = opts.network;
    this._cacheInSeconds = opts.cacheInSeconds;
    this.getPairsFns = opts.getPairsFns;
    this._cache = {};
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

      const pairAddress = parseScval(response as xdr.ScVal) as string;

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

      const token0String: string = parseScval(token0_scval as xdr.ScVal);

      const token1_scval = await contractInvoke({
        contractAddress: pairAddress,
        method: "token_1",
        args: [],
        sorobanContext,
      });
      const token1String: string = parseScval(token1_scval as xdr.ScVal);

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
      this.getPairsFns &&
      this.getPairsFns.length > 0
    ) {
      try {
        const protocolsFns = this.getPairsFns.filter((fn) =>
          sortedProtocols.includes(fn.protocol)
        );

        if (protocolsFns.length === 0) return getFromBlockchain();

        const result = await Promise.all(
          protocolsFns.map(async (fn) => await fn.fn())
        );

        const pairs = result.flat();

        const parsedPairs = pairs.map((pair) => {
          const token0 = new Token(this._network, pair.tokenA, 7);
          const token1 = new Token(this._network, pair.tokenB, 7);

          const pairInstance = new Pair(
            CurrencyAmount.fromRawAmount(token0, pair.reserveA),
            CurrencyAmount.fromRawAmount(token1, pair.reserveB),
            pair.fee ? Number(pair.fee) : undefined
          );

          return pairInstance;
        });

        this._cache[cacheKey] = { pairs: parsedPairs, timestamp: Date.now() };

        return parsedPairs;
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
