
# Multisig Transaction History (Graph-Protocol)

This project is an attempt to index the transaction history of our MULTISig wallets as well as metadata (owner, dayly limit, etc.) in order to efficiently (fast to load) and truthfully (blockchain information) build the Multis Wallet UI.

## Prerequiste

- libsecret-1-dev
```
$ sudo apt-get install libsecret-1-dev
```

- yarn
```
$ sudo apt-get install yarn
```

- graph-cli

```
$ yarn global add @graphprotocol/graph-cli
```

## Getting started

0. Source

```
git clone https://github.com/gjeanmart/ethereum-multisig-transaction-history
cd ./ethereum-multisig-transaction-history/graph
```

1. Build

```
$ .script/build.sh [--reset] [--code-gen] [--network mainnet|rinkeby]
```

- `--reset -r` deletes the build and generated code folders [optional]
- `--code-gen -c` (re)generate code from schema [optional]
- `--network -n` select a target network (mainnet or rinkeby) [optional, default: mainnet]

2. Start a local node

```
$ docker-compose -f ./node/docker-compose.yml up
$ graph create --node http://localhost:8020/ gjeanmart/multisig
$ ./script/deploy.sh [--network mainnet|rinkeby] --local
```

can't really work without an archive node. 


## Deploy on production

1. Authenticate to a graph node

```
$ graph auth https://api.thegraph.com/deploy/ <token>
```

2. deploy

```
$ ./script/deploy.sh [--network mainnet|rinkeby] [--local]
```

- `--network -n` select a target network (mainnet or rinkeby) [optional, default: mainnet]
- `--local -l`  deploy on a local node instead of a TheGraph node (https://api.thegraph.com/deploy/) [optional]


## Model

- Genesis
- Token
- Wallet
- Balance
- Allowance
- Submission
- Transaction
- Action

[TODO: graph schema diagram]


## Queries

### Balance

```graphql
{
  wallet(id: "0xed6a3f3d846ba7733d0a9a4d4a52f23404b4b394") {
    id
    balances {
      token {
        symbol
        id
      }
      value
    }
  }
}

```

### Transaction History

```graphql
{
  wallet(id: "0xed6a3f3d846ba7733d0a9a4d4a52f23404b4b394") {
    id
    totalTransactions
    transactions(where: {type: VALUE}, orderBy: date, orderDirection: desc) {
      hash
      date
      status
      value
      token {
        symbol
        id
        decimals
      }
      from
      to
      type
      subType
    }
  }
}

```

### Get wallet details

```graphql
{
  wallet(id: "0xed6a3f3d846ba7733d0a9a4d4a52f23404b4b394") {
    id
    factoryAddress
    date
    hash
    owners
    required
    dailyLimit
}

```

### Pending submissions

```graphql
{
  wallet(id: "0xed6a3f3d846ba7733d0a9a4d4a52f23404b4b394") {
    id
    submissions(where: {ended: false}, orderBy: date, orderDirection: desc) {
      id
      date
      executionId
      value
      destination
      data
      actions {
        id
        date
        type
        sender
      }
    }
  }
}
```

### Admin history

```graphql
{
  wallet(id: "0xed6a3f3d846ba7733d0a9a4d4a52f23404b4b394") {
    id
    totalTransactions
    transactions(where: {type: VALUE}, orderBy: date, orderDirection: desc) {
      hash
      date
      status
      value
      token {
        symbol
        id
        decimals
      }
      from
      to
      type
      subType
    }
  }
}

```