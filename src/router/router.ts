import { Currency, Token } from "../entities";
import { CurrencyAmount } from "../utils/amounts";
import { PoolProvider } from "../providers/pool-provider";
import { QuoteProvider } from "../providers/quote-provider";
import { TradeType } from "../constants";

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

    this._buildTrade(
      currencyIn,
      currencyOut,
      TradeType.EXACT_INPUT,
      routeQuote
    );

    return { ok: true };
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

    const trade = this._buildTrade(
      currencyIn,
      currencyOut,
      TradeType.EXACT_OUTPUT,
      routeQuote
    );

    return { ok: true };
  }

  private async _findBestRouteExactIn(
    amountIn: CurrencyAmount,
    tokenOut: Token,
    routes: any[]
  ) {
    this._quoteProvider.getQuotesManyExactIn([], []);

    this._getBestQuote();

    return { ok: true };
  }

  private async _findBestRouteExactOut(
    amountOut: CurrencyAmount,
    tokenIn: Token,
    routes: any[]
  ) {
    this._quoteProvider.getQuotesManyExactOut([], []);

    this._getBestQuote();

    return { ok: true };
  }

  private async _getAllRoutes(tokenIn: Token, tokenOut: Token) {
    const poolAccesor = await this._poolProvider.getPools();

    const pools = poolAccesor.getAllPools();

    this._computeAllRoutes();

    return [];
  }

  private _computeAllRoutes() {
    return [];
  }

  private async _getBestQuote() {}

  private async _buildTrade(
    tokenInCurrency: Currency,
    tokenOutCurrency: Currency,
    tradeType: TradeType,
    routeAmount: any
  ) {}
}
