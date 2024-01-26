import { TradeType } from "../constants";
import { CurrencyAmount } from "../utils/amounts";

export class QuoteProvider {
  constructor() {}

  public async getQuotesManyExactIn(
    amountIns: CurrencyAmount[],
    routes: any[]
  ) {
    return this.getQuotes(amountIns, routes, TradeType.EXACT_INPUT);
  }

  public async getQuotesManyExactOut(
    amountOuts: CurrencyAmount[],
    routes: any[]
  ) {
    return this.getQuotes(amountOuts, routes, TradeType.EXACT_OUTPUT);
  }

  public async getQuotes(
    amounts: CurrencyAmount[],
    routes: any[],
    tradeType: TradeType
  ) {}
}
