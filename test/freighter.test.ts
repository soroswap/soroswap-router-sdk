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
  protocols: Protocol[] = [Protocol.SOROSWAP]
) => {
  return new Router({
    pairsCacheInSeconds: 60,
    protocols: protocols,
    network: Networks.TESTNET,
    getPairsFns,
  });
};

const createToken = (address: string) => {
  return new Token(Networks.TESTNET, address, 7);
};

const XLM_TOKEN = createToken("CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC");
const USDC_TOKEN = createToken("CCGCRYUTDRP52NOPS35FL7XIOZKKGQWSP3IYFE6B66KD4YOGJMWVC5PR");

describe("Router", () => {
  let currencyAmount: CurrencyAmount<Token>;
  let quoteCurrency: Token;

  beforeEach(() => {
    currencyAmount = CurrencyAmount.fromRawAmount(XLM_TOKEN, 10000000);
    quoteCurrency = USDC_TOKEN;
  });

  it("Ensure Direct Routing Between Tokens With Equal Reserves", async () => {
    const router = createRouter([
      {
        protocol: Protocol.SOROSWAP,
        fn: async () => {
          const res = await fetch(
            // this endpoint is used to get the pairs for Testnet which `Router` will used to determine conversion rate
            new URL(
              "https://info.soroswap.finance/api/pairs/plain?network=TESTNET",
            ),
          );

          const data = await res.json();

          return data;
        },
      },
    ]);

    console.log("🚀 ~ it ~ router:", router)



    const route = await router.route(
      currencyAmount,
      quoteCurrency,
      TradeType.EXACT_INPUT,
    );
    console.log("🚀 ~ it ~ route:", route)

    // const route = await router.route(
    //   amountCurrency,
    //   quoteCurrency,
    //   TradeType.EXACT_INPUT
    // );

    // expect(exactInput?.trade.path).toEqual(["XLM_ADDRESS", "USDC_ADDRESS"]);

    // const exactOutput = await router.route(
    //   amountCurrency,
    //   quoteCurrency,
    //   TradeType.EXACT_OUTPUT
    // );

    // expect(exactOutput?.trade.path).toEqual(["USDC_ADDRESS", "XLM_ADDRESS"]);
  });

  // it("Select Optimal Route for Exact Input Based on Reserve Ratios", async () => {
  //   const router = createRouter([
  //     {
  //       protocol: Protocol.SOROSWAP,
  //       fn: async () => [
  //         {
  //           tokenA: "XLM_ADDRESS",
  //           tokenB: "USDC_ADDRESS",
  //           reserveA: "1000",
  //           reserveB: "1000",
  //         },
  //         {
  //           tokenA: "XLM_ADDRESS",
  //           tokenB: "DOGSTAR_ADDRESS",
  //           reserveA: "1000",
  //           reserveB: "1000",
  //         },
  //         {
  //           tokenA: "USDC_ADDRESS",
  //           tokenB: "DOGSTAR_ADDRESS",
  //           reserveA: "1000",
  //           reserveB: "100",
  //         },
  //       ],
  //     },
  //   ]);
  //   //Should use xlm to dogstar to usdc, because 1 xlm = 1 dogstar and 1 dogstar = 10 usdc

  //   const route = await router.route(
  //     amountCurrency,
  //     quoteCurrency,
  //     TradeType.EXACT_INPUT
  //   );

  //   expect(route?.trade.path).toEqual([
  //     "XLM_ADDRESS",
  //     "DOGSTAR_ADDRESS",
  //     "USDC_ADDRESS",
  //   ]);
  // });

  // it("Select Optimal Route for Exact Output Based on Reserve Ratios", async () => {
  //   const router = createRouter([
  //     {
  //       protocol: Protocol.SOROSWAP,
  //       fn: async () => [
  //         {
  //           tokenA: "XLM_ADDRESS",
  //           tokenB: "USDC_ADDRESS",
  //           reserveA: "1000",
  //           reserveB: "1000",
  //         },
  //         {
  //           tokenA: "XLM_ADDRESS",
  //           tokenB: "DOGSTAR_ADDRESS",
  //           reserveA: "1000",
  //           reserveB: "100",
  //         },
  //         {
  //           tokenA: "USDC_ADDRESS",
  //           tokenB: "DOGSTAR_ADDRESS",
  //           reserveA: "1000",
  //           reserveB: "1000",
  //         },
  //       ],
  //     },
  //   ]);

  //   const route = await router.route(
  //     amountCurrency,
  //     quoteCurrency,
  //     TradeType.EXACT_OUTPUT
  //   );

  //   expect(route?.trade.path).toEqual([
  //     "USDC_ADDRESS",
  //     "DOGSTAR_ADDRESS",
  //     "XLM_ADDRESS",
  //   ]);
  // });

  // it("Handle Scenario With No Available Trading Pairs", async () => {
  //   const router = createRouter([
  //     {
  //       protocol: Protocol.SOROSWAP,
  //       fn: async () => [],
  //     },
  //   ]);

  //   const route = await router.route(
  //     amountCurrency,
  //     quoteCurrency,
  //     TradeType.EXACT_INPUT
  //   );

  //   expect(route).toBeNull();
  // });

  // it("Should Split Distribution And Select Optimal Route When Using Split Protocol", async () => {
  //   const router = createRouter(
  //     [
  //       {
  //         protocol: Protocol.SOROSWAP,
  //         fn: async () => [
  //           {
  //             tokenA: "XLM_ADDRESS",
  //             tokenB: "USDC_ADDRESS",
  //             reserveA: "1000",
  //             reserveB: "1000",
  //           },
  //           {
  //             tokenA: "XLM_ADDRESS",
  //             tokenB: "DOGSTAR_ADDRESS",
  //             reserveA: "1000",
  //             reserveB: "1000",
  //           },
  //           {
  //             tokenA: "USDC_ADDRESS",
  //             tokenB: "DOGSTAR_ADDRESS",
  //             reserveA: "1000",
  //             reserveB: "100",
  //           },
  //         ],
  //       },
  //       {
  //         protocol: Protocol.PHOENIX,
  //         fn: async () => [
  //           {
  //             tokenA: "XLM_ADDRESS",
  //             tokenB: "USDC_ADDRESS",
  //             reserveA: "1000",
  //             reserveB: "1000",
  //           },
  //           {
  //             tokenA: "XLM_ADDRESS",
  //             tokenB: "DOGSTAR_ADDRESS",
  //             reserveA: "1000",
  //             reserveB: "1000",
  //           },
  //           {
  //             tokenA: "USDC_ADDRESS",
  //             tokenB: "DOGSTAR_ADDRESS",
  //             reserveA: "1000",
  //             reserveB: "100",
  //           },
  //         ],
  //       },
  //     ],
  //     [Protocol.SOROSWAP, Protocol.PHOENIX]
  //   );

  //   const route = await router.routeSplit(
  //     amountCurrency,
  //     quoteCurrency,
  //     TradeType.EXACT_INPUT
  //   );

  //   /* 
  //   Amount are:
  //   [0,  82, 159, 224, 274, 319, 358, 393, 421, 449, 472]
  //   and
  //   [0,  82, 159, 224, 274, 319, 358, 393, 421, 449, 472]

  //   Possible combinations:
  //   (0 + 10) = 0 + 472 = 472
  //   (1 + 9 ) = 82 + 449 = 531
  //   (2 + 8 ) = 159 + 421 = 580
  //   (3 + 7 ) = 224 + 393 = 617
  //   (4 + 6 ) = 274 + 358 = 632
  //   (5 + 5 ) = 319 + 319 = 638

  //   The best combination is (5 + 5) = 319 + 319 = 638
  //   */

  //   const requiredPath = ["XLM_ADDRESS", "DOGSTAR_ADDRESS", "USDC_ADDRESS"];
  //   const requiredFinalAmount = "638";

  //   expect(route.trade.distribution[0].parts).toEqual(5);
  //   expect(route.trade.distribution[1].parts).toEqual(5);

  //   expect(route.trade.distribution[0].path).toEqual(requiredPath);
  //   expect(route.trade.distribution[1].path).toEqual(requiredPath);

  //   expect(route.trade.amountOutMin).toEqual(requiredFinalAmount);
  // });
});
