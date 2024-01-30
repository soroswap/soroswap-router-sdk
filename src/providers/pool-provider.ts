import { CurrencyAmount, Token } from "../entities";
import { Pair } from "../entities/pair";
import {
  BRL_TOKEN,
  BRL_XLM,
  USDC_BRL,
  USDC_TOKEN,
  USDC_XLM,
  XLM_TOKEN,
} from "../example";

export class PoolProvider {
  private POOL_ADDRESS_CACHE: { [key: string]: string } = {};

  constructor() {}

  public async getPools() {
    //obtiene/recibe pairs y obtiene su liquidez devolviendo las pools validas

    return {
      getPool: (tokenA: Token, tokenB: Token): Pair => ({} as Pair),
      getPoolAddress: (address: string): Pair => ({} as Pair),
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
