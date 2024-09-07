import BigNumber from "bignumber.js";
import { Protocols, TradeType } from "../constants";
import { Token, Route } from "../entities";
import {
  InsufficientInputAmountError,
  InsufficientReservesError,
} from "../entities/pair";
import { CurrencyAmount } from "../utils/amounts";

/**
 * @ignore
 * Represents the quote for an amount with the resulting quote amount.
 */
export type V2AmountQuote = {
  amount: CurrencyAmount;
  quote: BigNumber | null;
};

/**
 * @ignore
 * Extends the basic Route class specifically for tokens, defining a route through which a trade can be executed.
 */
export class V2Route extends Route<Token, Token> { }

/**
 * @ignore
 * Represents a route along with the quotes for various amounts.
 */
export type V2RouteWithQuotes = [V2Route, V2AmountQuote[]];

/**
 * Provides functionality to fetch quotes for trade amounts over specified routes.
 *
 * ```typescript
 * const quoteProvider = new QuoteProvider();
 * ```
 *
 */
export class QuoteProvider {
  constructor() { }

  /**
   * Fetches quotes for multiple exact input amounts across specified routes.
   *
   * @param amountIns An array of input amounts for which quotes are requested.
   * @param routes The routes over which to fetch quotes.
   * @returns A promise that resolves to an array of routes with their associated quotes for the given input amounts.
   */
  public async getQuotesManyExactIn(
    amountIns: CurrencyAmount[],
    routes: V2Route[],
    protocol: Protocols = Protocols.SOROSWAP
  ) {
    return this.getQuotes(amountIns, routes, TradeType.EXACT_INPUT, protocol);
  }

  /**
   * Fetches quotes for multiple exact output amounts across specified routes.
   *
   * @param amountOuts An array of output amounts for which quotes are requested.
   * @param routes The routes over which to fetch quotes.
   * @returns A promise that resolves to an array of routes with their associated quotes for the given output amounts.
   */
  public async getQuotesManyExactOut(
    amountOuts: CurrencyAmount[],
    routes: V2Route[],
    protocol: Protocols = Protocols.SOROSWAP
  ) {
    return this.getQuotes(amountOuts, routes, TradeType.EXACT_OUTPUT, protocol);
  }

  /**
   * Core method to fetch quotes for specified amounts and routes, based on the trade type (exact input or exact output).
   *
   * @param amounts An array of amounts for which quotes are requested.
   * @param routes The routes over which to fetch quotes.
   * @param tradeType The type of trade, determining the direction of quote calculation.
   * @returns A promise that resolves to an object containing routes along with their associated quotes for the specified amounts.
   */
  public async getQuotes(
    amounts: CurrencyAmount[],
    routes: V2Route[],
    tradeType: TradeType,
    protocol: Protocols = Protocols.SOROSWAP
  ) {
    const routesWithQuotes: V2RouteWithQuotes[] = [];

    for (const route of routes) {
      const amountQuotes: V2AmountQuote[] = [];
      let insufficientInputAmountErrorCount = 0;
      let insufficientReservesErrorCount = 0;

      for (const amount of amounts) {
        try {
          if (tradeType == TradeType.EXACT_INPUT) {
            let outputAmount = amount.wrapped;

            for (const pair of route.pairs) {
              switch (protocol) {
                case Protocols.SOROSWAP:
                  [outputAmount] = pair.getOutputAmountSoroswap(outputAmount);
                  break;
                case Protocols.PHOENIX:
                  [outputAmount] = pair.getOutputAmountPhoenix(outputAmount);
                  break;
                case Protocols.AQUARIUS:
                  [outputAmount] = pair.getOutputAmountAquarius(outputAmount);
                  break;
                default:
                  throw new Error(`Protocol ${protocol} not supported`);
              }
            }

            amountQuotes.push({
              amount,
              quote: BigNumber(outputAmount.quotient.toString()),
            });
          } else {
            let inputAmount = amount.wrapped;

            for (let i = route.pairs.length - 1; i >= 0; i--) {
              const pair = route.pairs[i]!;
              [inputAmount] = pair.getInputAmount(inputAmount);
            }

            amountQuotes.push({
              amount,
              quote: BigNumber(inputAmount.quotient.toString()),
            });
          }
        } catch (err) {
          // Can fail to get quotes, e.g. throws InsufficientReservesError or InsufficientInputAmountError.
          if (err instanceof InsufficientInputAmountError) {
            insufficientInputAmountErrorCount =
              insufficientInputAmountErrorCount + 1;
            amountQuotes.push({ amount, quote: null });
          } else if (err instanceof InsufficientReservesError) {
            insufficientReservesErrorCount = insufficientReservesErrorCount + 1;
            amountQuotes.push({ amount, quote: null });
          } else {
            throw err;
          }
        }
      }

      routesWithQuotes.push([route, amountQuotes]);
    }

    return {
      routesWithQuotes,
    };
  }
}
