# Soroswap Router SDK

[![npm version](https://badge.fury.io/js/soroswap-router-sdk.svg)](https://badge.fury.io/js/soroswap-router-sdk) 

This repository contains routing logic for the Soroswap.Finance protocol.

It searches for the most efficient way to swap token A for token B, considering the reserves available in the protocol's liquidity pools.

**Useful links:**
- Documentation: https://soroswap-router-sdk.soroswap.finance/ 
- NPM Package: https://www.npmjs.com/package/soroswap-router-sdk
- Github Repo: https://github.com/soroswap/soroswap-router-sdk
- [Soroswap.Finance Discord Server] (https://discord.gg/QaezKEWXqX)

## Install

```ts
npm i soroswap-router-sdk
```

or

```ts
yarn add soroswap-router-sdk
```

## How to use

```ts
import {
  Router,
  Token,
  CurrencyAmount,
  TradeType,
  Networks,
} from "soroswap-router-sdk";

const XLM_ADDRESS = "CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4";
const USDC_ADDRESS = "CAMZFR4BHDUMT6J7INBBBGJG22WMS26RXEYORKC2ERZL2YGDIEEKTOJB";

const XLM_TOKEN = new Token(
  Networks.TESTNET,
  XLM_ADDRESS,
  7,
  "XLM",
  "Stellar Lumens"
);

const USDC_TOKEN = new Token(
  Networks.TESTNET,
  USDC_ADDRESS,
  7,
  "USDC",
  "USD Coin"
);

const amount = 10000000;

const router = new Router({
  backendUrl: "https://my-backend.com/", //soroswap backend
  backendApiKey: "my-api-key", // soroswap backend api key
  pairsCacheInSeconds: 20, // pairs cache duration
  protocols: [Protocols.SOROSWAP], // protocols to be used
  network: Networks.TESTNET, // network to be used
});

const currencyAmount = CurrencyAmount.fromRawAmount(USDC_TOKEN, amount);
const quoteCurrency = XLM_TOKEN;

const route = await router.route(
  currencyAmount,
  quoteCurrency,
  TradeType.EXACT_INPUT
);

console.log(route.trade.path);

//Output: ['0x...', '0x...', '0x...']
```
## Document
1.- Generate Documentation
```
bash docker/run.sh
yarn
yarn docs
```
