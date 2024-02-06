import JSBI from "jsbi";
import { Percent } from "./entities/fractions/percent";

export type BigintIsh = JSBI | string | number;

export enum TradeType {
  EXACT_INPUT,
  EXACT_OUTPUT,
}

export enum Rounding {
  ROUND_DOWN,
  ROUND_HALF_UP,
  ROUND_UP,
}

export enum ChainId {
  TESTNET = 1,
  STANDALONE = 2,
  FUTURENET = 3,
}

export const MaxUint256 = JSBI.BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

export const MINIMUM_LIQUIDITY = JSBI.BigInt(1000);

// exports for internal consumption
export const ZERO = JSBI.BigInt(0);
export const ONE = JSBI.BigInt(1);
export const FIVE = JSBI.BigInt(5);
export const _997 = JSBI.BigInt(997);
export const _1000 = JSBI.BigInt(1000);
export const BASIS_POINTS = JSBI.BigInt(10000);

export const ZERO_PERCENT = new Percent(ZERO);
export const ONE_HUNDRED_PERCENT = new Percent(ONE);
