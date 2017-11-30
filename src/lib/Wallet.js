import React, { Component } from 'react';
import iota from 'iota-engine'

class Wallet extends Component {

  constructor(){
    super()
    this.state={
      gettingBalance:false,
      balanceInputs:null,
      balance:null,
      gettingAddresses:false,
      addresses:null,
    }
  }

  componentDidMount = () => {
    if(!this.props.iota){
      iota.initClient()
      this.iota = iota
    } else {
      this.iota = this.props.iota
    }
  }

  // implement server-side
  getBalance = () => {
    this.setState({balance:null, gettingBalance:true})
    this.iota.getBalance(this.props.seed)
    .then(r=>{
      this.setState({balance:r.totalBalance, gettingBalance:false, balanceInputs:r.inputs})
    })
  }

  // implement server-side
  getAddresses = () => {
    this.setState({gettingAddresses:true})
    this.iota.createAddresses(this.props.seed, 10)
    .then(a=>{
      console.log(a)
      this.setState({addresses:a, gettingAddresses:false})
    })
  }

  sendIota = (amount, address, message, tag) => {
    this.setState({sendingIota:true})
    // implement createBundle server-side
    this.iota.createBundle(this.props.seed, amount, address, message, tag)
    .then((b)=>this.iota.isCorrectBundle(b))
    .then((b)=>this.iota.attachBundle(b))
    .then((r)=>{
      console.log(r)
      this.setState({sendingIota:false})
    })
  }

  render() {
    const {children} = this.props
    const childProps = {
      ...this.state,
      getBalance: this.getBalance,
      getAddresses: this.getAddresses,
      sendIota: this.sendIota
    }
    return (React.isValidElement(children) ?
      React.cloneElement(children,
      { ...childProps }
    ) : null)
  }

}

export default Wallet
