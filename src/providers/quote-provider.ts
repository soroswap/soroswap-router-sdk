import { TradeType } from "../constants";
import { Token, Route } from "../entities";
import {
  InsufficientInputAmountError,
  InsufficientReservesError,
} from "../entities/pair";
import { CurrencyAmount } from "../utils/amounts";
import { BigNumber } from "@ethersproject/bignumber";

export type V2AmountQuote = {
  amount: CurrencyAmount;
  quote: BigNumber | null;
};

export class V2Route extends Route<Token, Token> {}

export type V2RouteWithQuotes = [V2Route, V2AmountQuote[]];

export class QuoteProvider {
  constructor() {}

  public async getQuotesManyExactIn(
    amountIns: CurrencyAmount[],
    routes: V2Route[]
  ) {
    return this.getQuotes(amountIns, routes, TradeType.EXACT_INPUT);
  }

  public async getQuotesManyExactOut(
    amountOuts: CurrencyAmount[],
    routes: V2Route[]
  ) {
    return this.getQuotes(amountOuts, routes, TradeType.EXACT_OUTPUT);
  }

  public async getQuotes(
    amounts: CurrencyAmount[],
    routes: V2Route[],
    tradeType: TradeType
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
              [outputAmount] = pair.getOutputAmount(outputAmount);
            }

            amountQuotes.push({
              amount,
              quote: BigNumber.from(outputAmount.quotient.toString()),
            });
          } else {
            let inputAmount = amount.wrapped;

            for (let i = route.pairs.length - 1; i >= 0; i--) {
              const pair = route.pairs[i]!;
              [inputAmount] = pair.getInputAmount(inputAmount);
            }

            amountQuotes.push({
              amount,
              quote: BigNumber.from(inputAmount.quotient.toString()),
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
