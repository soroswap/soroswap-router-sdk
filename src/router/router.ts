import { Currency, Token } from "../entities";
import { CurrencyAmount } from "../utils/amounts";
import { PoolProvider } from "../providers/pool-provider";
import {
  QuoteProvider,
  V2Route,
  V2RouteWithQuotes,
} from "../providers/quote-provider";
import { ChainId, TradeType } from "../constants";
import { BigNumber } from "@ethersproject/bignumber";
import _ from "lodash";
import { Logger } from "@ethersproject/logger";
import { log } from "../utils/log";
import { Pair } from "../entities/pair";
import { Route } from "../entities/route";
import JSBI from "jsbi";

export type V2RouteWithValidQuote = {
  route: V2Route;
  rawQuote: BigNumber;
  amount: CurrencyAmount;
  percent: number;
  tradeType: TradeType;
  quoteToken: Token;
  poolProvider: PoolProvider;
} | null;

export class Router {
  private _chainId: number;
  private _poolProvider: PoolProvider;
  private _quoteProvider: QuoteProvider;

  constructor(chainId: number) {
    this._chainId = chainId;
    this._poolProvider = new PoolProvider();
    this._quoteProvider = new QuoteProvider();
  }

  public async route(
    amount: CurrencyAmount,
    quoteCurrency: Currency,
    tradeType: TradeType
  ) {
    if (tradeType === TradeType.EXACT_INPUT) {
      return this.routeExactIn(amount.currency, quoteCurrency, amount);
    } else {
      return this.routeExactOut(quoteCurrency, amount.currency, amount);
    }
  }

  public async routeExactIn(
    currencyIn: Currency,
    currencyOut: Currency,
    amountIn: CurrencyAmount
  ) {
    const tokenIn = currencyIn.wrapped;
    const tokenOut = currencyOut.wrapped;
    const routes = await this._getAllRoutes(tokenIn, tokenOut);

    const routeQuote = await this._findBestRouteExactIn(
      amountIn,
      tokenOut,
      routes
    );

    if (!routeQuote) return null;

    return this._buildTrade(
      currencyIn,
      currencyOut,
      TradeType.EXACT_INPUT,
      routeQuote
    );
  }

  public async routeExactOut(
    currencyIn: Currency,
    currencyOut: Currency,
    amountOut: CurrencyAmount
  ) {
    const tokenIn = currencyIn.wrapped;
    const tokenOut = currencyOut.wrapped;
    const routes = await this._getAllRoutes(tokenIn, tokenOut);
    const routeQuote = await this._findBestRouteExactOut(
      amountOut,
      tokenIn,
      routes
    );

    if (!routeQuote) return null;

    return this._buildTrade(
      currencyIn,
      currencyOut,
      TradeType.EXACT_OUTPUT,
      routeQuote
    );
  }

  private async _findBestRouteExactIn(
    amountIn: CurrencyAmount,
    tokenOut: Token,
    routes: V2Route[]
  ): Promise<V2RouteWithValidQuote> {
    const { routesWithQuotes: quotesRaw } =
      await this._quoteProvider.getQuotesManyExactIn([amountIn], routes);

    const bestQuote = await this._getBestQuote(
      routes,
      quotesRaw,
      tokenOut,
      TradeType.EXACT_INPUT
    );

    return bestQuote;
  }

  private async _findBestRouteExactOut(
    amountOut: CurrencyAmount,
    tokenIn: Token,
    routes: V2Route[]
  ) {
    const { routesWithQuotes: quotesRaw } =
      await this._quoteProvider.getQuotesManyExactOut([amountOut], routes);

    const bestQuote = await this._getBestQuote(
      routes,
      quotesRaw,
      tokenIn,
      TradeType.EXACT_OUTPUT
    );

    return bestQuote;
  }

  private async _getAllRoutes(tokenIn: Token, tokenOut: Token) {
    const poolAccesor = await this._poolProvider.getPools();

    const pools = poolAccesor.getAllPools();

    const routes: V2Route[] = this._computeAllRoutes(
      tokenIn,
      tokenOut,
      pools,
      this._chainId,
      [],
      [],
      tokenIn,
      2
    );

    return routes;
  }

  private _computeAllRoutes(
    tokenIn: Token,
    tokenOut: Token,
    pairs: Pair[],
    chainId: ChainId,
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
          chainId,
          [...currentPath, pair],
          allPaths,
          startTokenIn,
          maxHops - 1
        );
      }
    }

    return allPaths;
  }

  private async _getBestQuote(
    routes: V2Route[],
    quotesRaw: V2RouteWithQuotes[],
    quoteToken: Token,
    routeType: TradeType
  ) {
    log.debug(
      `Got ${
        _.filter(quotesRaw, ([_, quotes]) => !!quotes[0]).length
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
        Logger.globalLogger().debug(`No quote for ... ${route.path}`);

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
        poolProvider: this._poolProvider,
      };
    });

    return routeQuotes[0]!;
  }

  private async _buildTrade(
    tokenInCurrency: Currency,
    tokenOutCurrency: Currency,
    tradeType: TradeType,
    routeAmount: V2RouteWithValidQuote
  ) {
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

      return {
        amountCurrency,
        quoteCurrency,
        tradeType,
        routeCurrency,
        trade,
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

      return {
        amountCurrency,
        quoteCurrency,
        tradeType,
        routeCurrency,
        trade,
      };
    }
  }
}
