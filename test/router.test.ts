import {
  CurrencyAmount,
  Networks,
  Protocols,
  Router,
  Token,
  TradeType,
} from "../src";
import { GetPairsFns } from "../src/router/router";

const createRouter = (
  getPairsFns: GetPairsFns,
  protocols: Protocols[] = [Protocols.SOROSWAP]
) => {
  return new Router({
    pairsCacheInSeconds: 20,
    protocols: protocols,
    network: Networks.TESTNET,
    getPairsFns,
  });
};

const createToken = (address: string) => {
  return new Token(Networks.TESTNET, address, 7);
};

const XLM_TOKEN = createToken("XLM_ADDRESS");
const USDC_TOKEN = createToken("USDC_ADDRESS");

describe("Router", () => {
  let amountCurrency: CurrencyAmount<Token>;
  let quoteCurrency: Token;

  beforeEach(() => {
    amountCurrency = CurrencyAmount.fromRawAmount(XLM_TOKEN, 100);
    quoteCurrency = USDC_TOKEN;
  });

  it("Ensure Direct Routing Between Tokens With Equal Reserves", async () => {
    const router = createRouter([
      {
        protocol: Protocols.SOROSWAP,
        fn: async () => [
          {
            tokenA: "XLM_ADDRESS",
            tokenB: "USDC_ADDRESS",
            reserveA: "1000",
            reserveB: "1000",
          },
          {
            tokenA: "XLM_ADDRESS",
            tokenB: "DOGSTAR_ADDRESS",
            reserveA: "1000",
            reserveB: "1000",
          },
          {
            tokenA: "USDC_ADDRESS",
            tokenB: "DOGSTAR_ADDRESS",
            reserveA: "1000",
            reserveB: "1000",
          },
        ],
      },
    ]);

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
    const router = createRouter([
      {
        protocol: Protocols.SOROSWAP,
        fn: async () => [
          {
            tokenA: "XLM_ADDRESS",
            tokenB: "USDC_ADDRESS",
            reserveA: "1000",
            reserveB: "1000",
          },
          {
            tokenA: "XLM_ADDRESS",
            tokenB: "DOGSTAR_ADDRESS",
            reserveA: "1000",
            reserveB: "1000",
          },
          {
            tokenA: "USDC_ADDRESS",
            tokenB: "DOGSTAR_ADDRESS",
            reserveA: "1000",
            reserveB: "100",
          },
        ],
      },
    ]);
    //Should use xlm to dogstar to usdc, because 1 xlm = 1 dogstar and 1 dogstar = 10 usdc

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
    const router = createRouter([
      {
        protocol: Protocols.SOROSWAP,
        fn: async () => [
          {
            tokenA: "XLM_ADDRESS",
            tokenB: "USDC_ADDRESS",
            reserveA: "1000",
            reserveB: "1000",
          },
          {
            tokenA: "XLM_ADDRESS",
            tokenB: "DOGSTAR_ADDRESS",
            reserveA: "1000",
            reserveB: "100",
          },
          {
            tokenA: "USDC_ADDRESS",
            tokenB: "DOGSTAR_ADDRESS",
            reserveA: "1000",
            reserveB: "1000",
          },
        ],
      },
    ]);

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
    const router = createRouter([
      {
        protocol: Protocols.SOROSWAP,
        fn: async () => [],
      },
    ]);

    const route = await router.route(
      amountCurrency,
      quoteCurrency,
      TradeType.EXACT_INPUT
    );

    expect(route).toBeNull();
  });

  it("Should Split Distribution And Select Optimal Route When Using Split Protocols", async () => {
    const router = createRouter(
      [
        {
          protocol: Protocols.SOROSWAP,
          fn: async () => [
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "USDC_ADDRESS",
              reserveA: "1000",
              reserveB: "1000",
            },
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "DOGSTAR_ADDRESS",
              reserveA: "1000",
              reserveB: "1000",
            },
            {
              tokenA: "USDC_ADDRESS",
              tokenB: "DOGSTAR_ADDRESS",
              reserveA: "1000",
              reserveB: "100",
            },
          ],
        },
        {
          protocol: Protocols.PHOENIX,
          fn: async () => [
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "USDC_ADDRESS",
              reserveA: "1000",
              reserveB: "1000",
            },
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "DOGSTAR_ADDRESS",
              reserveA: "1000",
              reserveB: "1000",
            },
            {
              tokenA: "USDC_ADDRESS",
              tokenB: "DOGSTAR_ADDRESS",
              reserveA: "1000",
              reserveB: "100",
            },
          ],
        },
      ],
      [Protocols.SOROSWAP, Protocols.PHOENIX]
    );

    const route = await router.routeSplit(
      amountCurrency,
      quoteCurrency,
      TradeType.EXACT_INPUT
    );

    /* 
    Amount are:
    [0,  82, 159, 224, 274, 319, 358, 393, 421, 449, 472]
    and
    [0,  82, 159, 224, 274, 319, 358, 393, 421, 449, 472]

    Possible combinations:
    (0 + 10) = 0 + 472 = 472
    (1 + 9 ) = 82 + 449 = 531
    (2 + 8 ) = 159 + 421 = 580
    (3 + 7 ) = 224 + 393 = 617
    (4 + 6 ) = 274 + 358 = 632
    (5 + 5 ) = 319 + 319 = 638

    The best combination is (5 + 5) = 319 + 319 = 638
    */

    const requiredPath = ["XLM_ADDRESS", "DOGSTAR_ADDRESS", "USDC_ADDRESS"];
    const requiredFinalAmount = "638";

    expect(route.trade.distribution[0].parts).toEqual(5);
    expect(route.trade.distribution[1].parts).toEqual(5);

    expect(route.trade.distribution[0].path).toEqual(requiredPath);
    expect(route.trade.distribution[1].path).toEqual(requiredPath);

    expect(route.trade.amountOutMin).toEqual(requiredFinalAmount);
  });
});
