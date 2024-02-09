import { ChainId } from "../constants";
import { Token, Pair, CurrencyAmount } from "../entities";

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
const chainIdToName = {
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
    [ChainId.TESTNET]: { pairs: Pair[]; timestamp: number };
    [ChainId.STANDALONE]: { pairs: Pair[]; timestamp: number };
    [ChainId.FUTURENET]: { pairs: Pair[]; timestamp: number };
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
    this._cache = {
      [ChainId.TESTNET]: { pairs: [], timestamp: 0 },
      [ChainId.STANDALONE]: { pairs: [], timestamp: 0 },
      [ChainId.FUTURENET]: { pairs: [], timestamp: 0 },
    };
    this._cacheInSeconds = cacheInSeconds;
  }

  /**
   * Fetches all pairs from the backend API, caching them to reduce API calls. If cached pairs are still valid, returns them instead of fetching anew.
   *
   * @returns A promise that resolves to an array of Pair instances representing all pairs fetched from the backend, or an empty array in case of an error.
   */
  public async getAllPairs(): Promise<Pair[]> {
    const chainName = chainIdToName[this._chainId];
    const cache = this._cache[this._chainId];

    const cacheDuration = this._cacheInSeconds * 1000;
    const now = Date.now();

    if (cache.pairs.length > 0 && now - cache.timestamp < cacheDuration) {
      return cache.pairs;
    }

    try {
      const response = await fetch(
        `${this._backendUrl}/pairs/all?network=${chainName}`,
        {
          method: "POST",
          headers: {
            apiKey: this._backendApiKey,
            "Content-Type": "application/json",
          },
        }
      );

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

      this._cache[this._chainId] = { pairs: allPairs, timestamp: Date.now() };

      return allPairs;
    } catch (error) {
      console.error("Error fetching pairs from API");
      return [];
    }
  }
}
