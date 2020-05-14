#!/bin/bash

GRAPH_NODE=https://api.thegraph.com/deploy/
IPFS_NODE=https://api.thegraph.com/ipfs/
PROJECT_ID=gjeanmart/multisig


# Deploy
graph deploy --debug --node $GRAPH_NODE --ipfs $IPFS_NODE $PROJECT_ID