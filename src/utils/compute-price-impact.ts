import { BIPS_BASE, ONE_HUNDRED_PERCENT } from "../constants";
import { Currency, CurrencyAmount, Percent, Price } from "../entities";

const THIRTY_BIPS_FEE = new Percent(30, BIPS_BASE);
const INPUT_FRACTION_AFTER_FEE = ONE_HUNDRED_PERCENT.subtract(THIRTY_BIPS_FEE);

// computes realized lp fee as a percent
export function computeRealizedLPFeePercent(paths: string[]): Percent {
  let percent: Percent;

  const totalSwaps = paths.length - 1;

  const arrayOfTotalSwaps = Array.from({ length: totalSwaps }, (_, i) => i);

  // for each hop in our trade, take away the x*y=k price impact from 0.3% fees
  // e.g. for 3 tokens/2 hops: 1 - ((1 - .03) * (1-.03))

  percent = ONE_HUNDRED_PERCENT.subtract(
    arrayOfTotalSwaps.reduce<Percent>(
      (currentFee: Percent): Percent =>
        currentFee.multiply(INPUT_FRACTION_AFTER_FEE),
      ONE_HUNDRED_PERCENT
    )
  );

  return percent;
}

/**
 * Returns the percent difference between the mid price and the execution price, i.e. price impact.
 * @param midPrice mid price before the trade
 * @param inputAmount the input amount of the trade
 * @param outputAmount the output amount of the trade
 */
export function computePriceImpact<
  TBase extends Currency,
  TQuote extends Currency
>(
  midPrice: Price<TBase, TQuote>,
  inputAmount: CurrencyAmount<TBase>,
  outputAmount: CurrencyAmount<TQuote>,
  paths: string[]
): Percent {
  const quotedOutputAmount = midPrice.quote(inputAmount);

  // calculate price impact := (exactQuote - outputAmount) / exactQuote
  const priceImpact = quotedOutputAmount
    .subtract(outputAmount)
    .divide(quotedOutputAmount);

  const priceImpactAsPercent = new Percent(
    priceImpact.numerator,
    priceImpact.denominator
  );

  const realizedLpFeePercent = computeRealizedLPFeePercent(paths);

  return priceImpactAsPercent.subtract(realizedLpFeePercent);
}
