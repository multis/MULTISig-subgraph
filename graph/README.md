
# Multisig Transaction History (Graph)



## Getting started



1. Build

```
$ yarn install
$ yarn prepare:mainnet|rinkeby
$ yarn codegen
$ yarn build
```

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

dev.dev.dev...

## Deploy on production


1. Authenticate to a graph node

```
$ graph auth https://api.thegraph.com/deploy/ <token>
```

2. deploy

```
$ graph deploy \
    --debug \
    --node https://api.thegraph.com/deploy/ \
    --ipfs https://api.thegraph.com/ipfs/ \
    gjeanmart/multisig
```


## Queries

### Get all wallets

```
{
  wallets(first: 10) {
    id
    factoryAddress
    creationBlock
    creationDate
  }
}
```

### Get wallet details

```

```
