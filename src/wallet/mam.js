import React, { Component } from 'react';
import styled from 'styled-components'
import Button from './comps/button'
import Input from './comps/input'

export default class F extends Component {

  constructor(){
    super()
    this.state={
      fundAmount:'',
      userId:null,
      message:''
    }
  }

  initializeMam = async () => {
    const {actions} = this.props
    const mam = await actions.initializeMam()
    console.log("returned",mam)
  }

  sendMamMessage = async () => {
    const {actions} = this.props
    const mamRoot = await actions.sendMamMessage(this.state.message)
    console.log('sentMamMessage', mamRoot)
    const res = await actions.fetchMamStream(mamRoot)
    console.log('fetchedMamStream', res)
  }

  render(){
    const {show, iota} = this.props
    const {message} = this.state
    const {mam} = iota
    return <Mam show={show}>  
      {!mam && <Content>
        <Info>
          Connect to MaM to send and receive encrypted messages.
        </Info>
        <Button title="Connect" active={false}
          onClick={this.initializeMam}
          disabled={false} />
      </Content>}
      {mam && <Content>
        <Info>
          MaM connected!
        </Info>
        <Wrap>
          <Input type="text" label="Send MaM Message"
            onChange={(e)=>this.setState({message:e.target.value})}
            value={message}
            width="50%" />
          <Button title="Commit" active={false}
            onClick={this.sendMamMessage} margin="7px 0 7px 14px"
            disabled={false} />
        </Wrap>
      </Content>}
    </Mam>
  }
}

const Mam = styled.div`
  position:absolute;
  height:128px;
  width:100%;
  top:42px;
  left:0;
  border-bottom:1px solid white;
  border-top:1px solid ${p=> p.isBalance ? 'white' : 'transparent'};
  background:#140061;
  z-index:99;
  background:##140061;
  transition: all .12s ease-in-out;
  transform: translateY(${p=> p.show ? '0px' : '-131px'});
  display:flex;
  flex-direction:column;
  justify-content:space-between;
`
const Info = styled.div`
  margin:15px;
  font-size:11px;
`
const Content = styled.div`
  padding:8px 16px;
`
const Wrap = styled.div`
  display:flex;
`
