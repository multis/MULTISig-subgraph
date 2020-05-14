#!/bin/bash

NETWORK=mainnet

# Clean up build directories (--reset)
rm -rf build/ generated/ subgraph.yaml

# Prepare subgraph (--network)
yarn prepare:$NETWORK

# Build
graph codegen
graph build