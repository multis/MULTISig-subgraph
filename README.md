
# MULTISig-subgraph

This Subgraph dynamically tracks activity on any MULTISig (and Gnosis Multisig) wallets deployed through a factory. 

### Networks:

- Ropsten https://thegraph.com/explorer/subgraph/multis/multisig-ropsten
- Rinkeby https://thegraph.com/explorer/subgraph/multis/multisig-rinkeby
- Mainnet https://thegraph.com/explorer/subgraph/multis/multisig-mainnet

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

0. Get the source and install the ddependencies

```
$ git git@github.com:multis/MULTISig-subgraph.git
$ cd ./MULTISig-subgraph
$ npm install
```

1. Build

```
$ ./script/build.sh [--reset] [--code-gen] [--network mainnet|rinkeby|ropsten]
```

- `--reset -r` deletes the build and generated code folders [optional, default: false]
- `--code-gen -c` (re)generate code from schema [optional, default: false]
- `--network -n` select a target network (mainnet, ropsten or rinkeby) [optional, default: mainnet]

2. Start a local node

```
$ docker-compose -f ./node/docker-compose.yml up
$ graph create --node http://localhost:8020/ gjeanmart/multisig
$ ./script/deploy.sh [--network mainnet|rinkeby|ropsten] --local
```

**Note: can't really work without an archive node.**


## Deployment

1. Authenticate to a graph node

```
$ graph auth https://api.thegraph.com/deploy/ <token>
```

2. Deploy

```
$ ./script/deploy.sh [--network mainnet|rinkeby|ropsten] [--local]
```

- `--network -n` select a target network (mainnet, ropsten or rinkeby) [optional, default: mainnet]
- `--local -l`  deploy on a local node instead of a TheGraph node (https://api.thegraph.com/deploy/) [optional, default: false]


## Model

- Wallet
- Transaction
- Action

