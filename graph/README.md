
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
$ .script/build.sh --reset --code-gen --network mainnet|rinkeby
```

- `--reset || -r` deletes the build and generated code folders
- `--code-gen || -c` generate code 
- `--network || -n` select a target network (mainnet or rinkeby)

2. Start a local node

```
$ docker-compose -f ./node/docker-compose.yml up
$ graph create --node http://localhost:8020/ gjeanmart/multisig
$ graph deploy \
    --debug \
    --node http://localhost:8020/ \
    --ipfs http://localhost:5001/ \
    gjeanmart/multisig
```

can't really work without an archive node at disposition. 


## Deploy on production

1. Authenticate to a graph node

```
$ graph auth https://api.thegraph.com/deploy/ <token>
```

2. deploy

```
$ ./script/deploy.sh --network mainnet|rinkeby --local
```

- `--network || -n` select a target network (mainnet or rinkeby)
- `--local | -l`  deploy on a local node rather than TheGraph node (default)

## Queries

### Get all wallets

```
{
  wallets(first: 10) {
    id
    factoryAddress
    creationBlock
    creationDate
    owners
  }
}

```

### Get wallet details

```
{
  wallet(id: "0x09e666e01d25b409a94da56869b5449bc2b352a9") {
    id
    factoryAddress
    creationBlock
    creationDate
    owners
    required
    dailyLimit
    pending {
      id
    }
    transactions(orderBy: block, orderDirection: desc) {
      id
      status
      block
      date
      hash
      value
      token {
        id
        symbol
        decimals
      }
      from
      to
      type
      subType
      wallet {
        id
      }
    }
  }
}

```
