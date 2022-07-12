/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

import { error, success, start } from 'fabric-shim';
import { format } from 'util';

const ABstore = class {

  // Initialize the chaincode
  /*
  docker exec cli peer chaincode invoke \
    --tls --cafile /opt/home/managedblockchain-tls-chain.pem \
    --channelID mychannel \
    --name mycc -c '{"Args":["init", "a", "100", "b", "200"]}'
  */
  async Init(stub) {
    console.info('========= ABstore Init =========');
    let ret = stub.getFunctionAndParameters();
    console.info(ret);
    let args = ret.params;
    // initialise only if 4 parameters passed.
    if (args.length != 4) {
      return error('Incorrect number of arguments. Expecting 4');
    }

    let A = args[0];
    let B = args[2];
    let Aval = args[1];
    let Bval = args[3];

    if (typeof parseInt(Aval) !== 'number' || typeof parseInt(Bval) !== 'number') {
      return error('Expecting integer value for asset holding');
    }

    try {
      await stub.putState(A, Buffer.from(Aval));
      try {
        await stub.putState(B, Buffer.from(Bval));
        return success();
      } catch (err) {
        return error(err);
      }
    } catch (err) {
      return error(err);
    }
  }

  async Invoke(stub) {
    let ret = stub.getFunctionAndParameters();
    console.info(ret);
    let method = this[ret.fcn];
    if (!method) {
      console.log('no method of name:' + ret.fcn + ' found');
      return success();
    }
    try {
      let payload = await method(stub, ret.params);
      return success(payload);
    } catch (err) {
      console.log(err);
      return error(err);
    }
  }


  /* 
  docker exec cli peer chaincode invoke \
    --tls --cafile /opt/home/managedblockchain-tls-chain.pem \
    --channelID mychannel \
    --name mycc -c '{"Args":["invoke", "a", "b", "10"]}'
  */
  async invoke(stub, args) {
    if (args.length != 3) {
      throw new Error('Incorrect number of arguments. Expecting 3');
    }

    let A = args[0];
    let B = args[1];
    if (!A || !B) {
      throw new Error('asset holding must not be empty');
    }

    // Get the state from the ledger
    let Avalbytes = await stub.getState(A);
    if (!Avalbytes) {
      throw new Error('Failed to get state of asset holder A');
    }
    let Aval = parseInt(Avalbytes.toString());

    let Bvalbytes = await stub.getState(B);
    if (!Bvalbytes) {
      throw new Error('Failed to get state of asset holder B');
    }

    let Bval = parseInt(Bvalbytes.toString());
    // Perform the execution
    let amount = parseInt(args[2]);
    if (typeof amount !== 'number') {
      throw new Error('Expecting integer value for amount to be transaferred');
    }

    Aval = Aval - amount;
    Bval = Bval + amount;
    console.info(format('Aval = %d, Bval = %d\n', Aval, Bval));

    // Write the states back to the ledger
    await stub.putState(A, Buffer.from(Aval.toString()));
    await stub.putState(B, Buffer.from(Bval.toString()));

  }

  /*
  docker exec cli peer chaincode delete \
    --tls --cafile /opt/home/managedblockchain-tls-chain.pem \
    --channelID mychannel \
    --name mycc -c '{"Args":["delete", "a"]}'
  */
  // Deletes an entity from state
  async delete(stub, args) {
    if (args.length != 1) {
      throw new Error('Incorrect number of arguments. Expecting 1');
    }

    let A = args[0];

    // Delete the key from the state in ledger
    await stub.deleteState(A);
  }

  /*
  docker exec cli peer chaincode query \
    --tls --cafile /opt/home/managedblockchain-tls-chain.pem \
    --channelID mychannel \
    --name mycc -c '{"Args":["query", "a"]}'
  */
  // query callback representing the query of a chaincode
  async query(stub, args) {
    if (args.length != 1) {
      throw new Error('Incorrect number of arguments. Expecting name of the person to query')
    }

    let jsonResp = {};
    let A = args[0];

    // Get the state from the ledger
    let Avalbytes = await stub.getState(A);
    if (!Avalbytes) {
      jsonResp.error = 'Failed to get state for ' + A;
      throw new Error(JSON.stringify(jsonResp));
    }

    jsonResp.name = A;
    jsonResp.amount = Avalbytes.toString();
    console.info('Query Response:');
    console.info(jsonResp);
    return Avalbytes;
  }
};

start(new ABstore());