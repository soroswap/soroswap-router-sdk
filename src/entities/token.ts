import invariant from "tiny-invariant";

import { BaseCurrency } from "./base-currency";
import { Currency } from "./currency";
import BigNumber from "bignumber.js";
import { Networks } from "../constants";

export class Token extends BaseCurrency {
  public readonly isNative: false = false;
  public readonly isToken: true = true;

  /**
   * The contract address on the chain on which this token lives
   */
  public readonly address: string;

  /**
   * Relevant for fee-on-transfer (FOT) token taxes,
   * Not every ERC20 token is FOT token, so this field is optional
   */
  public readonly buyFeeBps?: BigNumber;
  public readonly sellFeeBps?: BigNumber;

  /**
   *
   * @param address The contract address on the chain on which this token lives
   * @param decimals {@link BaseCurrency#decimals}
   * @param symbol {@link BaseCurrency#symbol}
   * @param name {@link BaseCurrency#name}
   */
  public constructor(
    network: Networks,
    address: string,
    decimals: number,
    symbol?: string,
    name?: string
  ) {
    super(network, decimals, symbol, name);
    this.address = address;
  }

  /**
   * Returns true if the two tokens are equivalent, i.e. have the same address.
   * @param other other token to compare
   */
  public equals(other: Currency): boolean {
    return (
      other.isToken &&
      this.network === other.network &&
      this.address.toLowerCase() === other.address.toLowerCase()
    );
  }

  /**
   * Returns true if the address of this token sorts before the address of the other token
   * @param other other token to compare
   * @throws if the tokens have the same address
   */
  public sortsBefore(other: Token): boolean {
    invariant(this.network === other.network, "CHAIN_IDS");
    invariant(
      this.address.toLowerCase() !== other.address.toLowerCase(),
      "ADDRESSES"
    );
    return this.address.toLowerCase() < other.address.toLowerCase();
  }

  /**
   * Return this token, which does not need to be wrapped
   */
  public get wrapped(): Token {
    return this;
  }
}
