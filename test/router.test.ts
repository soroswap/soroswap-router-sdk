import fetchMock from "jest-fetch-mock";
import {
  ChainId,
  CurrencyAmount,
  Pair,
  Protocols,
  Router,
  Token,
  TradeType,
} from "../src";

const createToken = (address: string) => {
  return new Token(ChainId.TESTNET, address, 7);
};

const createPair = (
  token0: Token,
  token1: Token,
  reserve0: number,
  reserve1: number
) => {
  return new Pair(
    CurrencyAmount.fromRawAmount(token0, reserve0),
    CurrencyAmount.fromRawAmount(token1, reserve1)
  );
};

const createRouter = (protocols: Protocols[] = [Protocols.SOROSWAP]) => {
  return new Router(
    "https://my-backend.com/",
    "my-api-key",
    20,
    protocols,
    ChainId.TESTNET
  );
};

const XLM_TOKEN = createToken("XLM_ADDRESS");
const USDC_TOKEN = createToken("USDC_ADDRESS");
const DOGSTAR_TOKEN = createToken("DOGSTAR_ADDRESS");

fetchMock.enableMocks();

jest.mock("../src/providers/pair-provider", () => {
  return {
    PairProvider: jest.fn().mockImplementation(() => ({
      getAllPairs: jest.fn().mockResolvedValue([]),
    })),
  };
});

describe("Router", () => {
  let amountCurrency: CurrencyAmount<Token>;
  let quoteCurrency: Token;
  let PairProvider: jest.Mock;

  beforeEach(() => {
    PairProvider = require("../src/providers/pair-provider").PairProvider;

    PairProvider.mockImplementation(() => ({
      getAllPairs: jest
        .fn()
        .mockResolvedValue([
          createPair(XLM_TOKEN, USDC_TOKEN, 1000000, 1000000),
          createPair(XLM_TOKEN, DOGSTAR_TOKEN, 1000000, 1000000),
          createPair(USDC_TOKEN, DOGSTAR_TOKEN, 1000000, 1000000),
        ]),
    }));

    amountCurrency = CurrencyAmount.fromRawAmount(XLM_TOKEN, 1000);
    quoteCurrency = USDC_TOKEN;
  });

  it("Ensure Direct Routing Between Tokens With Equal Reserves", async () => {
    const router = createRouter();

    const exactInput = await router.route(
      amountCurrency,
      quoteCurrency,
      TradeType.EXACT_INPUT
    );

    expect(exactInput?.trade.path).toEqual(["XLM_ADDRESS", "USDC_ADDRESS"]);

    const exactOutput = await router.route(
      amountCurrency,
      quoteCurrency,
      TradeType.EXACT_OUTPUT
    );

    expect(exactOutput?.trade.path).toEqual(["USDC_ADDRESS", "XLM_ADDRESS"]);
  });

  it("Select Optimal Route for Exact Input Based on Reserve Ratios", async () => {
    PairProvider.mockImplementation(() => ({
      getAllPairs: jest
        .fn()
        .mockResolvedValue([
          createPair(XLM_TOKEN, USDC_TOKEN, 1000, 1000),
          createPair(XLM_TOKEN, DOGSTAR_TOKEN, 1000, 1000),
          createPair(USDC_TOKEN, DOGSTAR_TOKEN, 1000, 100),
        ]),
    }));
    //Should use xlm to dogstar to usdc, because 1 xlm = 1 dogstar and 1 dogstar = 10 usdc

    const router = createRouter();

    const route = await router.route(
      amountCurrency,
      quoteCurrency,
      TradeType.EXACT_INPUT
    );

    expect(route?.trade.path).toEqual([
      "XLM_ADDRESS",
      "DOGSTAR_ADDRESS",
      "USDC_ADDRESS",
    ]);
  });

  it("Select Optimal Route for Exact Output Based on Reserve Ratios", async () => {
    PairProvider.mockImplementation(() => ({
      getAllPairs: jest
        .fn()
        .mockResolvedValue([
          createPair(XLM_TOKEN, USDC_TOKEN, 10000, 10000),
          createPair(XLM_TOKEN, DOGSTAR_TOKEN, 10000, 1000),
          createPair(USDC_TOKEN, DOGSTAR_TOKEN, 10000, 10000),
        ]),
    }));
    //Should use usdc to dogstar to xlm, because 1 usdc = 1 dogstar and 1 dogstar = 10 xlm

    const router = createRouter();

    const route = await router.route(
      amountCurrency,
      quoteCurrency,
      TradeType.EXACT_OUTPUT
    );

    expect(route?.trade.path).toEqual([
      "USDC_ADDRESS",
      "DOGSTAR_ADDRESS",
      "XLM_ADDRESS",
    ]);
  });

  it("Handle Scenario With No Available Trading Pairs", async () => {
    PairProvider.mockImplementation(() => ({
      getAllPairs: jest.fn().mockResolvedValueOnce([]),
    }));

    const router = createRouter();

    const route = await router.route(
      amountCurrency,
      quoteCurrency,
      TradeType.EXACT_INPUT
    );

    expect(route).toBeNull();
  });

  it("Should Split Distribution When Using Splitting Protocols", async () => {
    PairProvider.mockImplementation(() => ({
      getAllPairs: jest
        .fn()
        .mockResolvedValue([
          createPair(XLM_TOKEN, USDC_TOKEN, 1000, 1000),
          createPair(XLM_TOKEN, DOGSTAR_TOKEN, 1000, 1000),
          createPair(USDC_TOKEN, DOGSTAR_TOKEN, 1000, 100),
        ]),
    }));

    const router = createRouter([Protocols.SOROSWAP, Protocols.PHOENIX]);

    const route = await router.routeSplittingProtocols(
      amountCurrency,
      quoteCurrency,
      TradeType.EXACT_INPUT
    );

    expect(route.distribution).toHaveLength(2);
    expect(route.distribution.map((d) => d.parts)).toEqual([5, 5]); // 50% each protocol
  });
});
