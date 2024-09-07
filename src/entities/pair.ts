import JSBI from "jsbi";
import invariant from "tiny-invariant";
import { BASIS_POINTS, Networks, ONE, ZERO, _1000, _997 } from "../constants";
import { CurrencyAmount, Price } from "./fractions";
import { Token } from "./token";

// see https://stackoverflow.com/a/41102306
const CAN_SET_PROTOTYPE = "setPrototypeOf" in Object;

/**
 * Indicates that the pair has insufficient reserves for a desired output amount. I.e. the amount of output cannot be
 * obtained by sending any amount of input.
 */
export class InsufficientReservesError extends Error {
  public readonly isInsufficientReservesError: true = true;

  public constructor() {
    super();
    this.name = this.constructor.name;
    if (CAN_SET_PROTOTYPE) Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Indicates that the input amount is too small to produce any amount of output. I.e. the amount of input sent is less
 * than the price of a single unit of output after fees.
 */
export class InsufficientInputAmountError extends Error {
  public readonly isInsufficientInputAmountError: true = true;

  public constructor() {
    super();
    this.name = this.constructor.name;
    if (CAN_SET_PROTOTYPE) Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class Pair {
  public readonly liquidityToken: Token;
  private fee: number;
  private readonly tokenAmounts: [CurrencyAmount<Token>, CurrencyAmount<Token>];

  public static getAddress(tokenA: Token, tokenB: Token): string {
    return `${tokenA} - ${tokenB} pair`;
  }

  public constructor(
    currencyAmountA: CurrencyAmount<Token>,
    tokenAmountB: CurrencyAmount<Token>,
    fee: number = 0.003,
  ) {
    const tokenAmounts = currencyAmountA.currency.sortsBefore(
      tokenAmountB.currency
    ) // does safety checks
      ? [currencyAmountA, tokenAmountB]
      : [tokenAmountB, currencyAmountA];

    this.liquidityToken = new Token(
      tokenAmounts[0].currency.network,
      Pair.getAddress(tokenAmounts[0].currency, tokenAmounts[1].currency),
      18
    );

    this.tokenAmounts = tokenAmounts as [
      CurrencyAmount<Token>,
      CurrencyAmount<Token>
    ];
    this.fee = fee;
  }

  /**
   * Returns true if the token is either token0 or token1
   * @param token to check
   */
  public involvesToken(token: Token): boolean {
    return token.equals(this.token0) || token.equals(this.token1);
  }

  /**
   * Returns the current mid price of the pair in terms of token0, i.e. the ratio of reserve1 to reserve0
   */
  public get token0Price(): Price<Token, Token> {
    const result = this.tokenAmounts[1].divide(this.tokenAmounts[0]);
    return new Price(
      this.token0,
      this.token1,
      result.denominator,
      result.numerator
    );
  }

  /**
   * Returns the current mid price of the pair in terms of token1, i.e. the ratio of reserve0 to reserve1
   */
  public get token1Price(): Price<Token, Token> {
    const result = this.tokenAmounts[0].divide(this.tokenAmounts[1]);
    return new Price(
      this.token1,
      this.token0,
      result.denominator,
      result.numerator
    );
  }

  /**
   * Return the price of the given token in terms of the other token in the pair.
   * @param token token to return price of
   */
  public priceOf(token: Token): Price<Token, Token> {
    invariant(this.involvesToken(token), "TOKEN");
    return token.equals(this.token0) ? this.token0Price : this.token1Price;
  }

  /**
   * Returns the chain ID of the tokens in the pair.
   */
  public get network(): Networks {
    return this.token0.network;
  }

  public get token0(): Token {
    return this.tokenAmounts[0].currency;
  }

  public get token1(): Token {
    return this.tokenAmounts[1].currency;
  }

  public get reserve0(): CurrencyAmount<Token> {
    return this.tokenAmounts[0];
  }

  public get reserve1(): CurrencyAmount<Token> {
    return this.tokenAmounts[1];
  }

  public reserveOf(token: Token): CurrencyAmount<Token> {
    invariant(this.involvesToken(token), "TOKEN");
    return token.equals(this.token0) ? this.reserve0 : this.reserve1;
  }

  public getOutputAmount(
    inputAmount: CurrencyAmount<Token>
  ): [CurrencyAmount<Token>, Pair] {
    invariant(this.involvesToken(inputAmount.currency), "TOKEN");
    if (
      JSBI.equal(this.reserve0.quotient, ZERO) ||
      JSBI.equal(this.reserve1.quotient, ZERO)
    ) {
      throw new InsufficientReservesError();
    }

    const inputReserve = this.reserveOf(inputAmount.currency);

    const outputReserve = this.reserveOf(
      inputAmount.currency.equals(this.token0) ? this.token1 : this.token0
    );

    const inputAmountWithFeeAndAfterTax = JSBI.multiply(
      inputAmount.quotient,
      _997
    );

    const numerator = JSBI.multiply(
      inputAmountWithFeeAndAfterTax,
      outputReserve.quotient
    );

    const denominator = JSBI.add(
      JSBI.multiply(inputReserve.quotient, _1000),
      inputAmountWithFeeAndAfterTax
    );

    const outputAmount = CurrencyAmount.fromRawAmount(
      inputAmount.currency.equals(this.token0) ? this.token1 : this.token0,
      JSBI.divide(numerator, denominator) // JSBI.divide will round down by itself, which is desired
    );

    if (JSBI.greaterThan(outputAmount.quotient, outputReserve.quotient)) {
      throw new InsufficientReservesError();
    }

    if (JSBI.equal(outputAmount.quotient, ZERO)) {
      throw new InsufficientInputAmountError();
    }

    return [
      outputAmount,
      new Pair(
        inputReserve.add(inputAmount),
        outputReserve.subtract(outputAmount)
      ),
    ];
  }

  public getOutputAmountSoroswap(
    inputAmount: CurrencyAmount<Token>
  ): [CurrencyAmount<Token>, Pair] {
    console.log("getOutputAmountSoroswap");
    invariant(this.involvesToken(inputAmount.currency), "TOKEN");
    return this.getOutputAmount(inputAmount);
  }

  public getOutputAmountPhoenix(
    inputAmount: CurrencyAmount<Token>
  ): [CurrencyAmount<Token>, Pair] {
    console.log("getOutputAmountPhoenix");
    invariant(this.involvesToken(inputAmount.currency), "TOKEN");
    if (
      JSBI.equal(this.reserve0.quotient, ZERO) ||
      JSBI.equal(this.reserve1.quotient, ZERO)
    ) {
      throw new InsufficientReservesError();
    }
    const inputReserve = this.reserveOf(inputAmount.currency);
    const outputReserve = this.reserveOf(
      inputAmount.currency.equals(this.token0) ? this.token1 : this.token0
    );
    const crossProduct = JSBI.multiply(
      inputReserve.quotient,
      outputReserve.quotient
    );
    const outputAmountBeforeFee = JSBI.subtract(
      outputReserve.quotient,
      JSBI.divide(
        crossProduct,
        JSBI.add(inputReserve.quotient, inputAmount.quotient)
      )
    );
    const taxAmount = JSBI.divide(
      JSBI.multiply(outputAmountBeforeFee, JSBI.BigInt(this.fee)),
      BASIS_POINTS
    );
    const outputAmount = CurrencyAmount.fromRawAmount(
      inputAmount.currency.equals(this.token0) ? this.token1 : this.token0,
      JSBI.subtract(outputAmountBeforeFee, taxAmount)
    );

    // TODO: returnamount should be before tax
    return [
      outputAmount,
      new Pair(
        inputReserve.add(inputAmount),
        outputReserve.subtract(CurrencyAmount.fromRawAmount(
          outputAmount.currency,
          outputAmountBeforeFee)
        )
      )
    ]
  }

  public getOutputAmountAquarius(
    inputAmount: CurrencyAmount<Token>
  ): [CurrencyAmount<Token>, Pair] {
    console.log("getOutputAmountSoroswap");
    invariant(this.involvesToken(inputAmount.currency), "TOKEN");
    if (
      JSBI.equal(this.reserve0.quotient, ZERO) ||
      JSBI.equal(this.reserve1.quotient, ZERO)
    ) {
      throw new InsufficientReservesError();
    }
    const inputReserve = this.reserveOf(inputAmount.currency);

    const outputReserve = this.reserveOf(
      inputAmount.currency.equals(this.token0) ? this.token1 : this.token0
    );

    const numerator = JSBI.multiply(
      inputAmount.quotient,
      outputReserve.quotient
    );

    const denominator = JSBI.add(
      inputReserve.quotient,
      inputAmount.quotient
    );
    const outputAmountBeforeFee = JSBI.divide(numerator, denominator);

    const feeToBeDeducted = JSBI.divide(JSBI.multiply(outputAmountBeforeFee, JSBI.BigInt(this.fee)), BASIS_POINTS);

    const outputAmount = CurrencyAmount.fromRawAmount(
      inputAmount.currency.equals(this.token0) ? this.token1 : this.token0,
      JSBI.subtract(outputAmountBeforeFee, feeToBeDeducted)
    );

    if (JSBI.greaterThan(outputAmount.quotient, outputReserve.quotient)) {
      throw new InsufficientReservesError();
    }

    if (JSBI.equal(outputAmount.quotient, ZERO)) {
      throw new InsufficientInputAmountError();
    }
    // TODO: returnamount should be before tax

    return [
      outputAmount,
      new Pair(
        inputReserve.add(inputAmount),
        outputReserve.subtract(CurrencyAmount.fromRawAmount(
          outputAmount.currency,
          outputAmountBeforeFee)
        )
      )
    ]
  }

  public getInputAmount(
    outputAmount: CurrencyAmount<Token>
  ): [CurrencyAmount<Token>, Pair] {
    invariant(this.involvesToken(outputAmount.currency), "TOKEN");

    if (
      JSBI.equal(this.reserve0.quotient, ZERO) ||
      JSBI.equal(this.reserve1.quotient, ZERO) ||
      JSBI.greaterThanOrEqual(
        outputAmount.quotient,
        this.reserveOf(outputAmount.currency).quotient
      ) ||
      JSBI.greaterThanOrEqual(
        outputAmount.quotient,
        this.reserveOf(outputAmount.currency).quotient
      )
    ) {
      throw new InsufficientReservesError();
    }

    const outputReserve = this.reserveOf(outputAmount.currency);

    const inputReserve = this.reserveOf(
      outputAmount.currency.equals(this.token0) ? this.token1 : this.token0
    );

    const numerator = JSBI.multiply(
      JSBI.multiply(inputReserve.quotient, outputAmount.quotient),
      _1000
    );
    const denominator = JSBI.multiply(
      JSBI.subtract(outputReserve.quotient, outputAmount.quotient),
      _997
    );

    const inputAmount = CurrencyAmount.fromRawAmount(
      outputAmount.currency.equals(this.token0) ? this.token1 : this.token0,
      JSBI.add(JSBI.divide(numerator, denominator), ONE) // add 1 here is part of the formula, no rounding needed here, since there will not be decimal at this point
    );

    return [
      inputAmount,
      new Pair(
        inputReserve.add(inputAmount),
        outputReserve.subtract(outputAmount)
      ),
    ];
  }

  public getInputAmountSoroswap(
    outputAmount: CurrencyAmount<Token>
  ): [CurrencyAmount<Token>, Pair] {
    console.log("getInputAmountSoroswap");
    invariant(this.involvesToken(outputAmount.currency), "TOKEN");
    return this.getInputAmount(outputAmount);
  }

  public getInputAmountPhoenix(
    outputAmount: CurrencyAmount<Token>
  ): [CurrencyAmount<Token>, Pair] {
    console.log("getInputAmountPhoenix");
    invariant(this.involvesToken(outputAmount.currency), "TOKEN");
    return this.getInputAmount(outputAmount);
  }

  public getInputAmountAquarius(
    outputAmount: CurrencyAmount<Token>
  ): [CurrencyAmount<Token>, Pair] {
    console.log("getInputAmountAquarius");
    invariant(this.involvesToken(outputAmount.currency), "TOKEN");
    return this.getInputAmount(outputAmount);
  }
}
