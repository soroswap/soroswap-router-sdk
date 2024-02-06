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

  constructor(chainId: ChainId, backendUrl: string, backendApiKey: string) {
    this._chainId = chainId;
    this._backendUrl = backendUrl;
    this._backendApiKey = backendApiKey;
  }

  public async getAllPairs(): Promise<Pair[]> {
    const chainName = chainIdToName[this._chainId];
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

      return allPairs;
    } catch (error) {
      console.error("Error fetching pairs from API");
      return [];
    }
  }
}
