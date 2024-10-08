import {
  CurrencyAmount,
  Networks,
  Protocol,
  Router,
  Token,
  TradeType,
} from "../src";
import { GetPairsFns } from "../src/router/router";

const createRouter = (
  getPairsFns: GetPairsFns,
  protocols: Protocol[] = [Protocol.SOROSWAP],
  maxHops?: number,
) => {
  return new Router({
    pairsCacheInSeconds: 20,
    protocols: protocols,
    network: Networks.TESTNET,
    getPairsFns,
    maxHops
  });
};

export const createToken = (address: string) => {
  return new Token(Networks.TESTNET, address, 7);
};

const XLM_TOKEN = createToken("XLM_ADDRESS");
const USDC_TOKEN = createToken("USDC_ADDRESS");
const EURC_TOKEN = createToken("EURC_ADDRESS");
const AQUA_TOKEN = createToken("AQUA_ADDRESS");

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
        protocol: Protocol.SOROSWAP,
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
        protocol: Protocol.SOROSWAP,
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

  it("Should calculate optimal route without loosing precision", async () => {

    const router = createRouter(
      [
        {
          protocol: Protocol.SOROSWAP,
          fn: async () => [
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "USDC_ADDRESS",
              reserveA: "9767010468590",
              reserveB: "899536615278",
            }, {
              tokenA: "USDC_ADDRESS",
              tokenB: "EURC_ADDRESS",
              reserveA: "181515657088",
              reserveB: "163462214604",
            }, {
              tokenA: "XLM_ADDRESS",
              tokenB: "AQUA_ADDRESS",
              reserveA: "34072360177",
              reserveB: "5167239439236"
            }
          ],
        },
      ],
      [Protocol.SOROSWAP],
      3
    );

    const routeAmount = CurrencyAmount.fromRawAmount(AQUA_TOKEN, 1000000_0000000);
    const quoteCurrency = EURC_TOKEN;
    const route = await router.route(
      routeAmount,
      quoteCurrency,
      TradeType.EXACT_INPUT,
    );

    // expect quotient to be 1825286174
    expect(route?.quoteCurrency.quotient.toString()).toEqual("1825286174");
  });

  it("Select Optimal Route for Exact Output Based on Reserve Ratios", async () => {
    const router = createRouter([
      {
        protocol: Protocol.SOROSWAP,
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
        protocol: Protocol.SOROSWAP,
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

  it("Should Split Distribution And Select Optimal Route When Using Split Protocol", async () => {
    const router = createRouter(
      [
        {
          protocol: Protocol.SOROSWAP,
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
          protocol: Protocol.AQUARIUS,
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
      [Protocol.SOROSWAP, Protocol.AQUARIUS]
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

  it("Should Calculate Optimal Route using Phoenix Specific Protocol", async () => {
    const router = createRouter(
      [
        {
          protocol: Protocol.PHOENIX,
          fn: async () => [
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "USDC_ADDRESS",
              reserveA: "8291494350066",
              reserveB: "706515116511",
              fee: "30"
            }
          ],
        },
      ],
      [Protocol.PHOENIX],
    );
    const amountSplit = CurrencyAmount.fromRawAmount(XLM_TOKEN, 100_000_0000000);
    const parts = 1;

    const route = await router.routeSplit(
      amountSplit,
      quoteCurrency,
      TradeType.EXACT_INPUT,
      parts
    );
    expect(route).not.toBeNull();

    expect(route?.trade.amountOutMin).toEqual("75810794757");
    expect(route?.trade.distribution[0].protocol_id).toEqual("phoenix");
    expect(route?.trade.distribution[0].parts).toEqual(parts);

  });

  it("Should Calculate Optimal Route using Aquarius Specific Protocol", async () => {
    const router = createRouter(
      [
        {
          protocol: Protocol.AQUARIUS,
          fn: async () => [
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "USDC_ADDRESS",
              reserveA: "10995320835786",
              reserveB: "1029760349373",
              fee: "10"
            }
          ],
        },
      ],
      [Protocol.AQUARIUS],
    );
    const amountSplit = CurrencyAmount.fromRawAmount(XLM_TOKEN, 100_0000000);
    const parts = 1;

    const route = await router.routeSplit(
      amountSplit,
      quoteCurrency,
      TradeType.EXACT_INPUT,
      parts
    );
    expect(route).not.toBeNull();

    expect(route?.trade.amountOutMin).toEqual("93552253");
    expect(route?.trade.distribution[0].protocol_id).toEqual("aquarius");
    expect(route?.trade.distribution[0].parts).toEqual(parts);

  });

  it("Should calculate optimal split distribution using protocol specific algorithms for phoenix and soroswap", async () => {

    const router = createRouter(
      [
        {
          protocol: Protocol.SOROSWAP,
          fn: async () => [
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "USDC_ADDRESS",
              reserveA: "9767010468590",
              reserveB: "899536615278",
            }
          ],
        },
        {
          protocol: Protocol.PHOENIX,
          fn: async () => [
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "USDC_ADDRESS",
              reserveA: "8291494350066",
              reserveB: "706515116511",
              fee: "30"
            }
          ],
        },
      ],
      [Protocol.SOROSWAP, Protocol.PHOENIX]
    );

    const amountSplit = CurrencyAmount.fromRawAmount(XLM_TOKEN, 100000_0000000);
    const parts = 10;

    const route = await router.routeSplit(
      amountSplit,
      quoteCurrency,
      TradeType.EXACT_INPUT,
      parts
    );
    expect(route).not.toBeNull();

    const soroswapDistribution = route.trade.distribution.find((d) => d.protocol_id === Protocol.SOROSWAP);
    const phoenixDistribution = route.trade.distribution.find((d) => d.protocol_id === Protocol.PHOENIX);
    expect(soroswapDistribution?.parts).toEqual(7);
    expect(phoenixDistribution?.parts).toEqual(3);

  });
  it("Should calculate optimal split distribution for exact in using protocol specific algorithms for Soroswap, Phoenix and Aquarius", async () => {

    const router = createRouter(
      [
        {
          protocol: Protocol.SOROSWAP,
          fn: async () => [
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "USDC_ADDRESS",
              reserveA: "9767010468590",
              reserveB: "899536615278",
            }
          ],
        },
        {
          protocol: Protocol.PHOENIX,
          fn: async () => [
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "USDC_ADDRESS",
              reserveA: "8291494350066",
              reserveB: "706515116511",
              fee: "30"
            }
          ],
        },
        {
          protocol: Protocol.AQUARIUS,
          fn: async () => [
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "USDC_ADDRESS",
              reserveA: "10995320835786",
              reserveB: "1029760349373",
              fee: "10"
            }
          ],
        },
      ],
      [Protocol.SOROSWAP, Protocol.PHOENIX, Protocol.AQUARIUS]
    );

    const amountSplit = CurrencyAmount.fromRawAmount(XLM_TOKEN, 500000_0000000);
    const parts = 10;

    const route = await router.routeSplit(
      amountSplit,
      quoteCurrency,
      TradeType.EXACT_INPUT,
      parts
    );
    expect(route).not.toBeNull();

    const soroswapDistribution = route.trade.distribution.find((d) => d.protocol_id === Protocol.SOROSWAP);
    const phoenixDistribution = route.trade.distribution.find((d) => d.protocol_id === Protocol.PHOENIX);
    const aquariusDistribution = route.trade.distribution.find((d) => d.protocol_id === Protocol.AQUARIUS);

    expect(aquariusDistribution?.parts).toEqual(4);
    expect(soroswapDistribution?.parts).toEqual(4);
    expect(phoenixDistribution?.parts).toEqual(2);

    expect(route.trade.amountOutMin).toEqual("386644391386");
  });

  it("Should calculate optimal split distribution for exact outusing protocol specific algorithms for Soroswap, Phoenix and Aquarius", async () => {
    const router = createRouter(
      [
        {
          protocol: Protocol.SOROSWAP,
          fn: async () => [
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "USDC_ADDRESS",
              reserveA: "9767010468590",
              reserveB: "899536615278",
            }
          ],
        },
        {
          protocol: Protocol.PHOENIX,
          fn: async () => [
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "USDC_ADDRESS",
              reserveA: "8291494350066",
              reserveB: "706515116511",
              fee: "30"
            }
          ],
        },
        {
          protocol: Protocol.AQUARIUS,
          fn: async () => [
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "USDC_ADDRESS",
              reserveA: "10995320835786",
              reserveB: "1029760349373",
              fee: "10"
            }
          ],
        },
      ],
      [Protocol.SOROSWAP, Protocol.PHOENIX, Protocol.AQUARIUS]
    );

    const amountSplit = CurrencyAmount.fromRawAmount(USDC_TOKEN, 10000_0000000);
    const parts = 20;
    quoteCurrency = XLM_TOKEN;
    const route = await router.routeSplit(
      amountSplit,
      quoteCurrency,
      TradeType.EXACT_OUTPUT,
      parts
    );
    expect(route).not.toBeNull();

    const soroswapDistribution = route.trade.distribution.find((d) => d.protocol_id === Protocol.SOROSWAP);
    const phoenixDistribution = route.trade.distribution.find((d) => d.protocol_id === Protocol.PHOENIX);
    const aquariusDistribution = route.trade.distribution.find((d) => d.protocol_id === Protocol.AQUARIUS);

    expect(aquariusDistribution?.parts).toEqual(11);
    expect(soroswapDistribution?.parts).toEqual(8);
    expect(phoenixDistribution?.parts).toEqual(1);

    expect(route.trade.amountInMax).toEqual("1136225742131");

  });

  it("Should calculate optimal split distribution for exact out using 2 hops and 3 protocols", async () => {
    const router = createRouter(
      [
        {
          protocol: Protocol.SOROSWAP,
          fn: async () => [
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "USDC_ADDRESS",
              reserveA: "9767010468590",
              reserveB: "899536615278",
            },
            {
              tokenA: "USDC_ADDRESS",
              tokenB: "AQUA_ADDRESS",
              reserveA: "643079281766",
              reserveB: "1116567371410720",
            }
          ],
        },
        {
          protocol: Protocol.PHOENIX,
          fn: async () => [
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "USDC_ADDRESS",
              reserveA: "8291494350066",
              reserveB: "706515116511",
              fee: "30"
            },
            {
              tokenA: "USDC_ADDRESS",
              tokenB: "AQUA_ADDRESS",
              reserveA: "57162602823",
              reserveB: "99250433014286",
              fee: "30"
            }
          ],
        },
        {
          protocol: Protocol.AQUARIUS,
          fn: async () => [
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "USDC_ADDRESS",
              reserveA: "10995320835786",
              reserveB: "1029760349373",
              fee: "10"
            },
            {
              tokenA: "USDC_ADDRESS",
              tokenB: "AQUA_ADDRESS",
              reserveA: "714532535295",
              reserveB: "1240630412678580",
              fee: "30"
            }
          ],
        },
      ],
      [Protocol.SOROSWAP, Protocol.PHOENIX, Protocol.AQUARIUS]
    );

    const amountSplit = CurrencyAmount.fromRawAmount(XLM_TOKEN, 10000_0000000);
    const parts = 20;
    quoteCurrency = AQUA_TOKEN;
    const route = await router.routeSplit(
      amountSplit,
      quoteCurrency,
      TradeType.EXACT_OUTPUT,
      parts
    );
    expect(route).not.toBeNull();

    console.log('🚀 ~ it.only ~ route:', route);
    console.log('🚀 ~ it.only ~ route.trade:', route.trade);
    console.log('🚀 ~ it.only ~ route.trade.distribution:', route.trade.distribution);

    const soroswapDistribution = route.trade.distribution.find((d) => d.protocol_id === Protocol.SOROSWAP);
    // const phoenixDistribution = route.trade.distribution.find((d) => d.protocol_id === Protocol.PHOENIX);
    const aquariusDistribution = route.trade.distribution.find((d) => d.protocol_id === Protocol.AQUARIUS);

    expect(aquariusDistribution?.parts).toEqual(7);
    expect(soroswapDistribution?.parts).toEqual(13);
    // expect(phoenixDistribution?.parts).toEqual(6);

    expect(route.trade.amountInMax).toEqual("16385874025460");

  });

  it("Should use only 1 hop when using Phoenix protocol", async () => {
    // Create the router
    const router = createRouter(
      [
        {
          protocol: Protocol.PHOENIX,
          fn: async () => [
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "USDC_ADDRESS",
              reserveA: "8291494350066",
              reserveB: "706515116511",
              fee: "30",
            },
            {
              tokenA: "USDC_ADDRESS",
              tokenB: "AQUA_ADDRESS",
              reserveA: "57162602823",
              reserveB: "99250433014286",
              fee: "30",
            },
            {
              tokenA: "XLM_ADDRESS",
              tokenB: "AQUA_ADDRESS",
              reserveA: "82914943500660",
              reserveB: "1226709907909250",
              fee: "30",
            },
          ],
        },
      ],
      [Protocol.PHOENIX]
    );

    // Define the input amount and target currency
    const amountSplit = CurrencyAmount.fromRawAmount(XLM_TOKEN, 10000_0000000);
    const quoteCurrency = AQUA_TOKEN;
    const parts = 10;

    // Route using the Phoenix protocol
    const route = await router.routeSplit(
      amountSplit,
      quoteCurrency,
      TradeType.EXACT_INPUT,
      parts
    );

    expect(route).not.toBeNull();

    // Extract Phoenix distribution
    const phoenixDistribution = route.trade.distribution.find(
      (d) => d.protocol_id === Protocol.PHOENIX
    );

    // Log route for debugging
    console.log("🚀 ~ it ~ route.trade:", route.trade);
    console.log("🚀 ~ it ~ route.trade.distribution:", route.trade.distribution);

    // Assert that Phoenix uses only 1 hop
    expect(phoenixDistribution).not.toBeNull();
    expect(phoenixDistribution?.path.length).toEqual(2); // Only XLM and AQUA

    // This test should initially fail because multiple hops are allowed
    // until the logic is updated to ensure a single hop for Phoenix
  });

});

