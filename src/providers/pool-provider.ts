import { Token, Pair, CurrencyAmount } from "../entities";

export const USDC_TOKEN = new Token(
  1,
  "CAMZFR4BHDUMT6J7INBBBGJG22WMS26RXEYORKC2ERZL2YGDIEEKTOJB",
  7,
  "USDC"
);

export const XLM_TOKEN = new Token(
  1,
  "CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4",
  7,
  "XLM"
);

export const BRL_TOKEN = new Token(
  1,
  "CD7LKEZ56E2W5BA2AGSCGLF3OQYMDQTZMVKLKRLLQI6B4VKN4ICGBPNF",
  7,
  "BRL"
);

export const USDC_BRL = new Pair(
  CurrencyAmount.fromRawAmount(USDC_TOKEN, 10000000),
  CurrencyAmount.fromRawAmount(BRL_TOKEN, 10000000)
);

export const BRL_XLM = new Pair(
  CurrencyAmount.fromRawAmount(BRL_TOKEN, 10000000),
  CurrencyAmount.fromRawAmount(XLM_TOKEN, 10000000)
);

export const USDC_XLM = new Pair(
  CurrencyAmount.fromRawAmount(USDC_TOKEN, 100000000),
  CurrencyAmount.fromRawAmount(XLM_TOKEN, 10000000)
);

export class PoolProvider {
  private POOL_ADDRESS_CACHE: { [key: string]: string } = {};

  constructor() {}

  public async getPools() {
    //obtiene/recibe pairs y obtiene su liquidez devolviendo las pools validas

    return {
      //@ts-ignore
      getPool: (tokenA: Token, tokenB: Token): Pair => {
        return {} as Pair;
      },
      //@ts-ignore
      getPoolAddress: (address: string): Pair => {
        return {} as Pair;
      },
      getAllPools: (): Pair[] => {
        return [USDC_XLM, USDC_BRL, BRL_XLM];
      },
    };
  }

  public getPoolAddress(tokenA: Token, tokenB: Token) {
    const [token0, token1] = tokenA.sortsBefore(tokenB)
      ? [tokenA, tokenB]
      : [tokenB, tokenA];

    const cacheKey = `${token0.address}/${token1.address}`;

    const cachedAddress = this.POOL_ADDRESS_CACHE[cacheKey];

    if (cachedAddress) {
      return { poolAddress: cachedAddress, token0, token1 };
    }

    //Get pool address from backend
    const poolAddress = "Hello";

    this.POOL_ADDRESS_CACHE[cacheKey] = poolAddress;

    return { poolAddress, token0, token1 };
  }
}
