import { ChainId } from "../constants";
import { Token, Pair, CurrencyAmount } from "../entities";

export interface PairFromApi {
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
}

const chainIdToName = {
  [ChainId.TESTNET]: "testnet",
  [ChainId.STANDALONE]: "standalone",
  [ChainId.FUTURENET]: "futurenet",
};

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
