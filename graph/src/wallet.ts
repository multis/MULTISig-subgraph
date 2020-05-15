import { Execution, Submission as SubmissionEvent, Deposit, 
         OwnerAddition, OwnerRemoval, DailyLimitChange, 
         RequirementChange, GSNMultiSigWalletWithDailyLimit, 
         Confirmation, Revocation } 
         from '../generated/templates/GSNMultiSigWalletWithDailyLimit/GSNMultiSigWalletWithDailyLimit'
import { Transfer } from '../generated/templates/ERC20/ERC20'
import { Wallet, Transaction, Submission, Action, Balance } from '../generated/schema'
import { zeroBigInt, concat } from './utils'
import { log, Address, crypto, ByteArray, BigInt, ethereum } from '@graphprotocol/graph-ts'



export function handleSubmission(event: SubmissionEvent): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let multisig = GSNMultiSigWalletWithDailyLimit.bind(multisigAddr)
        let callResult = multisig.transactions(event.params.transactionId)

        let submission = loadOrCreateSubmission(multisigAddr, event.params.transactionId, event)
        submission.executionId = event.params.transactionId
        submission.value = callResult.value1
        submission.destination = callResult.value0
        submission.data = callResult.value2

        //let action = loadOrCreateAction(multisigAddr, event.params.transactionId, "SUBMIT", /* REQUIRE SENDER (_msgSender()) */, event)
        //action.save()

        //submission = addActionToSubmission(submission, action)
        submission.save()
    
        let submissions = wallet.submissions
        submissions.push(submission.id)
        wallet.submissions = submissions
        
        wallet.save()

    } else {
        log.warning("handleSubmission::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleConfirmation(event: Confirmation): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let submission = loadOrCreateSubmission(multisigAddr, event.params.transactionId, event)

        let action = loadOrCreateAction(multisigAddr, event.params.transactionId, "CONFIRM", event.params.sender, event)
        action.save()

        submission = addActionToSubmission(submission, action)
        submission.save()

    } else {
        log.warning("handleConfirmation::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleRevocation(event: Revocation): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let submission = loadOrCreateSubmission(multisigAddr, event.params.transactionId, event)

        let action = loadOrCreateAction(multisigAddr, event.params.transactionId, "REVOKE", event.params.sender, event)
        action.save()

        submission = addActionToSubmission(submission, action)
        submission.ended = true
        submission.save()

    } else {
        log.warning("handleRevocation::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleExecution (event: Execution): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let submission = loadOrCreateSubmission(multisigAddr, event.params.transactionId, event)
        //let action = loadOrCreateAction(multisigAddr, event.params.transactionId, "EXECUTE", /* REQUIRE SENDER (_msgSender()) */, event)
        //action.save()

        //submission = addActionToSubmission(submission, action)
        submission.ended = true
        submission.save()

        let multisig = GSNMultiSigWalletWithDailyLimit.bind(multisigAddr)
        let callResult = multisig.transactions(event.params.transactionId)

        let transaction = loadOrCreateTransaction(multisigAddr, event)
        transaction.executionId = event.params.transactionId

        // value > 0 and no data (Value transfer)
        if(callResult.value1.gt(zeroBigInt()) && callResult.value2.length == 0) {
            transaction.type = "VALUE"
            transaction.value = callResult.value1
            transaction.token = "0x0000000000000000000000000000000000000000" // ETH

            let balance = loadOrCreateBalance(multisigAddr, <Address>Address.fromHexString(transaction.token))
            balance.value = (balance.value.minus(<BigInt>transaction.value))
            balance.save()
            wallet = updateBalance(wallet, balance)

        // value == 0 and data (Contract or ERC20) TODO find a way to differentiate both case (parse data???)
        } else if(callResult.value1.equals(zeroBigInt()) && callResult.value2.length > 0) {
            //todo...

        // value > 0 and data (Contract)
        } else if(callResult.value1.gt(zeroBigInt()) && callResult.value2.length > 0) {
            transaction.type = "CONTRACT"
            transaction.value = callResult.value1
            transaction.token = "0x0000000000000000000000000000000000000000" // ETH

            let balance = loadOrCreateBalance(multisigAddr, <Address>Address.fromHexString(transaction.token))
            balance.value = (balance.value.minus(<BigInt>transaction.value))
            balance.save()
            wallet = updateBalance(wallet, balance)
        }

        transaction.status = "EXECUTED"
        transaction.submission = submission.id
        transaction.save()
    
        wallet = pushTransactionIfNotExist(wallet, transaction)
        wallet.save()

    } else {
        log.warning("handleExecution::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleExecutionFailure (event: Execution): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let submission = loadOrCreateSubmission(multisigAddr, event.params.transactionId, event)
        //let action = loadOrCreateAction(multisigAddr, event.params.transactionId, "EXECUTE", /* REQUIRE SENDER (_msgSender()) */, event)
        //action.save()

        //submission = addActionToSubmission(submission, action)
        submission.ended = true
        submission.save()

        let multisig = GSNMultiSigWalletWithDailyLimit.bind(multisigAddr)
        let callResult = multisig.transactions(event.params.transactionId)

        let transaction = loadOrCreateTransaction(multisigAddr, event)
        transaction.executionId = event.params.transactionId
        transaction.from = multisigAddr
        transaction.to = callResult.value0

        // value > 0 and no data (Value transfer)
        if(callResult.value1.gt(zeroBigInt()) && callResult.value2.length == 0) {
            transaction.type = "VALUE"
            transaction.value = callResult.value1
            transaction.token = "0x0000000000000000000000000000000000000000" // ETH

            let balance = loadOrCreateBalance(multisigAddr, <Address>Address.fromHexString(transaction.token))
            balance.value = (balance.value.minus(<BigInt>transaction.value))
            balance.save()
            wallet = updateBalance(wallet, balance)

        // value == 0 and data (Contract or ERC20) TODO find a way to differentiate both case (parse data???)
        } else if(callResult.value1.equals(zeroBigInt()) && callResult.value2.length > 0) {
            //todo...

        // value > 0 and data (Contract)
        } else if(callResult.value1.gt(zeroBigInt()) && callResult.value2.length > 0) {
            transaction.type = "CONTRACT"
            transaction.value = callResult.value1
            transaction.token = "0x0000000000000000000000000000000000000000" // ETH

            let balance = loadOrCreateBalance(multisigAddr, <Address>Address.fromHexString(transaction.token))
            balance.value = (balance.value.minus(<BigInt>transaction.value))
            balance.save()
            wallet = updateBalance(wallet, balance)
        }

        transaction.status = "FAILED"
        transaction.submission = submission.id
        transaction.save()
    
        wallet = pushTransactionIfNotExist(wallet, transaction)
        wallet.save()

    } else {
        log.warning("handleExecution::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleDeposit(event: Deposit): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let transaction = loadOrCreateTransaction(multisigAddr, event)
        transaction.type = "VALUE"
        transaction.status = "EXECUTED"
        transaction.value = event.params.value
        transaction.token = "0x0000000000000000000000000000000000000000" // ETH
        transaction.from = event.params.sender
        transaction.to = multisigAddr
        transaction.save()
    
        let balance = loadOrCreateBalance(multisigAddr, <Address>Address.fromHexString(transaction.token))
        balance.value = (balance.value.plus(<BigInt>transaction.value))
        balance.save()

        wallet = pushTransactionIfNotExist(wallet, transaction)
        wallet = updateBalance(wallet, balance)
        wallet.save()

    } else {
        log.warning("handleDeposit::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleOwnerAddition(event: OwnerAddition): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let transaction = loadOrCreateTransaction(multisigAddr, event)
        transaction.type = "ADMIN"
        transaction.subType = "ADD_OWNER"
        transaction.from = multisigAddr
        transaction.to = multisigAddr
        transaction.extraBytes1 = event.params.owner
        transaction.save()
    
        let owners = wallet.owners
        owners.push(event.params.owner)
        wallet.owners = owners
        wallet = pushTransactionIfNotExist(wallet, transaction)
        wallet.save()

    } else {
        log.warning("handleOwnerAddition::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleOwnerRemoval(event: OwnerRemoval): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let transaction = loadOrCreateTransaction(multisigAddr, event)
        transaction.type = "ADMIN"
        transaction.subType = "REMOVE_OWNER"
        transaction.from = multisigAddr
        transaction.to = multisigAddr
        transaction.extraBytes1 = event.params.owner
        transaction.save()
    
        let owners = wallet.owners
        let index = owners.indexOf(event.params.owner, 0)
        if (index > -1) {
            owners = owners.splice(index, 1);

        }
        wallet.owners = owners
        wallet = pushTransactionIfNotExist(wallet, transaction)
        wallet.save()

    } else {
        log.warning("handleOwnerRemoval::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleDailyLimitChange(event: DailyLimitChange): void { 

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let transaction = loadOrCreateTransaction(multisigAddr, event)
        transaction.type = "ADMIN"
        transaction.subType = "CHANGE_DAILY_LIMIT"
        transaction.from = multisigAddr
        transaction.to = multisigAddr
        transaction.extraBigInt1 = event.params.dailyLimit 
        transaction.save()
    
        wallet = pushTransactionIfNotExist(wallet, transaction)
        wallet.dailyLimit = event.params.dailyLimit
        wallet.save()

    } else {
        log.warning("handleDailyLimitChange::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleRequirementChange(event: RequirementChange): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let transaction = loadOrCreateTransaction(multisigAddr, event)
        transaction.type = "ADMIN"
        transaction.subType = "CHANGE_REQUIREMENT"
        transaction.from = multisigAddr
        transaction.to = multisigAddr
        transaction.extraBigInt1 = event.params.required 
        transaction.save()
    
        wallet = pushTransactionIfNotExist(wallet, transaction)
        wallet.required = event.params.required
        wallet.save()

    } else {
        log.warning("handleRequirementChange::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleERC20Transfer(event: Transfer): void {
    handleERC20Transfer2(event.params.from, event)
    handleERC20Transfer2(event.params.to, event)
}

function handleERC20Transfer2(id: Address, event: Transfer): void {
    
    let multisigAddr = id
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let transaction = loadOrCreateTransaction(multisigAddr, event)
        transaction.type = "VALUE"
        transaction.subType = "ERC20"
        transaction.status = "EXECUTED"
        transaction.value = event.params.value
        transaction.token = event.address.toHexString()
        transaction.from = event.params.from
        transaction.to = event.params.to
        transaction.save()
    
        let balance = loadOrCreateBalance(multisigAddr, event.address)
        balance.value = (multisigAddr == event.params.to) ? (balance.value.plus(event.params.value)) : (balance.value.minus(event.params.value))
        balance.save()

        wallet = pushTransactionIfNotExist(wallet, transaction)
        wallet = updateBalance(wallet, balance)
        wallet.save()
    } 
}

function loadOrCreateTransaction(multisig: Address, event: ethereum.Event): Transaction {
    let id = crypto.keccak256(concat(multisig, event.transaction.hash))
    let transaction = new Transaction(id.toHexString())
    transaction.date = event.block.timestamp
    transaction.hash = event.transaction.hash

    return transaction
}

function loadOrCreateSubmission(multisig: Address, transactionId: BigInt, event: ethereum.Event): Submission {
    let id = crypto.keccak256(concat(multisig, ByteArray.fromI32(transactionId.toI32())))
    let submission = new Submission(id.toHexString())
    submission.date = event.block.timestamp
    submission.hash = event.transaction.hash

    return submission
}

function loadOrCreateAction(multisig: Address, transactionId: BigInt, type: string, sender: Address, event: ethereum.Event): Action {
    let id = crypto.keccak256(concat(concat(multisig, event.transaction.hash), ByteArray.fromI32(transactionId.toI32())))
    let action = new Action(id.toHexString())
    action.date = event.block.timestamp
    action.hash = event.transaction.hash
    action.executionId = transactionId
    action.type = type
    action.sender = sender

    return action
}

function loadOrCreateBalance(multisig: Address, token: Address): Balance {
    let id = crypto.keccak256(concat(multisig, token))

    let balance = Balance.load(id.toHexString())
    if(balance == null) {
        balance = new Balance(id.toHexString())
        balance.token = token.toHexString()
        balance.wallet = multisig.toHexString()
        balance.value = zeroBigInt()
    }

    return <Balance> balance
}

function updateBalance(wallet: Wallet|null, balance: Balance): Wallet|null {
    if(wallet == null) throw "wallet cannot be null"

    let balances = wallet.balances

    if (balances.indexOf(balance.id, 0) == -1) {
        balances.push(balance.id)
        wallet.balances = balances
    }

    return wallet
}

function addActionToSubmission(submission: Submission, action: Action): Submission {
    let actions = (submission.actions != null) ? submission.actions : <string[]>[]
    actions.push(action.id)
    submission.actions = actions
    return submission
}

function pushTransactionIfNotExist(wallet: Wallet|null, transaction: Transaction): Wallet|null {
    if(wallet == null) throw "wallet cannot be null"

    let transactions = wallet.transactions

    if (transactions.indexOf(transaction.id, 0) == -1) {
        transactions.push(transaction.id)
        wallet.transactions = transactions
    }

    wallet.totalTransactions = BigInt.fromI32(wallet.transactions.length)
    return wallet
}