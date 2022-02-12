// ensures that SAFE_DEPLOY exists

// this task should
// 1. ensure the orchestrator is connected
// 2. refuse to run if its on the mainnet and a SAFE_DEPLOY file doesn't exist
// 2. deploy the FOCAL contract and ensure the address is correct
// |-- needs to ensure the proper platform address is set and marketing and liquidity fee
// 3. send 20% of FOCAL to the team wallet, 5% to the marketing wallet
// 4. deploy the presale contract and send presale+privatesale tokens to it (6760000 tokens)
// 5. transfer the remaining coins to the OPERATOR wallet and then transferOwnership of both contracts
// 6. if on forknet write SAFE_DEPLOY file on success. Each step should assert to prove it was correct
// 7. verify the contract on BSCSCAN
