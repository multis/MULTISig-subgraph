(async () => {
  console.log('##########################################################################')
  console.log('## Transaction History                                                  ##')
  console.log('##########################################################################')

  ///////////////////////////////////////////////////////////////////////////////////////////////
  // IMPORT
  require('dotenv').config()
  const HDWalletProvider = require('@truffle/hdwallet-provider')
  const Web3 = require('web3')
  const readlineSync = require('readline-sync')
  const request = require('request-promise')
  const MULTISIG_ABI = require('./abi/MultiSigWalletWithDailyLimit.json')
  const MULTISIG_FACTORY_ABI = require('./abi/MultisigWalletFactory.json')
  const ERC20_ABI = require('./abi/ERC20.json')

  ///////////////////////////////////////////////////////////////////////////////////////////////
  // FUNCTIONS

  const getDef = (name) => {
    const result = CONTRACT_DEF.filter(def => def.name === name)
    return result[0]
  }

  const readEvents = async (def, from, to) => {
    const contract = new web3.eth.Contract(def.abi, def.addr)
    return {
      name: def.name,
      events: await contract.getPastEvents(def.event || 'allEvents', {
        filter: def.filter || {},
        fromBlock: from || 0,
        toBlock: to || 'latest'
      })
    }
  }

  const getMultisigBirthBlock = async (multisig, factory) => {
    const result = await readEvents({abi: MULTISIG_FACTORY_ABI, addr: factory.addr, event: 'ContractInstantiation'}, factory.block)
    const found = result.events.find(e => e.returnValues[1] === multisig)

    if(found) {
      return found.blockNumber
    } else {
      throw "Multisig " + multisig + " not found in the logs (ContractInstantiation) of the factory " + factory.addr
    }
  }

  const getEvents = async (definitions, from, to) => {
    return Promise.all(definitions.map(async (def) => readEvents(def, from, to)))
  }

  const sortByBlockNoDesc = (e1, e2) => {
    return e2.blockNumber - e1.blockNumber
  }

  const getTransactionInfo = async (multisigAddr, transactionId) => {
      const contract = new web3.eth.Contract(MULTISIG_ABI, multisigAddr)
      return await contract.methods.transactions(transactionId).call();
  }

  const getTransactionConfirmations = async (multisigAddr, transactionId, from, to) => {
      const result = await readEvents({abi: MULTISIG_ABI, addr: multisigAddr, event: 'Confirmation', filter: {transactionId}}, from, to);

      return Promise.all(result.events.map(async e => {
        const {blockNumber, transactionHash, returnValues} = e
        return {
          transactionHash,
          blockNumber,
          sender: returnValues.sender,
          date: await getDateByBlockNumber(blockNumber)
        }
      }))
  }

  const getOtherEvents = async (multisigAddr, blockNumber) => {
      const result = await readEvents({abi: MULTISIG_ABI, addr: multisigAddr}, blockNumber, blockNumber);
      return result.events.map(e => e.event)
  }

  const getDateByBlockNumber = async (blockNumber) => {
      const block = await web3.eth.getBlock(blockNumber);
      return new Date(block.timestamp*1000);
  }

  const getData = async (e, rules) => {

    const {blockNumber, transactionHash, event, address, returnValues, name} = e
    const {symb} = getDef(name)

    const date = rules.pullBlockTimestamp ? await getDateByBlockNumber(blockNumber) : null

    let value = "0", transactionId, transaction, confirmations;

    if(['Execution', 'ExecutionFailure', 'Revocation'].includes(event)) {
      transactionId = returnValues.transactionId
      transaction = await getTransactionInfo(address, transactionId)
      value = transaction.value || "0"
      confirmations = (rules.pullConfirmations) ? await getTransactionConfirmations(address, transactionId, blockNumber - 100000, blockNumber) : null

      const otherEvents = await getOtherEvents(address, blockNumber)
      if(rules.excludes && rules.excludes.some(val => otherEvents.indexOf(val) !== -1)) {
        return {status: "skipped"}
      }
      if(rules.includes && rules.includes.some(val => otherEvents.indexOf(val) === -1)) {
        return {status: "skipped"}
      }

    } else if(['Transfer', 'Deposit'].includes(event)) {
      value = returnValues.value
    }

    return {status: "ok", data: {blockNumber, transactionHash, event, address, name, date, symb, value, transactionId, transaction, confirmations}}
  }

  const flattenAndSortResult = result => {
    const events = []
    result.forEach(r => r.events.forEach(e => {
      e.name = r.name
      events.push(e)
    }))
    return events.sort(sortByBlockNoDesc)
  }

  const print = data => {
    console.log('-----------------------------------------------------------------------')
    console.log('### tx ' + data.transactionHash + ' - block #' + data.blockNumber + ((data.date !== null) ? ' ('+data.date.toLocaleDateString()+')' : ''))
    console.log('# address: ' + data.address)
    console.log('# event: ' + data.event)
    console.log('# type: ' + data.name)
    console.log('# value: ' + Number(web3.utils.fromWei(data.value)).toFixed(2) + ' ' + data.symb)
    if(data.transactionId) {
      console.log('# transactionId: ' + data.transactionId )
    }
    if(data.transaction) {
      console.log('# executed: ' + data.transaction.executed)
    }
    if(data.confirmations) {
      console.log('# confirmations:')
      data.confirmations.forEach(e => console.log('   - tx ' + e.transactionHash + ' - block #' + e.blockNumber + ' ('+e.date.toLocaleDateString()+') - sender ' + e.sender));
    }
  }


  ///////////////////////////////////////////////////////////////////////////////////////////////
  // CONFIG
  const MIN_PAGE_SIZE = 20
  const NETWORKS = ['mainnet', 'rinkeby']
  const FACTORY_ADDR = {
    mainnet: {
      gsn: {addr: "0x16154F7e9DE01e6B39dAc3159805e9B1531ee3cf", block: 9252472},
      gnosis: {addr: "0x6e95c8e8557abc08b46f3c347ba06f8dc012763f", block: /*4744726*/7000000}
    },
    rinkeby: {
      gsn: {addr: "0x64C50306e1061C76D00AA7920484d87f90f8DD5F", block: 5756898},
      gnosis: {addr: "0x19ba60816abca236baa096105df09260a4791418", block: 1821876}
    }
  }


  ///////////////////////////////////////////////////////////////////////////////////////////////
  // NETWORK AND WEB3
  let i = readlineSync.keyInSelect(NETWORKS, 'Which networks? ')
  const network = NETWORKS[i]
  const nodeURL = "wss://"+network+".infura.io/ws/v3/"+process.env.INFURA_KEY
  console.log('Connecting to node ' + nodeURL + '...')
  let provider = new HDWalletProvider(process.env.MNEMONIC, nodeURL)
  const web3 = new Web3(provider)

  const lastBlock = await web3.eth.getBlockNumber()
  console.log('Last Block: #' + lastBlock)


  ///////////////////////////////////////////////////////////////////////////////////////////////
  // MULTISIG
  const multisigAddr = web3.utils.toChecksumAddress(readlineSync.question('Multisig address? '))
  const gsn = readlineSync.keyInYN('GSN?')
  const factory = FACTORY_ADDR[network][gsn?"gsn":"gnosis"]


  ///////////////////////////////////////////////////////////////////////////////////////////////
  // BLOCKS
  const birthBlock = await getMultisigBirthBlock(multisigAddr, factory)
  console.log('Birth block: ' + birthBlock)
  const b = readlineSync.question('Block range? (press Enter to pull all the transactions in once) ')
  const blockRange = (b && b!=="")?Number(b):(lastBlock-birthBlock)


  ///////////////////////////////////////////////////////////////////////////////////////////////
  // EXTRA
  const pullConfirmations = readlineSync.keyInYN('Pull confirmations?')
  const pullBlockTimestamp = readlineSync.keyInYN('Pull Block timestamp?')


  ///////////////////////////////////////////////////////////////////////////////////////////////
  // CONTRACT DEFINITION
  const CONTRACT_DEF =[{name: 'multisig-out', symb: 'eth',  addr: multisigAddr,                                 abi: MULTISIG_ABI, event: 'Execution'},
                       {name: 'multisig-in',  symb: 'eth',  addr: multisigAddr,                                 abi: MULTISIG_ABI, event: 'ExecutionFailure'},
                       {name: 'multisig-in',  symb: 'eth',  addr: multisigAddr,                                 abi: MULTISIG_ABI, event: 'Revocation'},
                       {name: 'multisig-in',  symb: 'eth',  addr: multisigAddr,                                 abi: MULTISIG_ABI, event: 'Deposit'},
                       {name: 'crdt-in',      symb: 'crdt', addr: '0x1c4d5ca50419f94fc952a20dddcdc4182ef77cdf', abi: ERC20_ABI, event: 'Transfer', filter: {to: [multisigAddr]}},
                       {name: 'crdt-out',     symb: 'crdt', addr: '0x1c4d5ca50419f94fc952a20dddcdc4182ef77cdf', abi: ERC20_ABI, event: 'Transfer', filter: {from: [multisigAddr]}},
                       {name: 'dai-in',       symb: 'dai',  addr: '0x6b175474e89094c44da98b954eedeac495271d0f', abi: ERC20_ABI, event: 'Transfer', filter: {to: [multisigAddr]}},
                       {name: 'dai-out',      symb: 'dai',  addr: '0x6b175474e89094c44da98b954eedeac495271d0f', abi: ERC20_ABI, event: 'Transfer', filter: {from: [multisigAddr]}},
                       {name: 'knc-in',       symb: 'knc',  addr: '0xdd974d5c2e2928dea5f71b9825b8b646686bd200', abi: ERC20_ABI, event: 'Transfer', filter: {to: [multisigAddr]}},
                       {name: 'knc-out',      symb: 'knc',  addr: '0xdd974d5c2e2928dea5f71b9825b8b646686bd200', abi: ERC20_ABI, event: 'Transfer', filter: {from: [multisigAddr]}},
                       {name: 'sai-in',       symb: 'sai',  addr: '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359', abi: ERC20_ABI, event: 'Transfer', filter: {to: [multisigAddr]}},
                       {name: 'sai-out',      symb: 'sai',  addr: '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359', abi: ERC20_ABI, event: 'Transfer', filter: {from: [multisigAddr]}},
                       {name: 'usdc-in',      symb: 'usdc', addr: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', abi: ERC20_ABI, event: 'Transfer', filter: {to: [multisigAddr]}},
                       {name: 'usdc-out',     symb: 'usdc', addr: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', abi: ERC20_ABI, event: 'Transfer', filter: {from: [multisigAddr]}}]



  const pastTransactions = async (multisigAddr) => {
    console.log('########################### PAST TRANSACTIONS ############################')
    console.log('##########################################################################')

    let i = lastBlock;
    let total = 0;
    let pageSize = 0;
    let start = new Date().getTime();

    while (i >= birthBlock) {
      const result = await getEvents(CONTRACT_DEF, i-blockRange, i)
      const data = await Promise.all(flattenAndSortResult(result).map(e => getData(e, {pullConfirmations, pullBlockTimestamp, exludes: ['OwnerAddition', 'OwnerRemoval', 'RequirementChange', 'DailyLimitChange']})))

      data.filter(i => i.status === "ok")
          .forEach(i => print(i.data));

      total += pageSize += data.length
      i = i - blockRange - 1

      if(i > birthBlock && pageSize < MIN_PAGE_SIZE) {
        continue // pull more transaction to have at least 20 results

      } else {
        let end = new Date().getTime();
        console.log('[Page] size: ' + pageSize + ' pulled in ' + ((end-start)/1000) + ' seconds')

        if (i >= birthBlock && readlineSync.keyInYN('Do you want pull more transactions')) {
          pageSize = 0
          start = new Date().getTime()
        } else {
          break
        }
      }
    }
    console.log("[Total] past transactions: " + total)
  }


  const pendingTransactions = async (multisigAddr) => {
    console.log('########################### PENDING TRANSACTIONS #########################')
    console.log('##########################################################################')

  }


  const adminTransactions = async (multisigAddr) => {
    console.log('########################### ADMIN TRANSACTIONS #########################')
    console.log('##########################################################################')

    let i = lastBlock;
    let total = 0;
    let pageSize = 0;
    let start = new Date().getTime();

    while (i >= birthBlock) {
      const result = await getEvents(CONTRACT_DEF, i-blockRange, i)
      const data = await Promise.all(flattenAndSortResult(result).map(e => getData(e, {pullConfirmations, pullBlockTimestamp, includes: ['OwnerAddition', 'OwnerRemoval', 'RequirementChange', 'DailyLimitChange']})))

      data.filter(i => i.status === "ok")
          .forEach(i => print(i.data));

      total += pageSize += data.filter(i => i.status === "ok").length
      i = i - blockRange - 1

      if(i > birthBlock && pageSize < MIN_PAGE_SIZE) {
        continue // pull more transaction to have at least 20 results

      } else {
        let end = new Date().getTime();
        console.log('[Page] size: ' + pageSize + ' pulled in ' + ((end-start)/1000) + ' seconds')

        if (i >= birthBlock && readlineSync.keyInYN('Do you want pull more transactions')) {
          pageSize = 0
          start = new Date().getTime()
        } else {
          break
        }
      }
    }
    console.log("[Total] past transactions: " + total)
  }

  /////////////////////////////////////////////////////////////////////

  const options = ['Past Transactions', 'Pending confirmations', 'Admin transactions']
  let index = readlineSync.keyInSelect(options, 'Which options ?')

  switch(options[index]) {
    case options[0]:
      await pastTransactions(multisigAddr)
      break;
    case options[1]:
      await pendingTransactions(multisigAddr)
      break;
    case options[2]:
      await adminTransactions(multisigAddr)
      break;
  }

  // END...
  provider.engine.stop();
  console.log('END!')
  process.exit()
})();
