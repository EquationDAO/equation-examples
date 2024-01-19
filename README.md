# Equation Examples

The repository contains some examples of interacting with Equation, including: getting Equation data through GraphQL, getting price data through `REST`, and interacting with contracts through market orders and limit orders. For specific examples, please refer to following files:

1. [Contracts V1](./src/contracts-v1/index.ts)
2. [Contracts V2](./src/contracts-v2/index.ts)

## Run the examples

Before executing `npm run example-v1`, you need to create the `.env` file first, the content is as follows:

```text
PRIVATE_KEY=YOUR_PRIVATE_KEY
```

```bash
npm install
npm run build
npm run example-v1 # for contracts v1
npm run example-v2 # for contracts v2
```
