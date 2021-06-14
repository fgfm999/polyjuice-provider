const HttpProvider = require("web3-providers-http");
const { Godwoker } = require("./util");
const { Abi } = require("./abi");

class PolyjuiceHttpProvider extends HttpProvider {
  constructor(host, godwoken_config, abi_items, option) {
    super(host, option);
    this.godwoker = new Godwoker(host, godwoken_config);
    this.abi = new Abi(abi_items);
  }

  async send(payload, callback) {
    const { method, params } = payload;

    switch (method) {
      case "eth_sendTransaction":
        if (!window.ethereum) {
          alert(
            "PolyjuiceHttpProvider needs a wallet provider such as metamask!"
          );
          break;
        }

        try {
          const { from, gas, gasPrice, value, data, to } = params[0];

          const data_with_short_address =
            this.abi.refactor_data_with_short_address(
              data,
              this.godwoker.getShortAddressByAllTypeEthAddress.bind(
                this.godwoker
              )
            );

          const t = {
            from: from || window.ethereum.selectedAddress,
            to: to,
            value: value || 0,
            data: data_with_short_address || "",
            gas: gas,
            gasPrice: gasPrice,
          };

          const to_id = this.godwoker.allTypeEthAddressToAccountId(to);
          const sender_script_hash =
            this.godwoker.getScriptHashByEoaEthAddress(from);
          const receiver_script_hash =
            await this.godwoker.getScriptHashByAccountId(to_id);

          const polyjuice_tx = await this.godwoker.assembleRawL2Transaction(t);
          const message = this.godwoker.generateTransactionMessageToSign(
            polyjuice_tx,
            sender_script_hash,
            receiver_script_hash
          );
          const _signature = await window.ethereum.request({
            method: "personal_sign",
            params: [message, window.ethereum.selectedAddress],
          });
          const signature = this.godwoker.packSignature(_signature);
          const tx_hash = await this.godwoker.gw_submitL2Transaction(
            polyjuice_tx,
            signature
          );
          console.log(
            `provider just proxy an eth_sendTransaction rpc call, tx_hash: ${tx_hash}`
          );
          // todo: tx_hash should be eth_tx_hash not godwoken_tx_hash!
          callback(null, tx_hash);
          break;
        } catch (error) {
          this.connected = false;
          throw error;
        }

      case "eth_call":
        try {
          const { from, gas, gasPrice, value, data, to } = params[0];

          const data_with_short_address =
            this.abi.refactor_data_with_short_address(
              data,
              this.godwoker.getShortAddressByAllTypeEthAddress.bind(
                this.godwoker
              )
            );

          const t = {
            from: from || window.ethereum.selectedAddress,
            to: to,
            value: value || 0,
            data: data_with_short_address || "",
            gas: gas,
            gasPrice: gasPrice,
          };

          const polyjuice_tx = await this.godwoker.assembleRawL2Transaction(t);

          const tx_hash = await this.godwoker.gw_excuteRawL2Transaction(
            polyjuice_tx,
            signature
          );

          console.log(
            `provider just proxy an eth_call rpc call, tx_hash: ${tx_hash}`
          );

          await this.godwoker.waitForTransactionReceipt(tx_hash);
          const run_result = await this.godwoker.gw_getTransactionReceipt(
            tx_hash
          );
          console.log(`runResult: ${JSON.stringify(run_result, null, 2)}`);
          const abi_item =
            this.abi.get_intereted_abi_item_by_encoded_data(data);
          if (!abi_item) {
            callback(null, run_result.return_data);
          } else {
            const return_value_with_short_address =
              this.abi.refactor_return_value_with_short_address(
                run_result.return_data,
                abi_item,
                this.godwoker.getEthAddressByAllTypeShortAddress.bind(
                  this.godwoker
                )
              );
            callback(null, return_value_with_short_address);
          }
          break;
        } catch (error) {
          this.connected = false;
          throw error;
        }

      case "eth_estimateGas":
        try {
          var new_payload = payload;
          const { data } = params[0];

          const data_with_short_address =
            this.abi.refactor_data_with_short_address(
              data,
              this.godwoker.getShortAddressByAllTypeEthAddress.bind(
                this.godwoker
              )
            );

          new_payload.params[0].data = data_with_short_address;

          console.log(
            `provider just proxy an eth_estimateGas rpc call, data: ${data_with_short_address}`
          );
          super.send(new_payload, callback);
          break;
        } catch (error) {
          this.connected = false;
          throw error;
        }

      default:
        try {
          super.send(payload, callback);
          break;
        } catch (error) {
          this.connected = false;
          throw error;
        }
    }
  }
}

module.exports = PolyjuiceHttpProvider;
