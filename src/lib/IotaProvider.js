import React, {Component} from 'react'
import iotaEngine from 'iota-engine'

/*

cat /dev/urandom |LC_ALL=C tr -dc 'A-Z9' | fold -w 81 | head -n 1 

seed 1: V9SLUPAIGRIMWZQFRRMZJSCVREPJWRGWWZUDWI9WRELTIHSVDHYNRGWWOFOJZVJXQGKGKSK9MLIBZSGFF
seed 2: MXYYKEHWREFHFXC9SWJVTBNPPIAUUUM9XUITFIJEQMITPVME9UBGTYFEMOLYJFQFNVOAAWYFDSMDBZSNL

changes to iota-enine
 - add seed into getBalance
 - add seed into createAddresses
 - add seed into createBundle
 - add the bundle into the resolve() of isCorrectBundle()


questions:
  the inputs from getInputs (createAddresses) do not have the same addresses, missing last digits
*/

class IotaProvider extends Component {

  componentDidMount() {
    iotaEngine.initClient('http://node05.iotatoken.nl:16265')
  }

  render() {
    const {children} = this.props
    return <div>
      {React.isValidElement(children) ?
        React.cloneElement(children,
        { iota: iotaEngine }
      ) : null}
    </div>
  }

}

export default IotaProvider