import { Token } from "../entities";

export class PoolProvider {
  private POOL_ADDRESS_CACHE: { [key: string]: string } = {};

  constructor() {}

  public async getPools() {
    return {
      getPool: (tokenA: Token, tokenB: Token) => {},
      getPoolAddress: (address: string) => {},
      getAllPools: () => [],
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
