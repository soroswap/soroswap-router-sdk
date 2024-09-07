import BigNumber from "bignumber.js";
import JSBI from "jsbi";
import _ from "lodash";
import { Networks, Protocols, TradeType } from "../constants";
import { Currency, Fraction, Pair, Percent, Route, Token } from "../entities";
import { PairFromApi, PairProvider } from "../providers/pair-provider";
import {
  QuoteProvider,
  V2Route,
  V2RouteWithQuotes,
} from "../providers/quote-provider";
import { CurrencyAmount } from "../utils/amounts";
import { computePriceImpact } from "../utils/compute-price-impact";
import { SorobanContextType } from "../utils/contractInvoke/types";
import { log } from "../utils/log";

export interface GetPairsFn {
  protocol: Protocols;
  fn: () => Promise<PairFromApi[]>;
}

export type GetPairsFns = GetPairsFn[];

export interface BuildTradeReturn {
  amountCurrency: CurrencyAmount;
  quoteCurrency: CurrencyAmount;
  tradeType: TradeType;
  trade: {
    amountIn?: string;
    amountOut?: string;
    amountOutMin?: string;
    amountInMax?: string;
    path: string[];
  };
  priceImpact: Percent;
}

/**
 * Represents a route with a valid quote, including details like the raw quote amount, trade type, and the quote token.
 */
export type V2RouteWithValidQuote = {
  route: V2Route;
  rawQuote: BigNumber;
  amount: CurrencyAmount;
  percent: number;
  tradeType: TradeType;
  quoteToken: Token;
  pairProvider: PairProvider;
} | null;

interface RouterOptions {
  pairsCacheInSeconds?: number;
  protocols?: Protocols[];
  network?: Networks;
  maxHops?: number;
  getPairsFns?: GetPairsFns;
}

/**
 * The Router class is the core of the soroswap-router-sdk, facilitating the discovery of optimal trade routes and quotes for token exchanges on a specified blockchain network. It leverages quote and pair providers to find the best exchange route based on the specified trade type, either exact input or exact output.
 * ```ts
 * const USDC = new Token(Networks.TESTNET, USDC_ADDRESS, 7, "USDC", "USD Coin");
 * const XLM = new Token(Networks.TESTNET, XLM_ADDRESS, 7, "XLM", "Stellar Lumens");
 * const amountCurrency = CurrencyAmount.fromRawAmount(USDC, "100000000");
 * const quoteCurrency = XLM;
 * const tradeType = TradeType.EXACT_INPUT;
 * 
 * const router = new Router({
    pairsCacheInSeconds: 20,
    protocols: [Protocols.SOROSWAP],
    network: Networks.TESTNET,
  })
 *
 * const route = await router.route(amountCurrency, quoteCurrency, tradeType);
 * console.log(route.trade.path);
 * // Output: ['0x...', '0x...', '0x...']
 * ```
 */
export class Router {
  private _network: Networks;
  private _pairProvider: PairProvider;
  private _quoteProvider: QuoteProvider;
  private _protocols: Protocols[];
  private _maxHops = 2;

  /**
   * Initializes a new instance of the Router with configurations for connecting to a specified backend and retrieving pair exchange information.
   *
   * Example:
   * ```ts
   * const router = new Router({
      pairsCacheInSeconds: 20,
      protocols: [Protocols.SOROSWAP],
      network: Networks.TESTNET,
    })
   * ```
   *
   * @param pairsCacheInSeconds (Optional) The time in seconds to cache pair data.
   * @param network (Optional) The blockchain network ID to operate on. Defaults to TESTNET if not provided.
   */
  constructor(options: RouterOptions) {
    this._network = options.network || Networks.TESTNET;
    this._pairProvider = new PairProvider({
      network: this._network,
      cacheInSeconds: options.pairsCacheInSeconds || 20,
      getPairsFns: options.getPairsFns,
    });
    this._quoteProvider = new QuoteProvider();
    this._protocols = options.protocols?.sort() || [Protocols.SOROSWAP];
    this._maxHops = options.maxHops || 2;
  }

  /**
   * This is the main method and calculates the optimal route for a trade given the amount, quote currency, and trade type. Returns the trade route and details if successful; otherwise returns null.
   *
   * Example:
   * ```ts
   * const route = await router.route(amountCurrency, quoteCurrency, tradeType);
   * ```
   *
   *
   * @param amount The amount for the trade.
   * @param quoteCurrency The currency to quote the trade in.
   * @param tradeType The type of trade, either EXACT_INPUT or EXACT_OUTPUT.
   * @returns The trade details including the route, or null if no route is found.
   */
  public async route(
    amount: CurrencyAmount,
    quoteCurrency: Currency,
    tradeType: TradeType,
    factoryAddress?: string,
    sorobanContext?: SorobanContextType

  ) {
    if (tradeType === TradeType.EXACT_INPUT) {
      const routes: V2Route[] = await this._getAllRoutes(
        amount.currency.wrapped,
        quoteCurrency.wrapped,
        this._protocols,
        factoryAddress,
        sorobanContext
      );
      return this.routeExactIn(
        amount.currency,
        quoteCurrency,
        amount,
        routes
      );
    } else {
      const routes: V2Route[] = await this._getAllRoutes(
        quoteCurrency.wrapped,
        amount.currency.wrapped,
        this._protocols,
        factoryAddress,
        sorobanContext
      );

      return this.routeExactOut(
        quoteCurrency,
        amount.currency,
        amount,
        routes
      );
    }
  }

  /**
   * @private
   * @param s - The total amount to be distributed among protocols.
   * @param amounts - A 2D array representing the amounts available for each protocol and each distribution percentage.
   * @returns An array containing the total value of the distributed amounts and the distribution percentages.
   */
  private _findBestDistribution(
    s: number,
    amounts: number[][]
  ): [number, number[]] {
    const n = amounts.length;

    const VERY_NEGATIVE_VALUE = -1e72;

    const answer: number[][] = new Array(n);
    const parent: number[][] = new Array(n);

    for (let i = 0; i < n; i++) {
      answer[i] = new Array(s + 1).fill(0);
      parent[i] = new Array(s + 1).fill(0);
    }

    for (let j = 0; j <= s; j++) {
      answer[0][j] = amounts[0][j];
      for (let i = 1; i < n; i++) {
        answer[i][j] = VERY_NEGATIVE_VALUE;
      }
      parent[0][j] = 0;
    }

    for (let i = 1; i < n; i++) {
      for (let j = 0; j <= s; j++) {
        answer[i][j] = answer[i - 1][j];
        parent[i][j] = j;

        for (let k = 1; k <= j; k++) {
          if (answer[i - 1][j - k] + amounts[i][k] > answer[i][j]) {
            answer[i][j] = answer[i - 1][j - k] + amounts[i][k];
            parent[i][j] = j - k;
          }
        }
      }
    }

    const distribution: number[] = new Array(this._protocols.length).fill(0);

    let partsLeft = s;
    for (let curExchange = n - 1; partsLeft > 0; curExchange--) {
      distribution[curExchange] = partsLeft - parent[curExchange][partsLeft];
      partsLeft = parent[curExchange][partsLeft];
    }

    const returnAmount =
      answer[n - 1][s] === VERY_NEGATIVE_VALUE ? 0 : answer[n - 1][s];

    return [returnAmount, distribution];
  }

  /**
   * This method splits a given trade amount into multiple parts and determines the optimal distribution among different protocols.
   *
   * @param amount - The total trade amount to be split.
   * @param quoteCurrency - The currency to quote the trade in.
   * @param tradeType - The type of trade, either `EXACT_INPUT` or `EXACT_OUTPUT`.
   * @returns A promise that resolves to an object containing the total value of the split amounts and the distribution details.
   * @example
   * const result = await router.routeSplit(amountCurrency, quoteCurrency, TradeType.EXACT_INPUT);
   * console.log(result.totalAmount); // Output: 150
   * console.log(result.distribution);
   * // Output:
   * // [
   * //   { protocol: Protocols.SOROSWAP, amount: 100, path: ['0x...', '0x...', '0x...'] },
   * //   { protocol: Protocols.PHOENIX, amount: 50, path: ['0x...', '0x...', '0x...'] }
   * // ]
   */
  public async routeSplit(
    amount: CurrencyAmount,
    quoteCurrency: Currency,
    tradeType: TradeType,
    parts: number = 10,
    factoryAddress?: string,
    sorobanContext?: SorobanContextType
  ) {
    // console.log('🚀 « amount:', amount.toFixed());
    const interval = 100 / parts;

    const partsArray = Array.from(
      { length: parts },
      (_, index) => interval * (index + 1)
    );

    let amounts: number[][] = new Array(this._protocols.length)
      .fill(null)
      .map(() => new Array(parts + 1).fill(0));

    let paths: any[][] = new Array(this._protocols.length)
      .fill(null)
      .map(() => new Array(parts + 1).fill(0));

    let priceImpacts: any[][] = new Array(this._protocols.length)
      .fill(null)
      .map(() => new Array(parts + 1).fill(0));

    let routes: V2Route[] = [];
    if (tradeType === TradeType.EXACT_INPUT) {
      routes = await this._getAllRoutes(
        amount.currency.wrapped,
        quoteCurrency.wrapped,
        this._protocols,
        factoryAddress,
        sorobanContext
      );
    } else {
      routes = await this._getAllRoutes(
        quoteCurrency.wrapped,
        amount.currency.wrapped,
        this._protocols,
        factoryAddress,
        sorobanContext
      );
    }

    let routeArray: (BuildTradeReturn | null)[] = [];

    for (let i = 0; i < this._protocols.length; i++) {
      for (let j = 0; j < partsArray.length; j++) {
        const part = partsArray[j];
        const amountPerProtocol = amount.multiply(part).divide(100);

        let route: BuildTradeReturn | null = null;

        if (tradeType === TradeType.EXACT_INPUT) {
          route = await this.routeExactIn(
            amount.currency,
            quoteCurrency,
            amountPerProtocol,
            routes,
            this._protocols[i]
          );

          amounts[i][j + 1] = Number(route?.trade?.amountOutMin) || 0;
        } else {
          route = await this.routeExactOut(
            quoteCurrency,
            amount.currency,
            amountPerProtocol,
            routes,
            this._protocols[i]
          );

          amounts[i][j + 1] = Number(route?.trade?.amountInMax) || 0;
        }

        routeArray.push(route);

        priceImpacts[i][j + 1] = route?.priceImpact || [];
        paths[i][j + 1] = route?.trade?.path || [];
      }
    }

    const [totalAmount, distribution] = this._findBestDistribution(
      parts,
      amounts
    );

    const filteredDistribution = distribution.filter((value) => value !== 0);

    // Calculate weighted average price impact
    let totalPartsValue = 0;
    let weightedPriceImpact = new Fraction(0);

    filteredDistribution.forEach((parts, index) => {
      if (parts > 0) {
        const priceImpact = priceImpacts[index][parts];
        weightedPriceImpact = weightedPriceImpact.add(
          priceImpact.multiply(parts)
        );
        totalPartsValue += parts;
      }
    });

    const averagePriceImpact =
      totalPartsValue > 0
        ? weightedPriceImpact.divide(totalPartsValue)
        : new Fraction(0);

    const finalPriceImpact = new Percent(
      averagePriceImpact.numerator,
      averagePriceImpact.denominator
    );

    return {
      amountCurrency: amount,
      priceImpact: finalPriceImpact,
      quoteCurrency,
      trade: {
        amountIn: amount.quotient.toString(),
        amountOutMin: String(totalAmount),
        amountInMax: String(totalAmount),
        amountOut: amount.quotient.toString(),
        path: [],
        distribution: filteredDistribution.map((amount, index) => {
          return {
            protocol_id: this._protocols[index],
            path: paths[index][amount],
            parts: amount,
            is_exact_in: tradeType == TradeType.EXACT_INPUT ? true : false,
          };
        }),
      },
      tradeType,
    };
  }

  /**
   * Finds the best route for an exact input amount given the input and output currencies and the input amount. Returns the trade details if successful.
   *
   *
   * Example:
   * ```ts
   * if (tradeType === TradeType.EXACT_INPUT) {
   *  const route = await router.routeExactIn(amountCurrency, quoteCurrency, amount);
   * }
   * ```
   *
   * @param currencyIn The input currency.
   * @param currencyOut The output currency.
   * @param amountIn The exact input amount.
   * @returns The trade details for the best route, or null if no route is found.
   */
  public async routeExactIn(
    currencyIn: Currency,
    currencyOut: Currency,
    amountIn: CurrencyAmount,
    routes: V2Route[],
    protocol: Protocols = Protocols.SOROSWAP
  ) {
    const tokenOut = currencyOut.wrapped;

    const routeQuote = await this._findBestRouteExactIn(
      amountIn,
      tokenOut,
      routes,
      protocol
    );

    if (!routeQuote) return null;

    return this._buildTrade(
      currencyIn,
      currencyOut,
      TradeType.EXACT_INPUT,
      routeQuote
    );
  }

  /**
   * Finds the best route for an exact output amount given the input and output currencies and the output amount. Returns the trade details if successful.
   *
   * Example:
   * ```ts
   * if (tradeType === TradeType.EXACT_OUTPUT) {
   * const route = await router.routeExactOut(amountCurrency, quoteCurrency, amount);
   * }
   * ```
   *
   * @param currencyIn The input currency.
   * @param currencyOut The output currency.
   * @param amountOut The exact output amount.
   * @returns The trade details for the best route, or null if no route is found.
   */
  public async routeExactOut(
    currencyIn: Currency,
    currencyOut: Currency,
    amountOut: CurrencyAmount,
    routes: V2Route[],
    protocol: Protocols = Protocols.SOROSWAP
  ) {
    const tokenIn = currencyIn.wrapped;

    const routeQuote = await this._findBestRouteExactOut(
      amountOut,
      tokenIn,
      routes,
      protocol
    );

    if (!routeQuote) return null;

    return this._buildTrade(
      currencyIn,
      currencyOut,
      TradeType.EXACT_OUTPUT,
      routeQuote
    );
  }

  /**
   * Finds the best route for a given exact input amount by comparing all possible routes from tokenIn to tokenOut. It selects the route with the best quote.
   *
   * @param amountIn The exact amount of the input token.
   * @param tokenOut The output token for the trade.
   * @param routes An array of potential routes to evaluate.
   * @returns A promise that resolves to the route with the best quote, or null if no suitable route is found.
   */
  private async _findBestRouteExactIn(
    amountIn: CurrencyAmount,
    tokenOut: Token,
    routes: V2Route[],
    protocol: Protocols = Protocols.SOROSWAP
  ): Promise<V2RouteWithValidQuote> {
    const {
      routesWithQuotes: quotesRaw,
    } = await this._quoteProvider.getQuotesManyExactIn([amountIn], routes, protocol);

    const bestQuote = await this._getBestQuote(
      routes,
      quotesRaw,
      tokenOut,
      TradeType.EXACT_INPUT
    );

    return bestQuote;
  }

  /**
   * Finds the best route for a given exact output amount by comparing all possible routes from tokenIn to tokenOut. It selects the route with the best quote suitable for the required output amount.
   *
   * @param amountOut The desired output amount.
   * @param tokenIn The input token for the trade.
   * @param routes An array of potential routes to evaluate.
   * @returns A promise that resolves to the route with the best quote, or null if no suitable route is found.
   */
  private async _findBestRouteExactOut(
    amountOut: CurrencyAmount,
    tokenIn: Token,
    routes: V2Route[],
    protocol: Protocols = Protocols.SOROSWAP
  ) {
    const {
      routesWithQuotes: quotesRaw,
    } = await this._quoteProvider.getQuotesManyExactOut([amountOut], routes, protocol);

    const bestQuote = await this._getBestQuote(
      routes,
      quotesRaw,
      tokenIn,
      TradeType.EXACT_OUTPUT
    );

    return bestQuote;
  }

  /**
   * Retrieves all possible routes between a given input and output token pair by exploring all combinations of pairs provided by the PairProvider.
   *
   * @param tokenIn The input token for generating routes.
   * @param tokenOut The output token for generating routes.
   * @returns A promise that resolves to an array of V2Route objects representing all possible routes.
   */
  private async _getAllRoutes(
    tokenIn: Token,
    tokenOut: Token,
    protocols: Protocols[],
    factoryAddress?: string,
    sorobanContext?: SorobanContextType
  ) {
    const allPairs = await this._pairProvider.getAllPairs(
      tokenIn.address,
      tokenOut.address,
      factoryAddress,
      sorobanContext,
      protocols
    );

    if (!allPairs) return [];

    const routes: V2Route[] = this._computeAllRoutes(
      tokenIn,
      tokenOut,
      allPairs,
      this._network,
      [],
      [],
      tokenIn,
      this._maxHops
    );

    return routes;
  }

  public resetCache() {
    this._pairProvider.resetCache();
  }

  /**
   * Recursively computes all routes from tokenIn to tokenOut using a depth-first search algorithm, considering a maximum number of hops.
   *
   * @param tokenIn The starting token for route computation.
   * @param tokenOut The destination token for route computation.
   * @param pairs An array of all available pairs to be considered for routing.
   * @param network The ID of the blockchain network.
   * @param currentPath The current path being explored (used for recursion).
   * @param allPaths Accumulator for all valid paths found.
   * @param startTokenIn The original input token (used for recursion).
   * @param maxHops The maximum number of hops to consider.
   * @returns An array of V2Route objects representing all computed routes.
   */
  private _computeAllRoutes(
    tokenIn: Token,
    tokenOut: Token,
    pairs: Pair[],
    network: Networks,
    currentPath: Pair[] = [],
    allPaths: V2Route[] = [],
    startTokenIn: Token = tokenIn,
    maxHops = 2
  ): V2Route[] {
    for (const pair of pairs) {
      if (currentPath.indexOf(pair) !== -1 || !pair.involvesToken(tokenIn))
        continue;

      const outputToken = pair.token0.equals(tokenIn)
        ? pair.token1
        : pair.token0;
      if (outputToken.equals(tokenOut)) {
        allPaths.push(
          new V2Route([...currentPath, pair], startTokenIn, tokenOut)
        );
      } else if (maxHops > 1) {
        this._computeAllRoutes(
          outputToken,
          tokenOut,
          pairs,
          network,
          [...currentPath, pair],
          allPaths,
          startTokenIn,
          maxHops - 1
        );
      }
    }

    return allPaths;
  }

  /**
   * Evaluates all provided routes with their corresponding quotes to determine the best quote based on the specified trade type (exact input or output).
   *
   * @param routes An array of potential routes to be evaluated.
   * @param quotesRaw Raw quote data for each route.
   * @param quoteToken The token for which the quote is provided.
   * @param routeType The type of trade, determining how to compare quotes.
   * @returns The best quote found for the given trade type, or null if no suitable quote is found.
   */
  private async _getBestQuote(
    routes: V2Route[],
    quotesRaw: V2RouteWithQuotes[],
    quoteToken: Token,
    routeType: TradeType
  ) {
    log.debug(
      `Got ${_.filter(quotesRaw, ([_, quotes]) => !!quotes[0]).length
      } valid quotes from ${routes.length} possible routes.`
    );

    const routeQuotesRaw: {
      route: V2Route;
      quote: BigNumber;
      amount: CurrencyAmount;
    }[] = [];

    for (let i = 0; i < quotesRaw.length; i++) {
      const [route, quotes] = quotesRaw[i]!;
      const { quote, amount } = quotes[0]!;

      if (!quote) {
        continue;
      }

      routeQuotesRaw.push({ route, quote, amount });
    }

    if (routeQuotesRaw.length == 0) {
      return null;
    }

    routeQuotesRaw.sort((routeQuoteA, routeQuoteB) => {
      if (routeType == TradeType.EXACT_INPUT) {
        return routeQuoteA.quote.gt(routeQuoteB.quote) ? -1 : 1;
      } else {
        return routeQuoteA.quote.lt(routeQuoteB.quote) ? -1 : 1;
      }
    });

    const routeQuotes = _.map(routeQuotesRaw, ({ route, quote, amount }) => {
      return {
        route,
        rawQuote: quote,
        amount,
        percent: 100,
        tradeType: routeType,
        quoteToken,
        pairProvider: this._pairProvider,
      };
    });

    return routeQuotes[0]!;
  }

  /**
   * Constructs a trade object from the provided route and amount details. This method finalizes the trade details, including calculating the minimum amount out for exact input trades, or maximum amount in for exact output trades.
   *
   * @param tokenInCurrency The currency of the input token.
   * @param tokenOutCurrency The currency of the output token.
   * @param tradeType The type of trade (EXACT_INPUT or EXACT_OUTPUT).
   * @param routeAmount The selected route and amount details.
   * @returns A trade object containing detailed information about the trade, or null if the routeAmount is null.
   */
  private async _buildTrade(
    tokenInCurrency: Currency,
    tokenOutCurrency: Currency,
    tradeType: TradeType,
    routeAmount: V2RouteWithValidQuote
  ): Promise<BuildTradeReturn | null> {
    if (!routeAmount) return null;

    const { route, amount, rawQuote, quoteToken } = routeAmount;

    const quote = CurrencyAmount.fromRawAmount(quoteToken, rawQuote.toString());

    if (tradeType == TradeType.EXACT_INPUT) {
      const amountCurrency = CurrencyAmount.fromFractionalAmount(
        tokenInCurrency,
        amount.numerator,
        amount.denominator
      );
      const quoteCurrency = CurrencyAmount.fromFractionalAmount(
        tokenOutCurrency,
        quote.numerator,
        quote.denominator
      );

      const routeCurrency = new Route(
        route.pairs,
        amountCurrency.currency,
        quoteCurrency.currency
      );

      const trade = {
        amountIn: JSBI.divide(
          amountCurrency.numerator,
          amountCurrency.denominator
        ).toString(),
        amountOutMin: JSBI.divide(
          quoteCurrency.numerator,
          quoteCurrency.denominator
        ).toString(),
        path: routeCurrency.path.map((token) => token.address),
      };

      const priceImpact = computePriceImpact(
        route.midPrice,
        amountCurrency,
        quoteCurrency,
        trade.path
      );

      return {
        amountCurrency,
        quoteCurrency,
        tradeType,
        trade,
        priceImpact,
      };
    } else {
      const quoteCurrency = CurrencyAmount.fromFractionalAmount(
        tokenInCurrency,
        quote.numerator,
        quote.denominator
      );

      const amountCurrency = CurrencyAmount.fromFractionalAmount(
        tokenOutCurrency,
        amount.numerator,
        amount.denominator
      );

      const routeCurrency = new Route(
        route.pairs,
        quoteCurrency.currency,
        amountCurrency.currency
      );

      const trade = {
        amountOut: JSBI.divide(
          amountCurrency.numerator,
          amountCurrency.denominator
        ).toString(),
        amountInMax: JSBI.divide(
          quoteCurrency.numerator,
          quoteCurrency.denominator
        ).toString(),
        path: routeCurrency.path.map((token) => token.address),
      };

      const priceImpact = computePriceImpact(
        route.midPrice,
        quoteCurrency,
        amountCurrency,
        trade.path
      );

      return {
        amountCurrency,
        quoteCurrency,
        tradeType,
        trade,
        priceImpact,
      };
    }
  }
}
